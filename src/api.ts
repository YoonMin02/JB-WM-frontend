const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("jbwm_access_token");
  const headers = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers ?? {}),
  };
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers,
      ...init,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${body}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    console.error("API fetch error details:", err);
    throw err;
  }
}

// ── 타입 ──
export interface Customer {
  id: string;
  name: string;
  age_band: string;
}
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  customer_id: string | null;
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
  thread_id: string;
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
  messages?: SessionRecords["messages"];
  proposals?: Proposal[];
  events?: AgentEvent[];
  executions?: Record<string, unknown>[];
  snapshots?: Record<string, unknown>[];
  agent_jobs?: Record<string, unknown>[];
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

type WorkflowSession = Session & {
  graph_result?: Record<string, unknown>;
};

// ── 호출 ──
export const listCustomers = () => req<Customer[]>("/customers");
export const login = (email: string, password: string) =>
  req<{ access_token: string; token_type: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
export const getInsurance = (cid: string) =>
  req<{
    policies: {
      product_name: string;
      type: string;
      active: boolean;
      coverages: { coverage_type: string; limit: number; active: boolean }[];
    }[];
    gaps_hint: string | null;
  }>(`/customers/${cid}/insurance`);
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
  req<WorkflowSession>(`/customers/${cid}/workflow-sessions${forceNew ? "?force_new=true" : ""}`, { method: "POST" });
export const getSession = (threadId: string) => req<WorkflowSession>(`/workflow-sessions/${threadId}`);
export const postSignal = (threadId: string, source: string, payload: Record<string, unknown>) =>
  req<WorkflowSession>(`/workflow-sessions/${threadId}/events`, {
    method: "POST",
    body: JSON.stringify({ source, payload }),
  });
export const postMessage = (threadId: string, text: string) =>
  req<WorkflowSession>(`/workflow-sessions/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
export const getProposals = async (threadId: string) => {
  const session = await getSession(threadId);
  return { proposals: session.proposals ?? [] };
};
export const getEvents = async (threadId: string) => {
  const session = await getSession(threadId);
  return { events: session.events ?? [] };
};
export const getRecords = async (threadId: string): Promise<SessionRecords> => {
  const session = await getSession(threadId);
  return workflowRecords(session);
};
export const decide = (threadId: string, pid: string, action: "approve" | "reject" | "revise", note = "") =>
  req<WorkflowSession>(`/workflow-sessions/${threadId}/decisions`, {
    method: "POST",
    body: JSON.stringify({ decision: action, proposal_id: pid, note }),
  });
export const getPushPublicKey = () => req<{ public_key: string }>("/push-subscriptions/public-key");
export const registerPushSubscription = (subscription: PushSubscriptionJSON) =>
  req<{
    id: string;
    customer_id: string | null;
    endpoint: string;
    status: string;
  }>("/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      user_agent: navigator.userAgent,
      metadata: { app: "frontend-v2" },
    }),
  });
export const sendPushTest = () => req<{ sent: number; reason?: string }>("/push-subscriptions/test", { method: "POST" });

function workflowRecords(session: WorkflowSession): SessionRecords {
  const context = session.recent_context ?? {};
  const assessment = asRecord(context.assessment);
  const plan = asRecord(context.plan);
  const events = session.events ?? [];

  return {
    messages: session.messages ?? [],
    need_assessments: assessment
      ? [
          {
            primary_need: stringValue(assessment.primary_need, "none"),
            needs: Object.fromEntries(
              [
                "medical_cost_need",
                "insurance_need",
                "cashflow_need",
                "asset_defense_need",
                "investment_adjust_need",
                "life_plan_need",
              ].map((key) => [key, stringValue(assessment[key], "none")]),
            ),
            confidence: numberValue(assessment.confidence, 0),
            rationale: stringValue(assessment.rationale, ""),
            raw_output: assessment,
            created_at: latestEventAt(events, "policy") ?? latestEventAt(events, "graph_state") ?? new Date().toISOString(),
          },
        ]
      : [],
    plans: plan
      ? [
          {
            explanation: stringValue(plan.explanation, ""),
            raw_output: plan,
            proposal_ids: (session.proposals ?? []).map((proposal) => proposal.id),
            created_at: latestEventAt(events, "policy") ?? latestEventAt(events, "agent_job") ?? new Date().toISOString(),
          },
        ]
      : [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function latestEventAt(events: AgentEvent[], type: string): string | null {
  return [...events].reverse().find((event) => event.type === type)?.created_at ?? null;
}
