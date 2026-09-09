import type { Message, Insight, Session } from "./types";

const STORAGE_KEY = "wenji_sessions";
const TODAY_COUNT_KEY = "wenji_today_count";
const TODAY_DATE_KEY = "wenji_today_date";
const DRAFT_KEY = "wenji_draft";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isCreatedToday(createdAt: number): boolean {
  if (!createdAt) return false;
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === todayStr();
}

export function getSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Session[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function getSession(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  const list = getSessions();
  const idx = list.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    list[idx] = session;
  } else {
    list.unshift(session);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Upsert session; preserves createdAt/date if the id already exists. */
export function upsertSessionPartial(partial: {
  id: string;
  concern: string;
  messages: Message[];
  insight?: Insight;
  accepted?: boolean;
}): Session {
  const now = Date.now();
  if (typeof window === "undefined") {
    return {
      id: partial.id,
      concern: partial.concern,
      messages: partial.messages,
      insight: partial.insight,
      accepted: partial.accepted,
      date: formatDate(now),
      createdAt: now,
    };
  }
  const existing = getSession(partial.id);
  const session: Session = {
    id: partial.id,
    concern: partial.concern,
    messages: partial.messages,
    date: existing?.date || formatDate(now),
    createdAt: existing?.createdAt || now,
    helpful: existing?.helpful,
    accepted:
      partial.accepted !== undefined
        ? partial.accepted
        : existing?.accepted,
  };
  if (partial.insight !== undefined) {
    session.insight = partial.insight;
  } else if (existing?.insight) {
    session.insight = existing.insight;
  }
  saveSession(session);
  return session;
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  const list = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function countSessionsToday(): number {
  if (typeof window === "undefined") return 0;
  const today = todayStr();
  return getSessions().filter((s) => {
    if (s.date && s.date.startsWith(today)) return true;
    if (isCreatedToday(s.createdAt)) return true;
    return false;
  }).length;
}

function getStoredTodayCount(): number {
  if (typeof window === "undefined") return 0;
  const d = todayStr();
  const stored = localStorage.getItem(TODAY_DATE_KEY);
  if (stored !== d) {
    localStorage.setItem(TODAY_DATE_KEY, d);
    localStorage.setItem(TODAY_COUNT_KEY, "0");
    return 0;
  }
  return parseInt(localStorage.getItem(TODAY_COUNT_KEY) || "0", 10) || 0;
}

/** max(stored counter, sessions dated today) so UI never lies low */
export function getTodayCount(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(getStoredTodayCount(), countSessionsToday());
}

export function incrementTodayCount(): number {
  if (typeof window === "undefined") return 0;
  const n = getStoredTodayCount() + 1;
  localStorage.setItem(TODAY_DATE_KEY, todayStr());
  localStorage.setItem(TODAY_COUNT_KEY, String(n));
  return Math.max(n, countSessionsToday());
}

export function createId(): string {
  return `wj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface DraftState {
  sessionId: string;
  concern: string;
  messages: { role: string; content: string }[];
}

export function setDraft(draft: DraftState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function getDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLocal = localStorage.getItem(DRAFT_KEY);
    const fromSession = sessionStorage.getItem(DRAFT_KEY);
    const raw = fromLocal || fromSession;
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftState;
    if (!fromLocal && fromSession) {
      localStorage.setItem(DRAFT_KEY, raw);
      sessionStorage.removeItem(DRAFT_KEY);
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}
