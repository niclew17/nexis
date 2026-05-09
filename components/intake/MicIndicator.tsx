"use client";
import { MicVisual } from "@/components/voice/MicVisual";

export function MicIndicator({ isListening }: { isListening: boolean }) {
  if (!isListening) return null;
  return <MicVisual interactive={false} isListening={isListening} ariaLabel="Listening" />;
}
