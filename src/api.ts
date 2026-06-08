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
  rationale?: string;
  params?: Record<string, unknown>;
  status: string;
}
export interface ActiveNeeds {
  primary_need?: string;
  needs?: Record<string, "none" | "low" | "mid" | "high" | string>;
}
export interface Session {
  session_id: string;
  customer_id: string;
  state: string;
  active_needs: ActiveNeeds;
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
export interface SessionRecords {
  messages: {
    role: string;
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
  need_assessments: {
    primary_need: string;
    needs: Record<string, string>;
    confidence: number;
    rationale: string;
    raw_output: Record<string, unknown>;
    created_at: string;
  }[];
  plans: {
    explanation: string;
    raw_output: Record<string, unknown>;
    proposal_ids: string[];
    created_at: string;
  }[];
}
export interface Accounts {
  accounts: {
    account_id: string;
    bank_name: string;
    product_name: string;
    account_type: string;
    balance_krw: number;
    available_krw: number;
    last_transaction_on: string | null;
  }[];
  liquidity_summary: {
    available_cash_krw: number;
    emergency_fund_months: number | null;
  };
}
export interface Transactions {
  transactions: {
    transacted_at: string;
    direction: string;
    description: string;
    amount_krw: number;
    category_hint: string;
  }[];
  spending_summary: {
    monthly_outflow_krw: number;
    medical_spending_krw: number;
    fixed_cost_krw: number;
    record_count: number;
  };
}
export interface CardBills {
  bills: {
    card_name: string;
    charge_month: string;
    charge_krw: number;
    settlement_date: string | null;
    medical_charge_krw: number;
  }[];
  upcoming_card_payment_krw: number;
}
export type DetailSnapshot = Record<string, unknown>;

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
export const getAccounts = (cid: string) => req<Accounts>(`/customers/${cid}/accounts`);
export const getTransactions = (cid: string) => req<Transactions>(`/customers/${cid}/transactions`);
export const getCardBills = (cid: string) => req<CardBills>(`/customers/${cid}/card-bills`);
export const getLoanSwitchPrecheck = (cid: string) =>
  req<{ repayment_available?: boolean; prepayment_penalty_krw?: number; note?: string }>(
    `/customers/${cid}/loan-switch-precheck`,
  );
export const getDetailSnapshot = (cid: string) => req<DetailSnapshot>(`/customers/${cid}/detail-snapshot`);

export const createSession = (cid: string, forceNew = false) =>
  req<Session>(`/customers/${cid}/agent-sessions${forceNew ? "?force_new=true" : ""}`, { method: "POST" });
export const getSession = (sid: string) => req<Session>(`/agent-sessions/${sid}`);
export const postSignal = (sid: string, source: string, payload: Record<string, unknown>) =>
  req<Session>(`/agent-sessions/${sid}/signals`, {
    method: "POST",
    body: JSON.stringify({ source, payload }),
  });
export const getProposals = (sid: string) =>
  req<{ proposals: Proposal[] }>(`/agent-sessions/${sid}/proposals`);
export const getEvents = (sid: string) => req<{ events: AgentEvent[] }>(`/agent-sessions/${sid}/events`);
export const getRecords = (sid: string) => req<SessionRecords>(`/agent-sessions/${sid}/records`);
export const decide = (pid: string, action: "approve" | "reject" | "revise", note = "") =>
  req<Session>(`/proposals/${pid}/${action}`, {
    method: "POST",
    body: action === "revise" ? JSON.stringify({ note }) : undefined,
  });
