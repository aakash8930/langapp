import { startingRecommendation } from './starting-recommendation';

describe('startingRecommendation', () => {
  it('keeps a true beginner on kana and explains why the goal comes later', () => {
    expect(startingRecommendation({
      proficiencyLevel: 'beginner',
      learningGoals: ['conversation'],
    })).toMatchObject({
      unit: 'hiragana-basics',
      availableLevel: 'beginner',
      fallback: false,
      reason: expect.stringContaining('kana comes first'),
    });
  });

  it.each([
    ['reading', 'kanji-basics'],
    ['jlpt', 'grammar-basics'],
    ['travel', 'vocab-basics'],
  ])('maps an N5 %s goal to %s', (goal, unit) => {
    expect(startingRecommendation({
      proficiencyLevel: 'n5',
      learningGoals: [goal],
    })).toMatchObject({ unit, availableLevel: 'n5', fallback: false, goal });
  });

  it.each([
    ['reading', 'kanji-n4'],
    ['jlpt', 'grammar-n4'],
    ['work', 'vocab-n4'],
  ])('maps an N4 %s goal to %s', (goal, unit) => {
    expect(startingRecommendation({
      proficiencyLevel: 'n4',
      learningGoals: [goal],
    })).toMatchObject({ unit, availableLevel: 'n4', fallback: false, goal });
  });

  it.each(['n3', 'n2', 'n1'])('discloses the highest-available N4 fallback for %s', (level) => {
    expect(startingRecommendation({
      proficiencyLevel: level,
      learningGoals: ['jlpt'],
    })).toMatchObject({
      unit: 'grammar-n4',
      requestedLevel: level,
      availableLevel: 'n4',
      fallback: true,
      reason: expect.stringContaining('highest available'),
    });
  });
});
