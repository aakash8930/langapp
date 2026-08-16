import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';

import { useSession } from '../../useSession';
import { updateOnboarding, type OnboardingPatch } from '../../api';
import { queryKeys } from '../../queryKeys';

const TOTAL_STEPS = 3;

const LEVELS = [
  { value: 'beginner', label: 'New to Japanese', desc: 'Start with scripts, sounds, and first phrases' },
  { value: 'n5', label: 'Early beginner · N5', desc: 'I know kana and some basic vocabulary' },
  { value: 'n4', label: 'Beginner · N4', desc: 'I can handle simple everyday Japanese' },
  { value: 'n3', label: 'Intermediate · N3', desc: 'I can follow familiar conversations and texts' },
  { value: 'n2', label: 'Upper intermediate · N2', desc: 'I can read and discuss a broad range of topics' },
  { value: 'n1', label: 'Advanced · N1', desc: 'I am working toward near-native comprehension' },
] as const;

const GOALS = [
  { value: 'conversation', label: 'Speak with confidence', desc: 'Everyday conversation and listening' },
  { value: 'reading', label: 'Read Japanese', desc: 'Manga, books, articles, and signs' },
  { value: 'travel', label: 'Prepare for travel', desc: 'Useful Japanese for real situations' },
  { value: 'jlpt', label: 'Pass the JLPT', desc: 'Build toward an exam level' },
  { value: 'work', label: 'Use Japanese at work', desc: 'Professional vocabulary and comprehension' },
] as const;

const COMMITMENTS = [
  { minutes: 5, xp: 20, label: '5 minutes', desc: 'A quick daily check-in · 20 XP goal' },
  { minutes: 15, xp: 50, label: '15 minutes', desc: 'A steady daily habit · 50 XP goal' },
  { minutes: 30, xp: 100, label: '30 minutes', desc: 'A focused session · 100 XP goal' },
  { minutes: 60, xp: 200, label: '60 minutes', desc: 'An intensive routine · 200 XP goal' },
] as const;

type FormState = {
  proficiencyLevel: string;
  primaryGoal: string;
  studyTimeMinutes: number;
  dailyGoalXp: number;
};

type SignedInUser = ReturnType<typeof useSession> extends { session: infer S }
  ? S extends { state: 'signedIn'; user: infer U }
    ? U
    : never
  : never;

function initialStep(user: SignedInUser): number {
  const onboarding = user.onboardingState;
  if (!onboarding?.proficiencyLevel) return 0;
  const persisted = Math.min(Math.max(onboarding.onboardingStep ?? 0, 0), TOTAL_STEPS - 1);
  if (persisted === 0) return 0;
  if (!onboarding.learningGoals?.length) return 1;
  return persisted;
}

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
          <h1 className="onb-title">Personalize your start</h1>
          <p className="onb-subtitle">Sign in to choose where your Japanese practice begins.</p>
          <Link className="onb-btn onb-btn-primary" to="/signin">Sign in</Link>
        </div>
      </div>
    );
  }

  return <Wizard user={session.user} signOut={signOut} />;
}

function Wizard({ user, signOut }: { user: SignedInUser; signOut: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onboarding = user.onboardingState;
  const [step, setStep] = useState(() => initialStep(user));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    proficiencyLevel: onboarding?.proficiencyLevel ?? '',
    primaryGoal: onboarding?.learningGoals?.[0] ?? '',
    studyTimeMinutes: onboarding?.studyTimeMinutes ?? 15,
    dailyGoalXp: user.gamification?.dailyGoalXp ?? 50,
  });

  function answers(): OnboardingPatch {
    return {
      proficiencyLevel: form.proficiencyLevel,
      learningGoals: form.primaryGoal ? [form.primaryGoal] : [],
      studyTimeMinutes: form.studyTimeMinutes,
      dailyGoalXp: form.dailyGoalXp,
    };
  }

  async function save(patch: OnboardingPatch): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    try {
      const updatedUser = await updateOnboarding(patch);
      queryClient.setQueryData(queryKeys.session.me, updatedUser);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Your choice could not be saved. Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    const target = Math.min(step + 1, TOTAL_STEPS - 1);
    if (await save({ ...answers(), step: target })) setStep(target);
  }

  async function back() {
    const target = Math.max(0, step - 1);
    if (await save({ step: target })) setStep(target);
  }

  async function finish() {
    if (!(await save({ ...answers(), step: TOTAL_STEPS, onboardingComplete: true }))) return;
    navigate({ to: '/', replace: true });
  }

  return (
    <div className="onb-page">
      <div className="onb-card">
        <div
          className="onb-steps"
          role="progressbar"
          aria-label={`Choice ${step + 1} of ${TOTAL_STEPS}`}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={step + 1}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <Dot key={index} index={index} step={step} />
          ))}
        </div>

        {saveError ? <p className="onb-error" role="alert">{saveError}</p> : null}
        <fieldset className="onb-step-content" disabled={saving} aria-busy={saving}>
          {step === 0 ? (
            <ChoiceStep
              title="Where should you start?"
              subtitle="Choose the closest fit. This records your starting level without locking any course content."
              groupLabel="Japanese starting level"
              options={LEVELS}
              value={form.proficiencyLevel}
              onChange={(proficiencyLevel) => setForm((current) => ({ ...current, proficiencyLevel }))}
              onNext={() => void next()}
              nextDisabled={!form.proficiencyLevel}
              saving={saving}
            />
          ) : null}

          {step === 1 ? (
            <ChoiceStep
              title="What matters most right now?"
              subtitle="Pick one focus for your profile. You can still use every kind of practice."
              groupLabel="Primary learning goal"
              options={GOALS}
              value={form.primaryGoal}
              onChange={(primaryGoal) => setForm((current) => ({ ...current, primaryGoal }))}
              onNext={() => void next()}
              onBack={back}
              nextDisabled={!form.primaryGoal}
              saving={saving}
            />
          ) : null}

          {step === 2 ? (
            <CommitmentStep
              form={form}
              setForm={setForm}
              onBack={back}
              onFinish={() => void finish()}
              saving={saving}
            />
          ) : null}
        </fieldset>

        <button className="onb-link" type="button" onClick={signOut} disabled={saving}>Sign out</button>
      </div>
    </div>
  );
}

type Choice = { value: string; label: string; desc: string };

function ChoiceStep({
  title,
  subtitle,
  groupLabel,
  options,
  value,
  onChange,
  onNext,
  onBack,
  nextDisabled,
  saving,
}: {
  title: string;
  subtitle: string;
  groupLabel: string;
  options: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  nextDisabled: boolean;
  saving: boolean;
}) {
  return (
    <>
      <h1 className="onb-title">{title}</h1>
      <p className="onb-subtitle">{subtitle}</p>
      <div className="onb-options" role="radiogroup" aria-label={groupLabel}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`onb-option ${value === option.value ? 'onb-option--selected' : ''}`}
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="onb-option-radio" aria-hidden="true" />
            <span>
              <span className="onb-option-text">{option.label}</span>
              <span className="onb-option-desc">{option.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <StepButtons onNext={onNext} onBack={onBack} disabled={nextDisabled} saving={saving} />
    </>
  );
}

function CommitmentStep({
  form,
  setForm,
  onBack,
  onFinish,
  saving,
}: {
  form: FormState;
  setForm: (updater: (current: FormState) => FormState) => void;
  onBack: () => void;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <>
      <h1 className="onb-title">What can you sustain each day?</h1>
      <p className="onb-subtitle">
        This sets your study-time target and daily XP goal. Start small—you can change both in settings.
      </p>
      <div className="onb-options" role="radiogroup" aria-label="Daily commitment">
        {COMMITMENTS.map((commitment) => {
          const selected = form.studyTimeMinutes === commitment.minutes && form.dailyGoalXp === commitment.xp;
          return (
            <button
              key={commitment.minutes}
              type="button"
              className={`onb-option ${selected ? 'onb-option--selected' : ''}`}
              role="radio"
              aria-checked={selected}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  studyTimeMinutes: commitment.minutes,
                  dailyGoalXp: commitment.xp,
                }))
              }
            >
              <span className="onb-option-radio" aria-hidden="true" />
              <span>
                <span className="onb-option-text">{commitment.label}</span>
                <span className="onb-option-desc">{commitment.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      <StepButtons onNext={onFinish} onBack={onBack} nextLabel="Save and start learning" saving={saving} />
    </>
  );
}

function StepButtons({
  onNext,
  onBack,
  disabled,
  saving,
  nextLabel = 'Continue',
}: {
  onNext: () => void;
  onBack?: () => void;
  disabled?: boolean;
  saving: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="onb-btn-row" style={{ flexDirection: 'row' }}>
      {onBack ? <button className="onb-btn onb-btn-ghost" type="button" onClick={onBack}>Back</button> : null}
      <button className="onb-btn onb-btn-primary" type="button" onClick={onNext} disabled={disabled || saving}>
        {saving ? 'Saving…' : nextLabel}
      </button>
    </div>
  );
}
