import type { Message } from "./types";

/** 允许调用接口的网页来源（Pages + 本地调试） */
const ALLOWED_ORIGINS = new Set([
  "https://xiangshu3721.github.io",
  "http://localhost:3020",
  "http://127.0.0.1:3020",
  "http://localhost:3000",
]);

export const LIMITS = {
  concern: 1000,
  answer: 2000,
  messages: 80,
  messageChars: 4000,
  bodyBytes: 120_000,
};

export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    // 预检结果缓存一天，减少云端冷启动时的 OPTIONS 失败
    "Access-Control-Max-Age": "86400",
    "Content-Disposition": "inline",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
  }
  return h;
}

/** 只保留 user/assistant，限制条数与长度，防止客户端塞入 system 指令或超长内容 */
export function sanitizeMessages(input: unknown): Message[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.length > LIMITS.messages) return null;
  const out: Message[] = [];
  for (const m of input) {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null;
    }
    out.push({ role, content: content.slice(0, LIMITS.messageChars) });
  }
  return out;
}

/* ---------- 简单限流（内存，按来访 IP） ---------- */
const PER_MINUTE = 15;
const PER_HOUR = 120;
const hits = new Map<string, number[]>();

export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  return ip.slice(0, 64);
}

export function takeSlot(key: string, now = Date.now()): { ok: boolean; retrySeconds: number } {
  const list = (hits.get(key) || []).filter((t) => now - t < 3_600_000);
  const lastMin = list.filter((t) => now - t < 60_000);
  if (lastMin.length >= PER_MINUTE) {
    return { ok: false, retrySeconds: Math.ceil((60_000 - (now - lastMin[0])) / 1000) };
  }
  if (list.length >= PER_HOUR) {
    return { ok: false, retrySeconds: Math.ceil((3_600_000 - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      if (!v.some((t: number) => now - t < 3_600_000)) hits.delete(k);
    });
  }
  return { ok: true, retrySeconds: 0 };
}
