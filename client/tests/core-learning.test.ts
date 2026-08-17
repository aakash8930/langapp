import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GradeResult } from '../api/reviews';
import type { LessonSummary } from '../api/lessons';
import { groupByUnit, lessonAfter, nextLesson, withLockState } from '../lib/lessons';
import { formatInterval, summarize } from '../lib/reviews';
import { showsRomaji } from '../lib/romaji';

function lesson(
  id: string,
  unit: string,
  order: number,
  prerequisiteLessonIds: string[] = [],
): LessonSummary {
  return {
    id,
    lang: 'ja',
    unit,
    order,
    title: id,
    exerciseTypes: ['multipleChoice'],
    itemCount: 1,
    prerequisiteLessonIds,
  };
}

test('mobile course path honors prerequisites and teaching order', () => {
  const source = [
    lesson('kata-1', 'katakana-basics', 0, ['hira-2']),
    lesson('hira-2', 'hiragana-basics', 1, ['hira-1']),
    lesson('hira-1', 'hiragana-basics', 0),
  ];

  const initial = groupByUnit(withLockState(source, []));
  assert.equal(initial[0].unit, 'hiragana-basics');
  assert.equal(initial[0].status, 'current');
  assert.equal(initial[1].status, 'locked');
  assert.equal(nextLesson(initial)?.id, 'hira-1');
  assert.equal(lessonAfter(initial, 'hira-1')?.id, 'hira-2');

  const advanced = groupByUnit(withLockState(source, ['hira-1', 'hira-2']));
  assert.equal(advanced[0].status, 'done');
  assert.equal(advanced[1].status, 'current');
  assert.equal(nextLesson(advanced)?.id, 'kata-1');
});

test('mobile review summary counts only server-confirmed grades', () => {
  const results = [
    { grade: 'again', xpAwarded: 1, intervalMinutes: 1 },
    { grade: 'good', xpAwarded: 3, intervalMinutes: 10 },
    { grade: 'easy', xpAwarded: 4, intervalMinutes: 60 * 24 * 8 },
  ] as GradeResult[];

  assert.deepEqual(summarize(results), {
    reviewed: 3,
    recalled: 2,
    accuracyPercent: 67,
    xpEarned: 8,
    nextDueMinutes: 1,
  });
  assert.deepEqual(summarize([]), {
    reviewed: 0,
    recalled: 0,
    accuracyPercent: 0,
    xpEarned: 0,
    nextDueMinutes: null,
  });
  assert.equal(formatInterval(1), 'in 1 minute');
  assert.equal(formatInterval(60 * 24 * 2), 'in 2 days');
});

test('romaji support stops after the authored N4 boundary', () => {
  assert.equal(showsRomaji('N5'), true);
  assert.equal(showsRomaji('N4'), true);
  assert.equal(showsRomaji('N3'), false);
  assert.equal(showsRomaji(undefined), false);
});
