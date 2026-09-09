export type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

export interface Insight {
  matter: string;
  care: string;
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
  createdAt: number;
}

export type AskAction = "ask" | "finish";

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
  messages: Message[];
}

export interface ReplyResponse {
  action: AskAction;
  question?: string;
  insight?: {
    matter: string;
    care: string;
    see: string;
  };
  messages?: Message[];
}

/** 七层：事/感/欲/惧/念/我/无 — AI 自行决定下一层，不强制走完 */
export type Layer = "事" | "感" | "欲" | "惧" | "念" | "我" | "无";
