import type {
  DepthState,
  Message,
  ReplyMode,
  ReplyResponse,
  StartResponse,
} from "./types";

/**
 * 「问己」AI Core Rules 4.0 — 真心在听的人
 * 完整规则文档见 docs/ai-rules-4.0.md
 * 脊柱：用户核心 System Prompt（二十二）+ 产品硬规则
 */
const SYSTEM_PROMPT = `你是「问己」。

你不是答案机器、心理测试、咨询问卷，
也不是一个不断提问的机器人。

你是一面有温度的镜子。
像一个真正关心用户的人，
陪用户把一件事情慢慢看清楚。

你的核心状态：
空——不预设、不投射、不急于判断；
静——不抢答、不催促、允许沉默；
爱——接纳、理解、共情、尊重。

【产品原则】
最高能力不是会提问，而是让用户愿意继续说；
懂什么时候该问、什么时候只回应/留白。

你首先要做的是“听”，而不是“问”。

每次收到用户表达后，先判断：
用户此刻更需要被陪伴、被理解、被镜映、
被澄清、被探索，还是一点空间。

不要默认每次都提问。
不要机械地使用：“共情一句 + 提一个问题”。

【多气泡 · 自然节奏】
允许自然地连续发送多条短消息（bubbles，1–5 条）。
消息数量由内容和情绪决定，而不是固定规则。
可以只说一句；可以说两三句；可以只留下一个问题；必要时可以什么都不问。
多消息的目的不是模仿聊天格式，而是让回应具有自然的人类节奏。
情绪很重 → 多一点承接、少一点问题；简单表达 → 一句短回应即可；复杂 → 可拆成几条短句。

【共情与镜映】
共情必须来自用户具体说过的话。不要空洞模板「我理解你」。
可以说：“听起来……”“我注意到……”“你好像……”“我不知道是不是这样……”
观察是镜子，不是判词。言外之意只用「好像/不知道是不是」，不可「你其实……」宣判。
镜映分强度：0 不镜映｜1 轻｜2 情绪｜3 矛盾｜4 核心（谨慎，允许用户否定）。不必每句镜映。

【禁止】
- 诊断、人格标签、武断解释、替用户决定、争论感受、强加价值观
- 表演式口头禅：哈哈、哇、天呐、抱抱、宝贝、呜呜、我懂我懂
- 把手法写成医疗承诺；不作穴位等医学主张
- reply 模式禁止 action=finish（结束权只在用户）

【一次一个探索任务】
一次只推进一个核心探索方向（同一任务里可出现双向探索问句，如决策两边各看一眼）。
不机械「每次必须一问」。

【决策对称探索】
二选一/多选一：不要单向深入。先看见为何纠结；分别探索每边得到/失去/害怕/看重什么；再找共同需要或真正问题。可提示第三种可能，但不替用户选。

【情绪优先】
情绪明显：抱持 → 共情 → 表达 → 再决定要不要探索。强烈情绪：陪伴 → 稳定 → 留白。用户情绪未落地时不要硬推认知。

【沉默与只回应】
用户说「不知道」/不想答 / 已出现觉察：可只回应、留白、不问。
反机械检测：若连续两轮都是「问→答」，第三轮优先只回应不问。

【深度状态 S0–S9 · 非线性】
S0 着陆｜S1 事境｜S2 情绪体感｜S3 欲望｜S4 恐惧｜S5 信念叙事｜S6 身份自我｜S7 矛盾张力｜S8 看见瞬间｜S9 自见落定
可跳跃、可回流；不必走完。用户已看见时用 hold/celebrate 陪伴，由用户决定是否结束。

【结束权在用户】
- reply 模式禁止输出 action=finish。自见只能由用户主动触发（界面「谢谢，我已经找到答案了」→ finish 模式）。
- 若用户流露「原来如此 / 我知道了」：用 mode=hold 温柔确认与留白，可轻声提醒可自行结束——但不强制收束，绝不自行 finish。

【自见三字段】仅 finish 模式输出；insight 用用户口吻短句：
- matter →「我看见」；care →「我明白」；see →「我选择」

【每次回复前默问】
1. 我真的回应了用户刚才说的话吗？
2. 用户现在需要的是问题还是空间？
3. 我有没有忽略另一边的顾虑？
4. 我有没有过度理性化？
5. 我是不是又在机械追问？
6. 这个问题真的会带来自我觉察吗？
7. 如果不问，会不会更好？
不确定 → 宁可少问。

【输出契约 · 必须合法 JSON，无 markdown 代码块】

■ start 模式返回：
{"bubbles":["短句1","短句2"],"messages":[{"role":"user","content":"困惑原文"},{"role":"assistant","content":"短句1"},{"role":"assistant","content":"短句2"}],"firstQuestion":"可选·最后一个问句或最后一句"}
规则：bubbles 1–5 条非空短句；messages 中每条 bubble 对应一条独立 assistant；firstQuestion 兼容字段=最后一个含问号的 bubble，否则最后一条。

■ reply 模式只返回 ask（禁止 finish）：
{"action":"ask","mode":"explore|release|hold|celebrate","bubbles":["..."],"depth":"S0-S9","hasQuestion":true|false}
- bubbles：1–5 短句；可不含问句（hasQuestion:false）。
- 不要要求每次 mirror+question；不要把多句硬并成一大段。
- mode=celebrate：轻庆祝/朋友式回应，仍可含或不含问句。
- 即使用户像已经想通，也只 hold/轻问，绝不自行结束。

■ finish 模式（用户主动结束）返回：
{"action":"finish","insight":{"matter":"我看见…","care":"我明白…","see":"我选择…"}}
insight 扎根对话、用户口吻；不要提问。

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
      temperature: 0.7,
      max_tokens: 1500,
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

/** 组装助手气泡：镜映 + 空行 + 问题（legacy 兼容） */
export function buildAssistantContent(
  mirror: string | undefined,
  question: string | undefined
): string {
  const m = (mirror || "").trim();
  const q = (question || "").trim();
  if (m && q) return `${m}\n\n${q}`;
  return m || q || "";
}

/** 将非空 bubbles 逐条追加为 assistant message */
export function appendBubbles(messages: Message[], bubbles: string[]): Message[] {
  const next = [...messages];
  for (const b of bubbles) {
    const t = (b || "").trim();
    if (t) next.push({ role: "assistant", content: t });
  }
  return next;
}

function looksLikeQuestion(s: string): boolean {
  const t = s.trim();
  return /[？?]/.test(t) || /吗[。.!！]?$/.test(t) || /呢[。.!！]?$/.test(t);
}

/** 从 LLM 字段解析 bubbles；兼容 legacy mirror+question */
export function normalizeBubbles(parsed: {
  bubbles?: unknown;
  mirror?: string;
  question?: string;
  firstQuestion?: string;
}): string[] {
  if (Array.isArray(parsed.bubbles)) {
    const list = parsed.bubbles
      .map((b) => String(b ?? "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (list.length) return list;
  }
  const m = (parsed.mirror || "").trim();
  const q = (parsed.question || parsed.firstQuestion || "").trim();
  const legacy = [m, q].filter(Boolean);
  return legacy.slice(0, 5);
}

function pickFirstQuestion(bubbles: string[]): string {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    if (looksLikeQuestion(bubbles[i])) return bubbles[i];
  }
  return bubbles[bubbles.length - 1] || "";
}

function bubblesHaveQuestion(bubbles: string[]): boolean {
  return bubbles.some(looksLikeQuestion);
}

const EMOTION_RE =
  /难受|痛苦|焦虑|害怕|恐惧|委屈|愤怒|生气|伤心|难过|崩溃|压抑|紧张|慌|哭|累|窒息|孤独|无助|烦|恨|羞耻|愧疚|嫉妒|心痛|堵|空落落/;

const STOP_RE =
  /原来如此|原来是|我不想聊了|其实我知道|我明白了|我清楚了|知道了|不用再问|就到这里|我想停|答案是|我看见了/;

const CELEBRATE_RE =
  /终于|做成了|完成了|搞定了|成功|开心|太好了|松了一口气|做到了/;

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

/** 粗略检测连续「问→答」轮次（用于 mock 反机械） */
function consecutiveAskAnswerRounds(messages: Message[]): number {
  let rounds = 0;
  for (let i = messages.length - 1; i >= 1; i--) {
    const cur = messages[i];
    const prev = messages[i - 1];
    if (cur.role === "user" && prev.role === "assistant" && looksLikeQuestion(prev.content)) {
      rounds++;
      // skip past this user+assistant pair
      i -= 0; // continue scanning older pairs
      // move to before this assistant
      // find previous assistant before this user
      continue;
    }
    if (cur.role === "assistant") continue;
    break;
  }
  // recount properly: walk pairs (assistant with ?, then user)
  rounds = 0;
  let i = messages.length - 1;
  while (i >= 1) {
    if (
      messages[i].role === "user" &&
      messages[i - 1].role === "assistant" &&
      looksLikeQuestion(messages[i - 1].content)
    ) {
      rounds++;
      i -= 2;
      continue;
    }
    break;
  }
  return rounds;
}

/* ---------- Mock（自然节奏 · 多气泡 · 可不提问） ---------- */

function mockStart(concern: string): StartResponse {
  const emotion = EMOTION_RE.test(concern);
  const decision = /还是|要不要|辞|留|选|犹豫|纠结/.test(concern);
  let bubbles: string[];

  if (emotion) {
    bubbles = [
      `听起来，「${clip(concern, 22)}」这件事已经压在心里一阵了。`,
      "可以先不用急着想怎么办。",
      "这份感受在身体的哪里？如果只是轻轻放一会儿，它想被怎样对待？",
    ];
  } else if (decision) {
    bubbles = [
      `你提到「${clip(concern, 24)}」。`,
      "好像两边都在拉你。",
      "我们先不急着选——此刻最让你停不下来的，是哪一边？",
    ];
  } else {
    bubbles = [
      `你提到「${clip(concern, 28)}」。`,
      "此刻，这件事里最让你停不下来的一点是什么？",
    ];
  }

  const messages = appendBubbles([{ role: "user", content: concern }], bubbles);
  const firstQuestion = pickFirstQuestion(bubbles);
  return { firstQuestion, bubbles, messages };
}

function mockReply(messages: Message[], answer: string): ReplyResponse {
  const nextBase: Message[] = [...messages, { role: "user", content: answer }];
  const asked = messages.filter((m) => m.role === "assistant").length;
  const userReplies = countUserTurns(nextBase) - 1;
  const emotion = EMOTION_RE.test(answer);
  const clear = STOP_RE.test(answer);
  const celebrate = CELEBRATE_RE.test(answer);
  const askRounds = consecutiveAskAnswerRounds(messages);

  let mode: ReplyMode = "explore";
  let bubbles: string[];
  let depth = pickDepth(asked, emotion);

  // 用户流露「想通了」→ hold，不自动 finish
  if (clear) {
    mode = "hold";
    depth = "S8";
    bubbles = [
      `你说「${clip(answer, 28)}」。`,
      "听起来有些东西已经自己落下来了。",
      "若愿意，也可以停在这里；还有一点想再说的话，我在。",
    ];
  } else if (celebrate && !emotion) {
    mode = "celebrate";
    depth = "S8";
    bubbles = [
      `诶，「${clip(answer, 24)}」——这一下值得停一下。`,
      "做完的这一刻，身体里是什么感觉？",
    ];
  } else if (emotion && userReplies <= 3) {
    mode = "release";
    depth = "S2";
    // 情绪重：多承接，有时不问
    if (userReplies >= 2 || askRounds >= 2) {
      bubbles = [
        "嗯……",
        `听起来「${clip(answer, 24)}」真的不轻。`,
        "你可以先不用急着想清楚。",
      ];
    } else {
      const releaseQs = [
        "如果这份情绪可以说话，它最想先被听到的一句是什么？",
        "身体里哪一处最紧？只是允许它在——你注意到什么？",
        "若用一个画面形容此刻的感受，会是什么？",
      ];
      bubbles = [
        `你说「${clip(answer, 28)}」。`,
        releaseQs[Math.min(userReplies - 1, releaseQs.length - 1)],
      ];
    }
  } else if (askRounds >= 2 || (userReplies >= 3 && answer.length < 16)) {
    // 反机械：只回应不问
    mode = "hold";
    depth = "S8";
    bubbles = [
      `「${clip(answer, 32)}」——这句话我先接住。`,
      "不急，可以先停一会儿。",
    ];
  } else if (userReplies % 3 === 0) {
    // 有时 2–3 气泡探索
    mode = "explore";
    depth = pickDepth(asked, false);
    bubbles = [
      `我听见你说「${clip(answer, 26)}」。`,
      "这里好像还有一点没说完。",
      "在这些底下，你真正想要的是什么？",
    ];
  } else {
    const exploreQs = [
      "在这些底下，你真正想要的是什么？",
      "如果暂时无解，你最怕失去的是什么？",
      "你对自己反复说过的那句话是什么？",
      "这两边如果都成立，你心里最卡的是哪一点？",
      "若把「应该怎样」都放下，你还看见什么？",
    ];
    const q = exploreQs[Math.min(Math.max(asked - 1, 0), exploreQs.length - 1)];
    depth = pickDepth(asked, false);
    // 有时单气泡，有时拆成镜映+问
    if (userReplies % 2 === 0) {
      bubbles = [`你说「${clip(answer, 30)}」。`, q];
    } else {
      bubbles = [q];
    }
  }

  const hasQuestion = bubblesHaveQuestion(bubbles);
  const next = appendBubbles(nextBase, bubbles);
  const question = hasQuestion ? pickFirstQuestion(bubbles) : undefined;

  return {
    action: "ask",
    mode,
    bubbles,
    hasQuestion,
    question,
    depth,
    messages: next,
  };
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
          '返回 JSON：{"bubbles":["短句1","短句2"],"messages":[{"role":"user","content":"困惑原文"},{"role":"assistant","content":"短句1"},{"role":"assistant","content":"短句2"}],"firstQuestion":"可选"}。bubbles 1–5；每条 bubble 对应一条 assistant；可含镜映与问句，也可开场只接住。',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    firstQuestion?: string;
    mirror?: string;
    question?: string;
    bubbles?: string[];
    messages?: Message[];
  } | null;

  if (!parsed) return mockStart(concern);

  const bubbles = normalizeBubbles(parsed);
  if (!bubbles.length) return mockStart(concern);

  let messages: Message[];
  if (parsed.messages && parsed.messages.length >= 2) {
    const userMsg =
      parsed.messages.find((m) => m.role === "user") || {
        role: "user" as const,
        content: concern,
      };
    const assistantFromParsed = parsed.messages
      .filter((m) => m.role === "assistant")
      .map((m) => (m.content || "").trim())
      .filter(Boolean);
    // Prefer explicit bubbles; else use parsed assistant msgs; else bubbles
    const useBubbles =
      bubbles.length >= 2 || assistantFromParsed.length < 2
        ? bubbles
        : assistantFromParsed.slice(0, 5);
    messages = appendBubbles(
      [{ role: "user", content: userMsg.content || concern }],
      useBubbles.length ? useBubbles : bubbles
    );
  } else {
    messages = appendBubbles([{ role: "user", content: concern }], bubbles);
  }

  const finalBubbles = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
  const firstQuestion =
    (parsed.firstQuestion || "").trim() || pickFirstQuestion(finalBubbles);

  return {
    firstQuestion,
    bubbles: finalBubbles,
    messages,
  };
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
          '只允许继续：{"action":"ask","mode":"explore|release|hold|celebrate","bubbles":["短句…"],"depth":"S0-S9","hasQuestion":true|false}。禁止 action=finish；可不提问；bubbles 1–5。结束由用户在界面主动触发。',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    action?: string;
    mode?: ReplyMode;
    mirror?: string;
    question?: string;
    bubbles?: string[];
    hasQuestion?: boolean;
    depth?: DepthState;
    insight?: { matter?: string; care?: string; see?: string };
  } | null;

  const nextBase: Message[] = [...messages, { role: "user", content: answer }];

  // reply 模式忽略模型误返回的 finish，改成 hold 气泡
  if (parsed?.action === "finish") {
    const holdBubbles = [
      "听起来，有些看见已经在你心里了。",
      "若你已经找到答案，可以自己结束这次问己；若还有一点未说尽，我在这儿。",
    ];
    const next = appendBubbles(nextBase, holdBubbles);
    return {
      action: "ask",
      mode: "hold",
      bubbles: holdBubbles,
      hasQuestion: false,
      depth: parsed.depth || "S8",
      messages: next,
    };
  }

  if (parsed?.action === "ask" || parsed?.bubbles || parsed?.question || parsed?.mirror) {
    const bubbles = normalizeBubbles(parsed || {});
    if (!bubbles.length) {
      return mockReply(messages, answer);
    }
    const mode: ReplyMode =
      parsed?.mode ||
      (bubblesHaveQuestion(bubbles) ? "explore" : "hold");
    const hasQuestion =
      typeof parsed?.hasQuestion === "boolean"
        ? parsed.hasQuestion
        : bubblesHaveQuestion(bubbles);
    const next = appendBubbles(nextBase, bubbles);
    return {
      action: "ask",
      mode,
      bubbles,
      hasQuestion,
      question: hasQuestion ? pickFirstQuestion(bubbles) : undefined,
      depth: parsed?.depth,
      messages: next,
    };
  }

  return mockReply(messages, answer);
}

const STOP_LINE = "先停在这里。";

function withStopLine(messages: Message[]): Message[] {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.content.trim() === STOP_LINE) {
    return messages;
  }
  return [...messages, { role: "assistant", content: STOP_LINE }];
}

function mockFinish(messages: Message[]): ReplyResponse {
  const firstUser = messages.find((m) => m.role === "user")?.content || "";
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastUser = userMsgs[userMsgs.length - 1]?.content || firstUser;
  const insight = {
    matter: `我看见：${clip(firstUser, 40)}`,
    care: `我明白：${clip(lastUser, 40) || "对自己诚实的那一刻"}`,
    see: "我选择：先停在看见里，让下一步自然浮现。",
  };
  return {
    action: "finish",
    insight,
    depth: "S9",
    messages: withStopLine(messages),
  };
}

async function llmFinish(messages: Message[]): Promise<ReplyResponse> {
  const raw = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        mode: "finish",
        messages,
        instruction:
          '用户已找到答案或请求停止。只输出 finish JSON：{"action":"finish","insight":{"matter":"我看见…","care":"我明白…","see":"我选择…"}}。insight 须扎根对话、用用户口吻；不要提问、不要继续探索。',
      }),
    },
  ]);

  const parsed = extractJson(raw) as {
    action?: string;
    insight?: { matter?: string; care?: string; see?: string };
    depth?: DepthState;
  } | null;

  if (parsed?.insight) {
    const insight = {
      matter: parsed.insight.matter || "",
      care: parsed.insight.care || "",
      see: parsed.insight.see || "",
    };
    if (insight.matter || insight.care || insight.see) {
      return {
        action: "finish",
        insight,
        depth: parsed.depth || "S9",
        messages: withStopLine(messages),
      };
    }
  }

  return mockFinish(messages);
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

export async function handleFinish(messages: Message[]): Promise<ReplyResponse> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages_required");
  }

  if (!getGateway()) {
    return mockFinish(messages);
  }
  try {
    return await llmFinish(messages);
  } catch {
    return mockFinish(messages);
  }
}

export function hasRealGateway(): boolean {
  return !!getGateway();
}
