import { useMemo, useState } from 'react';

import { useSession } from '../../useSession';
import { ListeningAudioPlayer } from '../listening/ListeningAudioPlayer';
import { LISTENING_LEVELS, shuffleListening, sortListeningItems, spokenText, type ListeningLevel } from '../listening/listeningData';
import { useCorpus, type VocabItem } from '../library/useCorpus';
import { Icon } from '../ui/Icon';
import { transcriptMatches } from './speakingData';
import { SpeakingTabs } from './SpeakingTabs';
import { useSpeechRecognition } from './useSpeechRecognition';

import './speaking.css';

type ChallengeLevel = 'all' | ListeningLevel;
type ChallengeRun = { key: number; items: VocabItem[]; showMeaning: boolean };

export function SpeakingChallenges() {
  const corpus = useCorpus();
  const { session } = useSession();
  const [speed, setSpeed] = useState(session.state === 'signedIn' ? session.user.settings.audioSpeed : 1);
  const [level, setLevel] = useState<ChallengeLevel>('all');
  const [count, setCount] = useState(5);
  const [showMeaning, setShowMeaning] = useState(false);
  const [run, setRun] = useState<ChallengeRun | null>(null);
  const corpusItems = corpus.data?.items;
  const items = useMemo(() => sortListeningItems(corpusItems?.filter((item): item is VocabItem => item.kind === 'vocab') ?? []), [corpusItems]);
  const pool = useMemo(() => items.filter((item) => level === 'all' || item.jlpt === level), [items, level]);

  function buildRun(key: number) {
    if (pool.length === 0) return;
    setRun({ key, items: shuffleListening(pool).slice(0, Math.min(count, pool.length)), showMeaning });
  }

  return <div className="page speaking-reference"><SpeakingTabs active="challenges" />{corpus.isPending ? <div className="speaking-loading glass" role="status"><Icon name="trophy" size={40} /><p>Preparing speaking challenges…</p></div> : corpus.isError ? <div className="note note-error speaking-error" role="alert"><div><strong>Speaking challenges could not be loaded.</strong><span>The real course corpus is required to build prompts.</span></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => void corpus.refetch()}>Try again</button></div> : items.length === 0 ? <section className="speaking-empty glass"><span className="ja" lang="ja">空</span><h2>No challenge prompts are available</h2><p>{corpus.data.failedUnits.length > 0 ? 'The course units failed to load. Try again when the content API is available.' : 'The loaded course has no vocabulary readings.'}</p>{corpus.data.failedUnits.length > 0 ? <button type="button" className="btn btn-secondary" onClick={() => void corpus.refetch()}>Try again</button> : null}</section> : run ? <SpeakingChallengeSession key={run.key} run={run} speed={speed} onSpeedChange={setSpeed} onExit={() => setRun(null)} onRestart={() => buildRun(run.key + 1)} /> : <section className="speaking-challenge-setup glass" aria-labelledby="speaking-challenge-heading"><div className="speaking-challenge-copy"><p className="speaking-kicker">RUN-LOCAL PRACTICE</p><h1 id="speaking-challenge-heading">Build a speaking challenge</h1><p>Speak a shuffled set of real course readings. The browser can report whether its transcript identified the target, but the result is not saved as mastery, XP, or pronunciation quality.</p></div>{corpus.data.failedUnits.length > 0 ? <p className="note speaking-partial"><strong>Partial course data.</strong><span>{corpus.data.failedUnits.length} course unit{corpus.data.failedUnits.length === 1 ? '' : 's'} could not be loaded, so this pool is incomplete.</span></p> : null}<div className="speaking-challenge-options"><label><span>JLPT pool</span><select value={level} onChange={(event) => setLevel(event.target.value as ChallengeLevel)}><option value="all">All available levels</option>{LISTENING_LEVELS.map((value) => <option key={value} value={value}>{value} · {items.filter((item) => item.jlpt === value).length} readings</option>)}</select></label><label><span>Challenge length</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={3}>3 prompts</option><option value={5}>5 prompts</option><option value={10}>10 prompts</option></select></label><label><span>Model speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label><label className="speaking-checkbox"><input type="checkbox" checked={showMeaning} onChange={(event) => setShowMeaning(event.target.checked)} /><span>Show English meaning during prompts</span></label></div><div className="speaking-challenge-types"><article><span><Icon name="mic" size={22} /></span><div><strong>Speak every target</strong><p>A prompt counts only after browser transcription or an explicit self-check when recognition is unavailable.</p></div></article><article><span><Icon name="audio-lines" size={22} /></span><div><strong>Replay without penalty</strong><p>Use model audio and speed controls as often as you need. This is deliberate practice, not an exam.</p></div></article><article><span><Icon name="check" size={22} /></span><div><strong>Honest result</strong><p>The summary reports completed attempts and transcript identifications—never a fabricated pronunciation percentage.</p></div></article></div><div className="speaking-challenge-ready"><div><strong className="tabular">{pool.length}</strong><span>eligible course readings</span></div><div><strong className="tabular">{Math.min(count, pool.length)}</strong><span>prompts this run</span></div><button type="button" className="btn btn-primary" disabled={pool.length === 0} onClick={() => buildRun(1)}>Start speaking challenge <Icon name="chevron-right" size={15} /></button></div>{pool.length === 0 ? <p className="note"><strong>No eligible readings.</strong><span>The selected level is empty in the loaded course.</span></p> : null}</section>}</div>;
}

function SpeakingChallengeSession({ run, speed, onSpeedChange, onExit, onRestart }: { run: ChallengeRun; speed: number; onSpeedChange: (speed: number) => void; onExit: () => void; onRestart: () => void }) {
  const [index, setIndex] = useState(0);
  const [identified, setIdentified] = useState(0);
  const [transcribedAttempts, setTranscribedAttempts] = useState(0);
  const item = run.items[index];

  function advance(result: boolean | null) {
    if (result !== null) setTranscribedAttempts((value) => value + 1);
    if (result === true) setIdentified((value) => value + 1);
    setIndex((value) => value + 1);
  }

  if (index >= run.items.length) {
    return <section className="speaking-challenge-result glass"><span className="speaking-result-glyph ja" lang="ja">声</span><p className="speaking-kicker">CHALLENGE COMPLETE</p><h1>{run.items.length} spoken attempt{run.items.length === 1 ? '' : 's'} completed</h1>{transcribedAttempts > 0 ? <p className="speaking-result-count"><strong className="tabular">{identified} of {transcribedAttempts}</strong> browser transcripts identified the target</p> : <p className="speaking-result-count">Completed with manual self-checks because browser transcription was unavailable.</p>}<p>This summary belongs only to this run. It is not a pronunciation score, saved progress, XP, or SRS mastery.</p><div><button type="button" className="btn btn-primary" onClick={onRestart}><Icon name="refresh-cw" size={15} /> Try another shuffled run</button><button type="button" className="btn btn-secondary" onClick={onExit}>Change challenge settings</button></div></section>;
  }
  if (!item) return null;

  return <section className="speaking-challenge-run glass" aria-labelledby="speaking-challenge-prompt"><header><button type="button" onClick={onExit}><Icon name="chevron-left" size={14} /> End challenge</button><div className="speaking-challenge-progress" role="progressbar" aria-label="Speaking challenge progress" aria-valuemin={1} aria-valuemax={run.items.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / run.items.length) * 100}%` }} /></div><span className="tabular">{index + 1} / {run.items.length}</span></header><div className="speaking-challenge-prompt"><p className="speaking-kicker">SPEAK THIS COURSE READING · {item.jlpt}</p><h1 id="speaking-challenge-prompt" className="ja" lang="ja">{item.lemma}</h1><p className="ja" lang="ja">{item.reading}</p>{item.romaji ? <small>{item.romaji}</small> : null}{run.showMeaning ? <strong>{item.gloss}</strong> : <span className="speaking-concealed-meaning">Meaning hidden for this run</span>}<ListeningAudioPlayer itemId={item.id} text={spokenText(item)} speed={speed} onSpeedChange={onSpeedChange} /><ChallengeAttempt key={item.id} item={item} last={index === run.items.length - 1} onAdvance={advance} /></div></section>;
}

function ChallengeAttempt({ item, last, onAdvance }: { item: VocabItem; last: boolean; onAdvance: (result: boolean | null) => void }) {
  const speech = useSpeechRecognition();
  const hasTranscript = speech.transcript.trim().length > 0;
  const matches = hasTranscript && transcriptMatches(item, speech.transcript);
  const fallback = !speech.supported || Boolean(speech.error);

  return <div className="speaking-challenge-attempt">{speech.supported ? <div className={`speaking-transcript-box${speech.listening ? ' is-listening' : ''}`} aria-live="polite"><Icon name="mic" size={20} /><div><small>{speech.listening ? 'LISTENING…' : hasTranscript ? 'BROWSER TRANSCRIPT' : 'SPEAKING ATTEMPT'}</small><p className={hasTranscript ? 'ja' : ''} lang={hasTranscript ? 'ja' : undefined}>{speech.transcript || 'Start transcription, then say the target once.'}</p></div></div> : <div className="speaking-recorder-unavailable"><Icon name="mic" size={20} /><div><strong>Browser transcription is unavailable.</strong><p>Play the model, practise aloud, then use the self-check below.</p></div></div>}{speech.error ? <p className="speaking-control-error" role="alert">{speech.error}</p> : null}{hasTranscript && !speech.listening ? <div className={`speaking-feedback ${matches ? 'is-match' : 'is-different'}`}><Icon name={matches ? 'check' : 'audio-lines'} size={17} /><div><strong>{matches ? 'Target identified by browser transcript' : 'Different browser transcript'}</strong><p>{matches ? 'Continue when ready.' : 'Recognition can be wrong. Replay and retry, or continue after completing the spoken attempt.'}</p></div></div> : null}<div className="speaking-challenge-attempt-actions">{speech.supported ? <button type="button" className={`btn ${speech.listening ? 'btn-secondary' : 'btn-primary'}`} onClick={speech.listening ? speech.stop : speech.start}><Icon name={speech.listening ? 'square' : 'mic'} size={15} /> {speech.listening ? 'Stop listening' : speech.error ? 'Retry transcription' : hasTranscript ? 'Try again' : 'Start transcription'}</button> : null}{hasTranscript || fallback ? <button type="button" className="btn btn-secondary" onClick={() => onAdvance(hasTranscript ? matches : null)}>{fallback && !hasTranscript ? 'I practised it aloud' : last ? 'Finish challenge' : 'Continue'} <Icon name="chevron-right" size={14} /></button> : null}</div></div>;
}
