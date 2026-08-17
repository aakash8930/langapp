import * as Haptics from 'expo-haptics';

/**
 * Haptics are a garnish, never a signal on their own — the screen always says
 * the same thing in colour and text. They are absent on web, silent on some
 * Android hardware, and reject rather than no-op when the motor is missing, so
 * every call here is fired and forgotten. A phone that cannot buzz must still
 * be able to answer a question.
 */

/** Acknowledges the press itself, before the server has said anything. */
export function tapFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Confirms a confidence choice in a local study session. Medium rather than Light: this one is a
 * committed decision that immediately moves the card away, and it wants to feel
 * different under the thumb from the tap that merely revealed the answer.
 */
export function gradeFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * Warning, not Error, for a wrong answer: Error is a three-pulse pattern that
 * reads as "the app broke", and getting a character wrong is the ordinary case
 * in a drill, not a failure.
 */
export function answerFeedback(correct: boolean): void {
  void Haptics.notificationAsync(
    correct
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning,
  ).catch(() => {});
}
