import { expect, test, type Page, type Route } from '@playwright/test';

type TestUser = ReturnType<typeof makeUser>;

function makeUser() {
  return {
    id: 'user-1',
    email: 'learner@example.com',
    isAdmin: false,
    emailVerified: false,
    profile: {
      displayName: 'Aki Learner',
      nativeLanguage: 'en',
      activeTrack: 'ja',
    },
    gamification: {
      xp: 0,
      streakDays: 0,
      lastStudyDate: null,
      dailyGoalXp: 50,
    },
    settings: {
      audioSpeed: 1,
      theme: 'system',
      tz: 'Asia/Kolkata',
      leaderboardOptIn: false,
    },
    learningState: { knownKana: [] },
    onboardingState: {
      onboardingComplete: false,
      onboardingStep: 0,
      targetLanguage: 'ja',
      proficiencyLevel: '',
      learningGoals: [] as string[],
      learningStyle: '',
      preferredStudyTime: '',
      notificationsEnabled: false,
      studyTimeMinutes: 15,
      placementTestCompleted: false,
      placementTestScore: null,
      placementTestLevel: '',
    },
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page) {
  let signedIn = false;
  let user: TestUser = makeUser();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');

    if (path === '/auth/browser/register' && request.method() === 'POST') {
      signedIn = true;
      await json(route, {
        user,
        emailDelivery: { status: 'queued', deliveryId: 'delivery-1' },
      }, 201);
      return;
    }

    if (path === '/auth/browser/refresh') {
      await json(route, { message: 'No session' }, 401);
      return;
    }

    if (path === '/me' && request.method() === 'GET') {
      await json(route, signedIn ? user : { message: 'No session' }, signedIn ? 200 : 401);
      return;
    }

    if (path === '/auth/verify-email' && request.method() === 'POST') {
      user = { ...user, emailVerified: true };
      await json(route, { message: 'Email verified.' });
      return;
    }

    if (path === '/me/onboarding' && request.method() === 'PATCH') {
      const patch = request.postDataJSON() as Record<string, unknown>;
      user = {
        ...user,
        gamification: {
          ...user.gamification,
          ...('dailyGoalXp' in patch ? { dailyGoalXp: patch.dailyGoalXp as number } : {}),
        },
        onboardingState: {
          ...user.onboardingState,
          ...patch,
          onboardingStep: (patch.step as number | undefined) ?? user.onboardingState.onboardingStep,
        },
      };
      await json(route, user);
      return;
    }

    if (path === '/me/progress') {
      await json(route, {
        xp: 0,
        level: 1,
        xpIntoLevel: 0,
        xpForNextLevel: 100,
        streakDays: 0,
        lastStudyDate: null,
        daily: {
          xpToday: 0,
          goalXp: 50,
          percentOfGoal: 0,
          goalMet: false,
          reviewsDone: 0,
          lessonsDone: 0,
        },
        cardsDueNow: 0,
        lessonsCompleted: 0,
        completedLessonIds: [],
        passedUnits: [],
        startingRecommendation: {
          unit: 'hiragana-basics',
          title: 'Hiragana foundations',
          requestedLevel: 'beginner',
          availableLevel: 'beginner',
          goal: 'conversation',
          fallback: false,
          reason: 'Kana comes first.',
        },
      });
      return;
    }

    if (path === '/lessons') {
      await json(route, []);
      return;
    }

    await json(route, { message: `Unhandled test request: ${request.method()} ${path}` }, 500);
  });
}

async function fillSignup(page: Page) {
  await page.getByLabel('Display name').fill('Aki Learner');
  await page.getByLabel('Email address').fill('learner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await page.getByLabel('Confirm password').fill('correct-horse-battery');
  await page.getByLabel('Date of birth').fill('2000-01-01');
  await page.getByRole('checkbox').check();
}

test('signup preserves the form and explains a rejected account', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.route('**/api/auth/browser/register', (route) => json(route, {
    message: 'Email already registered',
  }, 409));
  await page.goto('/#/signup');
  await fillSignup(page);
  await page.getByRole('button', { name: 'Create my learning profile' }).click();

  await expect(page.getByRole('alert')).toContainText('account already exists');
  await expect(page.getByLabel('Email address')).toHaveValue('learner@example.com');
  await expect(page).toHaveURL(/#\/signup/);
});

test('signup, verification, account-state redirects, and onboarding form one browser journey', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.goto('/#/signup');

  await fillSignup(page);
  await page.getByRole('button', { name: 'Create my learning profile' }).click();

  await expect(page).toHaveURL(/#\/verify-email\?delivery=queued/);
  await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('queued');

  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify email' }).click();

  // The root account-state guard routes a verified but incomplete account to
  // onboarding; this checks the guard rather than navigating there directly.
  await expect(page).toHaveURL(/#\/onboarding/, { timeout: 5_000 });
  await expect(page.getByRole('heading', { name: 'Where should you start?' })).toBeVisible();

  await page.getByRole('radio', { name: /New to Japanese/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What matters most right now?' })).toBeVisible();

  await page.getByRole('radio', { name: /Speak with confidence/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'What can you sustain each day?' })).toBeVisible();

  await page.getByRole('radio', { name: /15 minutes/ }).click();
  await page.getByRole('button', { name: 'Save and start learning' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
