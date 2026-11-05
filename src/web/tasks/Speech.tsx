import { useRef, useState } from 'react';

type Speech = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };
const SpeechApi = (window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Speech }).webkitSpeechRecognition;

/** Says into the line at the bottom. Nothing shows where the browser cannot listen. */
export function Mic({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const speech = useRef<Speech | null>(null);
  if (!SpeechApi) return null;

  const listen = () => {
    if (listening) return speech.current?.stop();
    const s = new SpeechApi();
    s.lang = 'ru-RU';
    s.interimResults = true;
    s.onresult = (e) => onText(Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' '));
    s.onend = () => setListening(false);
    speech.current = s;
    s.start();
    setListening(true);
  };

  return (
    <button type="button" className={`quick-mic${listening ? ' is-on' : ''}`} aria-label={listening ? 'Остановить запись' : 'Сказать голосом'} aria-pressed={listening} onClick={listen}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21" />
      </svg>
    </button>
  );
}
