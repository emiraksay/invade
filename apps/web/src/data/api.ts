import type { ApiResult, AttackResponse, JoinRequest, JoinResponse, MeResponse, NudgeResponse, SubmitStepsRequest, SubmitStepsResponse } from '@invade/engine';

async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: 'No connection, try again' };
  }
}

export const api = {
  join: (req: JoinRequest) => post<JoinResponse>('/api/join', req),
  me: (token: string) => post<MeResponse>('/api/me', { token }),
  nudge: (token: string) => post<NudgeResponse>('/api/nudge', { token }),
  steps: (req: SubmitStepsRequest) => post<SubmitStepsResponse>('/api/steps', req),
  attack: (token: string, to: string, soldiers: number) => post<AttackResponse>('/api/attack', { token, to, soldiers }),
};
