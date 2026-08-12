import { useRef, useState } from 'react';

import { Icon } from '../ui/Icon';
import { convertRomajiToKana, countJapaneseCharacters, type KanaScript } from './romajiToKana';

export function JapaneseComposer({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength = 500,
  rows = 8,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [script, setScript] = useState<KanaScript>('hiragana');
  const analysis = convertRomajiToKana(value, script, false);
  const japaneseCharacters = countJapaneseCharacters(value);

  function apply(raw: string, selectionStart: number, selectionEnd: number, finalize: boolean) {
    const result = convertRomajiToKana(raw, script, finalize);
    const beforeStart = convertRomajiToKana(raw.slice(0, selectionStart), script, finalize).text.length;
    const beforeEnd = convertRomajiToKana(raw.slice(0, selectionEnd), script, finalize).text.length;
    onChange(result.text.slice(0, maxLength));
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea || document.activeElement !== textarea) return;
      textarea.setSelectionRange(Math.min(beforeStart, textarea.value.length), Math.min(beforeEnd, textarea.value.length));
    });
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const raw = event.currentTarget.value;
    if (!autoConvert || composingRef.current || (event.nativeEvent as InputEvent).isComposing) {
      onChange(raw.slice(0, maxLength));
      return;
    }
    apply(raw, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, false);
  }

  function enableConversion() {
    setAutoConvert((enabled) => {
      const next = !enabled;
      if (next) {
        const converted = convertRomajiToKana(value, script, false).text;
        onChange(converted.slice(0, maxLength));
      }
      return next;
    });
  }

  return <div className="writing-composer"><div className="writing-composer-toolbar"><label htmlFor={id}>{label}</label><div><button type="button" className={autoConvert ? 'is-active' : ''} onClick={enableConversion} aria-pressed={autoConvert}><Icon name="languages" size={14} /> Romaji → kana</button><label><span className="visually-hidden">Kana output script</span><select value={script} onChange={(event) => setScript(event.target.value as KanaScript)} disabled={!autoConvert}><option value="hiragana">Hiragana</option><option value="katakana">Katakana</option></select></label></div></div><textarea ref={textareaRef} id={id} className="ja" lang="ja" rows={rows} value={value} maxLength={maxLength} onChange={handleChange} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={(event) => { composingRef.current = false; onChange(event.currentTarget.value.slice(0, maxLength)); }} onBlur={(event) => { if (autoConvert && !composingRef.current) apply(event.currentTarget.value, event.currentTarget.selectionStart, event.currentTarget.selectionEnd, true); }} placeholder={placeholder} spellCheck={false} /><div className="writing-composer-status" aria-live="polite"><span>{autoConvert ? analysis.invalid ? <><Icon name="circle-alert" size={13} /> Unrecognised Latin text stays unchanged.</> : analysis.pending ? <><Icon name="languages" size={13} /> Keep typing to complete the romaji syllable.</> : <><Icon name="check" size={13} /> Valid romaji converts as you type.</> : 'Automatic romaji conversion is off.'}</span><span className="tabular">{japaneseCharacters} Japanese chars · {value.length}/{maxLength}</span></div><details className="writing-ime-help"><summary>How automatic conversion works</summary><p>Type phonetic romaji such as <b>watashi</b> → <span className="ja" lang="ja">わたし</span> or <b>gakkou</b> → <span className="ja" lang="ja">がっこう</span>. It converts only complete valid syllables. This is a kana converter, not a kanji prediction engine: type <b>ha</b> for <span className="ja">は</span> and <b>wo</b> for <span className="ja">を</span>. Native Japanese IME composition is left untouched.</p></details></div>;
}
