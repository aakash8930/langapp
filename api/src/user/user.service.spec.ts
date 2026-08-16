import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserDocument } from './schemas/user.schema';
import { UserService } from './user.service';

const USER_ID = '607f1f77bcf86cd799439011';

/**
 * Covers `awardXp` — where the streak rules from gamification/streak.ts meet
 * the actual writes. streak.spec.ts proves the arithmetic; this proves the
 * right update reaches Mongo, in particular that `todayXp` is *reset* rather
 * than incremented when the local day turns.
 */
interface Stored {
  xp: number;
  streakDays: number;
  lastStudyDate: string | null;
  todayXp: number;
  tz: string;
  weeklyXp: number;
  /** Defaults to the ISO week of NOW, so the common path is "same week". */
  weeklyXpWeek: string | null;
}

interface Harness {
  service: UserService;
  findOneAndUpdate: jest.Mock;
  findByIdAndUpdate: jest.Mock;
}

function build(stored: Partial<Stored> = {}, opts: { rollLosesRace?: boolean } = {}): Harness {
  const state: Stored = {
    xp: 100,
    streakDays: 3,
    lastStudyDate: '2026-07-18',
    todayXp: 40,
    tz: 'Asia/Kolkata',
    weeklyXp: 120,
    weeklyXpWeek: '2026-W29',
    ...stored,
  };

  const doc = {
    gamification: {
      xp: state.xp,
      streakDays: state.streakDays,
      lastStudyDate: state.lastStudyDate,
      todayXp: state.todayXp,
      weeklyXp: state.weeklyXp,
      weeklyXpWeek: state.weeklyXpWeek,
    },
    settings: { tz: state.tz },
  } as unknown as UserDocument;

  const findOneAndUpdate = jest.fn(() => ({
    // null models "another request already rolled the day" — the guard on
    // lastStudyDate matched nothing.
    exec: () => Promise.resolve(opts.rollLosesRace ? null : doc),
  }));
  const findByIdAndUpdate = jest.fn(() => ({ exec: () => Promise.resolve(doc) }));

  const userModel = {
    findById: () => ({ exec: () => Promise.resolve(doc) }),
    findOneAndUpdate,
    findByIdAndUpdate,
  };

  return { service: new UserService(userModel as never), findOneAndUpdate, findByIdAndUpdate };
}

/** The `$inc`/`$set` payload handed to Mongo. */
function updateArg(mock: jest.Mock, call = 0): Record<string, Record<string, unknown>> {
  // findOneAndUpdate takes (filter, update, opts); findByIdAndUpdate (id, update, opts).
  return mock.mock.calls[call][1] as Record<string, Record<string, unknown>>;
}

describe('UserService.awardXp', () => {
  // 12:00Z is 17:30 in Kolkata — comfortably mid-day, so the test doesn't
  // depend on which side of midnight UTC happens to be.
  const NOW = new Date('2026-07-19T12:00:00Z');

  it('accumulates XP without touching the streak on a repeat action the same day', async () => {
    const { service, findByIdAndUpdate, findOneAndUpdate } = build({
      lastStudyDate: '2026-07-19',
    });

    await service.awardXp(USER_ID, 10, NOW);

    // No day roll, so the guarded update must not fire at all.
    expect(findOneAndUpdate).not.toHaveBeenCalled();

    const update = updateArg(findByIdAndUpdate);
    // Every counter increments; nothing resets and no streak field is written.
    // The weekly counter rides along because the stored week matches NOW's.
    expect(update.$inc).toEqual({
      'gamification.xp': 10,
      'gamification.todayXp': 10,
      'gamification.weeklyXp': 10,
    });
    expect(update.$set).toEqual({ 'gamification.weeklyXpWeek': '2026-W29' });
  });

  it('rolls the streak and restarts todayXp on the first action of a new day', async () => {
    const { service, findOneAndUpdate } = build({
      lastStudyDate: '2026-07-18',
      streakDays: 3,
      todayXp: 40,
    });

    await service.awardXp(USER_ID, 10, NOW);

    const [filter, update] = findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, Record<string, unknown>>,
    ];

    // Guarded on the value we read, so two concurrent first-actions can't both
    // advance the streak.
    expect(filter['gamification.lastStudyDate']).toBe('2026-07-18');

    expect(update.$inc).toEqual({
      'gamification.xp': 10,
      // The stored week already matches, so this accumulates rather than resets.
      'gamification.weeklyXp': 10,
    });
    expect(update.$set).toEqual({
      'gamification.streakDays': 4,
      'gamification.lastStudyDate': '2026-07-19',
      // The critical bit: yesterday's 40 is replaced, not added to.
      'gamification.todayXp': 10,
      'gamification.weeklyXpWeek': '2026-W29',
    });
  });

  it('resets the streak to 1 when the user skipped a day', async () => {
    const { service, findOneAndUpdate } = build({ lastStudyDate: '2026-07-17', streakDays: 9 });

    await service.awardXp(USER_ID, 10, NOW);

    expect(updateArg(findOneAndUpdate).$set!['gamification.streakDays']).toBe(1);
  });

  it('applies only the XP when it loses the race to roll the day', async () => {
    const { service, findByIdAndUpdate } = build(
      { lastStudyDate: '2026-07-18' },
      { rollLosesRace: true },
    );

    await service.awardXp(USER_ID, 10, NOW);

    // The winner already set the streak and date correctly; re-setting them
    // here would double-count the day.
    const update = updateArg(findByIdAndUpdate);
    expect(update.$inc).toEqual({
      'gamification.xp': 10,
      'gamification.todayXp': 10,
      'gamification.weeklyXp': 10,
    });
    // The week is re-stamped rather than reset — the winner already rolled it.
    expect(update.$set).toEqual({ 'gamification.weeklyXpWeek': '2026-W29' });
  });

  /**
   * The weekly counter rolls on a **UTC week**, the daily one on the learner's
   * **local day**. They are independent, and this is the case that proves it:
   * same local day, but the stored week is last week's.
   */
  it('restarts the weekly counter when the UTC week has turned but the day has not', async () => {
    const { service, findByIdAndUpdate } = build({
      lastStudyDate: '2026-07-19',
      weeklyXp: 300,
      weeklyXpWeek: '2026-W28',
    });

    await service.awardXp(USER_ID, 10, NOW);

    const update = updateArg(findByIdAndUpdate);
    // Daily still accumulates; weekly is replaced, not added to.
    expect(update.$inc).toEqual({ 'gamification.xp': 10, 'gamification.todayXp': 10 });
    expect(update.$set).toEqual({
      'gamification.weeklyXp': 10,
      'gamification.weeklyXpWeek': '2026-W29',
    });
  });

  it('restarts both counters when the day and the week turn together', async () => {
    const { service, findOneAndUpdate } = build({
      lastStudyDate: '2026-07-18',
      weeklyXp: 300,
      weeklyXpWeek: '2026-W28',
    });

    await service.awardXp(USER_ID, 10, NOW);

    const update = updateArg(findOneAndUpdate);
    expect(update.$inc).toEqual({ 'gamification.xp': 10 });
    expect(update.$set).toEqual(
      expect.objectContaining({
        'gamification.todayXp': 10,
        'gamification.weeklyXp': 10,
        'gamification.weeklyXpWeek': '2026-W29',
      }),
    );
  });

  it('uses the learner own timezone to decide what "today" is', async () => {
    // 20:00Z is already the 19th in Kolkata but still the 18th in UTC. A user
    // who last studied on their local 18th is starting a new day right now.
    const eveningUtc = new Date('2026-07-18T20:00:00Z');
    const { service, findOneAndUpdate } = build({ lastStudyDate: '2026-07-18', streakDays: 3 });

    await service.awardXp(USER_ID, 10, eveningUtc);

    const set = updateArg(findOneAndUpdate).$set!;
    expect(set['gamification.lastStudyDate']).toBe('2026-07-19');
    expect(set['gamification.streakDays']).toBe(4);
  });

  it('rejects a negative or fractional award before writing anything', async () => {
    const { service, findByIdAndUpdate, findOneAndUpdate } = build();

    await expect(service.awardXp(USER_ID, -5, NOW)).rejects.toThrow(BadRequestException);
    await expect(service.awardXp(USER_ID, 1.5, NOW)).rejects.toThrow(BadRequestException);

    expect(findByIdAndUpdate).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('throws NotFound when the user is gone', async () => {
    const userModel = { findById: () => ({ exec: () => Promise.resolve(null) }) };
    const service = new UserService(userModel as never);

    await expect(service.awardXp(USER_ID, 10, NOW)).rejects.toThrow(NotFoundException);
  });
});

describe('UserService.todayXpFor', () => {
  const doc = (lastStudyDate: string | null, todayXp: number): UserDocument =>
    ({
      gamification: { lastStudyDate, todayXp },
      settings: { tz: 'Asia/Kolkata' },
    }) as unknown as UserDocument;

  const service = new UserService({} as never);
  const NOW = new Date('2026-07-19T12:00:00Z');

  it('returns the stored counter when it belongs to today', () => {
    expect(service.todayXpFor(doc('2026-07-19', 30), NOW)).toBe(30);
  });

  it('returns 0 once the local day has turned', () => {
    // Nothing rewrites todayXp until the next award, so the read path — not
    // the write path — is what stops yesterday's 30 being shown as today's.
    expect(service.todayXpFor(doc('2026-07-18', 30), NOW)).toBe(0);
  });

  it('returns 0 for a user who has never studied', () => {
    expect(service.todayXpFor(doc(null, 0), NOW)).toBe(0);
  });
});

/**
 * `updateSettings` writes dotted paths so a partial patch leaves its siblings
 * alone. The case worth pinning is `dailyGoalXp`, which is the one field on the
 * settings DTO that does *not* live under `settings` — it belongs to
 * gamification, because that is where /me/progress reads it from.
 */
describe('UserService.updateSettings', () => {
  it('writes the daily goal to gamification, not settings', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateSettings(USER_ID, { dailyGoalXp: 120 });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({
      'gamification.dailyGoalXp': 120,
    });
  });

  it('accepts system as a theme', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateSettings(USER_ID, { theme: 'system' });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({ 'settings.theme': 'system' });
  });

  it('patches only what was sent, so one setting never clobbers another', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateSettings(USER_ID, { theme: 'dark', dailyGoalXp: 20 });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({
      'settings.theme': 'dark',
      'gamification.dailyGoalXp': 20,
    });
  });

  it('rejects an unknown time zone before writing anything', async () => {
    const { service, findByIdAndUpdate } = build();

    await expect(
      service.updateSettings(USER_ID, { tz: 'Mars/Olympus_Mons' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  /**
   * Phase 2 §3.2 — the leaderboard opt-in lives on `settings`, and the patch
   * path is the way a client flips it. Worth pinning so a refactor that moves
   * the field cannot silently drop it from the surface.
   */
  it('writes the leaderboard opt-in to settings.leaderboardOptIn', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateSettings(USER_ID, { leaderboardOptIn: true });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({
      'settings.leaderboardOptIn': true,
    });
  });
});

describe('UserService.updateOnboarding', () => {
  it('makes the reminder opt-in effective for the worker-facing setting', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateOnboarding(USER_ID, { notificationsEnabled: true });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({
      'onboardingState.notificationsEnabled': true,
      'notificationSettings.studyReminders': true,
    });
  });

  it('rejects completion until the required personalization fields exist', async () => {
    const { service, findByIdAndUpdate } = build();

    await expect(
      service.updateOnboarding(USER_ID, { onboardingComplete: true }),
    ).rejects.toThrow(/starting level/);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('allows completion when the final request supplies every required answer', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateOnboarding(USER_ID, {
      proficiencyLevel: 'beginner',
      learningGoals: ['conversation'],
      learningStyle: 'mixed',
      preferredStudyTime: 'evening',
      onboardingComplete: true,
    });

    expect(updateArg(findByIdAndUpdate).$set).toMatchObject({
      'onboardingState.proficiencyLevel': 'beginner',
      'onboardingState.learningGoals': ['conversation'],
      'onboardingState.learningStyle': 'mixed',
      'onboardingState.preferredStudyTime': 'evening',
      'onboardingState.onboardingComplete': true,
    });
  });

  it('rejects attempts to reverse completed onboarding', async () => {
    const { service, findByIdAndUpdate } = build();

    await expect(
      service.updateOnboarding(USER_ID, { onboardingComplete: false }),
    ).rejects.toThrow(/cannot be reversed/);
    expect(findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps reminders off when the learner declines', async () => {
    const { service, findByIdAndUpdate } = build();

    await service.updateOnboarding(USER_ID, { notificationsEnabled: false });

    expect(updateArg(findByIdAndUpdate).$set).toEqual({
      'onboardingState.notificationsEnabled': false,
      'notificationSettings.studyReminders': false,
    });
  });
});

describe('UserService.weeklyXpFor', () => {
  const doc = (weeklyXpWeek: string | null, weeklyXp: number): UserDocument =>
    ({ gamification: { weeklyXpWeek, weeklyXp } }) as unknown as UserDocument;

  const service = new UserService({} as never);
  // A Wednesday in 2026-W30.
  const NOW = new Date('2026-07-22T12:00:00Z');

  it('returns the stored counter when it belongs to this week', () => {
    expect(service.weeklyXpFor(doc('2026-W30', 250), NOW)).toBe(250);
  });

  /**
   * Without this, the first leaderboard read after a Monday would rank everyone
   * by last week's totals — nothing rewrites a row until its owner earns again.
   */
  it('returns 0 once the UTC week has turned', () => {
    expect(service.weeklyXpFor(doc('2026-W29', 250), NOW)).toBe(0);
  });

  it('returns 0 for someone who has never earned any', () => {
    expect(service.weeklyXpFor(doc(null, 0), NOW)).toBe(0);
  });
});
