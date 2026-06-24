"use client";

import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useState } from "react";

export default function TestRefactorPage() {
  const { unlockSpeech, speakFeedback } = useVoiceFeedback();
  const [description, setDescription] = useState("");
  const [costText, setCostText] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const {
    voiceState,
    voiceError,
    transcript,
    elapsed,
    savedExpenses,
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
      <h1 className="text-xl font-bold">Test Voice Recorder Hook</h1>
      <div className="p-4 border rounded space-y-2">
        <p>Voice State: <span className="font-semibold">{voiceState}</span></p>
        <p>Elapsed Time: <span className="font-semibold">{elapsed}s</span></p>
        <p>Transcript: <span className="font-semibold">{transcript || "None"}</span></p>
        {voiceError && <p className="text-red-500">{voiceError}</p>}
      </div>

      <div className="space-x-2">
        <button
          onClick={voiceState === "recording" ? stopRecording : startRecording}
          className="bg-brand-600 text-white px-4 py-2 rounded"
        >
          {voiceState === "recording" ? "Stop Recording" : "Start Recording"}
        </button>
      </div>

      <div className="space-y-2">
        <p>Form Description: <span className="font-semibold">{description}</span></p>
        <p>Form Cost: <span className="font-semibold">{costText}</span></p>
        <p>Form Category ID: <span className="font-semibold">{categoryId}</span></p>
      </div>
    </div>
  );
}
