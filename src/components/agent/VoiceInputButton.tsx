import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation button for the composer. Renders nothing when the browser has no
 * Web Speech API, so unsupported browsers never see a dead control.
 */
export function VoiceInputButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  if (!supported) return null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const results = (event as { results?: ArrayLike<ArrayLike<{ transcript?: string }>> })
        .results;
      let transcript = "";
      if (results) {
        for (let i = 0; i < results.length; i += 1) {
          transcript += results[i]?.[0]?.transcript ?? "";
        }
      }
      const cleaned = transcript.trim();
      if (cleaned) onTranscript(cleaned);
    };
    recognition.onerror = (event) => {
      const code = (event as { error?: string }).error;
      if (code !== "aborted") {
        toast.error(code === "not-allowed" ? "Microphone access was blocked" : "Dictation failed");
      }
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      aria-label={listening ? "Stop dictation" : "Ask by voice"}
      aria-pressed={listening}
      className={cn(listening && "text-destructive")}
      onClick={() => (listening ? stop() : start())}
    >
      {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}
