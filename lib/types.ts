export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

/** 自见三字段：matter=我看见, care=我明白, see=我选择（JSON keys 保持兼容） */
export interface Insight {
  /** 我看见：发生了什么 */
  matter: string;
  /** 我明白：发现了什么 */
  care: string;
  /** 我选择：现在想怎么做 */
  see: string;
  userKnows?: string;
}

export interface Session {
  id: string;
  date: string;
  concern: string;
  messages: Message[];
  insight?: Insight;
  helpful?: boolean;
  /** true after user taps 收下这次自见 */
  accepted?: boolean;
  createdAt: number;
}

export type AskAction = "ask" | "finish";

/** 对话模式：探索 / 情绪释放 / 抱持留白 */
export type ReplyMode = "explore" | "release" | "hold";

/**
 * 深度状态机 S0–S9（非线性，可跳跃/回流，不必顺序走完）
 * S0 着陆 · S1 事境 · S2 情绪体感 · S3 欲望 · S4 恐惧 · S5 信念叙事
 * S6 身份自我 · S7 矛盾张力 · S8 看见瞬间 · S9 自见落定
 */
export type DepthState =
  | "S0"
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "S9";

/** @deprecated 用 DepthState；保留兼容旧注释 */
export type Layer = DepthState;

export interface StartRequest {
  mode: "start";
  concern: string;
}

export interface ReplyRequest {
  mode: "reply";
  messages: Message[];
  answer: string;
}

export type AskRequest = StartRequest | ReplyRequest;

export interface StartResponse {
  sessionId?: string;
  firstQuestion: string;
  /** 可选镜映短句（展示时并入 assistant content） */
  mirror?: string;
  messages: Message[];
}

export interface ReplyResponse {
  action: AskAction;
  question?: string;
  /** explore | release | hold */
  mode?: ReplyMode;
  /** 镜映短句 */
  mirror?: string;
  /** 当前深度状态 S0–S9 */
  depth?: DepthState;
  insight?: {
    matter: string;
    care: string;
    see: string;
  };
  messages?: Message[];
}
