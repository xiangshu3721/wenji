"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getTodayCount,
  setDraft,
  createId,
  getDraft,
  upsertSessionPartial,
} from "@/lib/storage";
import { postAsk, warmUp, FRIENDLY_SLOW } from "@/lib/request";
import type { Message } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function HomePage() {
  const router = useRouter();
  const [concern, setConcern] = useState("");
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasResume, setHasResume] = useState(false);
  const [loadingText, setLoadingText] = useState("正在进入…");
  const busyRef = useRef(false);

  useEffect(() => {
    warmUp();
    // 从后退缓存恢复（如微信里返回）时，按钮复位
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        busyRef.current = false;
        setLoading(false);
      }
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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
    if (busyRef.current) return;
    busyRef.current = true;
    setError("");
    setLoading(true);
    setLoadingText("正在进入…");
    // 超过 6 秒还没回来，多半是云端在冷启动
    const slowTimer = setTimeout(() => setLoadingText("正在唤醒，稍等几秒…"), 6000);
    let navigated = false;
    try {
      const data = await postAsk<{ messages?: Message[] }>(
        { mode: "start", concern: text },
        { onRetry: () => setLoadingText("正在唤醒，稍等几秒…") }
      );
      if (!Array.isArray(data.messages) || data.messages.length < 2) {
        throw new Error(FRIENDLY_SLOW);
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
        messages: data.messages,
      });
      if (typeof window !== "undefined") {
        sessionStorage.setItem("wenji_concern", text);
        sessionStorage.setItem("wenji_reveal", "1");
      }
      navigated = true;
      router.push("/ask");
      // 个别内置浏览器里客户端跳转偶发失败：4 秒后仍在首页就整页跳转
      setTimeout(() => {
        const here = window.location.pathname.replace(/\/+$/, "");
        if (here === BASE_PATH || here === "") {
          window.location.assign(`${BASE_PATH}/ask/`);
        }
      }, 4000);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : FRIENDLY_SLOW);
    } finally {
      clearTimeout(slowTimer);
      if (!navigated) {
        busyRef.current = false;
        setLoading(false);
      }
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
            className="home-error"
            role="alert"
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
            {loading ? loadingText : "开始问己"}
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
