import { ASK_URL } from "@/lib/api";

/**
 * 统一的接口请求：单次超时 + 对网络错误 / 超时 / 502 / 503 / 504 静默重试（带退避）。
 * - 用 text/plain 发送 JSON：属于“简单请求”，不触发 CORS 预检，冷启动时少一次往返（服务端按文本解析 JSON）。
 * - 没有 AbortController 的环境用 Promise.race 兜底超时。
 * - 任何失败都会以 AskError 抛出，调用方据此恢复按钮。
 */

export const FRIENDLY_SLOW = "网络有点慢，再点一次试试。";

export class AskError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

type Opts = {
  timeoutMs?: number;
  retries?: number;
  /** 第 n 次重试开始前回调（n 从 1 开始），用于切换“正在唤醒”文案 */
  onRetry?: (n: number) => void;
};

const RETRY_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(body: unknown, timeoutMs: number): Promise<Response> {
  const hasAbort = typeof AbortController !== "undefined";
  const ctrl = hasAbort ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // 先判定超时，再中止请求，保证调用方拿到的是“超时”
      reject(new AskError("timeout", 0));
      try {
        ctrl?.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);
  });
  try {
    const req = fetch(ASK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(body),
      cache: "no-store",
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    return await Promise.race([req, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function postAsk<T = Record<string, unknown>>(
  body: unknown,
  opts: Opts = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const retries = opts.retries ?? 2;
  let lastErr: AskError = new AskError(FRIENDLY_SLOW);
  let timeouts = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // 已经整段超时过一次又失败，就不再久等第三次（最多约 40 秒给出结果）
    if (timeouts >= 1 && attempt >= 2) break;
    if (attempt > 0) {
      try {
        opts.onRetry?.(attempt);
      } catch {
        /* ignore */
      }
      await sleep(attempt === 1 ? 1500 : 3500);
    }
    let res: Response;
    try {
      res = await once(body, timeoutMs);
    } catch (e) {
      // 网络错误 / 超时：可重试
      if (e instanceof AskError && e.message === "timeout") timeouts += 1;
      lastErr = new AskError(FRIENDLY_SLOW, 0);
      continue;
    }
    if (RETRY_STATUS.has(res.status)) {
      lastErr = new AskError(FRIENDLY_SLOW, res.status);
      continue;
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      if (res.ok) {
        lastErr = new AskError(FRIENDLY_SLOW, res.status);
        continue;
      }
    }
    if (!res.ok) {
      const msg = typeof data.error === "string" && data.error ? data.error : FRIENDLY_SLOW;
      throw new AskError(msg, res.status);
    }
    return data as T;
  }
  throw lastErr;
}

/** 页面打开时静默预热云端（GET 不计限流），失败无所谓 */
let warmed = false;
export function warmUp() {
  if (warmed || typeof fetch === "undefined") return;
  warmed = true;
  try {
    fetch(ASK_URL, { method: "GET", cache: "no-store" }).catch(() => {});
  } catch {
    /* ignore */
  }
}
