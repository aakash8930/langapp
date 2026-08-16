import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { fetchKanaCurriculum, type KanaCurriculumRow } from '../../api';
import { queryKeys } from '../../queryKeys';
import { useStrokes } from '../../strokes';
import { useSession } from '../../useSession';
import { Icon, type IconName } from '../ui/Icon';
import { SpeakButton } from '../SpeakButton';
import { StrokeOrder } from '../StrokeOrder';

import './kana-library.css';

type KanaScript = 'hiragana' | 'katakana';
type KanaStage = 'all' | 'vowels' | 'core' | 'more' | 'marks';

const BASE_ROWS = new Set(['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa', 'n']);
const CORE_ROWS = new Set(['ka', 'sa', 'ta', 'na']);
const MORE_ROWS = new Set(['ha', 'ma', 'ya', 'ra', 'wa', 'n']);

const STAGES: {
  id: Exclude<KanaStage, 'all'>;
  number: string;
  title: string;
  note: string;
  glyph: Record<KanaScript, string>;
}[] = [
  { id: 'vowels', number: '01', title: 'Five vowels', note: 'The sounds behind every kana row.', glyph: { hiragana: 'あ', katakana: 'ア' } },
  { id: 'core', number: '02', title: 'Core rows', note: 'K, S, T, and N — learn one row at a time.', glyph: { hiragana: 'か', katakana: 'カ' } },
  { id: 'more', number: '03', title: 'Complete the base', note: 'H, M, Y, R, W, and the final N.', glyph: { hiragana: 'ま', katakana: 'マ' } },
  { id: 'marks', number: '04', title: 'Marks & blends', note: 'Dakuten, handakuten, and small ゃゅょ.', glyph: { hiragana: 'が', katakana: 'ガ' } },
];

const ROUTES = {
  hiragana: {
    chart: '/hiragana' as const,
    other: '/katakana' as const,
    writing: '/hiragana-writing' as const,
    reading: '/hiragana-reading' as const,
    listening: '/hiragana-listening' as const,
    flashcards: '/hiragana-flashcards' as const,
    mistakes: '/hiragana-mistakes' as const,
  },
  katakana: {
    chart: '/katakana' as const,
    other: '/hiragana' as const,
    writing: '/katakana-writing' as const,
    reading: '/katakana-reading' as const,
    listening: '/katakana-listening' as const,
    flashcards: '/katakana-flashcards' as const,
    mistakes: '/katakana-mistakes' as const,
  },
};

type KanaRoute = (typeof ROUTES)[KanaScript][keyof (typeof ROUTES)['hiragana']];

const CONFUSING_PAIRS = {
  hiragana: [
    { chars: ['さ', 'き'], note: 'Watch the lower curve and where the lines cross.' },
    { chars: ['ぬ', 'め'], note: 'ぬ finishes with a small loop; め does not.' },
    { chars: ['れ', 'ね'], note: 'ね closes with a loop on the right.' },
    { chars: ['あ', 'お'], note: 'あ has the stronger crossing shape in the centre.' },
  ],
  katakana: [
    { chars: ['シ', 'ツ'], note: 'シ points across; ツ drops more vertically from the top.' },
    { chars: ['ソ', 'ン'], note: 'Follow the stroke direction, not only the final silhouette.' },
    { chars: ['ク', 'ケ'], note: 'ケ adds a separate vertical stroke on the left.' },
    { chars: ['ウ', 'ワ'], note: 'ウ carries the short mark across its top.' },
  ],
} as const;

function stageContains(stage: KanaStage, row: string): boolean {
  if (stage === 'all') return true;
  if (stage === 'vowels') return row === 'a';
  if (stage === 'core') return CORE_ROWS.has(row);
  if (stage === 'more') return MORE_ROWS.has(row);
  return !BASE_ROWS.has(row);
}

function stageForRow(row: string): Exclude<KanaStage, 'all'> {
  if (row === 'a') return 'vowels';
  if (CORE_ROWS.has(row)) return 'core';
  if (MORE_ROWS.has(row)) return 'more';
  return 'marks';
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function soundGuide(romaji: string): { breakdown: string; tip: string } {
  const special: Record<string, string> = {
    shi: 'Like “she” without stretching the vowel.',
    chi: 'Like “chee” in “cheese”, but kept to one short beat.',
    tsu: 'Say the end of “cats” and a short “oo” together: tsu.',
    fu: 'A soft breath between English f and h, followed by a short “oo”.',
    ji: 'Like “jee”, short and clean.',
    wo: 'Usually pronounced simply “o” in modern Japanese.',
    n: 'A light nasal n sound; it is the only kana without a following vowel.',
  };
  if (special[romaji]) return { breakdown: romaji.toUpperCase(), tip: special[romaji] };

  const vowel = [...romaji].at(-1) ?? '';
  const vowelTips: Record<string, string> = {
    a: '“a” as in “father”, kept short.',
    i: '“ee” as in “machine”, kept short.',
    u: 'A short “oo” sound, made with relaxed, mostly unrounded lips.',
    e: '“e” as in “met”.',
    o: 'A short “o” as in “more”.',
  };
  const consonant = romaji.slice(0, -1);
  const base = vowelTips[vowel] ?? 'Say it as one even Japanese beat.';
  const rNote = consonant.startsWith('r')
    ? ' The Japanese r is a quick tongue tap between an English r and l.'
    : '';

  return {
    breakdown: consonant ? `${consonant.toUpperCase()} + ${vowel.toUpperCase()}` : vowel.toUpperCase(),
    tip: `${base}${rNote}`,
  };
}

function titleFor(script: KanaScript): string {
  return script === 'hiragana' ? 'Hiragana' : 'Katakana';
}

function glyphFor(script: KanaScript): string {
  return script === 'hiragana' ? 'あ' : 'ア';
}

function scriptPurpose(script: KanaScript): string {
  return script === 'hiragana'
    ? 'Hiragana is the foundation of Japanese reading. It writes grammar, word endings, and many native Japanese words.'
    : 'Katakana writes loanwords, foreign names, sound effects, and words that need emphasis. Its sounds match hiragana exactly.';
}

function findPair(entry: KanaCurriculumRow, script: KanaScript) {
  return CONFUSING_PAIRS[script].find((pair) => pair.chars.some((char) => char === entry.kana));
}

function KanaDetail({
  entry,
  script,
  known,
  audioSpeed,
  position,
  total,
  onPrevious,
  onNext,
  onSelectCharacter,
}: {
  entry: KanaCurriculumRow;
  script: KanaScript;
  known: boolean;
  audioSpeed: number;
  position: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelectCharacter: (char: string) => void;
}) {
  const strokes = useStrokes(entry.kana);
  const guide = soundGuide(entry.romaji);
  const pair = findPair(entry, script);
  const routes = ROUTES[script];
  const partner = pair?.chars.find((char) => char !== entry.kana);

  return (
    <section className="kana-detail kana-study-detail glass" id="kana-study-detail" aria-live="polite" aria-labelledby="kana-focus-heading">
      <div className="kana-detail-head">
        <div>
          <p className="kana-kicker">CHARACTER FOCUS</p>
          <h2 id="kana-focus-heading">Learn this sound</h2>
        </div>
        <span className={`kana-status${known ? ' is-known' : ''}`}>{known ? 'Learned' : 'Learning'}</span>
      </div>

      <div className="kana-focus-glyph-wrap">
        <p className="kana-detail-glyph ja" lang="ja">{entry.kana}</p>
        <div>
          <p className="kana-detail-romaji">{entry.romaji}</p>
          <SpeakButton kanaId={entry.id} text={entry.kana} label="Hear the sound" speed={audioSpeed} />
        </div>
      </div>

      <div className="kana-sound-card">
        <span className="kana-sound-breakdown">{guide.breakdown}</span>
        <p>{guide.tip}</p>
      </div>

      <div className="kana-memory-tip">
        <Icon name="sparkles" size={17} />
        <p><strong>Memory tip</strong> Say “{entry.romaji}” while tracing {entry.kana} in the air. Linking voice and movement is stronger than memorising romaji alone.</p>
      </div>

      {partner && pair ? (
        <button type="button" className="kana-confusion-tip" onClick={() => onSelectCharacter(partner)}>
          <span className="ja" aria-hidden="true">{entry.kana} / {partner}</span>
          <span><strong>Do not mix these up</strong><small>{pair.note}</small></span>
          <Icon name="chevron-right" size={14} />
        </button>
      ) : null}

      <details className="kana-writing-guide" open>
        <summary><span><Icon name="pen-tool" size={16} /> Writing and stroke order</span><Icon name="chevron-down" size={14} /></summary>
        <div>
          <StrokeOrder char={entry.kana} />
          {strokes.isError ? (
            <p className="kana-writing-fallback">No animated diagram is available yet. Copy the printed shape slowly, then compare it with the character above.</p>
          ) : null}
        </div>
      </details>

      <dl className="kana-detail-facts">
        <div><dt>Kana row</dt><dd>{entry.row}</dd></div>
        {entry.taughtInLesson === null ? null : <div><dt>Unit lesson</dt><dd>{entry.taughtInLesson + 1}</dd></div>}
        <div><dt>Your status</dt><dd>{known ? 'Learned in the course' : 'Not learned yet'}</dd></div>
      </dl>

      <div className="kana-detail-nav">
        <button type="button" onClick={onPrevious} aria-label="Previous character"><Icon name="chevron-left" size={15} /> Previous</button>
        <span className="tabular">{position} / {total}</span>
        <button type="button" onClick={onNext} aria-label="Next character">Next <Icon name="chevron-right" size={15} /></button>
      </div>

      <div className="kana-detail-actions">
        <Link className="btn btn-primary btn-sm" to={routes.flashcards}>Practise recall</Link>
        <Link className="btn btn-secondary btn-sm" to={routes.writing}>Practise writing</Link>
      </div>
    </section>
  );
}

export function KanaLibrary({ script }: { script: KanaScript }) {
  const { session } = useSession();
  const [selected, setSelected] = useState<KanaCurriculumRow | null>(null);
  const [stage, setStage] = useState<KanaStage>('all');
  const [query, setQuery] = useState('');
  const [showRomaji, setShowRomaji] = useState(true);

  const curriculum = useQuery({
    queryKey: queryKeys.content.kanaCurriculum,
    queryFn: fetchKanaCurriculum,
    staleTime: 60 * 60_000,
  });

  const known = new Set(
    session.state === 'signedIn' ? (session.user.learningState?.knownKana ?? []) : [],
  );
  const rows = (curriculum.data ?? []).filter((entry) => entry.script === script);
  const learned = rows.filter((entry) => known.has(entry.kana)).length;
  const progressPercent = rows.length > 0 ? Math.round((learned / rows.length) * 100) : 0;
  const nextUnlearned = rows.find((entry) => !known.has(entry.kana)) ?? null;
  const defaultFocus = nextUnlearned ?? rows[0] ?? null;
  const routes = ROUTES[script];
  const title = titleFor(script);
  const glyph = glyphFor(script);
  const search = normalize(query);

  const visibleRows = rows.filter((entry) => {
    const matchesStage = stageContains(stage, entry.row);
    const matchesQuery = !search
      || entry.kana.includes(search)
      || entry.romaji.toLocaleLowerCase().includes(search)
      || entry.row.toLocaleLowerCase().includes(search);
    return matchesStage && matchesQuery;
  });

  const groups: { row: string; entries: KanaCurriculumRow[] }[] = [];
  for (const entry of visibleRows) {
    const group = groups.find((candidate) => candidate.row === entry.row);
    if (group) group.entries.push(entry);
    else groups.push({ row: entry.row, entries: [entry] });
  }

  useEffect(() => {
    if (selected || !defaultFocus) return;
    setSelected(defaultFocus);
  }, [defaultFocus, selected]);

  function chooseStage(nextStage: KanaStage) {
    setStage(nextStage);
    setQuery('');
    const candidates = rows.filter((entry) => stageContains(nextStage, entry.row));
    setSelected(candidates.find((entry) => !known.has(entry.kana)) ?? candidates[0] ?? null);
  }

  function revealDetailOnCompactScreen() {
    if (!window.matchMedia?.('(max-width: 1060px)').matches) return;
    window.requestAnimationFrame(() => {
      document.getElementById('kana-study-detail')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }

  function chooseCharacter(entry: KanaCurriculumRow) {
    setSelected(entry);
    revealDetailOnCompactScreen();
  }

  function selectByCharacter(char: string) {
    const entry = rows.find((candidate) => candidate.kana === char);
    if (!entry) return;
    setStage('all');
    setQuery('');
    setSelected(entry);
    revealDetailOnCompactScreen();
  }

  function moveSelection(direction: -1 | 1) {
    const pool = visibleRows.length > 0 ? visibleRows : rows;
    if (pool.length === 0) return;
    const currentIndex = selected ? pool.findIndex((entry) => entry.id === selected.id) : -1;
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + pool.length) % pool.length;
    setSelected(pool[nextIndex] ?? null);
  }

  function focusNextCharacter() {
    if (!defaultFocus) return;
    setStage(stageForRow(defaultFocus.row));
    setQuery('');
    setSelected(defaultFocus);
    window.requestAnimationFrame(() => {
      document.getElementById('kana-study-detail')?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }

  const selectedPool = visibleRows.length > 0 ? visibleRows : rows;
  const selectedPosition = selected
    ? Math.max(1, selectedPool.findIndex((entry) => entry.id === selected.id) + 1)
    : 0;
  const audioSpeed = session.state === 'signedIn' ? session.user.settings.audioSpeed : 1;

  return (
    <div className="page kana-page kana-reference">
      <section className="kana-hero glass">
        <div className="kana-hero-content">
          <p className="kana-kicker">JAPANESE WRITING SYSTEM</p>
          <h1><span className="ja" aria-hidden="true">{glyph}</span>{title}</h1>
          <p>{scriptPurpose(script)}</p>
          <div className="kana-hero-actions">
            <button type="button" className="btn btn-primary" onClick={focusNextCharacter} disabled={!defaultFocus}>
              {learned === 0 ? 'Start with the first sound' : learned === rows.length ? 'Review the first character' : 'Learn the next character'} <Icon name="chevron-right" size={16} />
            </button>
            <Link className="btn btn-secondary" to={routes.other}>Switch to {script === 'hiragana' ? 'katakana' : 'hiragana'}</Link>
          </div>
        </div>

        <div className="kana-hero-sample" aria-hidden="true">
          <span className="ja">{script === 'hiragana' ? 'あいうえお' : 'アイウエオ'}</span>
          <small>a · i · u · e · o</small>
        </div>

        <div className="kana-progress-card">
          <div className="kana-progress-ring" style={{ '--kana-progress': `${progressPercent * 3.6}deg` } as React.CSSProperties}>
            <span><strong className="tabular">{progressPercent}%</strong><small>Learned</small></span>
          </div>
          <div>
            <strong className="tabular">{learned} / {rows.length || '—'}</strong>
            <span>{session.state === 'signedIn' ? 'Course-tracked characters' : 'Sign in to track progress'}</span>
            <Link to="/courses">Open kana lessons <Icon name="chevron-right" size={13} /></Link>
          </div>
        </div>
      </section>

      {curriculum.isPending ? (
        <div className="kana-loading glass"><span className="ja">{glyph}</span><p>Loading the learning chart…</p></div>
      ) : curriculum.isError ? (
        <p className="note note-error"><strong>The chart could not be loaded.</strong><span>The API may be asleep. Nothing is wrong with your progress.</span></p>
      ) : rows.length === 0 ? (
        <p className="card-note">The server returned no {title.toLowerCase()} characters.</p>
      ) : (
        <>
          <section className="kana-path glass" aria-labelledby={`${script}-path-heading`}>
            <div className="kana-section-head">
              <div><p className="kana-kicker">BEGINNER ROADMAP</p><h2 id={`${script}-path-heading`}>Learn in this order</h2></div>
              <button type="button" onClick={() => chooseStage('all')} className={stage === 'all' ? 'is-active' : ''}>View the full chart</button>
            </div>
            <ol className="kana-path-list">
              {STAGES.map((item) => {
                const entries = rows.filter((entry) => stageContains(item.id, entry.row));
                const done = entries.filter((entry) => known.has(entry.kana)).length;
                const percent = entries.length > 0 ? Math.round((done / entries.length) * 100) : 0;
                return (
                  <li key={item.id}>
                    <button type="button" className={stage === item.id ? 'is-active' : ''} onClick={() => chooseStage(item.id)} aria-pressed={stage === item.id}>
                      <span className="kana-path-number tabular">{item.number}</span>
                      <span className="kana-path-glyph ja" aria-hidden="true">{item.glyph[script]}</span>
                      <span className="kana-path-copy"><strong>{item.title}</strong><small>{item.note}</small></span>
                      <span className="kana-path-meta"><span className="tabular">{done}/{entries.length}</span><i aria-hidden="true"><i style={{ width: `${percent}%` }} /></i></span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <VowelGuide
            script={script}
            rows={rows}
            audioSpeed={audioSpeed}
            onSelect={selectByCharacter}
          />

          <div className="kana-learning-layout">
            <main className="kana-learning-main">
              <section className="kana-chart-card glass" aria-labelledby={`${script}-chart-heading`}>
                <div className="kana-chart-head">
                  <div><p className="kana-kicker">GOJŪON & COMBINATIONS</p><h2 id={`${script}-chart-heading`}>{title} learning chart</h2></div>
                  <span className="tabular">{visibleRows.length} characters</span>
                </div>

                <div className="kana-chart-tools">
                  <div className="kana-search" role="search">
                    <Icon name="search" size={15} />
                    <label className="visually-hidden" htmlFor={`${script}-search`}>Search {title.toLowerCase()} by character, romaji, or row</label>
                    <input id={`${script}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search kana or romaji…" />
                    {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear kana search">×</button> : null}
                  </div>
                  <button type="button" className={`kana-romaji-toggle${showRomaji ? ' is-active' : ''}`} onClick={() => setShowRomaji((current) => !current)} aria-pressed={showRomaji}>
                    <Icon name={showRomaji ? 'check' : 'search'} size={13} /> {showRomaji ? 'Romaji shown' : 'Romaji hidden'}
                  </button>
                </div>

                <div className="kana-stage-tabs" role="group" aria-label="Choose a kana learning stage">
                  <button type="button" className={stage === 'all' ? 'is-active' : ''} onClick={() => chooseStage('all')}>All</button>
                  {STAGES.map((item) => <button key={item.id} type="button" className={stage === item.id ? 'is-active' : ''} onClick={() => chooseStage(item.id)}>{item.title}</button>)}
                </div>

                {stage === 'marks' ? <KanaMarksGuide script={script} /> : null}

                {groups.length === 0 ? (
                  <div className="kana-empty"><span className="ja">探</span><h3>No matching characters</h3><p>Try a romaji sound such as “ka” or clear the current stage.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(''); setStage('all'); }}>Clear filters</button></div>
                ) : (
                  <div className="kana-chart">
                    {groups.map((group) => (
                      <div className="kana-chart-row-wrap" key={group.row}>
                        {(stage === 'all' || stage === 'marks') && group.row === 'ga' ? <div className="kana-chart-divider"><span>Voiced & p-sounds</span><small>Add ゛ or ゜ to a shape you already know.</small></div> : null}
                        {(stage === 'all' || stage === 'marks') && group.row === 'kya' ? <div className="kana-chart-divider"><span>Blended sounds</span><small>A small ya, yu, or yo joins the first kana into one beat.</small></div> : null}
                        <section className="kana-row" aria-labelledby={`${script}-row-${group.row}`}>
                          <h3 className="kana-row-label" id={`${script}-row-${group.row}`}>{group.row}</h3>
                          <ul className="kana-cells">
                            {group.entries.map((entry) => {
                              const isKnown = known.has(entry.kana);
                              const isSelected = selected?.id === entry.id;
                              return (
                                <li key={entry.id}>
                                  <button type="button" className={`kana-cell${isKnown ? ' kana-cell-known' : ''}${isSelected ? ' kana-cell-selected' : ''}`} onClick={() => chooseCharacter(entry)} aria-pressed={isSelected}>
                                    <span className="kana-cell-glyph ja" lang="ja">{entry.kana}</span>
                                    <span className={`kana-cell-romaji${showRomaji ? '' : ' is-hidden'}`}>{showRomaji ? entry.romaji : '•••'}</span>
                                    {isKnown ? <span className="kana-known-mark" aria-hidden="true">✓</span> : null}
                                    <span className="visually-hidden">{entry.romaji}{isKnown ? ', learned' : ', not learned yet'}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <BeginnerTips script={script} />
              <ConfusingPairs script={script} rows={rows} onSelect={selectByCharacter} />
            </main>

            <aside className="kana-learning-rail" aria-label={`${title} character help`}>
              {selected ? (
                <KanaDetail
                  entry={selected}
                  script={script}
                  known={known.has(selected.kana)}
                  audioSpeed={audioSpeed}
                  position={selectedPosition}
                  total={selectedPool.length}
                  onPrevious={() => moveSelection(-1)}
                  onNext={() => moveSelection(1)}
                  onSelectCharacter={selectByCharacter}
                />
              ) : null}
              <FiveMinuteRoutine script={script} />
            </aside>
          </div>

          <PracticeModes script={script} learned={learned} />
        </>
      )}
    </div>
  );
}

function KanaMarksGuide({ script }: { script: KanaScript }) {
  const examples = script === 'hiragana'
    ? { dakuten: 'か → が', handakuten: 'は → ぱ', yoon: 'き + ゃ → きゃ' }
    : { dakuten: 'カ → ガ', handakuten: 'ハ → パ', yoon: 'キ + ャ → キャ' };

  return (
    <div className="kana-marks-guide" aria-label="How kana marks and blends work">
      <div><span className="ja">゛</span><p><strong>Dakuten</strong><small>Two marks voice the consonant: k becomes g, s becomes z, t becomes d, and h becomes b.</small><em className="ja">{examples.dakuten}</em></p></div>
      <div><span className="ja">゜</span><p><strong>Handakuten</strong><small>The small circle changes only the h-row into a p sound.</small><em className="ja">{examples.handakuten}</em></p></div>
      <div><span className="ja">{script === 'hiragana' ? 'ゃ' : 'ャ'}</span><p><strong>Yōon blends</strong><small>Small ya, yu, or yo combines with an i-sound. Read the pair as one beat, not two.</small><em className="ja">{examples.yoon}</em></p></div>
    </div>
  );
}

function VowelGuide({
  script,
  rows,
  audioSpeed,
  onSelect,
}: {
  script: KanaScript;
  rows: KanaCurriculumRow[];
  audioSpeed: number;
  onSelect: (char: string) => void;
}) {
  const vowels = [
    { romaji: 'a', sound: 'father' },
    { romaji: 'i', sound: 'machine' },
    { romaji: 'u', sound: 'short, light “oo”' },
    { romaji: 'e', sound: 'met' },
    { romaji: 'o', sound: 'short “o” in more' },
  ];

  return (
    <section className="kana-vowels glass" aria-labelledby={`${script}-vowels-heading`}>
      <div className="kana-vowel-intro">
        <p className="kana-kicker">PRONUNCIATION FOUNDATION</p>
        <h2 id={`${script}-vowels-heading`}>Say the five vowels first</h2>
        <p>Every kana row reuses these same five vowel sounds. Keep each one short and even — never stretch it into an English-style diphthong.</p>
      </div>
      <div className="kana-vowel-grid">
        {vowels.map((vowel) => {
          const entry = rows.find((candidate) => candidate.row === 'a' && candidate.romaji === vowel.romaji);
          if (!entry) return null;
          return (
            <div className="kana-vowel-card" key={vowel.romaji}>
              <button type="button" onClick={() => onSelect(entry.kana)} aria-label={`Focus ${entry.kana}, ${entry.romaji}`}>
                <span className="ja" lang="ja">{entry.kana}</span>
                <span><strong>{entry.romaji}</strong><small>as in “{vowel.sound}”</small></span>
              </button>
              <SpeakButton kanaId={entry.id} text={entry.kana} label={`Hear ${vowel.romaji}`} speed={audioSpeed} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BeginnerTips({ script }: { script: KanaScript }) {
  const tips = [
    { icon: 'layers' as const, title: 'Learn five at a time', note: 'Finish one sound row before adding another.' },
    { icon: 'headphones' as const, title: 'Say every sound', note: 'Your ear should recognise it before you rely on romaji.' },
    { icon: 'search' as const, title: 'Hide the answer', note: 'Use the romaji toggle and recall before you click.' },
    { icon: 'pen-tool' as const, title: 'Write from memory', note: 'One careful character beats ten rushed copies.' },
  ];

  return (
    <section className="kana-tips glass" aria-labelledby={`${script}-tips-heading`}>
      <div className="kana-section-head"><div><p className="kana-kicker">BEGINNER TIPS</p><h2 id={`${script}-tips-heading`}>Study smarter, not longer</h2></div></div>
      <ul>{tips.map((tip) => <li key={tip.title}><span><Icon name={tip.icon} size={17} /></span><div><strong>{tip.title}</strong><p>{tip.note}</p></div></li>)}</ul>
      <p className="kana-progress-note"><Icon name="check" size={14} /> Your “learned” count updates when you complete the matching lessons in the course.</p>
    </section>
  );
}

function ConfusingPairs({ script, rows, onSelect }: { script: KanaScript; rows: KanaCurriculumRow[]; onSelect: (char: string) => void }) {
  const available = CONFUSING_PAIRS[script].filter((pair) => pair.chars.every((char) => rows.some((entry) => entry.kana === char)));
  if (available.length === 0) return null;

  return (
    <section className="kana-pairs glass" aria-labelledby={`${script}-pairs-heading`}>
      <div className="kana-section-head"><div><p className="kana-kicker">COMMON MIX-UPS</p><h2 id={`${script}-pairs-heading`}>Characters beginners confuse</h2></div></div>
      <div className="kana-pair-grid">
        {available.map((pair) => (
          <button type="button" key={pair.chars.join('')} onClick={() => onSelect(pair.chars[0])}>
            <span className="ja">{pair.chars.join(' · ')}</span><small>{pair.note}</small><Icon name="chevron-right" size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}

function FiveMinuteRoutine({ script }: { script: KanaScript }) {
  const routes = ROUTES[script];
  return (
    <section className="kana-routine glass" aria-labelledby={`${script}-routine-heading`}>
      <div className="kana-section-head"><div><p className="kana-kicker">DAILY ROUTINE</p><h2 id={`${script}-routine-heading`}>A useful five minutes</h2></div></div>
      <ol>
        <li><span>1 min</span><p>Review five characters with romaji visible.</p></li>
        <li><span>1 min</span><p>Listen and repeat each sound aloud.</p></li>
        <li><span>1 min</span><p>Hide romaji and recall the readings.</p></li>
        <li><span>2 min</span><p>Write them, then complete a short reading drill.</p></li>
      </ol>
      <Link className="btn btn-primary" to={routes.reading}>Start a reading drill <Icon name="chevron-right" size={15} /></Link>
    </section>
  );
}

function PracticeModes({ script, learned }: { script: KanaScript; learned: number }) {
  const routes = ROUTES[script];
  const modes: { to: KanaRoute; label: string; desc: string; icon: IconName; tag?: string }[] = [
    { to: routes.flashcards, label: 'Flashcards', desc: 'Look, recall, reveal, and self-grade.', icon: 'layers', tag: learned < 5 ? 'Start here' : undefined },
    { to: routes.listening, label: 'Listening', desc: 'Hear one sound and choose its kana.', icon: 'headphones' },
    { to: routes.writing, label: 'Writing', desc: 'Trace with the correct order and direction.', icon: 'pen-tool' },
    { to: routes.reading, label: 'Reading', desc: 'See the kana and type its romaji.', icon: 'book-open', tag: learned >= 5 ? 'Recommended' : undefined },
    { to: routes.mistakes, label: 'Mistake drill', desc: 'Repeat only the characters you missed.', icon: 'refresh-cw' },
  ];

  return (
    <section className="kana-practice-section" aria-labelledby={`${script}-practice-heading`}>
      <div className="kana-section-head"><div><p className="kana-kicker">BUILD REAL RECALL</p><h2 id={`${script}-practice-heading`}>Practice modes</h2></div><span>Recognition → listening → writing → recall</span></div>
      <div className="kana-practice-grid">
        {modes.map((mode, index) => (
          <Link key={mode.label} className="kana-practice-card glass" to={mode.to}>
            <span className="kana-practice-index tabular">{String(index + 1).padStart(2, '0')}</span>
            <span className="kana-practice-icon"><Icon name={mode.icon} size={20} /></span>
            <span><strong>{mode.label}</strong><small>{mode.desc}</small></span>
            {mode.tag ? <em>{mode.tag}</em> : null}
            <Icon name="chevron-right" size={15} />
          </Link>
        ))}
      </div>
    </section>
  );
}
