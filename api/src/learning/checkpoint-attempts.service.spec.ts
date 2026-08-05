import {
  CheckpointAttemptsService,
  COMBINED_UNIT_PREFIX,
} from './checkpoint-attempts.service';

describe('CheckpointAttemptsService.combinedUnitMarker', () => {
  it('is stable for the same slug set regardless of input order', () => {
    const service = new CheckpointAttemptsService({} as never);

    const a = service.combinedUnitMarker(['hiragana-basics', 'katakana-basics']);
    const b = service.combinedUnitMarker(['katakana-basics', 'hiragana-basics']);

    expect(a).toBe(b);
  });

  it('changes when the slug set changes', () => {
    const service = new CheckpointAttemptsService({} as never);

    const before = service.combinedUnitMarker(['hiragana-basics']);
    const after = service.combinedUnitMarker(['hiragana-basics', 'katakana-basics']);

    expect(after).not.toBe(before);
  });

  it('is prefixed so the value is self-describing in logs and the index', () => {
    const service = new CheckpointAttemptsService({} as never);

    const marker = service.combinedUnitMarker(['hiragana-basics']);

    expect(marker.startsWith(COMBINED_UNIT_PREFIX)).toBe(true);
  });
});