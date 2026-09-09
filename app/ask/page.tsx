"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearDraft,
  getDraft,
  setDraft,
  createId,
  incrementTodayCount,
  upsertSessionPartial,
} from "@/lib/storage";
import type { Message } from "@/lib/types";

export default function AskPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [concern, setConcern] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef("");
  const concernRef = useRef("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  useEffect(() => {
    concernRef.current = concern;
  }, [concern]);

  useEffect(() => {
    const draft = getDraft();
    if (draft && draft.messages?.length) {
      setSessionId(draft.sessionId);
      setConcern(draft.concern);
      setMessages(draft.messages as Message[]);
      upsertSessionPartial({
        id: draft.sessionId,
        concern: draft.concern,
        messages: draft.messages as Message[],
      });
      setReady(true);
      return;
    }
    const q =
      typeof window !== "undefined"
        ? sessionStorage.getItem("wenji_concern") || ""
        : "";
    if (!q) {
      router.replace("/");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "start", concern: q }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "失败");
        const id = createId();
        setSessionId(id);
        setConcern(q);
        setMessages(data.messages);
        setDraft({ sessionId: id, concern: q, messages: data.messages });
        upsertSessionPartial({
          id,
          concern: q,
          messages: data.messages,
        });
        setReady(true);
      } catch {
        router.replace("/");
      }
    })();
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function persistPartial(id: string, c: string, msgs: Message[]) {
    setDraft({ sessionId: id, concern: c, messages: msgs });
    upsertSessionPartial({ id, concern: c, messages: msgs });
  }

  function goHome() {
    const id = sessionIdRef.current;
    const c = concernRef.current;
    const msgs = messagesRef.current;
    if (id && msgs.length > 0) {
      persistPartial(id, c, msgs);
    }
    router.push("/");
  }

  async function send() {
    const text = answer.trim();
    if (!text || loading) return;
    setAnswer("");
    setLoading(true);

    const optimistic: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(optimistic);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reply",
          messages,
          answer: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "回复失败");

      const nextMessages: Message[] =
        data.messages ||
        [
          ...optimistic,
          {
            role: "assistant",
            content: data.question || "……",
          },
        ];

      setMessages(nextMessages);
      persistPartial(sessionId, concern, nextMessages);

      if (data.action === "finish" && data.insight) {
        upsertSessionPartial({
          id: sessionId,
          concern,
          messages: nextMessages,
          insight: {
            matter: data.insight.matter,
            care: data.insight.care,
            see: data.insight.see,
          },
          accepted: false,
        });
        incrementTodayCount();
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            "wenji_pending_insight",
            JSON.stringify({
              sessionId,
              concern,
              messages: nextMessages,
              insight: data.insight,
            })
          );
        }
        clearDraft();
        router.push(`/insight?id=${encodeURIComponent(sessionId)}`);
        return;
      }
    } catch {
      setMessages(messages);
      setAnswer(text);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!ready) {
    return (
      <main className="page">
        <div className="empty-state">
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
          <p>正在进入问己…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page" style={{ paddingTop: 12, paddingBottom: 12 }}>
      <div className="topbar">
        <button
          type="button"
          className="quiet-link"
          onClick={goHome}
          style={{
            borderBottom: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            font: "inherit",
            color: "inherit",
          }}
        >
          ←
        </button>
        <span className="topbar-title">正在问己</span>
        <span style={{ width: 24 }} />
      </div>

      <div className="chat-area">
        {messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m, i) => (
            <div
              key={`${i}-${m.role}`}
              className={`bubble ${m.role === "assistant" ? "ai" : "user"}`}
            >
              {m.content}
            </div>
          ))}
        {loading ? (
          <div className="bubble ai">
            <div className="typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="composer">
        <textarea
          ref={inputRef}
          className="field"
          rows={1}
          placeholder="输入你的回答……"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          maxLength={800}
        />
        <button
          className="send-btn"
          type="button"
          onClick={send}
          disabled={loading || !answer.trim()}
        >
          发送
        </button>
      </div>
    </main>
  );
}
