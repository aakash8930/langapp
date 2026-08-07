import { useQuery } from '@tanstack/react-query';

import { fetchKanaCurriculum, type KanaCurriculumRow } from '../api';
import { queryKeys } from '../queryKeys';
import { useSession } from '../useSession';

export function useKanaData(script: 'hiragana' | 'katakana') {
  const { session } = useSession();

  const curriculum = useQuery({
    queryKey: queryKeys.content.kanaCurriculum,
    queryFn: fetchKanaCurriculum,
    staleTime: 60 * 60_000,
  });

  const kana = (curriculum.data ?? []).filter((entry) => entry.script === script);

  const known = new Set(
    session.state === 'signedIn' ? (session.user.learningState?.knownKana ?? []) : [],
  );

  const learned = kana.filter((entry) => known.has(entry.kana));
  const unlearned = kana.filter((entry) => !known.has(entry.kana));

  return {
    kana,
    learned,
    unlearned,
    known,
    isPending: curriculum.isPending,
    isError: curriculum.isError,
    error: curriculum.error,
    titleGlyph: script === 'hiragana' ? 'あ' : 'ア',
    chartPath: script === 'hiragana' ? '/hiragana' as const : '/katakana' as const,
    scriptLabel: script === 'hiragana' ? 'Hiragana' : 'Katakana',
  };
}

export type { KanaCurriculumRow };
