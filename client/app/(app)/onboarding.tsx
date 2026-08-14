import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OnboardingPatch } from '@/api/onboarding';
import { updateOnboarding } from '@/api/onboarding';
import { updateNotificationSettings } from '@/api/notifications';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/Button';
import { ChoiceCard } from '@/components/ChoiceCard';
import { ErrorState } from '@/components/ErrorState';
import { FormError } from '@/components/FormError';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { errorText } from '@/lib/errors';
import { requestNotificationPermission, scheduleStudyReminder } from '@/lib/notifications';
import { useTheme } from '@/theme';

/**
 * First-time onboarding — the wizard `(app)/_layout.tsx` sends a signed-in
 * account to whenever `onboardingState.onboardingComplete` is false, until
 * `finish()` below flips it.
 *
 * Content and field names mirror web's `OnboardingWizard`
 * (`web/src/components/onboarding/OnboardingWizard.tsx`) and the shared
 * `PATCH /me/onboarding` contract (`OnboardingDto`) exactly — same steps,
 * same values, same server fields. Two differences from web, both
 * deliberate:
 *
 *   - **This wizard is actually reachable.** Web's exists at `/onboarding`
 *     but nothing — not even web's own signup form, which navigates to `/`
 *     — ever routes there. `(app)/_layout.tsx`'s redirect is what makes this
 *     one live rather than orphaned code, which is a real behavioural
 *     difference from web, not an oversight; see that file's comment.
 *   - **A failed save shows an error and does not advance.** Web's
 *     `next()`/`back()` end in `.catch(() => {})` — a save that fails
 *     silently does nothing, including tell the learner it failed. Wrong
 *     for an app whose own conventions say the API is offline regularly and
 *     that has to be a normal, visible condition, not a silent no-op.
 *
 * Placement test: `onboardingState` has `placementTestCompleted/Score/Level`
 * fields, and nothing — on this client or web's — writes them. There is no
 * placement test to take. This wizard's placement-test step is what web's
 * is: an intro screen with a "Skip for now" button. Building the real test
 * is a separate, considerably larger feature.
 *
 * AI Personalization is not in web's wizard or `OnboardingDto` at all — no
 * server field corresponds to it. Rather than inventing one (or silently
 * dropping the step), it is here as a step that explains how the answers
 * already given get used, and persists nothing itself.
 */

const TOTAL_STEPS = 11;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
] as const;

const LEVELS = [
  { value: 'beginner', label: 'Absolute beginner', desc: 'I know nothing or just a few words' },
  { value: 'n5', label: 'JLPT N5', desc: 'I know hiragana, katakana, and basic phrases' },
  { value: 'n4', label: 'JLPT N4', desc: 'I can handle everyday conversations' },
  { value: 'n3', label: 'JLPT N3', desc: 'I can read simple articles and manga' },
  { value: 'n2', label: 'JLPT N2', desc: 'I can read newspapers and engage in discussions' },
  { value: 'n1', label: 'JLPT N1', desc: 'I am near-native or already fluent' },
] as const;

const GOALS = [
  { value: 'conversation', label: 'Conversation' },
  { value: 'reading', label: 'Reading manga / books' },
  { value: 'travel', label: 'Travel' },
  { value: 'jlpt', label: 'JLPT exam' },
  { value: 'work', label: 'Work / business' },
] as const;

const STYLES = [
  { value: 'visual', label: 'Visual', desc: 'Kanji, charts, and imagery' },
  { value: 'auditory', label: 'Auditory', desc: 'Listening and pronunciation' },
  { value: 'reading', label: 'Reading', desc: 'Text and grammar study' },
  { value: 'mixed', label: 'Mixed', desc: 'A bit of everything' },
] as const;

const STUDY_TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'any', label: 'Anytime' },
] as const;

/** Matches `settings.tsx`'s `GOAL_OPTIONS` exactly — one set of presets for one field. */
const XP_OPTIONS: readonly Segment<number>[] = [
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
];

/**
 * Presets rather than web's slider, for the reason `register.tsx`'s date
 * field gives: a slider needs a library this repo asks about first. Bounds
 * (5–120 on the server) allow more; these four cover what a beginner
 * actually picks.
 */
const STUDY_MINUTES_OPTIONS: readonly Segment<number>[] = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];

const TOGGLE_OPTIONS: readonly Segment<boolean>[] = [
  { value: false, label: 'Off' },
  { value: true, label: 'On' },
];

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

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, applyUser, refresh } = useAuth();

  const [step, setStep] = useState(user?.onboardingState.onboardingStep ?? 0);
  const [form, setForm] = useState<FormState>({
    nativeLanguage: user?.profile.nativeLanguage || 'en',
    proficiencyLevel: user?.onboardingState.proficiencyLevel ?? '',
    learningGoals: user?.onboardingState.learningGoals ?? [],
    learningStyle: user?.onboardingState.learningStyle ?? '',
    preferredStudyTime: user?.onboardingState.preferredStudyTime ?? '',
    notificationsEnabled: user?.onboardingState.notificationsEnabled ?? false,
    studyTimeMinutes: user?.onboardingState.studyTimeMinutes ?? 15,
    dailyGoalXp: user?.gamification.dailyGoalXp ?? 50,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Same class of gap settings.tsx's `!user` branch covers: a launch that
  // could not reach the API lets the app in with no profile, and this
  // screen has nothing to save answers onto until one loads.
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
          error={error ?? new Error('Your profile hasn’t loaded yet, so there is nothing to set up here. Check that the API is running.')}
          onRetry={() => void refresh().catch(setError)}
        />
      </ScrollView>
    );
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

  function currentAnswers(): OnboardingPatch {
    return {
      nativeLanguage: form.nativeLanguage,
      proficiencyLevel: form.proficiencyLevel,
      learningGoals: form.learningGoals,
      learningStyle: form.learningStyle,
      preferredStudyTime: form.preferredStudyTime,
      notificationsEnabled: form.notificationsEnabled,
      studyTimeMinutes: form.studyTimeMinutes,
      dailyGoalXp: form.dailyGoalXp,
    };
  }

  async function next() {
    const target = step + 1;
    if (await persist({ ...currentAnswers(), step: target })) setStep(target);
  }

  async function back() {
    const target = Math.max(0, step - 1);
    if (await persist({ ...currentAnswers(), step: target })) setStep(target);
  }

  async function finish() {
    if (!(await persist({ ...currentAnswers(), onboardingComplete: true }))) return;

    // `onboardingState.notificationsEnabled` (just written above) is a record
    // of what this step asked — nothing reads it back. `notificationSettings.studyReminders`
    // is what `ReminderProcessor` actually checks server-side, and what this
    // client schedules a device notification for (see `lib/notifications.ts`).
    // A "yes" here has to reach both, or the toggle the learner just set was
    // a formality. A denied permission is not treated as a failure of setup —
    // it just leaves the reminder off, silently, the same as declining on any
    // other app's first-run prompt.
    if (form.notificationsEnabled) {
      try {
        const granted = await requestNotificationPermission();
        await updateNotificationSettings({ studyReminders: granted });
        if (granted) await scheduleStudyReminder(form.preferredStudyTime);
      } catch {
        // Setup is still complete without reminders — do not block finishing
        // the wizard over a notification permission round trip.
      }
    }

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

      {step === 0 ? <WelcomeStep onNext={() => void next()} saving={saving} /> : null}
      {step === 1 ? (
        <LanguageStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 2 ? (
        <LevelStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 3 ? (
        <GoalsStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 4 ? (
        <DailyGoalStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 5 ? (
        <StyleStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 6 ? (
        <StudyTimeStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 7 ? <PlacementTestStep onNext={() => void next()} onBack={() => void back()} saving={saving} /> : null}
      {step === 8 ? (
        <NotificationsStep form={form} setForm={setForm} onNext={() => void next()} onBack={() => void back()} saving={saving} />
      ) : null}
      {step === 9 ? <AiPersonalizationStep onNext={() => void next()} onBack={() => void back()} saving={saving} /> : null}
      {step === 10 ? <CompleteStep form={form} onFinish={() => void finish()} onBack={() => void back()} saving={saving} /> : null}
    </ScrollView>
  );
}

/** Dots rather than a fraction — matches web's `Dot` row, one glance to see how much is left. */
function StepDots({ step }: { step: number }) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step + 1} of ${TOTAL_STEPS}`}
      style={{ flexDirection: 'row', gap: theme.spacing.xs, justifyContent: 'center' }}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: i <= step ? theme.colors.ink : theme.colors.hairline,
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

/** Back + Continue, the shape every step but Welcome/placement-test/Complete uses. */
function StepButtons({
  onNext,
  onBack,
  saving,
  disabled,
  nextLabel = 'Continue',
}: {
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  disabled?: boolean;
  nextLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Button label="Back" variant="secondary" onPress={onBack} disabled={saving} />
      </View>
      <View style={{ flex: 2 }}>
        <Button label={nextLabel} onPress={onNext} loading={saving} disabled={disabled} />
      </View>
    </View>
  );
}

type StepProps = {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
};

function WelcomeStep({ onNext, saving }: { onNext: () => void; saving: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl, flex: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
        <Text style={{ fontFamily: theme.families.jaBold, fontSize: 44, color: theme.colors.ink }}>言</Text>
        <StepHeading
          title="Welcome to langapp"
          subtitle="Let’s personalize your learning experience. A few quick questions so we can tailor your journey to Japanese fluency."
        />
      </View>
      <Button label="Get started" onPress={onNext} loading={saving} />
    </View>
  );
}

function LanguageStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading
        title="What’s your native language?"
        subtitle="This helps us show translations and explanations you understand."
      />

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {LANGUAGES.map((lang) => (
            <ChoiceCard
              key={lang.value}
              title={lang.label}
              selected={form.nativeLanguage === lang.value}
              onPress={() => setForm((prev) => ({ ...prev, nativeLanguage: lang.value }))}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>
          Learning
        </Text>
        <View
          style={{
            height: theme.controlHeight,
            borderRadius: theme.radius.md,
            borderWidth: theme.hairlineWidth,
            borderColor: theme.colors.hairline,
            paddingHorizontal: theme.spacing.lg,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.bodyLarge, color: theme.colors.inkSoft }}>
            Japanese 🇯🇵
          </Text>
        </View>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft }}>
          More languages coming soon.
        </Text>
      </View>

      <StepButtons onNext={onNext} onBack={onBack} saving={saving} />
    </View>
  );
}

function LevelStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  return (
    <View style={{ gap: 24 }}>
      <StepHeading title="How much Japanese do you know?" subtitle="Don’t worry — you can always change this later." />
      <View style={{ gap: 8 }}>
        {LEVELS.map((level) => (
          <ChoiceCard
            key={level.value}
            title={level.label}
            description={level.desc}
            selected={form.proficiencyLevel === level.value}
            onPress={() => setForm((prev) => ({ ...prev, proficiencyLevel: level.value }))}
          />
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} disabled={!form.proficiencyLevel} />
    </View>
  );
}

function GoalsStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  function toggle(goal: string) {
    setForm((prev) => ({
      ...prev,
      learningGoals: prev.learningGoals.includes(goal)
        ? prev.learningGoals.filter((g) => g !== goal)
        : [...prev.learningGoals, goal],
    }));
  }

  return (
    <View style={{ gap: 24 }}>
      <StepHeading title="What are your goals?" subtitle="Select all that apply. We’ll tailor your path accordingly." />
      <View style={{ gap: 8 }}>
        {GOALS.map((goal) => (
          <ChoiceCard
            key={goal.value}
            title={goal.label}
            variant="checkbox"
            selected={form.learningGoals.includes(goal.value)}
            onPress={() => toggle(goal.value)}
          />
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} disabled={form.learningGoals.length === 0} />
    </View>
  );
}

function DailyGoalStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  const theme = useTheme();
  const questionsPerSession = Math.round(form.dailyGoalXp / 5);

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading title="Set your daily goal" subtitle="How much do you want to study each day?" />

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>
          {`Daily XP goal — ${form.dailyGoalXp} XP`}
        </Text>
        <SegmentedControl
          label="Daily XP goal"
          options={XP_OPTIONS}
          value={form.dailyGoalXp}
          onChange={(value) => setForm((prev) => ({ ...prev, dailyGoalXp: value }))}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>
          {`Study time per day — ${form.studyTimeMinutes} min`}
        </Text>
        <SegmentedControl
          label="Study time per day"
          options={STUDY_MINUTES_OPTIONS}
          value={form.studyTimeMinutes}
          onChange={(value) => setForm((prev) => ({ ...prev, studyTimeMinutes: value }))}
        />
        <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft, textAlign: 'center' }}>
          {`~${questionsPerSession} questions per session`}
        </Text>
      </View>

      <StepButtons onNext={onNext} onBack={onBack} saving={saving} />
    </View>
  );
}

function StyleStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  return (
    <View style={{ gap: 24 }}>
      <StepHeading title="How do you learn best?" subtitle="We’ll emphasize the methods that work for you." />
      <View style={{ gap: 8 }}>
        {STYLES.map((style) => (
          <ChoiceCard
            key={style.value}
            title={style.label}
            description={style.desc}
            selected={form.learningStyle === style.value}
            onPress={() => setForm((prev) => ({ ...prev, learningStyle: style.value }))}
          />
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} disabled={!form.learningStyle} />
    </View>
  );
}

function StudyTimeStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  return (
    <View style={{ gap: 24 }}>
      <StepHeading title="When do you prefer to study?" subtitle="We’ll schedule reminders at the right time." />
      <View style={{ gap: 8 }}>
        {STUDY_TIMES.map((t) => (
          <ChoiceCard
            key={t.value}
            title={t.label}
            selected={form.preferredStudyTime === t.value}
            onPress={() => setForm((prev) => ({ ...prev, preferredStudyTime: t.value }))}
          />
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} disabled={!form.preferredStudyTime} />
    </View>
  );
}

/**
 * No real test exists to take (see this file's header comment) — matches
 * web's own placement-test step exactly: an intro, and a skip.
 */
function PlacementTestStep({ onNext, onBack, saving }: { onNext: () => void; onBack: () => void; saving: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading
        title="Find your starting point"
        subtitle="A quick assessment to place you at the right level so you don’t waste time on what you already know."
      />
      <View style={{ gap: theme.spacing.sm }}>
        {['15 quick questions', 'Adaptive difficulty', 'Covers vocabulary & grammar'].map((feature, i) => (
          <View key={feature} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: theme.radius.pill,
                borderWidth: theme.hairlineWidth,
                borderColor: theme.colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.caption, color: theme.colors.inkSoft }}>
                {i + 1}
              </Text>
            </View>
            <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ink }}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} nextLabel="Skip for now" />
    </View>
  );
}

function NotificationsStep({ form, setForm, onNext, onBack, saving }: StepProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading title="Stay on track" subtitle="We’ll send gentle reminders to help you build a consistent habit." />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.lg,
          padding: theme.spacing.lg,
          borderRadius: theme.radius.md,
          borderWidth: theme.hairlineWidth,
          borderColor: theme.colors.hairline,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ink }}>
            Study reminders
          </Text>
          <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.small, color: theme.colors.inkSoft }}>
            Get notified when it’s time to review
          </Text>
        </View>
        <SegmentedControl
          label="Study reminders"
          options={TOGGLE_OPTIONS}
          value={form.notificationsEnabled}
          onChange={(value) => setForm((prev) => ({ ...prev, notificationsEnabled: value }))}
        />
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} />
    </View>
  );
}

/**
 * Not in web's wizard or `OnboardingDto` — see this file's header comment.
 * Explains the personalization rather than collecting or persisting anything.
 */
function AiPersonalizationStep({ onNext, onBack, saving }: { onNext: () => void; onBack: () => void; saving: boolean }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading
        title="Your AI tutor is listening"
        subtitle="Everything you just told us shapes how it teaches you."
      />
      <View style={{ gap: theme.spacing.md }}>
        <PersonalizationPoint text="Chat scenarios lean toward the goals you picked — conversation, travel, JLPT, or work." />
        <PersonalizationPoint text="Explanations match your level, from absolute beginner to near-native." />
        <PersonalizationPoint text="Review pacing follows the daily goal you set, not a fixed schedule." />
      </View>
      <StepButtons onNext={onNext} onBack={onBack} saving={saving} />
    </View>
  );
}

function PersonalizationPoint({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.ink }}>{'・'}</Text>
      <Text
        style={{
          flex: 1,
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          lineHeight: theme.lineHeight.body,
          color: theme.colors.inkSoft,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function CompleteStep({
  form,
  onFinish,
  onBack,
  saving,
}: {
  form: FormState;
  onFinish: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const theme = useTheme();

  const levelLabel = LEVELS.find((l) => l.value === form.proficiencyLevel)?.label ?? 'Not set';
  const styleLabel = STYLES.find((s) => s.value === form.learningStyle)?.label ?? 'Not set';
  const timeLabel = STUDY_TIMES.find((t) => t.value === form.preferredStudyTime)?.label ?? 'Not set';
  const langLabel = LANGUAGES.find((l) => l.value === form.nativeLanguage)?.label ?? 'English';
  const goalLabels =
    form.learningGoals.map((g) => GOALS.find((x) => x.value === g)?.label).filter(Boolean).join(', ') || 'None';

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <StepHeading title="You’re all set!" subtitle="Here’s a summary of your preferences. You can change these anytime in Settings." />

      <View style={{ gap: 0 }}>
        <SummaryRow label="Native language" value={langLabel} />
        <SummaryRow label="Japanese level" value={levelLabel} />
        <SummaryRow label="Goals" value={goalLabels} />
        <SummaryRow label="Daily XP" value={`${form.dailyGoalXp} XP`} />
        <SummaryRow label="Study time" value={`${form.studyTimeMinutes} min/day, ${timeLabel.toLowerCase()}`} />
        <SummaryRow label="Learning style" value={styleLabel} />
        <SummaryRow label="Notifications" value={form.notificationsEnabled ? 'Enabled' : 'Disabled'} last />
      </View>

      <View style={{ gap: theme.spacing.md }}>
        <Button label="Start learning" onPress={onFinish} loading={saving} />
        <Button label="Back" variant="secondary" onPress={onBack} disabled={saving} />
      </View>
    </View>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: last ? 0 : theme.hairlineWidth,
        borderBottomColor: theme.colors.hairline,
      }}
    >
      <Text style={{ fontFamily: theme.families.ui, fontSize: theme.fontSize.body, color: theme.colors.inkSoft }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontFamily: theme.families.ui,
          fontSize: theme.fontSize.body,
          color: theme.colors.ink,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
