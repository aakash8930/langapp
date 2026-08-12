import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { ListeningAudioPlayer } from '../listening/ListeningAudioPlayer';
import { LISTENING_LEVELS, sortListeningItems, spokenText, type ListeningLevel } from '../listening/listeningData';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { transcriptMatches } from './speakingData';
import { SpeakingTabs } from './SpeakingTabs';
import { useSpeechRecognition } from './useSpeechRecognition';
import { VoiceRecorder } from './VoiceRecorder';

import './speaking.css';

type LevelFilter = 'all' | ListeningLevel;
const PAGE_SIZE = 30;

export function PronunciationPractice() {
  const corpus = useCorpus();
  const { session } = useSession();
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? []), [corpusItems]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => (level === 'all' || item.jlpt === level)
      && (!needle || `${item.lemma} ${item.reading} ${item.romaji ?? ''} ${item.gloss} ${item.pos}`.toLocaleLowerCase().includes(needle)));
  }, [items, level, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const active = shown.find((item) => item.id === selectedId) ?? shown[0] ?? null;

  function changeLevel(next: LevelFilter) {
    setLevel(next);
    setPage(0);
    setSelectedId(null);
  }

  function changePage(next: number) {
    setPage(Math.max(0, Math.min(next, pageCount - 1)));
    setSelectedId(null);
  }

  return <div className="page speaking-reference"><SpeakingTabs active="pronunciation" /><section className="speaking-practice-hero glass"><div><p className="speaking-kicker">MODEL · RECORD · COMPARE</p><h1><Icon name="audio-lines" size={42} /> Pronunciation studio</h1><p>Choose a real course word, hear its reading, record your voice, and use browser transcription as a careful comparison—not a made-up accent score.</p></div><dl><div><dt>Course readings</dt><dd className="tabular">{corpus.isPending || corpus.isError ? '—' : items.length}</dd></div><div><dt>Current pool</dt><dd className="tabular">{corpus.isPending || corpus.isError ? '—' : filtered.length}</dd></div></dl></section>
    {corpus.isPending ? <div className="speaking-loading glass" role="status"><Icon name="mic" size={40} /><p>Loading pronunciation targets…</p></div> : corpus.isError ? <div className="note note-error speaking-error" role="alert"><div><strong>Pronunciation practice could not be loaded.</strong><span>The course content API may be asleep.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <div className="speaking-empty glass"><span className="ja" lang="ja">空</span><h2>{corpus.data.failedUnits.length > 0 ? 'No pronunciation targets could be loaded' : 'No pronunciation targets are available'}</h2><p>{corpus.data.failedUnits.length > 0 ? 'The course units failed to load. Try again when the content API is available.' : 'The loaded course contains no vocabulary readings.'}</p>{corpus.data.failedUnits.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => void corpus.refetch()}>Try again</button> : null}</div> : <>{corpus.data.failedUnits.length > 0 ? <p className="note speaking-partial"><strong>Partial course data.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this list is incomplete.</span></p> : null}<div className="speaking-pronunciation-layout"><section className="speaking-target-picker glass" aria-labelledby="pronunciation-targets-heading"><div className="speaking-section-head"><div><p className="speaking-kicker">REAL COURSE CORPUS</p><h2 id="pronunciation-targets-heading">Choose a target</h2></div><span className="tabular">{filtered.length} matching</span></div><div className="speaking-toolbar"><div className="speaking-search" role="search"><Icon name="search" size={17} /><label className="visually-hidden" htmlFor="pronunciation-search">Search pronunciation targets</label><input id="pronunciation-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); setSelectedId(null); }} placeholder="Search word, reading, or meaning…" />{query ? <button type="button" onClick={() => { setQuery(''); setPage(0); setSelectedId(null); }} aria-label="Clear pronunciation search">×</button> : null}</div><label className="speaking-select"><span>JLPT</span><select value={level} onChange={(event) => changeLevel(event.target.value as LevelFilter)}><option value="all">All levels</option>{LISTENING_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length}</option>)}</select></label></div>{filtered.length === 0 ? <div className="speaking-empty speaking-empty-inline"><span className="ja" lang="ja">探</span><h3>No matching target</h3><p>Try another search or level.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(''); changeLevel('all'); }}>Clear filters</button></div> : <><ul className="speaking-target-list">{shown.map((item) => <li key={item.id}><button type="button" className={active?.id === item.id ? 'is-active' : ''} aria-pressed={active?.id === item.id} onClick={() => setSelectedId(item.id)}><span className="speaking-target-play"><Icon name="play" size={14} /></span><span><strong className="ja" lang="ja">{item.lemma}</strong><small>{item.reading !== item.lemma ? item.reading : item.romaji || item.pos}</small></span><span><strong>{item.gloss}</strong><small>{item.pos}</small></span><span className="speaking-level-badge">{item.jlpt}</span></button></li>)}</ul>{pageCount > 1 ? <div className="speaking-pagination"><button type="button" onClick={() => changePage(safePage - 1)} disabled={safePage === 0}><Icon name="chevron-left" size={14} /> Previous</button><span className="tabular">{safePage + 1} / {pageCount}</span><button type="button" onClick={() => changePage(safePage + 1)} disabled={safePage >= pageCount - 1}>Next <Icon name="chevron-right" size={14} /></button></div> : null}</>}</section><section className="speaking-pronunciation-studio glass">{active ? <PronunciationStudio key={active.id} item={active} speed={speed} onSpeedChange={setSpeed} /> : <div className="speaking-empty"><Icon name="mic" size={40} /><h3>Select an available target</h3></div>}</section></div></>}
    <p className="speaking-route-note"><Icon name="history" size={14} /> Voice clips stay local to this tab. Submitted AI conversation text is the only speaking-related content saved to <Link to="/speaking-history">conversation history</Link>.</p>
  </div>;
}

function PronunciationStudio({ item, speed, onSpeedChange }: { item: VocabItem; speed: number; onSpeedChange: (speed: number) => void }) {
  const speech = useSpeechRecognition();
  const reading = spokenText(item);
  const hasTranscript = speech.transcript.trim().length > 0;
  const matches = hasTranscript && transcriptMatches(item, speech.transcript);

  return <div className="speaking-studio-content"><header><div><span className="speaking-level-badge">{item.jlpt}</span><p className="speaking-kicker">CURRENT PRONUNCIATION TARGET</p><h2><b className="ja" lang="ja">{item.lemma}</b> · {item.gloss}</h2><p className="ja" lang="ja">{item.reading}</p>{item.romaji ? <small>{item.romaji}</small> : null}</div><span>{item.pos}</span></header><ol className="speaking-step-list"><li><span>1</span><strong>Hear the model</strong></li><li><span>2</span><strong>Record and replay</strong></li><li><span>3</span><strong>Check transcription</strong></li></ol><section aria-labelledby="model-audio-heading"><div className="speaking-subhead"><h3 id="model-audio-heading">Model pronunciation</h3><span>Course recording or labelled browser voice</span></div><ListeningAudioPlayer itemId={item.id} text={reading} speed={speed} onSpeedChange={onSpeedChange} /></section><section aria-labelledby="recording-heading"><div className="speaking-subhead"><h3 id="recording-heading">Voice recording</h3><span>Private playback in this tab</span></div><VoiceRecorder downloadName={`pronunciation-${item.id}`} /></section><section aria-labelledby="feedback-heading"><div className="speaking-subhead"><h3 id="feedback-heading">Pronunciation feedback</h3><span>Browser transcription comparison</span></div>{speech.supported ? <div className="speaking-transcription"><div className={`speaking-transcript-box${speech.listening ? ' is-listening' : ''}`} aria-live="polite"><Icon name="mic" size={20} /><div><small>{speech.listening ? 'LISTENING…' : hasTranscript ? 'YOUR BROWSER HEARD' : 'READY TO TRANSCRIBE'}</small><p className={hasTranscript ? 'ja' : ''} lang={hasTranscript ? 'ja' : undefined}>{speech.transcript || 'Speak the target once. Review the transcript before trying again.'}</p></div></div><div className="speaking-control-actions"><button type="button" className={`btn ${speech.listening ? 'btn-secondary' : 'btn-primary'}`} onClick={speech.listening ? speech.stop : speech.start}><Icon name={speech.listening ? 'square' : 'mic'} size={15} /> {speech.listening ? 'Stop listening' : hasTranscript ? 'Try transcription again' : 'Start transcription'}</button>{hasTranscript ? <button type="button" className="btn btn-secondary" onClick={speech.clear}><Icon name="refresh-cw" size={15} /> Clear</button> : null}</div>{speech.error ? <p className="speaking-control-error" role="alert">{speech.error}</p> : hasTranscript && !speech.listening ? <div className={`speaking-feedback ${matches ? 'is-match' : 'is-different'}`} role="status"><Icon name={matches ? 'check' : 'audio-lines'} size={18} /><div><strong>{matches ? 'The browser identified the target.' : 'The browser transcribed something different.'}</strong><p>{matches ? 'Replay at normal speed and compare rhythm and vowel length. This is still transcription—not a pronunciation or accent score.' : `Target: ${reading}. Listen again at 0.75×, repeat once, and compare another transcript. Recognition can also be wrong.`}</p></div></div> : <p className="speaking-privacy-note">Speech recognition sends microphone audio to the browser&rsquo;s speech service. The app receives only the returned text.</p>}</div> : <div className="speaking-recorder-unavailable"><Icon name="mic" size={22} /><div><strong>Browser transcription is unavailable.</strong><p>You can still hear the model, record yourself, and compare the playback manually.</p></div></div>}</section></div>;
}
