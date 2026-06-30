import { useEffect, useRef } from "react";

export function useVoiceFeedback() {
  const unlockSpeech = useRef(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const primer = new SpeechSynthesisUtterance(" ");
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
    } catch { /* ignore */ }
  }).current;

  const speakFeedback = useRef((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.88;
      utterance.pitch = 1.05;
      const idVoice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("id"));
      if (idVoice) utterance.voice = idVoice;
      synth.speak(utterance);
    };
    if (synth.getVoices().length === 0) {
      synth.addEventListener("voiceschanged", run, { once: true });
      setTimeout(run, 300);
    } else {
      run();
    }
  }).current;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { unlockSpeech, speakFeedback };
}
