import type { MeResponse } from '@invade/engine';

// The player's sync token is their identity on this device (no passwords for the hackathon).
const KEY = 'invade.session.v1';

export interface Session extends MeResponse {
  token: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* private mode: session lasts this tab only */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
