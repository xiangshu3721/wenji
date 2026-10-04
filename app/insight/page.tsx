"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSession,
  saveSession,
  formatDate,
  upsertSessionPartial,
} from "@/lib/storage";
import type { Insight, Message, Session } from "@/lib/types";

interface Pending {
  sessionId: string;
  concern: string;
  messages: Message[];
  insight: { matter: string; care: string; see: string };
}

function InsightInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const [session, setSession] = useState<Session | null>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [userKnows, setUserKnows] = useState("");
  const [helpful, setHelpful] = useState<boolean | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) {
      router.replace("/");
      return;
    }

    const existing = getSession(id);

    let pending: Pending | null = null;
    try {
      const raw = sessionStorage.getItem("wenji_pending_insight");
      if (raw) pending = JSON.parse(raw) as Pending;
    } catch {
      pending = null;
    }

    if (pending && pending.sessionId === id && pending.insight) {
      const insightData: Insight = {
        matter: pending.insight.matter,
        care: pending.insight.care,
        see: pending.insight.see,
      };
      const already = getSession(pending.sessionId);
      const s = upsertSessionPartial({
        id: pending.sessionId,
        concern: pending.concern,
        messages: pending.messages,
        insight: insightData,
        accepted: already?.accepted === true ? true : false,
      });
      setSession(s);
      setInsight(insightData);
      setUserKnows(s.insight?.userKnows || already?.insight?.userKnows || "");
      setHelpful(s.helpful);
      setSaved(s.accepted === true);
      setReady(true);
      return;
    }

    if (existing?.insight) {
      setSession(existing);
      setInsight(existing.insight);
      setUserKnows(existing.insight.userKnows || "");
      setHelpful(existing.helpful);
      // Legacy (no accepted field): sessions were only written on 收下
      const isAccepted =
        existing.accepted === true || existing.accepted === undefined;
      setSaved(isAccepted);
      if (existing.accepted === undefined) {
        saveSession({ ...existing, accepted: true });
      }
      setReady(true);
      return;
    }

    if (existing) {
      setSession(existing);
      setInsight({
        matter: existing.concern,
        care: "",
        see: "",
      });
      setReady(true);
      return;
    }

    router.replace("/history");
  }, [id, router]);

  function accept() {
    if (!session || !insight) return;
    const next: Session = {
      ...session,
      insight: {
        ...insight,
        userKnows: userKnows.trim() || undefined,
      },
      helpful,
      accepted: true,
      date: session.date || formatDate(Date.now()),
      createdAt: session.createdAt || Date.now(),
    };
    saveSession(next);
    try {
      sessionStorage.removeItem("wenji_pending_insight");
    } catch {
      /* ignore */
    }
    setSaved(true);
    setSession(next);
  }

  if (!ready || !insight) {
    return (
      <main className="page">
        <div className="empty-state">
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
          <p>正在生成自见…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <Link className="quiet-link" href="/" style={{ borderBottom: "none" }}>
          ←
        </Link>
        <span className="topbar-title">自见</span>
        <span style={{ width: 24 }} />
      </div>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.28em",
          textIndent: "0.28em",
          margin: "12px 0 8px",
        }}
      >
        自见
      </h1>
      <p className="muted" style={{ marginBottom: 8 }}>
        {session?.date}
      </p>

      <div className="insight-card">
        <div className="insight-label">我看见</div>
        <div className="insight-body">{insight.matter}</div>
        <div className="insight-label">我明白</div>
        <div className="insight-body">{insight.care}</div>
        <div className="insight-label">我选择</div>
        <div className="insight-body">{insight.see}</div>
      </div>

      {session?.messages && session.messages.length > 0 ? (
        <div className="transcript-section">
          {!showTranscript ? (
            <button
              type="button"
              className="transcript-toggle"
              onClick={() => setShowTranscript(true)}
            >
              查看原始对话
            </button>
          ) : (
            <>
              <div className="transcript-header">
                <span className="transcript-title">原始对话</span>
                <button
                  type="button"
                  className="transcript-toggle"
                  onClick={() => setShowTranscript(false)}
                >
                  收起
                </button>
              </div>
              <div className="transcript-chat">
                {session.messages
                  .filter((m) => m.role === "user" || m.role === "assistant")
                  .map((m, i) => (
                    <div
                      key={`${i}-${m.role}`}
                      className={`bubble ${m.role === "assistant" ? "ai" : "user"}`}
                    >
                      {m.content}
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      <label
        className="muted"
        style={{ display: "block", marginTop: 20, marginBottom: 8 }}
      >
        这一刻，如果让你自己给这次探索留一句话，会是什么？
      </label>
      <textarea
        className="field"
        rows={3}
        placeholder="用自己的话写下一句"
        value={userKnows}
        onChange={(e) => setUserKnows(e.target.value)}
        disabled={saved}
        maxLength={300}
      />

      <div style={{ marginTop: 28 }}>
        <p className="muted" style={{ marginBottom: 12 }}>
          这次问己，有让你更了解自己吗？（可选）
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className={`btn-ghost${helpful === true ? " active" : ""}`}
            onClick={() => !saved && setHelpful(true)}
            disabled={saved}
          >
            有
          </button>
          <button
            type="button"
            className={`btn-ghost${helpful === false ? " active" : ""}`}
            onClick={() => !saved && setHelpful(false)}
            disabled={saved}
          >
            没有
          </button>
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 32 }}>
        {!saved ? (
          <button className="btn-primary" type="button" onClick={accept}>
            收下这次自见
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p
              style={{
                textAlign: "center",
                color: "var(--ink-muted)",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              已收下
            </p>
            <button
              className="btn-primary"
              type="button"
              onClick={() => router.push("/")}
            >
              回首页
            </button>
            <button
              className="btn-ghost"
              type="button"
              style={{ width: "100%" }}
              onClick={() => router.push("/history")}
            >
              我的问题
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function InsightPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="empty-state">加载中…</div>
        </main>
      }
    >
      <InsightInner />
    </Suspense>
  );
}
