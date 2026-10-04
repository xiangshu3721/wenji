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
import { ASK_URL } from "@/lib/api";
import type { Message } from "@/lib/types";

export default function AskPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [concern, setConcern] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
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
        const res = await fetch(ASK_URL, {
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
      const res = await fetch(ASK_URL, {
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

      let nextMessages: Message[];
      if (Array.isArray(data.messages) && data.messages.length) {
        nextMessages = data.messages;
      } else if (Array.isArray(data.bubbles) && data.bubbles.length) {
        nextMessages = [
          ...optimistic,
          ...data.bubbles
            .map((b: string) => String(b || "").trim())
            .filter(Boolean)
            .map((content: string) => ({
              role: "assistant" as const,
              content,
            })),
        ];
      } else {
        nextMessages = [
          ...optimistic,
          {
            role: "assistant",
            content: data.question || "……",
          },
        ];
      }

      setMessages(nextMessages);
      persistPartial(sessionId, concern, nextMessages);
      // 自见仅由用户点击「谢谢，我已经找到答案了」触发
    } catch {
      setMessages(messages);
      setAnswer(text);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }


  function applyFinishFlow(
    nextMessages: Message[],
    insight: { matter: string; care: string; see: string }
  ) {
    upsertSessionPartial({
      id: sessionId,
      concern,
      messages: nextMessages,
      insight: {
        matter: insight.matter,
        care: insight.care,
        see: insight.see,
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
          insight,
        })
      );
    }
    clearDraft();
    router.push(`/insight?id=${encodeURIComponent(sessionId)}`);
  }

  async function finishEarly() {
    if (loading || finishing || messages.length < 2) return;
    setFinishing(true);
    setLoading(true);
    try {
      const res = await fetch(ASK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "finish",
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "结束失败");
      if (!data.insight) throw new Error("未生成自见");

      let nextMessages: Message[] = data.messages || messages;
      const stopLine = "先停在这里。";
      const last = nextMessages[nextMessages.length - 1];
      if (
        !(
          last?.role === "assistant" &&
          last.content.trim() === stopLine
        )
      ) {
        nextMessages = [
          ...nextMessages,
          { role: "assistant", content: stopLine },
        ];
      }

      setMessages(nextMessages);
      applyFinishFlow(nextMessages, data.insight);
    } catch {
      setFinishing(false);
      setLoading(false);
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
            {finishing ? (
              <span className="muted">正在整理自见…</span>
            ) : (
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {messages.length >= 2 && !loading ? (
        <button
          type="button"
          className="finish-btn"
          onClick={finishEarly}
          disabled={loading || finishing}
        >
          <svg
            className="finish-icon"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
            <path
              d="M5.2 8.1 7.1 10l3.7-4.2"
              stroke="currentColor"
              strokeWidth="1.35"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          谢谢，我已经找到答案了
        </button>
      ) : null}

      <div className="composer">
        <textarea
          ref={inputRef}
          className="field"
          rows={1}
          placeholder="输入你的回答……"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading || finishing}
          maxLength={800}
        />
        <button
          className="send-btn"
          type="button"
          onClick={send}
          disabled={loading || finishing || !answer.trim()}
        >
          发送
        </button>
      </div>
    </main>
  );
}
