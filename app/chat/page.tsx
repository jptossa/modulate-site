import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { ChatThread } from "@/components/chat/ChatThread";
import { Button } from "@/components/ds";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <div className="chat-page">
      {/* The session is read behind Suspense: it needs the request's cookies (cacheComponents). */}
      <Suspense
        fallback={
          <>
            <header className="container chat-header">
              <Logo />
            </header>
            <main className="chat-main" />
          </>
        }
      >
        <ChatSession />
      </Suspense>
      <footer className="container chat-footer">
        <p>
          Occupation and skills data from O*NET 31.0 by the U.S. Department of Labor, licensed CC BY 4.0. Job-market figures from the U.S. Bureau of Labor Statistics.
        </p>
      </footer>
    </div>
  );
}

async function ChatSession() {
  // Keep this out of the prerender and the runtime prefetch: the auth check reads the clock.
  await connection();
  const user = await getCurrentUser();
  return (
    <>
      <header className="container chat-header">
        <Logo />
        {user ? (
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        ) : (
          <nav className="chat-nav" aria-label="Account">
            <Link href="/auth/sign-in?next=/chat" className="chat-link">
              Sign in
            </Link>
            <Button href="/auth/sign-up?next=/chat" variant="secondary">
              Create an account
            </Button>
          </nav>
        )}
      </header>
      <main className="chat-main">
        <ChatThread />
      </main>
    </>
  );
}
