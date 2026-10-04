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

type Phase = "idle" | "thinking" | "typing";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function AskPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [concern, setConcern] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const busyRef = useRef(false);
  const runRef = useRef(0);
  const fullRef = useRef<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef("");
  const concernRef = useRef("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    // 离开页面时让进行中的“逐条出现”停下
    return () => {
      runRef.current += 1;
    };
  }, []);
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
      const all = draft.messages as Message[];
      fullRef.current = all;
      let fresh = false;
      try {
        fresh = sessionStorage.getItem("wenji_reveal") === "1";
      } catch {
        /* ignore */
      }
      const firstUser = all.findIndex((m) => m.role === "user");
      const tail = firstUser >= 0 ? all.slice(firstUser + 1) : [];
      if (fresh && tail.length > 0 && tail.every((m) => m.role === "assistant")) {
        const base = all.slice(0, firstUser + 1);
        setMessages(base);
        setReady(true);
        busyRef.current = true;
        revealBubbles(base, tail, 0, true).finally(() => {
          busyRef.current = false;
          try {
            sessionStorage.removeItem("wenji_reveal");
          } catch {
            /* ignore */
          }
        });
        return;
      }
      setMessages(all);
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
    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, loading, phase, errorMsg]);

  /**
   * 回复逐条出现：已“思考”的时间从 sentAt 起算（含真实请求耗时），
   * 不够再补，够了就不再叠加；条与条之间有短暂“正在输入”。
   */
  async function revealBubbles(
    base: Message[],
    incoming: Message[],
    sentAt: number,
    quick = false
  ): Promise<boolean> {
    const token = ++runRef.current;
    const reduce = prefersReducedMotion();
    const chars = incoming.reduce((n, m) => n + m.content.length, 0);
    // quick：刚从首页过来，已经等过一轮请求，只留一小段停顿
    const thinkMs = reduce ? 300 : quick ? 800 : clamp(1200 + chars * 15, 1200, 3000);
    const waited = sentAt ? Date.now() - sentAt : thinkMs;
    setPhase("thinking");
    await sleep(Math.max(reduce ? 0 : 300, thinkMs - waited));
    let shown = base;
    for (let i = 0; i < incoming.length; i++) {
      if (runRef.current !== token) return false;
      if (i > 0) {
        setPhase("typing");
        await sleep(
          reduce ? 150 : clamp(450 + incoming[i].content.length * 22, 600, 1300)
        );
        if (runRef.current !== token) return false;
      }
      shown = [...shown, incoming[i]];
      setMessages(shown);
      setPhase(i < incoming.length - 1 ? "typing" : "idle");
    }
    return true;
  }

  function persistPartial(id: string, c: string, msgs: Message[]) {
    setDraft({ sessionId: id, concern: c, messages: msgs });
    upsertSessionPartial({ id, concern: c, messages: msgs });
  }

  function goHome() {
    const id = sessionIdRef.current;
    const c = concernRef.current;
    const msgs =
      fullRef.current.length >= messagesRef.current.length
        ? fullRef.current
        : messagesRef.current;
    if (id && msgs.length > 0) {
      persistPartial(id, c, msgs);
    }
    router.push("/");
  }

  async function send() {
    const text = answer.trim();
    if (!text || busyRef.current || loading || finishing) return;
    busyRef.current = true;
    setErrorMsg("");
    setAnswer("");
    setPhase("thinking");
    const sentAt = Date.now();

    const prev = messages;
    const optimistic: Message[] = [...prev, { role: "user", content: text }];
    setMessages(optimistic);
    fullRef.current = optimistic;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(ASK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reply",
          messages: prev,
          answer: text,
        }),
        signal: ctrl.signal,
      });
      let data: {
        error?: string;
        messages?: Message[];
        bubbles?: string[];
        question?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        /* 非 JSON，按失败处理 */
      }
      if (!res.ok) throw new Error(data.error || "回复失败");

      let incoming: Message[] = [];
      if (Array.isArray(data.messages) && data.messages.length > optimistic.length) {
        incoming = data.messages
          .slice(optimistic.length)
          .filter((m) => m.role === "assistant" && String(m.content || "").trim());
      }
      if (!incoming.length && Array.isArray(data.bubbles)) {
        incoming = data.bubbles
          .map((b) => String(b || "").trim())
          .filter(Boolean)
          .map((content) => ({ role: "assistant" as const, content }));
      }
      if (!incoming.length && data.question) {
        incoming = [{ role: "assistant", content: String(data.question) }];
      }
      if (!incoming.length) throw new Error("empty");

      const nextMessages = [...optimistic, ...incoming];
      fullRef.current = nextMessages;
      // 先整体存盘，再逐条展示；中途离开也不丢
      persistPartial(sessionId, concern, nextMessages);
      await revealBubbles(optimistic, incoming, sentAt);
      // 自见仅由用户点击「谢谢，我已经找到答案了」触发
    } catch (e) {
      runRef.current += 1;
      setMessages(prev);
      fullRef.current = prev;
      setAnswer(text);
      setPhase("idle");
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setErrorMsg(
        aborted
          ? "这一句等得有点久，没有送达。稍等一下，再发一次。"
          : e instanceof Error && e.message && !["empty", "回复失败", "Failed to fetch"].includes(e.message) && /[\u4e00-\u9fa5]/.test(e.message)
            ? e.message
            : "这一句没有送出去，网络好像有点慢。再试一次吧。"
      );
    } finally {
      clearTimeout(timer);
      busyRef.current = false;
      setPhase("idle");
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
    if (loading || finishing || busyRef.current || messages.length < 2) return;
    setErrorMsg("");
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
      setErrorMsg("自见这会儿没生成出来，稍等一下再点一次。");
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
              className={`bubble ${m.role === "assistant" ? "ai enter" : "user"}`}
            >
              {m.content}
            </div>
          ))}
        {loading || phase !== "idle" ? (
          <div
            className="bubble ai thinking"
            role="status"
            aria-live="polite"
          >
            {finishing ? (
              <span className="muted">正在整理自见…</span>
            ) : (
              <>
                <div className="typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                {phase === "thinking" ? (
                  <span className="think-text">正在想……</span>
                ) : (
                  <span className="sr-only">正在输入</span>
                )}
              </>
            )}
          </div>
        ) : null}
        {errorMsg ? (
          <p className="chat-error" role="alert">
            {errorMsg}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {messages.length >= 2 && !loading && phase === "idle" ? (
        <button
          type="button"
          className="finish-btn"
          onClick={finishEarly}
          disabled={loading || finishing || phase !== "idle"}
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
          disabled={loading || finishing || phase !== "idle"}
          maxLength={800}
        />
        <button
          className="send-btn"
          type="button"
          onClick={send}
          disabled={loading || finishing || phase !== "idle" || !answer.trim()}
        >
          发送
        </button>
      </div>
    </main>
  );
}
