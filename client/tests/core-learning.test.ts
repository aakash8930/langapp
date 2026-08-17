import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LessonSummary } from '../api/lessons';
import { groupByUnit, lessonAfter, nextLesson, unitLabel, withLockState } from '../lib/lessons';
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

  const n4 = groupByUnit(withLockState([
    lesson('kanji-n4-1', 'kanji-n4', 0),
    lesson('vocab-n4-1', 'vocab-n4', 0),
    lesson('grammar-n4-1', 'grammar-n4', 0),
  ], []));
  assert.deepEqual(n4.map((unit) => unit.unit), ['vocab-n4', 'grammar-n4', 'kanji-n4']);
  assert.equal(unitLabel('grammar-n4'), 'N4 grammar');
});

test('romaji support stops after the authored N4 boundary', () => {
  assert.equal(showsRomaji('N5'), true);
  assert.equal(showsRomaji('N4'), true);
  assert.equal(showsRomaji('N3'), false);
  assert.equal(showsRomaji(undefined), false);
});
