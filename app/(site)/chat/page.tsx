import type { Metadata } from "next";
import { ChatThread } from "@/components/chat/ChatThread";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <div className="chat-page">
      <main className="chat-main">
        <ChatThread />
      </main>
      <footer className="container chat-footer">
        <p>
          Occupation and skills data from O*NET 31.0 by the U.S. Department of Labor, licensed CC BY 4.0. Job-market figures from the U.S. Bureau of Labor Statistics.
        </p>
      </footer>
    </div>
  );
}
