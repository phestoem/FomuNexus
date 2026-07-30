"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shouldSubmitSpeechOnEnd } from "@/lib/nexus/speech-input-end";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from "@/lib/nexus/speech-recognition";

type UseSpeechInputOptions = {
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechInput(options: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const optionsRef = useRef(options);
  // When true, the next onend must not auto-submit (loading stop, abort, restart).
  const ignoreNextEndRef = useRef(false);

  optionsRef.current = options;

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());

    return () => {
      ignoreNextEndRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    // External callers (e.g. form `loading`/`amending`) stop capture without submitting.
    ignoreNextEndRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      optionsRef.current.onError?.(
        "Voice input is not supported in this browser.",
      );
      return;
    }

    ignoreNextEndRef.current = true;
    recognitionRef.current?.abort();

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    transcriptRef.current = "";
    ignoreNextEndRef.current = false;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = transcriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      transcriptRef.current = finalTranscript;
      const combinedTranscript = `${finalTranscript}${interimTranscript}`.trim();
      optionsRef.current.onInterimTranscript(combinedTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        optionsRef.current.onError?.(
          event.error === "not-allowed"
            ? "Microphone permission was denied."
            : "Voice capture failed. Please try again.",
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      const ignoreNextEnd = ignoreNextEndRef.current;
      ignoreNextEndRef.current = false;

      const finalTranscript = transcriptRef.current.trim();
      if (
        shouldSubmitSpeechOnEnd({
          ignoreNextEnd,
          transcript: finalTranscript,
        })
      ) {
        optionsRef.current.onFinalTranscript(finalTranscript);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      optionsRef.current.onError?.("Unable to start voice capture.");
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      // User-initiated stop: allow onend to submit the captured transcript.
      ignoreNextEndRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    startListening();
  }, [isListening, startListening]);

  return {
    isListening,
    isSupported,
    toggleListening,
    stopListening,
  };
}
