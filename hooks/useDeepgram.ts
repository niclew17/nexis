"use client";

import { useState, useRef, useCallback } from "react";
import { DeepgramClient } from "@deepgram/sdk";

export class MicDeniedError extends Error {
  constructor() {
    super("Microphone access denied");
    this.name = "MicDeniedError";
  }
}

interface UseDeepgramReturn {
  transcript: string;
  interimTranscript: string;
  isConnected: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  requestPermission: () => Promise<'granted' | 'denied'>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySocket = any;

export function useDeepgram(onSilenceDetected: () => void): UseDeepgramReturn {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<AnySocket>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onSilenceRef = useRef(onSilenceDetected);
  onSilenceRef.current = onSilenceDetected;

  const stopListening = useCallback(() => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    socketRef.current?.close();
    setIsConnected(false);
  }, []);

  const startListening = useCallback(async () => {
    // Request mic first — must be synchronous from the user gesture
    // to guarantee the browser shows the permission prompt.
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MicDeniedError();
    }
    streamRef.current = mediaStream;

    const res = await fetch("/api/deepgram-token", { method: "POST" });
    const { token } = await res.json();

    const deepgram = new DeepgramClient({ apiKey: token });

    // SDK v5 uses string "true"/"false" for boolean params
    const socket = await deepgram.listen.v1.connect({
      model: "nova-3",
      language: "en",
      smart_format: "true",
      interim_results: "true",
      utterance_end_ms: "2500",
      endpointing: "500",
      punctuate: "true",
      numerals: "true",
      Authorization: `Token ${token}`,
    });

    socket.on("message", (data: AnySocket) => {
      if (data.type === "UtteranceEnd") {
        onSilenceRef.current();
        return;
      }
      if (data.type === "Results") {
        const text = data.channel?.alternatives?.[0]?.transcript as string | undefined;
        if (!text) return;
        if (data.is_final) {
          setTranscript((prev) => (prev ? `${prev} ${text}` : text));
          setInterimTranscript("");
        } else {
          setInterimTranscript(text);
        }
      }
    });

    socket.on("close", () => setIsConnected(false));
    socket.on("error", (err: unknown) => console.error("Deepgram error:", err));

    socket.connect();
    await socket.waitForOpen();
    setIsConnected(true);
    socketRef.current = socket;

    const recorder = new MediaRecorder(mediaStream, {
      mimeType: "audio/webm;codecs=opus",
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && socketRef.current) {
        try {
          socketRef.current.sendMedia(event.data);
        } catch {
          // socket closed between check and send (e.g. final dataavailable after stop()) — ignore
        }
      }
    };
    recorder.start(250);
    recorderRef.current = recorder;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const requestPermission = useCallback(async (): Promise<'granted' | 'denied'> => {
    if (typeof navigator === 'undefined') return 'denied';
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        // state === 'prompt' — fall through to getUserMedia
      }
    } catch {
      // permissions API unavailable or query threw — fall through
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch {
      return 'denied';
    }
  }, []);

  return {
    transcript,
    interimTranscript,
    isConnected,
    startListening,
    stopListening,
    resetTranscript,
    requestPermission,
  };
}
