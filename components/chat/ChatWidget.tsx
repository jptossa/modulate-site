"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ds";
import { ChatThread } from "./ChatThread";
import "./widget.css";

/** Pages that are the chat itself, or where a chat bubble would get in the way. */
const HIDDEN_ON = ["/chat", "/auth"];

/**
 * Floating chat for every page. It is a modal <dialog>, so the browser handles the focus trap, Escape,
 * and returning focus to the launcher. The thread stays mounted while the dialog is closed (and across
 * page changes, because this lives in the root layout), so the conversation is not lost on close.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector("textarea")?.focus();
  }

  function close() {
    dialogRef.current?.close();
  }

  // Arriving on /chat or an auth page (for example through "Create an account") closes the panel.
  useEffect(() => {
    if (hidden) dialogRef.current?.close();
  }, [hidden]);

  return (
    <>
      <button type="button" className="chat-launcher" aria-haspopup="dialog" hidden={hidden} onClick={open}>
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-4 3v-3H5.5A2.5 2.5 0 0 1 3 11.5z" />
        </svg>
        Ask Modulate
      </button>

      <dialog
        ref={dialogRef}
        className="chat-dialog"
        aria-labelledby={titleId}
        // A click on the backdrop reports the dialog itself as the target; the dialog has no padding of its own.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="chat-dialog-head">
          <h2 id={titleId} className="chat-dialog-title">
            Route guide
          </h2>
          <Button type="button" variant="secondary" onClick={close}>
            Close chat
          </Button>
        </div>
        <div className="chat-dialog-body">
          <ChatThread variant="widget" />
        </div>
      </dialog>
    </>
  );
}
