"use client";

import { useEffect, useRef, useState } from "react";
import { pickVoice, savedCloudVoice, Speaker, speechSetup } from "@/lib/voice/speaker";

// "Listen" under an answer: read it aloud with the same voice as voice conversations (ElevenLabs/OpenAI when set up,
// otherwise the browser's own voices). Only one answer plays at a time.
type Reading = { speaker: Speaker; done: (failed?: boolean) => void };
let playing: Reading | null = null;

function stopPlaying(failed = false) {
  const stopped = playing;
  playing = null;
  try {
    stopped?.speaker.stop();
  } catch {
    failed = true;
  } finally {
    stopped?.done(failed);
  }
  return !failed;
}

export function SpeakButton({ id, text, compact = false }: { id: string; text: string; compact?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [failed, setFailed] = useState(false);
  const owned = useRef<Reading | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && ("speechSynthesis" in window || typeof Audio !== "undefined"));
    return () => {
      if (owned.current && playing === owned.current) stopPlaying();
      owned.current = null;
    };
  }, [id, text]);
  if (!supported) return null;

  async function play() {
    if (!stopPlaying()) {
      setFailed(true);
      return;
    }
    const sp = new Speaker();
    const reading: Reading = { speaker: sp, done: (failed = false) => {
      if (owned.current !== reading) return;
      owned.current = null;
      setSpeaking(false);
      setPreparing(false);
      setFailed(failed);
    } };
    owned.current = reading;
    playing = reading;
    setSpeaking(true);
    setPreparing(true);
    setFailed(false);
    sp.onIdle = () => {
      if (playing === reading) playing = null;
      reading.done();
    };
    try {
      const setup = await speechSetup();
      if (playing !== reading || owned.current !== reading) return;
      if (setup.service !== "browser") {
        sp.cloud = true;
        sp.cloudVoice = savedCloudVoice(setup);
      }
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("orbit.voice.name");
      } catch {}
      if ("speechSynthesis" in window) sp.voice = pickVoice(window.speechSynthesis.getVoices(), "en", saved);
      setPreparing(false);
      sp.say(text);
    } catch {
      if (playing === reading) stopPlaying(true);
    }
  }

  const icon = speaking ? (
    <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-current" />
  ) : (
    <svg viewBox="0 0 16 16" width={compact ? 16 : 13} height={compact ? 16 : 13} aria-hidden><path d="M3 6.2h2.2L8.5 3.5v9L5.2 9.8H3zM10.8 5.6a3.3 3.3 0 0 1 0 4.8M12.6 3.8a5.8 5.8 0 0 1 0 8.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  const button = compact ? (
      <button type="button" onClick={() => (speaking ? stopPlaying() : play())} aria-pressed={speaking} aria-busy={preparing} aria-label={preparing ? "Cancel read aloud" : speaking ? "Stop reading" : "Read aloud"} title={preparing ? "Cancel read aloud" : speaking ? "Stop" : "Read aloud"}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-surface-200 hover:text-ink">
        {icon}
      </button>
    ) : (
    <button type="button" onClick={() => (speaking ? stopPlaying() : play())} aria-pressed={speaking} aria-busy={preparing}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-200 hover:text-ink">
      {icon}
      {preparing ? "Cancel read aloud" : speaking ? "Stop" : "Listen"}
    </button>
  );
  return <span className="inline-flex flex-wrap items-center gap-1.5">{button}{failed && <span role="status" className="text-xs text-danger">Audio control failed.</span>}</span>;
}
