# Phase 0 Engineering Blueprint

**AI-native language platform — how it works internally**
Working name: TBD · Stack: NestJS · TypeScript · MongoDB · Redis · Companion to the v3 product blueprint

---

## How to read this document

The v3 HTML describes *what* the platform contains. This describes *how the part you build first actually works* — enough to open an editor and start.

The reviewer's seven asks (orchestration, data model, AI pipeline, service boundaries, business layer, deployment, security) really belong to two different documents:

- **The build spec** — the data model, one real request flow, the module seams you draw now, the SRS, and the cost math. For you, this week.
- **The scale/pitch spec** — full microservices, event bus, deployment topology, GDPR tooling, marketplace economics, API licensing. Real, but for a funded team or a product with traction.

This is the first one. Where the second one's concerns show up, they're marked **[Later]** and left as a stub. Building for them now is the single most common way a solo project dies before it ships anything.

---

## 1. Requirements & constraints

**Functional (Phase 0 only).** A single learner can: sign up and log in; work through Hiragana → Katakana → basic vocabulary → basic grammar lessons; review due items via SRS; hold one AI conversation (text first, voice optional); and see XP, a streak, and progress. Japanese only. One platform, web + mobile.

**Non-functional.** One developer. Ship a usable vertical slice in weeks, not quarters. Low *fixed* monthly cost. **Variable AI cost per active user must be known and bounded** — this is the constraint that shapes the most decisions. Latency on an AI turn should feel conversational (a few seconds), not instant.

**Constraints.** Solo build on your existing stack. No ops team, so managed services over self-hosted anything **at launch** — but testing runs at ₹0 on your own machine first (§11 Stage A). Thin budget, so no idle microservice fleet.

Everything below follows from those. If any of them is wrong, tell me and the design shifts.

---

## 2. ADR-001 — Modular monolith, not microservices

**Status:** Proposed · **Date:** 2026-07 · **Decider:** you

### Context
The v3 stack diagram and the last review both imply a service-per-box split (Auth, User, Learning Engine, Knowledge Graph, AI Orchestrator, Lesson, Dictionary, Media, Analytics, Marketplace, Notifications). That's a good *logical* decomposition. As a *deployment* topology on day one, for one developer, it's a trap: you'd spend your first month on inter-service auth, network retries, distributed tracing, and eleven deploy pipelines — before a single learner has reviewed a single flashcard.

### Decision
Build one NestJS application, internally divided into modules whose boundaries match those future services. Extract a module into its own service **only when a real force demands it** (independent scaling, a separate team, a language-specific runtime). The seams are logical now, physical later.

### Options considered

| Option | Complexity | Cost (fixed) | Time to first ship | Right when |
|---|---|---|---|---|
| A. Microservices | High | High (many always-on services) | Slow | You have a team and proven load |
| B. **Modular monolith** | **Low–Med** | **Low (one deployable)** | **Fast** | **Solo dev, pre-traction — you** |
| C. Big-ball-of-mud monolith | Low now, High later | Low | Fast | Never, if you plan to grow |

### Consequences
- **Easier:** local dev, one deploy, one log stream, refactoring across boundaries, shipping.
- **Harder later:** you must keep module boundaries honest (no reaching into another module's collections directly — go through its service class). Discipline now is what makes extraction cheap later.
- **Revisit when:** the AI Orchestrator's CPU/GPU or latency profile diverges from the CRUD app, or content authoring becomes a separate team. That's the first service to peel off.

---

## 3. High-level architecture (Phase 0)

```
   Web (Next.js)      Mobile (Flutter)
          \               /
           \             /
        ┌───────────────────┐
        │   API (NestJS)    │   one deployable, modular inside
        │                   │
        │  Auth  User  Learning  KnowledgeGraph        │
        │  AIOrchestrator  Content  Chat  Analytics    │
        └───────────────────┘
              │        │         │
        ┌─────┘        │         └───────────┐
        ▼              ▼                      ▼
   ┌─────────┐   ┌──────────┐        ┌────────────────┐
   │ MongoDB │   │  Redis   │        │  AI providers  │
   │         │   │ cache +  │        │  LLM / STT /   │
   │         │   │  queue   │        │  TTS           │
   └─────────┘   └──────────┘        └────────────────┘
                                            │
                                      ┌───────────┐
                                      │  Object   │
                                      │  storage  │  audio, media
                                      └───────────┘
```

The same shape runs in both deployment stages — local Docker during testing, managed services at launch (§11). Only the addresses change.

Redis does three jobs: response/prompt cache, session/rate-limit store, and a lightweight job queue (BullMQ) for anything that shouldn't block a request — analytics writes, memory updates, TTS pre-generation.

---

## 4. Module boundaries (the seams)

Each NestJS module owns its own collections and exposes a service class. Other modules call the service, never the collections. That single rule is what lets any row in the last column become a real service later without a rewrite.

| Module | Owns | Phase 0 reality | Future service |
|---|---|---|---|
| **Auth** | credentials, sessions, tokens | Full | Auth |
| **User** | user, profile, settings | Full | User |
| **Learning** | lessons progress, SRS cards, XP, streak | Full — the core | Learning Engine |
| **KnowledgeGraph** | concept nodes + edges | **Thin** — nodes for vocab/grammar/kanji + prerequisite edges | Knowledge Graph |
| **Content** | vocab, grammar, kanji, lesson definitions | Full (Japanese pack) | Lesson + Dictionary |
| **AIOrchestrator** | prompt assembly, provider calls, pipeline | Full for chat; agents stubbed | AI Orchestrator |
| **Chat** | chat sessions, messages | Full (text; voice optional) | (part of AI) |
| **Analytics** | append-only event log | Full (write path only) | Analytics |
| Notifications | reminders | **[Later]** — stub | Notifications |
| Media | audio storage refs | Thin — just storage keys | Media |
| Marketplace | — | **[Later]** — none | Marketplace |

"Agents" (grammar, pronunciation, kanji…) from the v3 Learning Brain are **not** separate services in Phase 0. They're prompt strategies inside AIOrchestrator — a `role` and a system prompt. Promote one to its own component only when its logic outgrows a prompt.

---

## 5. Data model (MongoDB)

Modeling rules used below: **embed** what's read together and bounded (profile in user); **reference** what's high-cardinality or append-heavy (reviews, events, messages); keep **content** (shared, language-pack-scoped) separate from **per-user state**.

```typescript
// users — embed profile & settings; they're always read with the user
interface User {
  _id: ObjectId;
  email: string;
  passwordHash: string;          // argon2id
  createdAt: Date;
  profile: {
    displayName: string;
    nativeLanguage: string;
    activeTrack: 'ja';           // language pack in progress
  };
  gamification: {
    xp: number;
    streakDays: number;
    lastStudyDate: string;       // 'YYYY-MM-DD' in user's tz
    dailyGoalXp: number;
  };
  settings: { audioSpeed: number; theme: 'light'|'dark'; tz: string };
}

// content: vocab / grammar / kanji — shared, immutable-ish, language-scoped
interface VocabItem {
  _id: ObjectId;
  lang: 'ja';
  lemma: string;                 // 食べる
  reading: string;               // たべる
  gloss: string;                 // to eat
  pos: string;                   // verb
  jlpt: 'N5'|'N4'|'N3'|'N2'|'N1';
  tags: string[];                // ['food','common']
  conceptId: ObjectId;           // -> knowledgeNodes
}
interface GrammarPoint { _id: ObjectId; lang: 'ja'; title: string; jlpt: string; explanation: string; conceptId: ObjectId; }
interface KanjiEntry  { _id: ObjectId; lang: 'ja'; char: string; on: string[]; kun: string[]; meanings: string[]; strokes: number; radical: string; jlpt: string; conceptId: ObjectId; }

// lessons — an ordered set of items + an exercise recipe
interface Lesson {
  _id: ObjectId;
  lang: 'ja';
  unit: string;                  // 'hiragana-a-row'
  order: number;
  title: string;
  itemRefs: { kind: 'vocab'|'grammar'|'kanji'|'kana'; id: ObjectId }[];
  exerciseTypes: string[];       // ['multipleChoice','listenType','match']
  prerequisiteLessonIds: ObjectId[];
}

// THE THIN KNOWLEDGE GRAPH — adjacency lists in two collections
interface KnowledgeNode {
  _id: ObjectId;
  lang: 'ja';
  kind: 'vocab'|'grammar'|'kanji'|'kana';
  refId: ObjectId;               // -> the content doc
  label: string;
}
interface KnowledgeEdge {
  _id: ObjectId;
  from: ObjectId;                // KnowledgeNode
  to: ObjectId;
  type: 'prerequisite'|'contains'|'related'|'usesKanji';
}

// per-user LEARNING STATE — one SRS card per (user, item)
interface SrsCard {
  _id: ObjectId;
  userId: ObjectId;
  itemRef: { kind: string; id: ObjectId };
  // FSRS state (see §6)
  stability: number;
  difficulty: number;
  due: Date;
  lastReview: Date | null;
  reps: number;
  lapses: number;
  state: 'new'|'learning'|'review'|'relearning';
}
// index: { userId: 1, due: 1 }  -> "give me this user's due cards" is the hottest query

// CHAT
interface ChatSession { _id: ObjectId; userId: ObjectId; scenario: string; startedAt: Date; }
interface ChatMessage {
  _id: ObjectId;
  sessionId: ObjectId;
  role: 'user'|'assistant';
  text: string;
  audioKey?: string;             // object-storage key, not the bytes
  corrections?: { span: string; fix: string; note: string }[];
  createdAt: Date;
}

// ANALYTICS — append-only, write-heavy, never updated
interface Event {
  _id: ObjectId;
  userId: ObjectId;
  type: string;                  // 'lesson.completed', 'review.graded', 'chat.turn'
  payload: Record<string, unknown>;
  ts: Date;
}
// index: { userId: 1, ts: -1 }
```

**On the graph in MongoDB.** Mongo isn't a graph database, but at Phase 0 scale an adjacency-list (nodes + edges collections) answers everything you need — "what are the prerequisites of X", "what contains kanji Y" — with one indexed lookup or a `$graphLookup` for shallow traversal. **Revisit** only if traversals get deep and hot; then a dedicated graph store is the extraction. Don't start there.

---

## 6. The SRS (this is the core of Phase 0, and no review specifies it)

Everything else is UI around this loop. Use **FSRS** (Free Spaced Repetition Scheduler) over the older SM-2 — it schedules from a stability/difficulty model that measurably improves retention per review, and there's a maintained TypeScript library (`ts-fsrs`) so you're not implementing the math yourself.

Per review, the flow is:

```
user grades recall (again / hard / good / easy)
        ↓
ts-fsrs.next(card, now, grade)  ->  new {stability, difficulty, due, state}
        ↓
persist SrsCard  ·  award XP  ·  emit 'review.graded' event (async)
```

The only query that has to be fast is *"fetch this user's due cards"* — `{ userId, due: { $lte: now } }` against the compound index above. Cap a session (e.g. 20 cards) so it's bounded. That's the whole engine.

---

## 7. AI orchestration — one real flow, end to end

The reviewer's generic pipeline (understand → retrieve → reason → generate → evaluate → personalize → store) is right, but it only becomes buildable when pinned to one feature. Here is **an AI conversation turn**, which is the most complex path and therefore the one worth specifying:

```
[1] user sends text  (or voice -> STT -> text)          UNDERSTAND
[2] load context:                                        RETRIEVE
      - recent messages in session (Chat)
      - learner level + recent weak items (Learning)
      - relevant vocab/grammar for the scenario (KnowledgeGraph)
[3] assemble prompt: system role for scenario + level    REASON
      cap history; inject 5-10 target words, not the DB
[4] call LLM (conversation model) -> reply               GENERATE
[5] correction pass (cheap model / same call):           EVALUATE
      extract {span, fix, note} for the user's errors
[6] return reply (+ corrections). voice? -> TTS          PERSONALIZE
[7] async (queue, non-blocking):                         STORE
      - append messages
      - update memory: which items were used/missed
      - emit 'chat.turn' event
      - schedule missed words into SRS
```

Two things make this affordable and responsive:

- **Steps 4 and 5 use different models.** A stronger model for the conversation; a cheap, fast one (Haiku-class — you already run Anthropic models through MaSTeR) for correction extraction, routing, and any "which agent" decision. Never pay premium tokens for classification.
- **Step 7 is off the request path.** The user gets their reply immediately; memory, analytics, and SRS scheduling happen in a Redis/BullMQ job. If that job fails, the conversation is unaffected.

The "agents" are step-3 prompt variants, not services. Routing to the right one is a cheap-model classification, cached by scenario.

---

## 8. Cost model — the number that decides whether this is a business

This is the honest core, and it's why the cost constraint drove §7. **Voice AI cost per user can quietly exceed what a language-app subscription earns.** You must model it before you build voice, not after.

Per conversation turn (voice), you pay for three things:

```
cost/turn ≈ STT(seconds of user speech)
          + LLM(input tokens + output tokens)
          + TTS(characters spoken back)

cost/user/month ≈ cost/turn × turns/session × sessions/month
```

**Worked example — illustrative rates, verify current provider pricing before trusting any absolute number.** Assume a turn is ~10s of speech in, ~1.5k input tokens (history + context), ~200 output tokens, ~300 TTS chars. Assume an engaged user does ~15 turns/session, ~15 sessions/month ≈ **225 voice turns/month**.

The point is not the exact figure — it's the **shape**: with those assumptions, voice is dominated by STT + TTS, and a heavy free user on voice can cost more per month than a typical ~$8–12 subscription would bring in. That inverts your unit economics if the free tier includes unlimited voice.

**The levers (design these in from day one):**

- **Text chat is ~an order of magnitude cheaper than voice** (no STT/TTS). Make text the default; make voice a metered premium.
- **Cap the free tier** — e.g. text chat + N voice turns/day. This is a product decision forced by §8, not a growth-hacking afterthought.
- **Cache aggressively** — TTS for fixed phrases, prompt prefixes, scenario setups.
- **Cheap model for everything that isn't the actual tutoring sentence** (§7).
- **Trim context** — inject 5–10 targeted items, never dump the graph into the prompt. Input tokens are a cost you control.

Build the model in a spreadsheet, plug in *current* rates, and set the free-tier caps from it. I can pull live pricing and fill this in with real numbers if you want.

**During testing (§11 Stage A) this can be ₹0.** With only you and a few friends, a provider free tier (Gemini, Groq) covers the traffic, or you run fully local — Ollama for the LLM, whisper.cpp for STT, Piper for TTS. Quality is lower and your laptop does the work, but nothing is billed. Use the free window to *measure real token and audio volume per session*, then plug those measured numbers into the model above instead of guessing. That's the cheapest way to get a trustworthy cost forecast.

---

## 9. API surface (Phase 0)

Keep it small and REST. Illustrative:

```
POST /auth/register            POST /auth/login            POST /auth/refresh
GET  /me                       PATCH /me/settings
GET  /lessons?unit=            GET  /lessons/:id
POST /lessons/:id/complete     -> awards XP, seeds SRS cards
GET  /reviews/due              POST /reviews/:cardId/grade
POST /chat/sessions            POST /chat/sessions/:id/messages
GET  /me/progress
```

---

## 10. Security & privacy

**Phase 0 (do now):**
- Auth: argon2id password hashing; short-lived JWT access + rotating refresh tokens; refresh tokens revocable in Redis.
- Transport: TLS everywhere (your PaaS/CDN handles it).
- At rest: **Stage A** — your laptop's disk encryption (BitLocker) is the whole story; **Stage B** — managed encryption (Atlas encrypts at rest by default). Don't roll your own either way.
- **Backups are yours in Stage A.** No managed provider is doing this for you. Nightly `mongodump` to a cloud-synced folder, from day one (§11).
- **PII inventory** — write down exactly what you store: email, chat transcripts, and (if voice) audio. Know where each lives.
- **Minimize voice data** — prefer storing the *transcript*, not the raw audio. If you must keep audio, store it in object storage behind signed URLs with a short retention window, never in the DB.
- Secrets in the platform's secret manager / env, never in the repo.
- Basic rate limiting (Redis) on auth and chat endpoints — also a cost guard, and **mandatory in Stage A**, where Funnel puts your laptop on the public internet.

**[Later] — before EU/B2B users or public launch at scale:**
- **India's DPDP Act, 2023** applies to you as an India-based operator, and **GDPR** applies the moment you have EU users — both require lawful basis, consent, and data export/delete. Build a `DELETE /me` that truly erases before you need it, not after a request arrives.
- AI chat moderation (you're generating and storing model output tied to users).
- Automated backups + a tested restore (Atlas does backups; test the restore).
- Handwriting/voice biometric considerations if those features land.

---

## 11. Deployment

Two stages. **Stage A** costs ₹0 and runs on your own machine while the only users are you and a few friends. **Stage B** is where you graduate the moment testing ends or money changes hands.

### Stage A — Testing (₹0/month, self-hosted)

```
Friends' phones / browsers
     │  public HTTPS, no client install
     ▼
Tailscale Funnel   ->   your-machine.your-tailnet.ts.net
     │                  (auto-provisioned TLS cert = free domain)
     ▼
Your Windows laptop
 ├── NestJS API            (node / pm2)
 ├── MongoDB Community     (docker)
 ├── Redis                 (docker)
 └── ./storage/            (local filesystem for audio)

 External: AI provider free tier — or fully local models
```

**Why Funnel and not plain Tailscale:** Funnel exposes a local port to the public internet with automatic HTTPS, so testers open a normal URL and install nothing. Tailscale's Personal plan is free forever for up to 6 users — and with Funnel your testers aren't tailnet users at all, so you never approach that cap.

**Component choices:**

| Need | Stage A (free) | Notes |
|---|---|---|
| Host | Your laptop | No PaaS bill |
| Public URL + TLS | Tailscale Funnel | Free `.ts.net` domain, valid cert. Buy a real domain at launch |
| Database | MongoDB Community in Docker | No 512MB cap, unlike Atlas M0 |
| Cache/queue | Redis in Docker | Same as production, just local |
| Object storage | Local `./storage/` folder | **Must** sit behind a `StorageService` interface (`put/get/delete`) so the S3 swap is one class, not a refactor |
| AI | Gemini / Groq free tier, **or** local Ollama + whisper.cpp + Piper | The only line that can cost money — see §8 |
| Android testing | `flutter build apk`, sideload | Free |
| iOS testing | **Web app as PWA via Funnel** | Apple Developer ($99/yr) is the one unavoidable cost for real iOS distribution — defer it |

**Four risks this setup introduces — handle them on day one:**

1. **You have no backups.** Your laptop is now the only copy of the database. Script a nightly `mongodump` into a folder that syncs to cloud storage. Losing your only copy is the classic self-host failure.
2. **The laptop must stay awake.** Windows sleep, updates, and reboots will silently take the "server" down. Disable sleep on AC and expect downtime.
3. **Funnel is the public internet.** Anyone with the URL can hit your API and burn your AI quota. Rate limiting (§10) and auth are not optional here — they're the cost guard.
4. **Tailscale Personal is non-commercial only.** Fine for testing; you must be on Stage B before you charge anyone.

### Stage B — Launch (graduate when testing ends)

```
Web + Mobile
     │
   CDN / TLS
     │
 NestJS container  ×1-2   (Railway / Render / Fly.io — or one small VPS)
     │
 ├── MongoDB Atlas (managed, backups on)
 ├── Redis (managed / add-on)
 └── S3-compatible object storage (audio, media)

 External: LLM / STT / TTS provider APIs
```

Roughly $30–90/month at small scale. **Triggers to migrate:** you start charging (Tailscale Personal's licence forbids commercial use), users outside your friend group, uptime starts mattering, or a real domain goes live.

Because Stage A mirrors Stage B component-for-component — same NestJS, same Mongo, same Redis, storage behind an interface — the migration is a config change and a data dump/restore, not a rewrite. That symmetry is the whole point of choosing local Docker over free-tier managed services.

No Kubernetes, no service mesh, no message broker beyond Redis at either stage. **Graduate** further only against a measured limit (the AI path pegging CPU, or content authoring needing isolation). Everything the reviewer drew as separate deployment tiers is real — **[Later]**.

---

## 12. Monetization (kept short on purpose)

**Positioning — "Duolingo's habit, Busuu's depth, neither one's disrespect."** Duolingo owns the daily loop (streaks, bite-sized lessons, a usable free tier) but its "learning" is translation drills; Busuu owns real communication (CEFR structure, dialogues, native-speaker corrections) but buries it under ads and mid-lesson upsell nags. The combination is Duolingo's engagement engine around Busuu's seriousness — and the wedge that's *yours* is that Busuu's best feature, native-speaker correction, is slow and depends on strangers showing up, while your AI does it instantly, every time, at any hour. That's the thing Busuu wishes it could do.

**The product principle: never interrupt learning to sell.** Busuu's sin isn't *having* premium — it's *how* it pushes it (aggressive, mid-lesson, manipulative). You can run a subscription and still be the anti-Busuu. The calm, ad-free, respectful experience *is* the thing people pay for. Concretely:

- **No ads. Ever.** Not a Phase 0 stopgap — a permanent product promise and a marketing line.
- **No interruptions inside a lesson or review.** Premium is surfaced only at natural seams — a locked scenario, the end of a session — stated once, plainly, then dropped.
- **Monetize without manipulating.** No fake urgency, no dark patterns, no nagging modals. This is the position neither Duolingo nor Busuu can easily take, which is what makes "the one that respects you" defensible.

**The tiers.** Phase 0 needs exactly two, and §8 dictates their shape (the free tier must be cheap to serve, so voice is where the paywall sits):

- **Free** — full lessons + SRS + *text* AI chat + AI writing/speaking corrections + a small daily voice allowance. Genuinely usable, never ad-supported.
- **Premium** (~monthly) — unlimited/higher voice conversation, offline, advanced analytics. Sold at the seams, never in the flow.

Note the honest tension: ad-free plus AI corrections plus conversation costs real money per user (§8), so "free forever with nothing to pay for" isn't viable — the *respectful, calm* experience being the paid product is what squares the vision with the unit economics.

**[Later]:** family plan, schools/universities (needs the Teacher Portal), enterprise, teacher subscriptions, marketplace rev-share, API licensing. Each is a real line — none is a Phase 0 line.

---

## 13. Cross-cutting concerns (the non-feature layer)

None of these is a feature on the v3 map, which is exactly why they get skipped. They're the layer *around* the features that decides whether they work and whether the app survives contact with real users. Items 1–6 are Phase 0; 7–9 are named, not built.

**1. Onboarding / activation flow.** The placement test exists on the map, but not the designed first five minutes: pick your *why*, get one fast win *before* any friction, land on a filled-in home screen, not an empty one. Whether a new user finishes lesson 1 and returns on day 2 (activation) predicts nearly everything downstream. Design it explicitly — it's currently blank.

**2. Content-correctness pipeline.** The existential risk of an AI-content Japanese app is confidently teaching *wrong* Japanese. Three cheap safeguards: a **"report a mistake"** action on every item; a **human (native/advanced) reviewer gate** on AI-generated content before it reaches learners; and **content versioning** so a bad edit is traceable and reversible. Catastrophic to skip, small to add.

**3. Product analytics (for you, not the learner).** §5's `events` collection is the write side; this is the missing read side — activation funnel, day-1/7/30 retention, and where people quit. Learner-facing stats already exist; you have nothing telling *you* what's working. You can't improve what you can't see.

**4. AI guardrails.** The tutor can hallucinate bad grammar, drift off-topic, or be steered somewhere inappropriate. Constrain outputs, add a **"this correction looks wrong"** report (feeds item 2), and enforce refusal boundaries. This compounds with item 5.

**5. Age gate + minimal legal.** Language apps pull in minors whether or not you target them. You need an **age gate**, a **privacy policy + ToS**, and DPDP-aware handling (India base + likely minors). Tiny now, painful to retrofit after launch.

**6. Billing plumbing.** §12 has the strategy; this is the mechanism — **Razorpay** (you already know it), subscriptions, GST invoicing, upgrade/downgrade/refund, and a grace window on failed payment. Scope it when you're ready to charge, not after.

**[Later] — name them now:**

- **7. Lifecycle / win-back** — streak repair and re-engagement when someone lapses. Retention engineering is Duolingo's real moat; notifications alone aren't it.
- **8. Accessibility + native-language localization** — a **furigana toggle** (pedagogically essential for Japanese, not a nicety), screen-reader support, and UI in the learner's *own* language (a Hindi speaker learning Japanese, not only an English base).
- **9. In-app support / help** — the path for a stuck or confused user.

Underneath all of it, not a module: the **teaching method** itself — comprehensible input, how strictly you grade speaking/writing (too harsh demotivates, too loose doesn't teach), sensible scaffolding. A design principle to hold, not a feature to add.

---

## 14. What to build first

Build **one vertical slice all the way through** before any breadth:

1. Auth + user (register, login, `/me`).
2. Content seed: one unit of Hiragana as `Lesson` + `KnowledgeNode`s.
3. One exercise type (multiple choice) rendering that lesson.
4. `POST /lessons/:id/complete` → seeds `SrsCard`s + awards XP.
5. `GET /reviews/due` + `grade` with `ts-fsrs`. **Now you have a real learning loop.**
6. Streak + daily goal on `/me`.
7. One AI **text** chat scenario through the §7 pipeline (skip STT/TTS).
8. Only then: a second exercise type, then voice, then Katakana, then the rest of Phase 0.

If steps 1–6 work and feel good, you have something a learner can use every day. That's worth more than all twenty expansion modules on paper.

---

## 15. What I left out, and why

Microservices, an event bus / Kafka, Kubernetes, multi-region, the marketplace, the SDK, a real agent-service ecosystem, GDPR/DPDP tooling, deployment tiers. All real, all in v3, all **[Later]**. They solve problems of *scale and organization* you don't have yet. Adding them now would cost you the one thing you actually have to protect as a solo builder: the time to ship.

The blueprint says where you're going. This says take the first step. Take it.
