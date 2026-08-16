import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { User } from '@/api/auth';
import type { OnboardingPatch } from '@/api/onboarding';
import { updateOnboarding } from '@/api/onboarding';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { ChoiceCard } from '@/components/ChoiceCard';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { errorText } from '@/lib/errors';
import { useTheme } from '@/theme';

/**
 * Three honest first-run decisions: starting level, primary goal, and a daily
 * commitment. There is deliberately no placement-test teaser—the product has
 * no placement test yet—and no reminder/style questions before first value.
 */
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

function initialStep(user: User | null): number {
  const onboarding = user?.onboardingState;
  if (!onboarding?.proficiencyLevel) return 0;
  const persisted = Math.min(Math.max(onboarding.onboardingStep ?? 0, 0), TOTAL_STEPS - 1);
  if (persisted === 0) return 0;
  if (!onboarding.learningGoals.length) return 1;
  return persisted;
}

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, applyUser, refresh, logout } = useAuth();
  const [step, setStep] = useState(() => initialStep(user));
  const [form, setForm] = useState<FormState>(() => ({
    proficiencyLevel: user?.onboardingState.proficiencyLevel ?? '',
    primaryGoal: user?.onboardingState.learningGoals[0] ?? '',
    studyTimeMinutes: user?.onboardingState.studyTimeMinutes ?? 15,
    dailyGoalXp: user?.gamification.dailyGoalXp ?? 50,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!user) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.spacing.xl,
          paddingTop: insets.top + theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xxl,
        }}
      >
        <ErrorState
          error={error ?? new Error('Your account status has not loaded yet. Connect to the API and try again.')}
          onRetry={() => void refresh().catch(setError)}
        />
      </ScrollView>
    );
  }

  function answers(): OnboardingPatch {
    return {
      proficiencyLevel: form.proficiencyLevel,
      learningGoals: form.primaryGoal ? [form.primaryGoal] : [],
      studyTimeMinutes: form.studyTimeMinutes,
      dailyGoalXp: form.dailyGoalXp,
    };
  }

  async function persist(patch: OnboardingPatch): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      applyUser(await updateOnboarding(patch));
      return true;
    } catch (failure) {
      setError(failure);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    const target = Math.min(step + 1, TOTAL_STEPS - 1);
    if (await persist({ ...answers(), step: target })) setStep(target);
  }

  async function back() {
    const target = Math.max(0, step - 1);
    if (await persist({ step: target })) setStep(target);
  }

  async function finish() {
    if (!(await persist({ ...answers(), step: TOTAL_STEPS, onboardingComplete: true }))) return;
    router.replace('/');
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingTop: insets.top + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xxl,
        gap: theme.spacing.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <StepDots step={step} />
      {error ? <FormError message={errorText(error)} /> : null}

      {step === 0 ? (
        <ChoiceStep
          title="Where should you start?"
          subtitle="Choose the closest fit. This records your starting level without locking any course content."
          options={LEVELS}
          value={form.proficiencyLevel}
          onChange={(proficiencyLevel) => setForm((current) => ({ ...current, proficiencyLevel }))}
          onNext={() => void next()}
          disabled={!form.proficiencyLevel}
          saving={saving}
        />
      ) : null}

      {step === 1 ? (
        <ChoiceStep
          title="What matters most right now?"
          subtitle="Pick one focus for your profile. You can still use every kind of practice."
          options={GOALS}
          value={form.primaryGoal}
          onChange={(primaryGoal) => setForm((current) => ({ ...current, primaryGoal }))}
          onNext={() => void next()}
          onBack={back}
          disabled={!form.primaryGoal}
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

      <Button label="Sign out" variant="secondary" onPress={() => void logout()} disabled={saving} />
    </ScrollView>
  );
}

function StepDots({ step }: { step: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Choice ${step + 1} of ${TOTAL_STEPS}`}
      style={{ flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'center' }}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, index) => (
        <View
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: index <= step ? theme.colors.ink : theme.colors.hairline,
          }}
        />
      ))}
    </View>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.title,
          lineHeight: theme.lineHeight.title,
          color: theme.colors.ink,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

type Choice = { value: string; label: string; desc: string };

function ChoiceStep({
  title,
  subtitle,
  options,
  value,
  onChange,
  onNext,
  onBack,
  disabled,
  saving,
}: {
  title: string;
  subtitle: string;
  options: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  disabled: boolean;
  saving: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }} accessibilityRole="radiogroup">
      <StepHeading title={title} subtitle={subtitle} />
      <View style={{ gap: theme.spacing.sm }}>
        {options.map((option) => (
          <ChoiceCard
            key={option.value}
            title={option.label}
            description={option.desc}
            selected={value === option.value}
            onPress={() => {
              if (!saving) onChange(option.value);
            }}
          />
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} disabled={disabled} />
    </View>
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
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }} accessibilityRole="radiogroup">
      <StepHeading
        title="What can you sustain each day?"
        subtitle="This sets your study-time target and daily XP goal. Start small—you can change both in settings."
      />
      <View style={{ gap: theme.spacing.sm }}>
        {COMMITMENTS.map((commitment) => {
          const selected = form.studyTimeMinutes === commitment.minutes && form.dailyGoalXp === commitment.xp;
          return (
            <ChoiceCard
              key={commitment.minutes}
              title={commitment.label}
              description={commitment.desc}
              selected={selected}
              onPress={() => {
                if (saving) return;
                setForm((current) => ({
                  ...current,
                  studyTimeMinutes: commitment.minutes,
                  dailyGoalXp: commitment.xp,
                }));
              }}
            />
          );
        })}
      </View>
      <StepButtons
        onNext={onFinish}
        onBack={onBack}
        saving={saving}
        nextLabel="Save and start learning"
      />
    </View>
  );
}

function StepButtons({
  onNext,
  onBack,
  saving,
  disabled,
  nextLabel = 'Continue',
}: {
  onNext: () => void;
  onBack?: () => void;
  saving: boolean;
  disabled?: boolean;
  nextLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      {onBack ? (
        <View style={{ flex: 1 }}>
          <Button label="Back" variant="secondary" onPress={onBack} disabled={saving} />
        </View>
      ) : null}
      <View style={{ flex: onBack ? 2 : 1 }}>
        <Button label={nextLabel} onPress={onNext} loading={saving} disabled={disabled} />
      </View>
    </View>
  );
}
