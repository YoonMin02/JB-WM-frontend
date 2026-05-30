const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── 타입 ──
export interface Customer {
  id: string;
  name: string;
  age_band: string;
}
export interface Proposal {
  id: string;
  kind: string;
  summary: string;
  has_external_effect: boolean;
  status: string;
}
export interface Session {
  session_id: string;
  customer_id: string;
  state: string;
  active_intents: Record<string, string>;
  allowed_actions: string[];
  pending_proposal: {
    id: string;
    kind: string;
    summary: string;
    has_external_effect: boolean;
    rationale: string;
  } | null;
  recent_context: Record<string, unknown>;
  failure_reason: string | null;
}
export interface AgentEvent {
  type: string;
  detail: Record<string, unknown>;
  created_at: string;
}

// ── 호출 ──
export const listCustomers = () => req<Customer[]>("/customers");
export const getInsurance = (cid: string) => req<{ gaps_hint: string | null }>(`/customers/${cid}/insurance`);
export const getPortfolio = (cid: string) =>
  req<{ high_risk_weight: number; total_value: number }>(`/customers/${cid}/portfolio`);
export const getMemory = (cid: string) =>
  req<{ medical_willingness?: string; investment_style?: string; constraints?: Record<string, string> }>(
    `/customers/${cid}/memory`,
  );
export const getHealth = (cid: string) =>
  req<{ events: { kind: string; severity: string }[] }>(`/customers/${cid}/health`);
export const getLoans = (cid: string) =>
  req<{ loans: { balance: number; next_due_date: string | null; monthly_payment: number }[] }>(
    `/customers/${cid}/loans`,
  );

export const createSession = (cid: string) =>
  req<Session>(`/customers/${cid}/agent-sessions`, { method: "POST" });
export const getSession = (sid: string) => req<Session>(`/agent-sessions/${sid}`);
export const postSignal = (sid: string, source: string, payload: Record<string, unknown>) =>
  req<Session>(`/agent-sessions/${sid}/signals`, {
    method: "POST",
    body: JSON.stringify({ source, payload }),
  });
export const getProposals = (sid: string) =>
  req<{ proposals: Proposal[] }>(`/agent-sessions/${sid}/proposals`);
export const getEvents = (sid: string) => req<{ events: AgentEvent[] }>(`/agent-sessions/${sid}/events`);
export const decide = (pid: string, action: "approve" | "reject" | "revise", note = "") =>
  req<Session>(`/proposals/${pid}/${action}`, {
    method: "POST",
    body: action === "revise" ? JSON.stringify({ note }) : undefined,
  });
