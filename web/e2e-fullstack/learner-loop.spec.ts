import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

const API = 'http://127.0.0.1:3000/v1';
const MAILPIT = 'http://127.0.0.1:8025';
const EMAIL = `fullstack-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'new-correct-horse-battery';

type MailpitList = { messages?: Array<{ ID?: string; Id?: string; Subject?: string }> };

async function verificationCode(request: APIRequestContext, subject: RegExp): Promise<string> {
  await expect.poll(async () => {
    const response = await request.get(`${MAILPIT}/api/v1/messages`);
    if (!response.ok()) return null;
    const body = await response.json() as MailpitList;
    const message = body.messages?.find((entry) =>
      subject.test(entry.Subject ?? '') && JSON.stringify(entry).includes(EMAIL));
    return message?.ID ?? message?.Id ?? null;
  }, { timeout: 15_000, message: `mail matching ${subject} should reach Mailpit` }).not.toBeNull();

  const list = await request.get(`${MAILPIT}/api/v1/messages`);
  const body = await list.json() as MailpitList;
  const message = body.messages?.find((entry) =>
    subject.test(entry.Subject ?? '') && JSON.stringify(entry).includes(EMAIL));
  const id = message?.ID ?? message?.Id;
  if (!id) throw new Error(`Mailpit listed no message matching ${subject}`);

  const detail = await request.get(`${MAILPIT}/api/v1/message/${id}`);
  const serialized = JSON.stringify(await detail.json());
  const match = serialized.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`Mailpit message ${id} contained no six-digit code`);
  return match[1];
}

async function csrf(context: BrowserContext): Promise<Record<string, string>> {
  const token = (await context.cookies()).find((cookie) => cookie.name === 'genko_csrf')?.value;
  if (!token) throw new Error('Browser session has no CSRF cookie');
  return { 'x-csrf-token': token };
}

async function fillSignup(page: Page) {
  await page.getByLabel('Display name').fill('Full Stack Learner');
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByLabel('Date of birth').fill('2000-01-01');
  await page.getByRole('checkbox').check();
}

test('real signup, mail, onboarding, lesson, and recovery loop', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/signup');
  await fillSignup(page);
  await page.getByRole('button', { name: 'Create my learning profile' }).click();

  await expect(page).toHaveURL(/#\/verify-email/);
  const code = await verificationCode(page.request, /verify your genkō account/i);
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify email' }).click();

  await expect(page).toHaveURL(/#\/onboarding/);
  await page.getByRole('radio', { name: /New to Japanese/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Speak with confidence/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /15 minutes/ }).click();
  await page.getByRole('button', { name: 'Save and start learning' }).click();
  await expect(page).toHaveURL(/#\/$/);

  const lessonsResponse = await page.request.get(`${API}/lessons`);
  expect(lessonsResponse.ok()).toBeTruthy();
  const lessons = await lessonsResponse.json() as Array<{ id: string; unit: string; order: number }>;
  expect(lessons.length).toBeGreaterThan(0);
  const firstLesson = lessons.find((lesson) =>
    lesson.unit === 'hiragana-basics' && lesson.order === 0);
  expect(firstLesson, 'seeded first hiragana lesson').toBeTruthy();
  const lessonId = firstLesson!.id;

  const exerciseResponse = await page.request.get(`${API}/lessons/${lessonId}/exercises?attempt=0`);
  expect(exerciseResponse.ok()).toBeTruthy();
  const exerciseSet = await exerciseResponse.json() as {
    questions: Array<{
      exerciseId: string;
      type: string;
      options?: Array<{ id: string }>;
    }>;
  };
  expect(exerciseSet.questions.length).toBeGreaterThan(0);

  for (const question of exerciseSet.questions) {
    const headers = await csrf(context);
    const firstBody = question.type === 'wordReading'
      ? { text: 'wrong', responseTimeMs: 250 }
      : { optionId: question.options?.[0]?.id, responseTimeMs: 250 };
    const first = await page.request.post(
      `${API}/lessons/${lessonId}/exercises/${question.exerciseId}/answer`,
      { data: firstBody, headers },
    );
    expect(first.ok()).toBeTruthy();
    const result = await first.json() as {
      correct: boolean;
      correctOptionId: string;
      correctValue: string;
    };
    if (!result.correct) {
      const correctBody = question.type === 'wordReading'
        ? { text: result.correctValue, responseTimeMs: 300 }
        : { optionId: result.correctOptionId, responseTimeMs: 300 };
      const corrected = await page.request.post(
        `${API}/lessons/${lessonId}/exercises/${question.exerciseId}/answer`,
        { data: correctBody, headers: await csrf(context) },
      );
      expect(corrected.ok()).toBeTruthy();
      expect((await corrected.json() as { correct: boolean }).correct).toBeTruthy();
    }
  }

  const completed = await page.request.post(`${API}/lessons/${lessonId}/complete`, {
    headers: await csrf(context),
  });
  expect(completed.ok()).toBeTruthy();

  const progress = await page.request.get(`${API}/me/progress`);
  expect(progress.ok()).toBeTruthy();
  expect((await progress.json() as { completedLessonIds: string[] }).completedLessonIds)
    .toContain(lessonId);

  const forgot = await page.request.post(`${API}/auth/forgot-password`, { data: { email: EMAIL } });
  expect(forgot.ok()).toBeTruthy();
  const resetCode = await verificationCode(page.request, /password reset/i);
  const reset = await page.request.post(`${API}/auth/reset-password`, {
    data: { email: EMAIL, code: resetCode, newPassword: NEW_PASSWORD },
  });
  expect(reset.ok()).toBeTruthy();

  const login = await page.request.post(`${API}/auth/browser/login`, {
    data: { email: EMAIL, password: NEW_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
});
