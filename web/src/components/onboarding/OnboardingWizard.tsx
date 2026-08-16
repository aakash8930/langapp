import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Check, GraduationCap, Target, BookOpen, Brain, Clock, Bell, ClipboardList, Sparkles } from 'lucide-react';

import { useSession } from '../../useSession';
import { updateOnboarding, type OnboardingPatch } from '../../api';
import { queryKeys } from '../../queryKeys';

const TOTAL_STEPS = 10;

type FormState = {
  nativeLanguage: string;
  proficiencyLevel: string;
  learningGoals: string[];
  learningStyle: string;
  preferredStudyTime: string;
  notificationsEnabled: boolean;
  studyTimeMinutes: number;
  dailyGoalXp: number;
};

const LEVELS = [
  { value: 'beginner', label: 'Absolute Beginner', desc: 'I know nothing or just a few words' },
  { value: 'n5', label: 'JLPT N5', desc: 'I know hiragana, katakana, and basic phrases' },
  { value: 'n4', label: 'JLPT N4', desc: 'I can handle everyday conversations' },
  { value: 'n3', label: 'JLPT N3', desc: 'I can read simple articles and manga' },
  { value: 'n2', label: 'JLPT N2', desc: 'I can read newspapers and engage in discussions' },
  { value: 'n1', label: 'JLPT N1', desc: 'I am near-native or already fluent' },
];

const GOALS = [
  { value: 'conversation', label: 'Conversation' },
  { value: 'reading', label: 'Reading manga / books' },
  { value: 'travel', label: 'Travel' },
  { value: 'jlpt', label: 'JLPT exam' },
  { value: 'work', label: 'Work / business' },
];

const STYLES = [
  { value: 'visual', label: 'Visual', desc: 'Kanji, charts, and imagery' },
  { value: 'auditory', label: 'Auditory', desc: 'Listening and pronunciation' },
  { value: 'reading', label: 'Reading', desc: 'Text and grammar study' },
  { value: 'mixed', label: 'Mixed', desc: 'A bit of everything' },
];

const STUDY_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'any', label: 'Anytime' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
];

function Dot({ index, step }: { index: number; step: number }) {
  const cls = index < step ? 'onb-dot--done' : index === step ? 'onb-dot--active' : '';
  return <span className={`onb-dot ${cls}`} aria-hidden="true" />;
}

export function OnboardingWizard() {
  const { session, signOut } = useSession();

  if (session.state !== 'signedIn') {
    return (
      <div className="onb-page">
        <div className="onb-card">
          <h1 className="onb-title">Welcome to GENKŌ</h1>
          <p className="onb-subtitle">Sign in to set up your learning experience.</p>
          <Link className="onb-btn onb-btn-primary" to="/signin">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return <Wizard user={session.user} signOut={signOut} />;
}

type SignedInUser = ReturnType<typeof useSession> extends { session: infer S }
  ? S extends { state: 'signedIn'; user: infer U }
    ? U
    : never
  : never;

function Wizard({ user, signOut }: { user: SignedInUser; signOut: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const os = user.onboardingState;
  const [step, setStep] = useState(os?.onboardingStep ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    nativeLanguage: user.profile.nativeLanguage ?? 'en',
    proficiencyLevel: os?.proficiencyLevel ?? '',
    learningGoals: os?.learningGoals ?? [],
    learningStyle: os?.learningStyle ?? '',
    preferredStudyTime: os?.preferredStudyTime ?? '',
    notificationsEnabled: os?.notificationsEnabled ?? false,
    studyTimeMinutes: os?.studyTimeMinutes ?? 15,
    dailyGoalXp: user.gamification?.dailyGoalXp ?? 50,
  });

  async function save(overrides: Partial<OnboardingPatch>): Promise<boolean> {
    const body: OnboardingPatch = { step: step + 1, ...overrides };
    if (form.nativeLanguage !== user.profile.nativeLanguage) body.nativeLanguage = form.nativeLanguage;
    if (form.proficiencyLevel !== (os?.proficiencyLevel ?? '')) body.proficiencyLevel = form.proficiencyLevel;
    if (JSON.stringify(form.learningGoals) !== JSON.stringify(os?.learningGoals ?? [])) body.learningGoals = form.learningGoals;
    if (form.learningStyle !== (os?.learningStyle ?? '')) body.learningStyle = form.learningStyle;
    if (form.preferredStudyTime !== (os?.preferredStudyTime ?? '')) body.preferredStudyTime = form.preferredStudyTime;
    if (form.notificationsEnabled !== (os?.notificationsEnabled ?? false)) body.notificationsEnabled = form.notificationsEnabled;
    if (form.studyTimeMinutes !== (os?.studyTimeMinutes ?? 15)) body.studyTimeMinutes = form.studyTimeMinutes;
    if (form.dailyGoalXp !== (user.gamification?.dailyGoalXp ?? 50)) body.dailyGoalXp = form.dailyGoalXp;

    setSaving(true);
    setSaveError(null);
    try {
      const updatedUser = await updateOnboarding(body);
      queryClient.setQueryData(queryKeys.session.me, updatedUser);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Your answers could not be saved. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function next() {
    void save({ step: step + 1 }).then((saved) => {
      if (saved) setStep((current) => current + 1);
    });
  }

  function back() {
    void save({ step: Math.max(0, step - 1) }).then((saved) => {
      if (saved) setStep((current) => Math.max(0, current - 1));
    });
  }

  function finish() {
    void save({ onboardingComplete: true }).then((saved) => {
      if (saved) navigate({ to: '/', replace: true });
    });
  }

  const dots = Array.from({ length: TOTAL_STEPS }, (_, i) => <Dot key={i} index={i} step={step} />);

  return (
    <div className="onb-page">
      <div className="onb-card">
        <div className="onb-steps">{dots}</div>

        {saveError ? <p className="onb-error" role="alert">{saveError}</p> : null}
        <fieldset className="onb-step-content" disabled={saving} aria-busy={saving}>
          {step === 0 && <Welcome next={next} />}
          {step === 1 && <LanguageStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 2 && <LevelStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 3 && <GoalsStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 4 && <DailyGoalStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 5 && <StyleStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 6 && <StudyTimeStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 7 && <NotificationsStep form={form} setForm={setForm} next={next} back={back} />}
          {step === 8 && <PlacementTestIntro next={next} back={back} />}
          {step === 9 && <CompleteStep form={form} finish={finish} back={back} />}
        </fieldset>
        <button className="onb-link" type="button" onClick={signOut} disabled={saving}>
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ---- Step 0: Welcome ---- */

function Welcome({ next }: { next: () => void }) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 'var(--s-xl)' }}>
        <Sparkles size={40} color="var(--o-accent)" style={{ marginBottom: 'var(--s-md)' }} />
        <h1 className="onb-title">Welcome to GENKŌ</h1>
        <p className="onb-subtitle">
          Let's personalize your learning experience. A few quick questions so we can
          tailor your journey to Japanese fluency.
        </p>
      </div>
      <button className="onb-btn onb-btn-primary" onClick={next}>
        Get Started
      </button>
    </>
  );
}

/* ---- Step 1: Language ---- */

function LanguageStep({ form, setForm, next, back }: StepProps) {
  return (
    <>
      <h1 className="onb-title">What's your native language?</h1>
      <p className="onb-subtitle">This helps us show translations and explanations you understand.</p>
      <div className="onb-form">
        <div className="onb-field">
          <label className="onb-label">Native language</label>
          <select className="onb-select" value={form.nativeLanguage} onChange={(e) => setForm({ ...form, nativeLanguage: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="onb-field">
          <label className="onb-label">Learning</label>
          <div className="onb-select" style={{ color: 'var(--o-text-soft)', display: 'flex', alignItems: 'center' }}>
            Japanese 🇯🇵
          </div>
          <p className="onb-subtitle" style={{ margin: 0, textAlign: 'left', fontSize: 'var(--text-caption)' }}>
            More languages coming soon.
          </p>
        </div>
      </div>
      <StepButtons next={next} back={back} />
    </>
  );
}

/* ---- Step 2: Level ---- */

function LevelStep({ form, setForm, next, back }: StepProps) {
  return (
    <>
      <h1 className="onb-title">How much Japanese do you know?</h1>
      <p className="onb-subtitle">Don't worry — you can always change this later.</p>
      <div className="onb-options">
        {LEVELS.map((level) => (
          <div
            key={level.value}
            className={`onb-option ${form.proficiencyLevel === level.value ? 'onb-option--selected' : ''}`}
            onClick={() => setForm({ ...form, proficiencyLevel: level.value })}
            role="radio"
            aria-checked={form.proficiencyLevel === level.value}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setForm({ ...form, proficiencyLevel: level.value })}
          >
            <span className="onb-option-radio" />
            <div>
              <div className="onb-option-text">{level.label}</div>
              <div className="onb-option-desc">{level.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <StepButtons next={next} back={back} disabled={!form.proficiencyLevel} />
    </>
  );
}

/* ---- Step 3: Goals ---- */

function GoalsStep({ form, setForm, next, back }: StepProps) {
  const toggle = (goal: string) => {
    const goals = form.learningGoals.includes(goal)
      ? form.learningGoals.filter((g) => g !== goal)
      : [...form.learningGoals, goal];
    setForm({ ...form, learningGoals: goals });
  };

  return (
    <>
      <h1 className="onb-title"><Target size={24} style={{ verticalAlign: -4, marginRight: 8 }} aria-hidden="true" />What are your goals?</h1>
      <p className="onb-subtitle">Select all that apply. We'll tailor your path accordingly.</p>
      <div className="onb-checks">
        {GOALS.map((goal) => {
          const checked = form.learningGoals.includes(goal.value);
          return (
            <div key={goal.value} className={`onb-check ${checked ? 'onb-check--checked' : ''}`} onClick={() => toggle(goal.value)}>
              <span className="onb-check-box">{checked ? <Check size={14} strokeWidth={3} /> : null}</span>
              <span className="onb-check-label">{goal.label}</span>
            </div>
          );
        })}
      </div>
      <StepButtons next={next} back={back} disabled={form.learningGoals.length === 0} />
    </>
  );
}

/* ---- Step 4: Daily Goal ---- */

function DailyGoalStep({ form, setForm, next, back }: StepProps) {
  const xpTime = Math.round(form.dailyGoalXp / 5);
  return (
    <>
      <h1 className="onb-title">Set your daily goal</h1>
      <p className="onb-subtitle">How much do you want to study each day?</p>
      <div className="onb-form">
        <div className="onb-field">
          <label className="onb-label">Daily XP goal</label>
          <div className="onb-slider-value">
            <span>Light</span>
            <strong>{form.dailyGoalXp} XP</strong>
            <span>Intense</span>
          </div>
          <input
            className="onb-slider"
            type="range"
            min={10}
            max={200}
            step={10}
            value={form.dailyGoalXp}
            onChange={(e) => setForm({ ...form, dailyGoalXp: Number(e.target.value) })}
          />
        </div>
        <div className="onb-field">
          <label className="onb-label">Study time per day</label>
          <div className="onb-slider-value">
            <span>5 min</span>
            <strong>{form.studyTimeMinutes} min</strong>
            <span>60 min</span>
          </div>
          <input
            className="onb-slider"
            type="range"
            min={5}
            max={60}
            step={5}
            value={form.studyTimeMinutes}
            onChange={(e) => setForm({ ...form, studyTimeMinutes: Number(e.target.value) })}
          />
          <p className="onb-subtitle" style={{ margin: 0, textAlign: 'center', fontSize: 'var(--text-caption)' }}>
            ~{xpTime} questions per session
          </p>
        </div>
      </div>
      <StepButtons next={next} back={back} />
    </>
  );
}

/* ---- Step 5: Learning Style ---- */

function StyleStep({ form, setForm, next, back }: StepProps) {
  return (
    <>
      <h1 className="onb-title"><Brain size={24} style={{ verticalAlign: -4, marginRight: 8 }} aria-hidden="true" />How do you learn best?</h1>
      <p className="onb-subtitle">We'll emphasize the methods that work for you.</p>
      <div className="onb-options">
        {STYLES.map((style) => (
          <div
            key={style.value}
            className={`onb-option ${form.learningStyle === style.value ? 'onb-option--selected' : ''}`}
            onClick={() => setForm({ ...form, learningStyle: style.value })}
            role="radio"
            aria-checked={form.learningStyle === style.value}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setForm({ ...form, learningStyle: style.value })}
          >
            <span className="onb-option-radio" />
            <div>
              <div className="onb-option-text">{style.label}</div>
              <div className="onb-option-desc">{style.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <StepButtons next={next} back={back} disabled={!form.learningStyle} />
    </>
  );
}

/* ---- Step 6: Study Time ---- */

function StudyTimeStep({ form, setForm, next, back }: StepProps) {
  return (
    <>
      <h1 className="onb-title"><Clock size={24} style={{ verticalAlign: -4, marginRight: 8 }} aria-hidden="true" />When do you prefer to study?</h1>
      <p className="onb-subtitle">We'll schedule reminders at the right time.</p>
      <div className="onb-options">
        {STUDY_TIMES.map((t) => (
          <div
            key={t.value}
            className={`onb-option ${form.preferredStudyTime === t.value ? 'onb-option--selected' : ''}`}
            onClick={() => setForm({ ...form, preferredStudyTime: t.value })}
            role="radio"
            aria-checked={form.preferredStudyTime === t.value}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setForm({ ...form, preferredStudyTime: t.value })}
          >
            <span className="onb-option-radio" />
            <div className="onb-option-text">{t.label}</div>
          </div>
        ))}
      </div>
      <StepButtons next={next} back={back} disabled={!form.preferredStudyTime} />
    </>
  );
}

/* ---- Step 7: Notifications ---- */

function NotificationsStep({ form, setForm, next, back }: StepProps) {
  return (
    <>
      <h1 className="onb-title"><Bell size={24} style={{ verticalAlign: -4, marginRight: 8 }} aria-hidden="true" />Stay on track</h1>
      <p className="onb-subtitle">We'll send gentle reminders to help you build a consistent habit.</p>
      <div className="onb-toggles">
        <div className="onb-toggle">
          <div>
            <div className="onb-toggle-label">Study reminders</div>
            <div className="onb-toggle-desc">Get notified when it's time to review</div>
          </div>
          <button
            type="button"
            className={`onb-toggle-switch ${form.notificationsEnabled ? 'onb-toggle-switch--on' : ''}`}
            onClick={() => setForm({ ...form, notificationsEnabled: !form.notificationsEnabled })}
            aria-label={form.notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
          />
        </div>
      </div>
      <StepButtons next={next} back={back} />
    </>
  );
}

/* ---- Step 8: Placement Test Intro ---- */

function PlacementTestIntro({ next, back }: { next: () => void; back: () => void }) {
  return (
    <>
      <div className="onb-test-intro">
        <div className="onb-test-icon">
          <GraduationCap size={36} />
        </div>
        <h1 className="onb-title">Find Your Starting Point</h1>
        <p className="onb-subtitle">
          A quick assessment to place you at the right level so you don't waste time on
          what you already know.
        </p>
        <div className="onb-test-features">
          {['15 quick questions', 'Adaptive difficulty', 'Covers vocabulary & grammar'].map((f, i) => (
            <div key={i} className="onb-test-feature">
              <span>{i + 1}</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="onb-btn-row">
        <button className="onb-btn onb-btn-primary" onClick={next}>
          Skip for now
        </button>
        <button className="onb-link" onClick={back}>Go back</button>
      </div>
    </>
  );
}

/* ---- Step 9: Complete ---- */

function CompleteStep({ form, finish, back }: { form: FormState; finish: () => void; back: () => void }) {
  const levelLabel = LEVELS.find((l) => l.value === form.proficiencyLevel)?.label ?? 'Not set';
  const styleLabel = STYLES.find((s) => s.value === form.learningStyle)?.label ?? 'Not set';
  const timeLabel = STUDY_TIMES.find((t) => t.value === form.preferredStudyTime)?.label ?? 'Not set';
  const goalLabels = form.learningGoals.map((g) => GOALS.find((x) => x.value === g)?.label).filter(Boolean).join(', ') || 'None';
  const langLabel = LANGUAGES.find((l) => l.value === form.nativeLanguage)?.label ?? 'English';

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 'var(--s-lg)' }}>
        <ClipboardList size={36} color="var(--o-accent)" style={{ marginBottom: 'var(--s-sm)' }} />
        <h1 className="onb-title">You're all set!</h1>
        <p className="onb-subtitle">Here's a summary of your preferences. You can change these anytime in Settings.</p>
      </div>

      <div className="onb-summary">
        <div className="onb-summary-row">
          <span className="onb-summary-label">Native language</span>
          <span className="onb-summary-value">{langLabel}</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Japanese level</span>
          <span className="onb-summary-value">{levelLabel}</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Goals</span>
          <span className="onb-summary-value">{goalLabels}</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Daily XP</span>
          <span className="onb-summary-value">{form.dailyGoalXp} XP</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Study time</span>
          <span className="onb-summary-value">{form.studyTimeMinutes} min/day</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Learning style</span>
          <span className="onb-summary-value">{styleLabel}</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Study time</span>
          <span className="onb-summary-value">{timeLabel}</span>
        </div>
        <div className="onb-summary-row">
          <span className="onb-summary-label">Notifications</span>
          <span className="onb-summary-value">{form.notificationsEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <div className="onb-btn-row">
        <button className="onb-btn onb-btn-primary" onClick={finish}>
          <BookOpen size={20} aria-hidden="true" />
          Start Learning
        </button>
        <button className="onb-link" onClick={back}>Go back</button>
      </div>
    </>
  );
}

/* ---- Shared ---- */

type StepProps = {
  form: FormState;
  setForm: (f: FormState) => void;
  next: () => void;
  back: () => void;
};

function StepButtons({ next, back, disabled }: { next: () => void; back: () => void; disabled?: boolean }) {
  return (
    <div className="onb-btn-row" style={{ flexDirection: 'row' }}>
      <button className="onb-btn onb-btn-ghost" onClick={back}>Back</button>
      <button className="onb-btn onb-btn-primary" onClick={next} disabled={disabled}>Continue</button>
    </div>
  );
}
