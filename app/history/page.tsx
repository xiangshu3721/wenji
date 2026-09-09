"use client";

import { useEffect, useState } from "react";
import { getSessions, formatDate } from "@/lib/storage";
import type { Session } from "@/lib/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const list = getSessions()
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setSessions(list);
    setReady(true);
  }, []);

  return (
    <main className="page">
      <div className="topbar">
        <a className="quiet-link" href="/" style={{ borderBottom: "none" }}>
          ←
        </a>
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
          <a className="quiet-link" href="/">
            开始第一次
          </a>
        </div>
      ) : (
        <div>
          {sessions.map((s) => (
            <a
              key={s.id}
              className="history-item"
              href={`/insight?id=${encodeURIComponent(s.id)}`}
            >
              <div className="history-date">
                {s.date || formatDate(s.createdAt)}
                {s.insight ? " · 自见" : ""}
              </div>
              <div className="history-concern">
                {s.insight?.matter || s.concern}
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
