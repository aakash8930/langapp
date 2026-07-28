import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobsService } from '../jobs/jobs.service';
import { JOB_LEAGUE_SETTLE } from '../jobs/queues';
import { UserService } from '../user/user.service';
import { isoWeek, weekEndsAt } from '../user/gamification/week';
import {
  LEAGUE_TIERS,
  MIN_TIER_SIZE_TO_SETTLE,
  PROMOTION_COUNT,
  settleJobId,
  settleTier,
  tierName,
} from './leagues';
import { LeagueStanding, LeagueStandingDocument } from './schemas/league-standing.schema';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string;
  weeklyXp: number;
  /** True for the learner who asked, so a client can highlight the row. */
  isYou: boolean;
}

export interface Leaderboard {
  week: string;
  /** When this week's competition closes, so a client can count down. */
  endsAt: string;
  tier: number;
  tierName: string;
  /** How many tiers exist, for "3 of 6" style display. */
  tierCount: number;
  rows: LeaderboardRow[];
  /** The asking learner's own rank, even if their row is off the end. */
  yourRank: number | null;
  /**
   * How many go up when the week closes; zero in a tier too small. Promotion-
   * only since Phase 2 §3.2 — nobody goes down for finishing last any more.
   */
  promotionCount: number;
  /**
   * Always zero — kept on the response so the client can branch on "is
   * relegation a thing here" without a schema change later if it ever comes
   * back. Costs nothing; protects the contract.
   */
  relegationCount: 0;
  /**
   * Whether the viewer themselves has the weekly leaderboard switched on.
   * An opted-out viewer sees an empty `rows` and the client renders an opt-in
   * card. A viewer who is opted in still does not see opted-out peers —
   * `rows` is filtered either way.
   */
  optedIn: boolean;
}

/**
 * The weekly league table.
 *
 * Ranking is by **UTC week**, not the learner's local week — see
 * `gamification/week.ts` for why a competitive board needs one shared clock when
 * everything else in this app is deliberately local.
 */
@Injectable()
export class LeagueService {
  private readonly logger = new Logger(LeagueService.name);

  constructor(
    @InjectModel(LeagueStanding.name)
    private readonly standingModel: Model<LeagueStandingDocument>,
    private readonly userService: UserService,
    private readonly jobs: JobsService,
  ) {}

  async leaderboard(viewerId: string, now: Date = new Date()): Promise<Leaderboard> {
    const viewer = await this.userService.findById(viewerId);
    if (!viewer) {
      throw new NotFoundException('User not found');
    }

    // Settlement is off the request path (ADR-006). This enqueues rather than
    // settles, so the response below reads the viewer's tier as it stands right
    // now: if this request is the one that discovered the week had closed, the
    // board it returns is the pre-promotion one and the next read shows the
    // move. `LeagueSettleScheduler` is what keeps that from being the normal
    // case — it settles at 00:05 UTC Monday, before anyone looks — and this
    // path is the safety net for a Stage A laptop that was asleep then.
    //
    // `jobId` is the dedup: every leaderboard read reaches this line, and
    // without it a busy Monday would queue one settlement per viewer. Keyed on
    // the week being settled, so concurrent readers coalesce onto one job. See
    // `settleJobId` for why the id is built by a helper. Enqueued regardless of
    // the viewer's opt-in — promotion has to run for the whole tier, and the
    // viewer here is only whoever happened to ask.
    const closingWeek = isoWeek(new Date(now.getTime() - 7 * 86_400_000));
    await this.jobs.enqueue(
      JOB_LEAGUE_SETTLE,
      { now: now.toISOString() },
      { jobId: settleJobId(closingWeek) },
    );

    const tier = viewer.gamification.leagueTier;
    const viewerOptedIn = viewer.settings.leaderboardOptIn;

    const members = await this.userService.findByLeagueTier(tier);

    // Opt-in (§3.2): the table only contains opted-in learners, and an opted-
    // out viewer sees an empty `rows` rather than a board with their own row
    // missing. The viewer being themselves in the tier is irrelevant — they
    // never appear when opted out.
    const visibleMembers = viewerOptedIn
      ? members.filter((member) => member.settings.leaderboardOptIn)
      : [];

    const rows = visibleMembers
      .map((member) => ({
        userId: member._id.toString(),
        displayName: member.profile.displayName,
        // Corrected on read — a member who has not earned since last week still
        // holds last week's number in the document.
        weeklyXp: this.userService.weeklyXpFor(member, now),
      }))
      .sort(byXpThenName)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        isYou: row.userId === viewerId,
      }));

    const yours = rows.find((row) => row.isYou);
    const settleable = rows.length >= MIN_TIER_SIZE_TO_SETTLE;

    return {
      week: isoWeek(now),
      endsAt: weekEndsAt(now).toISOString(),
      tier,
      tierName: tierName(tier),
      tierCount: LEAGUE_TIERS.length,
      rows,
      yourRank: yours?.rank ?? null,
      // Reported as zero rather than hidden when the tier is too small, so a
      // client can say "too few players to promote this week" instead of
      // promising movement that will not happen.
      promotionCount: settleable ? PROMOTION_COUNT : 0,
      relegationCount: 0,
      optedIn: viewerOptedIn,
    };
  }

  /**
   * Close out any week that has ended and not yet been settled.
   *
   * Idempotent because the unique index on `{week, tier}` means exactly one
   * concurrent caller can insert the snapshot — the loser catches the duplicate
   * key and does nothing, rather than settling a second time and promoting
   * everyone twice.
   *
   * Only the **immediately preceding** week is settled. A gap of several
   * unsettled weeks would need last week's totals, which the reset has already
   * destroyed; settling those from current numbers would promote anyone who
   * happened to be quietly earning through the gap. Skipping them is the honest
   * outcome — see the note in OPEN-ITEMS.
   *
   * Called from `LeagueSettleProcessor`; the public surface is intentional
   * (ADR-006, M1) so the worker can drive it. The unit tests pin the
   * promotion-only and dedup behaviour, so changing the body is fine; changing
   * the contract requires a test change too.
   */
  async settleClosedWeeks(now: Date): Promise<void> {
    const previous = isoWeek(new Date(now.getTime() - 7 * 86_400_000));
    const current = isoWeek(now);
    if (previous === current) {
      return;
    }

    for (let tier = 0; tier < LEAGUE_TIERS.length; tier++) {
      try {
        await this.settleTierForWeek(tier, previous);
      } catch (err) {
        // One tier failing must not stop the others, and must never fail the
        // request that happened to trigger settlement — the learner asked for a
        // leaderboard, not to run the scheduler.
        this.logger.warn(
          `league settle failed for tier ${tier} week ${previous}: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async settleTierForWeek(tier: number, week: string): Promise<void> {
    const existing = await this.standingModel.findOne({ week, tier }).select('_id').exec();
    if (existing) {
      return;
    }

    const members = await this.userService.findByLeagueTier(tier);
    if (members.length === 0) {
      return;
    }

    const ranked = members
      .map((member) => ({
        userId: member._id,
        displayName: member.profile.displayName,
        // The week being settled is the one whose totals are still stored — a
        // member who has already earned in the *new* week has had their counter
        // reset, and reads as 0 for the old one. That is correct: their old
        // total is genuinely gone, and this is why settling more than one week
        // late is refused rather than guessed at.
        weeklyXp:
          member.gamification.weeklyXpWeek === week ? member.gamification.weeklyXp : 0,
      }))
      .sort(byXpThenName)
      .map((row, index) => {
        const rank = index + 1;
        return {
          ...row,
          rank,
          movedTo: settleTier({ tier, rank, size: members.length, weeklyXp: row.weeklyXp }),
        };
      });

    // Claim the week first. If this throws a duplicate key, another request beat
    // us to it and has already moved everyone — doing it again would promote
    // them twice.
    await this.standingModel.create({ week, tier, rows: ranked });

    for (const row of ranked) {
      if (row.movedTo !== tier) {
        await this.userService.setLeagueTier(row.userId.toString(), row.movedTo);
      }
    }

    this.logger.log(
      `Settled ${tierName(tier)} for ${week}: ${ranked.length} players, ` +
        `${ranked.filter((r) => r.movedTo > tier).length} promoted`,
    );
  }
}

/**
 * Most XP first, then name, so the order is **total** rather than
 * arbitrary — two people on the same XP would otherwise swap places between two
 * reads of the same table, which looks like a bug to whoever is watching.
 */
function byXpThenName(
  a: { weeklyXp: number; displayName: string },
  b: { weeklyXp: number; displayName: string },
): number {
  if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
  return a.displayName.localeCompare(b.displayName);
}
