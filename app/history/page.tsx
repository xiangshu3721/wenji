"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessions, formatDate, setDraft } from "@/lib/storage";
import type { Session } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const list = getSessions()
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setSessions(list);
    setReady(true);
  }, []);

  function openSession(s: Session) {
    if (s.insight) {
      router.push(`/insight?id=${encodeURIComponent(s.id)}`);
      return;
    }
    // In-progress: restore draft and continue chat
    setDraft({
      sessionId: s.id,
      concern: s.concern,
      messages: s.messages,
    });
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wenji_concern", s.concern);
    }
    router.push("/ask");
  }

  return (
    <main className="page">
      <div className="topbar">
        <Link className="quiet-link" href="/" style={{ borderBottom: "none" }}>
          ←
        </Link>
        <span className="topbar-title">我的问题</span>
        <span style={{ width: 24 }} />
      </div>

      <h1
        style={{
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textIndent: 0,
          textAlign: "left",
          margin: "8px 0 24px",
        }}
      >
        我的问题
      </h1>

      {!ready ? (
        <div className="empty-state">加载中…</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <p>还没有问己记录</p>
          <Link className="quiet-link" href="/">
            开始第一次
          </Link>
        </div>
      ) : (
        <div>
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="history-item"
              onClick={() => openSession(s)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
              }}
            >
              <div className="history-date">
                {s.date || formatDate(s.createdAt)}
                {s.insight ? " · 已自见" : " · 进行中"}
              </div>
              <div className="history-concern">
                {s.insight?.matter || s.concern}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
