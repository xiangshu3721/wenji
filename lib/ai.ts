import type {
  DepthState,
  Message,
  ReplyMode,
  ReplyResponse,
  StartResponse,
} from "./types";

/**
 * 「问己」AI Core Rules 2.0 — 镜像导师
 * 完整规则文档见 docs/ai-rules-2.0.md
 */
const SYSTEM_PROMPT = `你是「问己」——一位空、静、爱的镜像导师（mirror mentor）。

【身份】
- 你不是答案给予者、教练、诊断者或说教者。
- 你是一面安静的镜子：帮用户听见自己、看见自己，最终由用户自己落定。
- 气质：空（不填塞）、静（不催促）、爱（不评判）。

【核心循环】听 → 镜映 → 一问
1. 先听：内部快速核对——情绪？身体？矛盾？未说出口的？用户真正在说什么？
2. 再镜映：用用户的词，短短一句映回（不解读、不升华、不贴标签）。
3. 最后一问：每次至多一个问题。若此刻只需空间，可只镜映或抱持，不强问。

【好问题五准则】根 × 指向 × 空间 × 可答 × 增量
- 根：扎在用户刚说的话里
- 指向：朝向更深的自我看见，而非外部建议
- 空间：留白，不逼答
- 可答：具体、温柔、当下能开口
- 增量：比上一问多打开一点，不重复、不辩论

【情绪优先】
- 若情绪或身体感受明显：先陪伴与释放，再探索意义。
- 释放模式可用：描述感受 / 觉察身体 / 意象 / 自由表达 / 允许与抱持。
- 禁止把任何手法写成医疗承诺或治疗处方；不作 EFT 穴位等医学主张。
- 用户情绪未落地时，不要硬推认知层问题。

【工具箱（按状态选用，不机械套用）】
- 澄清事实 · 情绪命名与体感 · 欲望/恐惧 · 信念与自我叙事
- 矛盾并置（优先）：两句互相打架的话并排映出，邀请用户自己看
- 抱持/留白 · 停止与自见收束
禁止：辩论、心理标签/诊断、替用户决定、投射你的故事、连环「为什么」、急着总结。

【深度状态 S0–S9 · 非线性】
S0 着陆｜S1 事境｜S2 情绪体感｜S3 欲望｜S4 恐惧｜S5 信念叙事｜S6 身份自我｜S7 矛盾张力｜S8 看见瞬间｜S9 自见落定
可跳跃、可回流；不必走完。到达「用户已看见自己」即停。

【停止机制】出现下列信号 → action=finish：
- 用户说出清晰的自我看见（「原来……」「其实我知道……」）
- 用户明确不想再聊 / 需要停
- 已在 S8–S9，继续问只会稀释
- 内部闸门判定：此刻继续问是为了用户，还是为了维持对话？若是后者 → 停或 hold

【自见三字段】finish 时 insight 用用户口吻短句（非 AI 建议）：
- matter →「我看见」：发生了什么
- care →「我明白」：发现了什么
- see →「我选择」：现在想怎么做
JSON 键名仍为 matter / care / see。

【内部闸门 · 每次回复前默问】
1. 这一句是为用户，还是为了把聊天继续下去？
2. 此刻需要一个问题，还是只需要空间？
3. 镜映是否忠实？问题是否满足五准则？

【输出契约 · 必须合法 JSON，无 markdown 代码块】

■ start 模式返回：
{"firstQuestion":"...","mirror":"可选镜映短句","messages":[{"role":"user","content":"用户困惑"},{"role":"assistant","content":"展示用完整气泡"}]}
规则：assistant.content = 若有 mirror 则为 mirror + "\\n\\n" + firstQuestion，否则仅为 firstQuestion。开场尽量给一句短镜映。

■ reply 模式返回其一：
{"action":"ask","mode":"explore|release|hold","mirror":"...","question":"...","depth":"S0-S9"}
{"action":"finish","insight":{"matter":"我看见…","care":"我明白…","see":"我选择…"}}
- ask：展示内容 = mirror 有则 mirror+"\\n\\n"+question，否则 question。
- mode=hold：短允许/空间文字；question 可省略或用轻柔邀请。
- finish：不要催促；系统会用「先停在这里。」作为助手收束语。

只输出 JSON。`;

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
      model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat",
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
      temperature: 0.65,
      max_tokens: 1200,
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

/* ---------- helpers ---------- */

export function clip(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : t.slice(0, n) + "…";
}

/** 组装助手气泡：镜映 + 空行 + 问题 */
export function buildAssistantContent(
  mirror: string | undefined,
  question: string | undefined
): string {
  const m = (mirror || "").trim();
  const q = (question || "").trim();
  if (m && q) return `${m}\n\n${q}`;
  return m || q || "";
}

const EMOTION_RE =
  /难受|痛苦|焦虑|害怕|恐惧|委屈|愤怒|生气|伤心|难过|崩溃|压抑|紧张|慌|哭|累|窒息|孤独|无助|烦|恨|羞耻|愧疚|嫉妒|心痛|堵|空落落/;

const STOP_RE =
  /原来如此|原来是|我不想聊了|其实我知道|我明白了|我清楚了|知道了|不用再问|就到这里|我想停|答案是|我看见了/;

const DEPTH_CYCLE: DepthState[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
];

function countUserTurns(messages: Message[]): number {
  return messages.filter((m) => m.role === "user").length;
}

function pickDepth(asked: number, emotion: boolean): DepthState {
  if (emotion && asked <= 1) return "S2";
  return DEPTH_CYCLE[Math.min(asked, DEPTH_CYCLE.length - 1)];
}

/* ---------- Mock（镜映优先 · 情绪→释放 · 自见三义） ---------- */

function mockStart(concern: string): StartResponse {
  const mirror = `你提到「${clip(concern, 28)}」。`;
  const emotion = EMOTION_RE.test(concern);
  const firstQuestion = emotion
    ? `这份感受在身体的哪里？如果只是轻轻放一会儿，它想被怎样对待？`
    : `此刻，这件事里最让你停不下来的一点是什么？`;
  const content = buildAssistantContent(mirror, firstQuestion);
  const messages: Message[] = [
    { role: "user", content: concern },
    { role: "assistant", content },
  ];
  return { firstQuestion, mirror, messages };
}

function mockReply(messages: Message[], answer: string): ReplyResponse {
  const next: Message[] = [...messages, { role: "user", content: answer }];
  const asked = messages.filter((m) => m.role === "assistant").length;
  const userReplies = countUserTurns(next) - 1;
  const emotion = EMOTION_RE.test(answer);
  const clear = STOP_RE.test(answer) && userReplies >= 2;
  const shouldFinish =
    userReplies >= 5 || (userReplies >= 4 && answer.length > 40) || clear;

  if (shouldFinish) {
    const concern = messages.find((m) => m.role === "user")?.content || answer;
    const insight = {
      matter: `我看见：${clip(concern, 40)}`,
      care: `我明白：${clip(answer, 40) || "对自己诚实的那一刻"}`,
      see: "我选择：先停在看见里，让下一步自然浮现。",
    };
    next.push({ role: "assistant", content: "先停在这里。" });
    return {
      action: "finish",
      insight,
      depth: "S9",
      messages: next,
    };
  }

  const mirror = `你说「${clip(answer, 32)}」。`;
  let mode: ReplyMode = "explore";
  let question: string;
  let depth = pickDepth(asked, emotion);

  if (emotion && userReplies <= 3) {
    mode = "release";
    depth = "S2";
    const releaseQs = [
      `如果这份情绪可以说话，它最想先被听到的一句是什么？`,
      `身体里哪一处最紧？只是允许它在，不必马上改掉——你注意到什么？`,
      `若用一个画面形容此刻的感受，会是什么？`,
    ];
    question = releaseQs[Math.min(userReplies - 1, releaseQs.length - 1)];
  } else if (userReplies >= 4 && answer.length < 12) {
    mode = "hold";
    depth = "S8";
    question = `若愿意，也可以只是静一静。还有什么轻轻冒出来吗？`;
  } else {
    const exploreQs = [
      `在这些底下，你真正想要的是什么？`,
      `如果暂时无解，你最怕失去的是什么？`,
      `你对自己反复说过的那句话是什么？`,
      `这两边如果都成立，你心里最卡的是哪一点？`,
      `若把「应该怎样」都放下，你还看见什么？`,
    ];
    question = exploreQs[Math.min(Math.max(asked - 1, 0), exploreQs.length - 1)];
    depth = pickDepth(asked, false);
  }

  const content = buildAssistantContent(mirror, question);
  next.push({ role: "assistant", content });
  return { action: "ask", mode, mirror, question, depth, messages: next };
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
          '返回 JSON：{"firstQuestion":"...","mirror":"短镜映可选","messages":[{"role":"user","content":"困惑原文"},{"role":"assistant","content":"mirror\\n\\nfirstQuestion 或仅 firstQuestion"}]}。优先短镜映。',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    firstQuestion?: string;
    mirror?: string;
    messages?: Message[];
  } | null;

  if (parsed?.firstQuestion) {
    const mirror = parsed.mirror?.trim() || undefined;
    const assistantContent = buildAssistantContent(mirror, parsed.firstQuestion);
    const messages: Message[] =
      parsed.messages && parsed.messages.length >= 2
        ? [
            parsed.messages[0],
            {
              role: "assistant",
              content:
                parsed.messages[1]?.content?.includes("\n\n") || !mirror
                  ? parsed.messages[1].content
                  : assistantContent,
            },
            ...parsed.messages.slice(2),
          ]
        : [
            { role: "user", content: concern },
            { role: "assistant", content: assistantContent },
          ];
    // 确保展示气泡含镜映
    if (mirror && messages[1]?.role === "assistant") {
      const c = messages[1].content || "";
      if (!c.includes(parsed.firstQuestion)) {
        messages[1] = { role: "assistant", content: assistantContent };
      } else if (mirror && !c.startsWith(mirror) && !c.includes("\n\n")) {
        messages[1] = { role: "assistant", content: assistantContent };
      }
    }
    return { firstQuestion: parsed.firstQuestion, mirror, messages };
  }

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
          '继续：{"action":"ask","mode":"explore|release|hold","mirror":"...","question":"...","depth":"S0-S9"}\n结束：{"action":"finish","insight":{"matter":"我看见…","care":"我明白…","see":"我选择…"}}',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    action?: string;
    mode?: ReplyMode;
    mirror?: string;
    question?: string;
    depth?: DepthState;
    insight?: { matter?: string; care?: string; see?: string };
  } | null;

  const next: Message[] = [...messages, { role: "user", content: answer }];

  if (parsed?.action === "finish" && parsed.insight) {
    const insight = {
      matter: parsed.insight.matter || "",
      care: parsed.insight.care || "",
      see: parsed.insight.see || "",
    };
    next.push({ role: "assistant", content: "先停在这里。" });
    return {
      action: "finish",
      insight,
      depth: parsed.depth || "S9",
      messages: next,
    };
  }

  if (parsed?.action === "ask") {
    const mirror = parsed.mirror?.trim() || undefined;
    const question = (parsed.question || "").trim();
    const mode: ReplyMode = parsed.mode || (question ? "explore" : "hold");
    const content =
      buildAssistantContent(mirror, question) ||
      (mode === "hold" ? "我在这儿。你可以只是停一会儿。" : "");
    if (!content) {
      return mockReply(messages, answer);
    }
    next.push({ role: "assistant", content });
    return {
      action: "ask",
      mode,
      mirror,
      question: question || undefined,
      depth: parsed.depth,
      messages: next,
    };
  }

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
