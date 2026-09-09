import type { Session } from "./types";

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

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  const list = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getTodayCount(): number {
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

export function incrementTodayCount(): number {
  if (typeof window === "undefined") return 0;
  const n = getTodayCount() + 1;
  localStorage.setItem(TODAY_DATE_KEY, todayStr());
  localStorage.setItem(TODAY_COUNT_KEY, String(n));
  return n;
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
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function getDraft(): DraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DRAFT_KEY);
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
