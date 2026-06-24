"use client";

import { useVoiceFeedback } from "@/hooks/useVoiceFeedback";
import { useState } from "react";

export default function TestRefactorPage() {
  const { unlockSpeech, speakFeedback } = useVoiceFeedback();
  const [text, setText] = useState("Halo, ini tes suara.");

  return (
    <div className="p-8 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Test Refactor</h1>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full border p-2 rounded"
      />
      <div className="space-x-2">
        <button onClick={unlockSpeech} className="bg-slate-200 px-4 py-2 rounded">
          Unlock Audio
        </button>
        <button onClick={() => speakFeedback(text)} className="bg-brand-600 text-white px-4 py-2 rounded">
          Speak
        </button>
      </div>
    </div>
  );
}
