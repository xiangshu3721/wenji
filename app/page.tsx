"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getTodayCount,
  setDraft,
  createId,
  getDraft,
  upsertSessionPartial,
} from "@/lib/storage";
import { ASK_URL } from "@/lib/api";
import type { Message } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [concern, setConcern] = useState("");
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasResume, setHasResume] = useState(false);

  useEffect(() => {
    setTodayCount(getTodayCount());
    const draft = getDraft();
    setHasResume(Boolean(draft && draft.messages?.length));
  }, []);

  async function startAsk() {
    const text = concern.trim();
    if (!text) {
      setError("此刻，你的心里有什么困惑？先写下吧。");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(ASK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "start", concern: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "开始失败");
      }
      const sessionId = createId();
      setDraft({
        sessionId,
        concern: text,
        messages: data.messages,
      });
      upsertSessionPartial({
        id: sessionId,
        concern: text,
        messages: data.messages as Message[],
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("wenji_concern", text);
      }
      router.push("/ask");
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络异常，请稍后再试");
      setLoading(false);
    }
  }

  return (
    <main className="page" style={{ justifyContent: "space-between" }}>
      <header style={{ paddingTop: 48 }}>
        <h1 className="brand-title">问己</h1>
        <p className="brand-sub">AI 深度自我探索</p>
      </header>

      <section style={{ marginTop: 56 }}>
        <p
          style={{
            fontSize: 17,
            color: "var(--ink-soft)",
            letterSpacing: "0.04em",
            marginBottom: 14,
          }}
        >
          相比答案，好的问题更重要！
        </p>
        <p
          style={{
            fontSize: 15,
            color: "var(--ink-muted)",
            letterSpacing: "0.2em",
          }}
        >
          问至无问，答案自明
        </p>
      </section>

      <section style={{ marginTop: 48, flex: 1 }}>
        <textarea
          className="field"
          rows={4}
          placeholder="此刻，你的心里有什么困惑？"
          value={concern}
          onChange={(e) => setConcern(e.target.value)}
          disabled={loading}
          maxLength={500}
        />
        {error ? (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "#8b5a4a",
            }}
          >
            {error}
          </p>
        ) : null}
        <div style={{ marginTop: 18 }}>
          <button
            className="btn-primary"
            onClick={startAsk}
            disabled={loading}
            type="button"
          >
            {loading ? "正在进入…" : "开始问己"}
          </button>
        </div>
        {hasResume ? (
          <p style={{ marginTop: 16, textAlign: "center" }}>
            <Link className="quiet-link" href="/ask">
              继续上次问己
            </Link>
          </p>
        ) : null}
      </section>

      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 24,
        }}
      >
        <span className="muted">今日已问 {todayCount} 次</span>
        <Link className="quiet-link" href="/history">
          我的问题
        </Link>
      </footer>
    </main>
  );
}
