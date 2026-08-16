import { validate } from 'class-validator';
import { OnboardingDto } from './onboarding.dto';

async function errors(patch: Partial<OnboardingDto>) {
  return validate(Object.assign(new OnboardingDto(), patch));
}

describe('OnboardingDto — three-choice contract', () => {
  it('accepts the starting level, one primary goal, and daily commitment', async () => {
    await expect(
      errors({
        proficiencyLevel: 'n5',
        learningGoals: ['conversation'],
        studyTimeMinutes: 15,
        dailyGoalXp: 50,
        onboardingComplete: true,
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects unknown levels and goals', async () => {
    const result = await errors({
      proficiencyLevel: 'expert',
      learningGoals: ['secret-goal'],
    });

    expect(result.map((error) => error.property)).toEqual(
      expect.arrayContaining(['proficiencyLevel', 'learningGoals']),
    );
  });

  it('requires exactly one goal whenever the goal choice is sent', async () => {
    await expect(errors({ learningGoals: [] })).resolves.toHaveLength(1);
    await expect(errors({ learningGoals: ['reading', 'travel'] })).resolves.toHaveLength(1);
  });
});
