import type { Message, ReplyResponse, StartResponse } from "./types";

const SYSTEM_PROMPT = `你是「问己」——一位安静、克制的深度自我探索引导者。

产品理念：AI 不急着给答案，通过连续追问帮用户看见自己的答案。
口号：问至无问，答案自明。

内部七层（事/感/欲/惧/念/我/无），你自行判断下一层，不必强制走完：
- 事：发生了什么、具体情境
- 感：此刻身体或情绪的感受
- 欲：真正想要的是什么
- 惧：担心失去或害怕的是什么
- 念：反复出现的想法、自我叙事
- 我：这与「我是谁」有何关联
- 无：若放下执念，还剩下什么

严格规则：
1. 每次只问一个问题，简短、温柔、具体
2. 禁止连环「为什么」；可用「是什么让你……」「你说的……，是指？」
3. 禁止心理标签、诊断、说教、替用户做决定
4. 禁止急着总结；问题必须紧扣用户上一句回答
5. 当用户已能清晰看见自己时，停止追问，输出自见

开始模式：根据用户的困惑，给出第一个问题。
回复模式：若需继续追问，输出 action=ask 与一个 question；若可结束，输出 action=finish 与 insight（matter/care/see 三段简短中文）。

输出必须是合法 JSON，不要 markdown 代码块。`;

function getGateway(): {
  baseUrl: string;
  apiKey: string;
  model: string;
} | null {
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseek) {
    return {
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: deepseek,
      model: "deepseek-chat",
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      apiKey: openai,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  return null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
  const gw = getGateway();
  if (!gw) throw new Error("NO_GATEWAY");

  const res = await fetch(`${gw.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gw.apiKey}`,
    },
    body: JSON.stringify({
      model: gw.model,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM_HTTP_${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content || "";
}

/* ---------- Mock（规则追问 → 模板自见） ---------- */

const MOCK_QUESTIONS = [
  (concern: string) =>
    `你提到「${clip(concern, 24)}」。此刻，这件事里最让你停不下来的一点是什么？`,
  () => `说起这个，你身体里最先出现的感觉是什么？`,
  () => `在这些感受底下，你真正想要的是什么？`,
  () => `如果这件事暂时无解，你最怕失去的是什么？`,
  () => `你对自己反复说过的那句话是什么？`,
  () => `若把「应该怎样」都放下，你还看见什么？`,
];

function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : t.slice(0, n) + "…";
}

function countUserTurns(messages: Message[]): number {
  return messages.filter((m) => m.role === "user").length;
}

function mockStart(concern: string): StartResponse {
  const q = MOCK_QUESTIONS[0](concern);
  const messages: Message[] = [
    { role: "user", content: concern },
    { role: "assistant", content: q },
  ];
  return { firstQuestion: q, messages };
}

function mockReply(messages: Message[], answer: string): ReplyResponse {
  const next: Message[] = [
    ...messages,
    { role: "user", content: answer },
  ];
  // assistant 已提问次数（含 start 的第一问）
  const asked = messages.filter((m) => m.role === "assistant").length;
  const userReplies = countUserTurns(next) - 1; // 不含最初 concern
  // 约 4–6 轮用户回答后结束；话里出现「明白/清楚」等可提前
  const clear =
    /我明白|我清楚|原来是|其实我|我真正|答案是|知道了/.test(answer) &&
    userReplies >= 3;
  const shouldFinish =
    userReplies >= 5 || (userReplies >= 4 && answer.length > 40) || clear;

  if (shouldFinish) {
    const concern =
      messages.find((m) => m.role === "user")?.content || answer;
    const insight = {
      matter: clip(concern, 48),
      care: clip(answer, 48) || "对自己诚实的那一刻",
      see: "答案不在别处，而在你愿意停下来看自己的地方。",
    };
    next.push({
      role: "assistant",
      content: "好。我们停在这里。",
    });
    return { action: "finish", insight, messages: next };
  }

  // 下一问：感→欲→惧→念→无（index 1..5）
  const idx = Math.min(asked, MOCK_QUESTIONS.length - 1);
  const qFn = MOCK_QUESTIONS[idx];
  const question =
    idx === 0
      ? (qFn as (c: string) => string)(answer)
      : (qFn as () => string)();
  next.push({ role: "assistant", content: question });
  return { action: "ask", question, messages: next };
}

/* ---------- Real LLM ---------- */

async function llmStart(concern: string): Promise<StartResponse> {
  const raw = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        mode: "start",
        concern,
        instruction:
          '返回 JSON：{"firstQuestion":"你的第一个问题","messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    firstQuestion?: string;
    messages?: Message[];
  } | null;

  if (parsed?.firstQuestion) {
    const messages: Message[] =
      parsed.messages && parsed.messages.length >= 2
        ? parsed.messages
        : [
            { role: "user", content: concern },
            { role: "assistant", content: parsed.firstQuestion },
          ];
    return { firstQuestion: parsed.firstQuestion, messages };
  }

  // fallback
  return mockStart(concern);
}

async function llmReply(
  messages: Message[],
  answer: string
): Promise<ReplyResponse> {
  const raw = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        mode: "reply",
        messages,
        answer,
        instruction:
          '若继续追问：{"action":"ask","question":"..."}\n若可结束：{"action":"finish","insight":{"matter":"...","care":"...","see":"..."}}',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    action?: string;
    question?: string;
    insight?: { matter?: string; care?: string; see?: string };
  } | null;

  const next: Message[] = [...messages, { role: "user", content: answer }];

  if (parsed?.action === "finish" && parsed.insight) {
    const insight = {
      matter: parsed.insight.matter || "",
      care: parsed.insight.care || "",
      see: parsed.insight.see || "",
    };
    next.push({ role: "assistant", content: "好。我们停在这里。" });
    return { action: "finish", insight, messages: next };
  }

  if (parsed?.action === "ask" && parsed.question) {
    next.push({ role: "assistant", content: parsed.question });
    return { action: "ask", question: parsed.question, messages: next };
  }

  // LLM 输出异常时走 mock
  return mockReply(messages, answer);
}

export async function handleStart(concern: string): Promise<StartResponse> {
  const c = concern.trim();
  if (!c) throw new Error("concern_required");

  if (!getGateway()) {
    return mockStart(c);
  }
  try {
    return await llmStart(c);
  } catch {
    return mockStart(c);
  }
}

export async function handleReply(
  messages: Message[],
  answer: string
): Promise<ReplyResponse> {
  const a = answer.trim();
  if (!a) throw new Error("answer_required");
  if (!Array.isArray(messages)) throw new Error("messages_required");

  if (!getGateway()) {
    return mockReply(messages, a);
  }
  try {
    return await llmReply(messages, a);
  } catch {
    return mockReply(messages, a);
  }
}

export function hasRealGateway(): boolean {
  return !!getGateway();
}
