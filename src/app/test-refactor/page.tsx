"use client";

import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Calculator } from "@/components/calculator";
import { useState } from "react";

export default function TestRefactorPage() {
  const { unlockSpeech, speakFeedback } = useVoiceFeedback();
  const [description, setDescription] = useState("");
  const [costText, setCostText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);

  const {
    voiceState,
    voiceError,
    transcript,
    elapsed,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    spentAt: new Date().toISOString().split("T")[0],
    setDescription,
    setCostText,
    setCategoryId,
    speakFeedback,
    unlockSpeech,
  });

  return (
    <div className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Test Calculator & Voice Hook</h1>

      <div className="space-y-2">
        <p>Form Description: <span className="font-semibold">{description}</span></p>
        <p>Form Cost: <span className="font-semibold">{costText}</span></p>
        <button
          onClick={() => setCalcOpen(!calcOpen)}
          className="bg-brand-500 text-white px-4 py-2 rounded"
        >
          {calcOpen ? "Close Calculator" : "Open Calculator"}
        </button>
        {calcOpen && (
          <Calculator
            onResult={(res) => setCostText(String(res))}
            onClose={() => setCalcOpen(false)}
          />
        )}
      </div>

      <div className="space-x-2">
        <button
          onClick={voiceState === "recording" ? stopRecording : startRecording}
          className="bg-brand-600 text-white px-4 py-2 rounded"
        >
          {voiceState === "recording" ? "Stop Recording" : "Start Recording"}
        </button>
      </div>
    </div>
  );
}
