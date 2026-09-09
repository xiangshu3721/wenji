import { NextRequest, NextResponse } from "next/server";
import { handleReply, handleStart, hasRealGateway } from "@/lib/ai";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body?.mode as string;

    if (mode === "start") {
      const concern = String(body?.concern || "").trim();
      if (!concern) {
        return NextResponse.json(
          { error: "请写下此刻心里的困惑" },
          { status: 400 }
        );
      }
      const result = await handleStart(concern);
      return NextResponse.json({
        ...result,
        mock: !hasRealGateway(),
      });
    }

    if (mode === "reply") {
      const answer = String(body?.answer || "").trim();
      const messages = (body?.messages || []) as Message[];
      if (!answer) {
        return NextResponse.json({ error: "请输入你的回答" }, { status: 400 });
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({ error: "会话无效" }, { status: 400 });
      }
      const result = await handleReply(messages, answer);
      return NextResponse.json({
        ...result,
        mock: !hasRealGateway(),
      });
    }

    return NextResponse.json(
      { error: "mode 须为 start 或 reply" },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: "问己",
    gateway: hasRealGateway() ? "live" : "mock",
  });
}
