import type { ApiResult, GeneralResponse, JoinRequest, JoinResponse, MeResponse, NudgeResponse, SubmitStepsRequest, SubmitStepsResponse, TeamId } from '@invade/engine';

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
  general: (token: string) => post<GeneralResponse>('/api/general', { token }),
  generalTeam: (code: string, team: TeamId) => post<GeneralResponse>('/api/general', { code, team }),
};
