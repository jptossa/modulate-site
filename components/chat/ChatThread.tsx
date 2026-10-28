"use client";

import { useChat } from "@ai-sdk/react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Chip } from "@/components/ds";
import { ToolResult, type ToolPart } from "./ToolResult";

const STARTERS = [
  "I'm a teacher and want a change. Where could I go?",
  "Which skills carry over from nursing to other roles?",
  "Is demand for software developers rising or cooling?",
];

/** useChat surfaces a non-OK response as Error(body text). Our route returns { error }. */
function errorMessage(error: Error): string {
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // not JSON: fall through
  }
  return "Something went wrong. Please try again.";
}

export function ChatThread({ signedIn }: { signedIn: boolean }) {
  const { messages, sendMessage, status, stop, error, clearError } = useChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    clearError();
    void sendMessage({ text: trimmed });
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="chat-thread">
      <div className="chat-scroll" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <h1 className="type-panel-title" style={{ color: "var(--ink)" }}>
              Where are you today?
            </h1>
            <p>Tell me your current role. I&apos;ll show the routes your skills already connect to, and what the job market says about each one.</p>
            <div className="chat-starters">
              {STARTERS.map((s) => (
                <Chip key={s} onClick={() => send(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`chat-msg chat-msg-${m.role}`}>
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return part.text ? (
                    <p key={i} className="chat-text">
                      {part.text}
                    </p>
                  ) : null;
                }
                if (part.type.startsWith("tool-")) return <ToolResult key={i} part={part as unknown as ToolPart} />;
                return null;
              })}
            </div>
          ))
        )}
        {status === "submitted" ? (
          <p className="chat-tool-note" role="status">
            Thinking…
          </p>
        ) : null}
        {error ? (
          <div className="chat-error" role="alert">
            <p>{errorMessage(error)}</p>
            {!signedIn && /guest/i.test(errorMessage(error)) ? (
              <Link href="/auth/sign-up?next=/chat" className="chat-link">
                Create an account
              </Link>
            ) : null}
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form className="chat-composer" onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          rows={2}
          value={input}
          maxLength={2000}
          placeholder="Describe your current role or the career you're curious about"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="chat-composer-actions">
          {busy ? (
            <Button type="button" variant="secondary" onClick={() => void stop()}>
              Stop
            </Button>
          ) : null}
          <Button type="submit" disabled={busy || input.trim() === ""}>
            Send message
          </Button>
        </div>
      </form>
    </div>
  );
}
