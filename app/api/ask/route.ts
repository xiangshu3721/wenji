import { NextResponse } from "next/server";
import { handleFinish, handleReply, handleStart, hasRealGateway } from "@/lib/ai";
import {
  LIMITS,
  clientKey,
  corsHeaders,
  sanitizeMessages,
  takeSlot,
} from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

function reply(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), ...extra },
  });
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: Request) {
  const slot = takeSlot(clientKey(req));
  if (!slot.ok) {
    return reply(
      req,
      { error: "说得有点快，歇一会儿再继续吧。" },
      429,
      { "Retry-After": String(slot.retrySeconds) }
    );
  }

  try {
    const raw = await req.text();
    if (raw.length > LIMITS.bodyBytes) {
      return reply(req, { error: "内容太长了，精简一些再试。" }, 413);
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(req, { error: "请求无法解析" }, 400);
    }
    const mode = body?.mode;

    if (mode === "start") {
      const concern = String(body?.concern || "").trim();
      if (!concern) return reply(req, { error: "请写下此刻心里的困惑" }, 400);
      if (concern.length > LIMITS.concern) {
        return reply(req, { error: `一次最多写 ${LIMITS.concern} 字，先挑最想说的。` }, 400);
      }
      const result = await handleStart(concern);
      return reply(req, { ...result, mock: !hasRealGateway() });
    }

    if (mode === "reply") {
      const answer = String(body?.answer || "").trim();
      if (!answer) return reply(req, { error: "请输入你的回答" }, 400);
      if (answer.length > LIMITS.answer) {
        return reply(req, { error: `一次最多写 ${LIMITS.answer} 字，分几次说也可以。` }, 400);
      }
      const messages = sanitizeMessages(body?.messages);
      if (!messages) return reply(req, { error: "会话无效" }, 400);
      const result = await handleReply(messages, answer);
      return reply(req, { ...result, mock: !hasRealGateway() });
    }

    if (mode === "finish") {
      const messages = sanitizeMessages(body?.messages);
      if (!messages) return reply(req, { error: "会话无效" }, 400);
      const result = await handleFinish(messages);
      return reply(req, { ...result, mock: !hasRealGateway() });
    }

    return reply(req, { error: "mode 须为 start、reply 或 finish" }, 400);
  } catch (e) {
    // 只返回通用提示，不把上游错误细节带给浏览器
    console.error("ask failed:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return reply(req, { error: "服务暂时没接上，稍后再试一次。" }, 500);
  }
}

export async function GET(req: Request) {
  return reply(req, {
    ok: true,
    product: "问己",
    gateway: hasRealGateway() ? "live" : "mock",
  });
}
