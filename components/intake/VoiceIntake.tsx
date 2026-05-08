"use client";

import { useState } from "react";
import { useVoiceIntake } from "@/hooks/useVoiceIntake";
import { InstructionSlide } from "./InstructionSlide";
import { QuestionDisplay } from "./QuestionDisplay";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { MicIndicator } from "./MicIndicator";
import { ConfirmedAnswer } from "./ConfirmedAnswer";

const QUESTIONS = [
  "Do you identify with any of these founder communities — veteran, woman, rural founder, immigrant, or LGBTQ+? You can name one, a few, or skip it if none apply.",
  "Where in Utah are you based or operating? You can name a city, a county, or describe the region — like Salt Lake, St. George, Cache Valley, or rural southern Utah.",
  "Tell me about your business — what you do and where you are in the journey. Are you still in the idea phase, just getting started, or already running something?",
  "What's the most pressing thing you need help with right now? For example — finding funding or loans, figuring out how to get started, growing or scaling, marketing and sales, or connecting with other entrepreneurs and mentors.",
];

export function VoiceIntake() {
  const {
    state,
    currentQuestionIndex,
    confirmedAnswers,
    currentTranscript,
    interimTranscript,
    isListening,
    micError,
    inputMode,
    begin,
    startQuestion,
    skipQuestion,
    confirmAnswer,
    retryMic,
    switchToTextMode,
    submitTextAnswer,
  } = useVoiceIntake();

  const [textInput, setTextInput] = useState('');

  const handleBegin = () => {
    startQuestion().catch(console.error);
  };

  return (
    <div style={{ maxWidth: "680px", width: "100%", padding: "0 24px" }}>
      {/* Mic permission denied */}
      {micError && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", fontSize: "1.25rem", color: "white", margin: 0 }}>
            Microphone access is required.
          </p>
          <p style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system", fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.6 }}>
            To enable your mic, click the camera icon in your browser&apos;s address bar and allow access, then try again. Or type your answers below.
          </p>
          <button
            onClick={() => retryMic().catch(console.error)}
            style={{ padding: "10px 32px", border: "1px solid white", background: "transparent", color: "white", fontSize: "0.875rem", fontFamily: "ui-sans-serif, system-ui, -apple-system", cursor: "pointer", letterSpacing: "0.05em" }}
          >
            Try again
          </button>
          <button
            onClick={switchToTextMode}
            style={{
              background: "none",
              border: "none",
              color: "#666666",
              fontSize: "0.8rem",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            type instead
          </button>
        </div>
      )}

      {/* Main intake UI — hidden when mic is denied */}
      {!micError && confirmedAnswers.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          {confirmedAnswers.map((a) => (
            <ConfirmedAnswer
              key={a.questionIndex}
              answer={a.extractedAnswer}
              questionIndex={a.questionIndex}
            />
          ))}
        </div>
      )}

      {/* Idle */}
      {!micError && state === "idle" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "3rem",
              color: "white",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Utah&apos;s Nexis
          </p>
          <p
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.9375rem",
              color: "#666666",
              margin: "0",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Utah business resources, matched to your story.
          </p>
          <button
            onClick={begin}
            style={{
              padding: "12px 40px",
              border: "1px solid white",
              background: "transparent",
              color: "white",
              fontSize: "1rem",
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            Find your resources →
          </button>
        </div>
      )}

      {/* Instructions */}
      {!micError && state === "instructions" && (
        <InstructionSlide onBegin={handleBegin} />
      )}

      {/* Listening */}
      {!micError && state === "listening" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <QuestionDisplay question={QUESTIONS[currentQuestionIndex]} />

          {inputMode === 'voice' ? (
            <>
              <TranscriptDisplay
                finalTranscript={currentTranscript}
                interimTranscript={interimTranscript}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "16px",
                  marginTop: "24px",
                }}
              >
                <MicIndicator isListening={isListening} />
                <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                  {currentTranscript && (
                    <button
                      onClick={confirmAnswer}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#888",
                        fontSize: "0.8rem",
                        fontFamily: "ui-sans-serif, system-ui, -apple-system",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      confirm
                    </button>
                  )}
                  <button
                    onClick={skipQuestion}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#666",
                      fontSize: "0.8rem",
                      fontFamily: "ui-sans-serif, system-ui, -apple-system",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    skip
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginTop: "24px" }}>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.25rem",
                  textAlign: "center",
                  lineHeight: 1.7,
                  color: "white",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #444444",
                  outline: "none",
                  width: "100%",
                  resize: "none",
                  padding: "8px 0",
                }}
              />
              <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                {textInput.trim() && (
                  <button
                    onClick={() => { submitTextAnswer(textInput); setTextInput(''); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#888",
                      fontSize: "0.8rem",
                      fontFamily: "ui-sans-serif, system-ui, -apple-system",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    confirm
                  </button>
                )}
                <button
                  onClick={() => { setTextInput(''); skipQuestion(); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    fontSize: "0.8rem",
                    fontFamily: "ui-sans-serif, system-ui, -apple-system",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processing */}
      {!micError && state === "processing" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <QuestionDisplay question={QUESTIONS[currentQuestionIndex]} />
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              color: "#666666",
              fontSize: "1.125rem",
              margin: "16px 0",
            }}
          >
            Processing...
          </p>
        </div>
      )}

      {/* Confirmed */}
      {!micError && state === "confirmed" && (
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontStyle: "italic",
              color: "#666666",
              fontSize: "1rem",
              margin: "0 0 8px",
            }}
          >
            Got it
          </p>
        </div>
      )}

      {/* Complete */}
      {!micError && state === "complete" && (
        <p
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontStyle: "italic",
            fontSize: "1.25rem",
            color: "white",
            textAlign: "center",
            margin: 0,
          }}
        >
          Finding your matches...
        </p>
      )}
    </div>
  );
}
