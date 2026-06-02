import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import * as api from "./api";
import { t } from "./i18n";

const STATE_LABEL: Record<string, string> = {
  Monitoring: "관찰 중",
  SignalDetected: "신호 감지",
  AssessNeed: "필요도 평가",
  GeneratePlan: "계획 수립",
  RiskCheck: "리스크 검토",
  UserApproval: "승인 대기",
  ExecuteAction: "실행 중",
  VerifyResult: "결과 확인",
  UpdateMemory: "기록",
  ClarifyUser: "질문 중",
};
const label = (s: string) => STATE_LABEL[s] ?? s;

const NEED_LABEL: Record<string, string> = {
  medical_cost_need: "의료비",
  insurance_need: "보험",
  cashflow_need: "현금흐름",
  asset_defense_need: "자산방어",
  investment_adjust_need: "투자전략",
  life_plan_need: "생애설계",
};
const PRIMARY_NEED_LABEL: Record<string, string> = {
  medical_cost: "의료비",
  insurance: "보험",
  cashflow: "현금흐름",
  asset_defense: "자산방어",
  investment_adjust: "투자전략",
  life_plan: "생애설계",
  preference_update: "성향 업데이트",
  none: "없음",
};
const NEED_LEVEL_LABEL: Record<string, string> = {
  none: "없음",
  low: "낮음",
  mid: "중간",
  high: "높음",
};

export default function App() {
  const qc = useQueryClient();
  const [sid, setSid] = useState<string | null>(null);

  const customers = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const customer = customers.data?.[0];

  // 고객 확인되면 세션 생성
  useEffect(() => {
    if (customer && !sid) {
      api.createSession(customer.id).then((s) => setSid(s.session_id));
    }
  }, [customer, sid]);

  const session = useQuery({
    queryKey: ["session", sid],
    queryFn: () => api.getSession(sid!),
    enabled: !!sid,
  });
  const proposals = useQuery({
    queryKey: ["proposals", sid],
    queryFn: () => api.getProposals(sid!),
    enabled: !!sid,
  });
  const events = useQuery({
    queryKey: ["events", sid],
    queryFn: () => api.getEvents(sid!),
    enabled: !!sid,
  });
  const records = useQuery({
    queryKey: ["records", sid],
    queryFn: () => api.getRecords(sid!),
    enabled: !!sid,
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["session", sid] });
    qc.invalidateQueries({ queryKey: ["proposals", sid] });
    qc.invalidateQueries({ queryKey: ["events", sid] });
    qc.invalidateQueries({ queryKey: ["records", sid] });
  };

  const signal = useMutation({
    mutationFn: ({ source, payload }: { source: string; payload: Record<string, unknown> }) =>
      api.postSignal(sid!, source, payload),
    onSuccess: refetchAll,
  });
  const decide = useMutation({
    mutationFn: ({ pid, action }: { pid: string; action: "approve" | "reject" | "revise" }) =>
      api.decide(pid, action),
    onSuccess: refetchAll,
  });

  const newSession = async () => {
    if (!customer) return;
    const s = await api.createSession(customer.id);
    setSid(s.session_id);
    qc.clear();
  };

  if (customers.isLoading || !customer) {
    return <Centered>{t("loading")}</Centered>;
  }

  const s = session.data;
  const pending = s?.pending_proposal ?? null;
  const busy = signal.isPending || decide.isPending;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#F6F7FB] pb-10">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-[#0A31A8] px-5 py-4 text-white shadow">
        <div className="text-2xl font-extrabold tracking-tight">{t("app_title")}</div>
        <div className="mt-0.5 text-sm text-blue-100">{t("app_subtitle")}</div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>
            {t("customer")}: <b>{customer.name}</b> ({customer.age_band})
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            {t("state")}: {label(s?.state ?? "")}
          </span>
        </div>
      </header>

      <main className="space-y-5 px-5 py-5">
        <Resilience cid={customer.id} />
        <NeedAssessmentPanel session={s} events={events.data?.events ?? []} />
        <FinancialContext cid={customer.id} />

        {/* 상황 시뮬레이션 */}
        <section>
          <H>{t("simulate")}</H>
          <div className="grid grid-cols-1 gap-2">
            <SimBtn
              disabled={busy}
              onClick={() => signal.mutate({ source: "event", payload: { kind: "portfolio_loss" } })}
            >
              {t("sim_portfolio_loss")}
            </SimBtn>
            <SimBtn
              disabled={busy}
              onClick={() => signal.mutate({ source: "event", payload: { kind: "bp_rising" } })}
            >
              {t("sim_health")}
            </SimBtn>
            <SimBtn
              disabled={busy}
              onClick={() =>
                signal.mutate({ source: "user_utterance", payload: { text: "투자는 보수적으로" } })
              }
            >
              {t("sim_utterance")}
            </SimBtn>
          </div>
          {busy && <p className="mt-2 text-center text-sm text-[#1C56FF]">{t("processing")}</p>}
        </section>

        {/* 승인 대기 카드 */}
        {pending && (
          <section>
            <H>{t("pending")}</H>
            <div className="rounded-2xl border-2 border-[#1C56FF] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-bold leading-snug">{pending.summary}</p>
                <Badge external={pending.has_external_effect} />
              </div>
              {pending.rationale && (
                <p className="mt-2 text-sm leading-relaxed text-[#666]">{pending.rationale}</p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <ActBtn tone="primary" disabled={busy} onClick={() => decide.mutate({ pid: pending.id, action: "approve" })}>
                  {t("approve")}
                </ActBtn>
                <ActBtn tone="ghost" disabled={busy} onClick={() => decide.mutate({ pid: pending.id, action: "revise" })}>
                  {t("revise")}
                </ActBtn>
                <ActBtn tone="danger" disabled={busy} onClick={() => decide.mutate({ pid: pending.id, action: "reject" })}>
                  {t("reject")}
                </ActBtn>
              </div>
            </div>
          </section>
        )}

        {/* 제안 목록 */}
        <section>
          <H>{t("recommended")}</H>
          <div className="space-y-2">
            {(proposals.data?.proposals ?? []).length === 0 && (
              <p className="rounded-xl bg-white p-4 text-center text-sm text-[#999]">{t("no_pending")}</p>
            )}
            {(proposals.data?.proposals ?? []).map((p) => (
              <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{p.summary}</p>
                  <Badge external={p.has_external_effect} />
                </div>
                <div className="mt-1 text-xs text-[#999]">
                  {p.kind} · <StatusText status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 진행 내역 */}
        <section>
          <H>{t("timeline")}</H>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <ol className="space-y-1 text-sm">
              {(events.data?.events ?? []).map((e, i) => (
                <li key={i} className="flex gap-2 text-[#444]">
                  <span className="text-[#1C56FF]">▸</span>
                  <span>{eventLabel(e)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <RecordsPanel records={records.data} />

        <button onClick={newSession} className="w-full rounded-xl border border-[#D5DBE5] bg-white py-3 font-semibold text-[#666]">
          {t("reset")}
        </button>
      </main>
    </div>
  );
}

// ── 회복탄력성 상태 ──
function Resilience({ cid }: { cid: string }) {
  const q = useQuery({
    queryKey: ["status", cid],
    queryFn: async () => {
      const [ins, pf, mem, health] = await Promise.all([
        api.getInsurance(cid),
        api.getPortfolio(cid),
        api.getMemory(cid),
        api.getHealth(cid),
      ]);
      return { ins, pf, mem, health };
    },
  });
  if (!q.data) return null;
  const { ins, pf, health } = q.data;
  const highRisk = Math.round((pf.high_risk_weight ?? 0) * 100);
  return (
    <section>
      <H>{t("resilience")}</H>
      <div className="grid grid-cols-2 gap-2">
        <Stat title={t("health_risk")} value={health.events.length > 0 ? "주의" : "양호"} bad={health.events.length > 0} />
        <Stat title={t("insurance_gap")} value={ins.gaps_hint ?? "양호"} bad={!!ins.gaps_hint} />
        <Stat title={t("investment_risk")} value={`고위험 ${highRisk}%`} bad={highRisk >= 60} />
        <Stat title={t("cashflow_risk")} value={highRisk >= 60 ? "주의" : "보통"} bad={highRisk >= 60} />
      </div>
    </section>
  );
}

function NeedAssessmentPanel({
  session,
  events,
}: {
  session?: api.Session;
  events: api.AgentEvent[];
}) {
  const latest = [...events].reverse().find((e) => e.type === "need_assessment");
  const eventAssessment = latest ? assessmentFromEvent(latest.detail) : undefined;
  const needs = session?.active_needs?.needs ?? eventAssessment?.needs ?? {};
  const primary = session?.active_needs?.primary_need ?? eventAssessment?.primary_need ?? "none";
  const rationale = typeof latest?.detail?.rationale === "string" ? latest.detail.rationale : "";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <H>{t("need_assessment")}</H>
        <span className="rounded-full bg-[#EAF0FF] px-3 py-1 text-xs font-bold text-[#0A31A8]">
          {PRIMARY_NEED_LABEL[primary] ?? primary}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(NEED_LABEL).map(([key, name]) => (
          <NeedMeter key={key} label={name} level={String(needs[key] ?? "none")} />
        ))}
      </div>
      {rationale && <p className="mt-2 rounded-xl bg-white p-3 text-sm leading-relaxed text-[#555]">{rationale}</p>}
    </section>
  );
}

function NeedMeter({ label, level }: { label: string; level: string }) {
  const score: Record<string, number> = { none: 0, low: 1, mid: 2, high: 3 };
  const width = `${((score[level] ?? 0) / 3) * 100}%`;
  const strong = level === "high";
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#777]">{label}</span>
        <span className={`text-xs font-bold ${strong ? "text-[#0A31A8]" : "text-[#777]"}`}>
          {NEED_LEVEL_LABEL[level] ?? level}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8EBF2]">
        <div className={`h-full rounded-full ${strong ? "bg-[#0A31A8]" : "bg-[#7B93D1]"}`} style={{ width }} />
      </div>
    </div>
  );
}

function FinancialContext({ cid }: { cid: string }) {
  const q = useQuery({
    queryKey: ["financial-context", cid],
    queryFn: async () => {
      const [accounts, transactions, cardBills, precheck, loans] = await Promise.all([
        api.getAccounts(cid),
        api.getTransactions(cid),
        api.getCardBills(cid),
        api.getLoanSwitchPrecheck(cid),
        api.getLoans(cid),
      ]);
      return { accounts, transactions, cardBills, precheck, loans };
    },
  });
  if (!q.data) return null;
  const { accounts, transactions, cardBills, precheck, loans } = q.data;
  const loan = loans.loans[0];

  return (
    <section>
      <H>{t("financial_context")}</H>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          title={t("available_cash")}
          value={formatKrw(accounts.liquidity_summary.available_cash_krw)}
          bad={(accounts.liquidity_summary.emergency_fund_months ?? 0) < 3}
        />
        <Stat
          title={t("monthly_outflow")}
          value={formatKrw(transactions.spending_summary.monthly_outflow_krw)}
          bad={transactions.spending_summary.medical_spending_krw > 0}
        />
        <Stat title={t("card_due")} value={formatKrw(cardBills.upcoming_card_payment_krw)} bad />
        <Stat
          title={t("loan_due")}
          value={loan ? formatKrw(loan.monthly_payment) : "없음"}
          bad={!!loan}
        />
      </div>
      <div className="mt-2 rounded-xl bg-white p-3 text-sm leading-relaxed text-[#555]">
        <div className="flex justify-between gap-3">
          <span>{t("medical_spending")}</span>
          <b>{formatKrw(transactions.spending_summary.medical_spending_krw)}</b>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>{t("record_count")}</span>
          <b>{transactions.spending_summary.record_count}건</b>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span>{t("loan_switch")}</span>
          <b>{precheck.repayment_available ? "가능" : "확인 필요"}</b>
        </div>
      </div>
    </section>
  );
}

function RecordsPanel({ records }: { records?: api.SessionRecords }) {
  if (!records) return null;
  const latestAssessment = records.need_assessments.at(-1);
  const latestPlan = records.plans.at(-1);
  const latestMessages = records.messages.slice(-4);

  return (
    <section>
      <H>{t("records")}</H>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniCount label={t("messages")} value={records.messages.length} />
          <MiniCount label={t("assessments")} value={records.need_assessments.length} />
          <MiniCount label={t("plans")} value={records.plans.length} />
        </div>

        {latestAssessment && (
          <div className="mt-3 border-t border-[#EDF0F5] pt-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-bold text-[#333]">{t("last_assessment")}</span>
              <span className="rounded-full bg-[#EAF0FF] px-2 py-1 text-xs font-bold text-[#0A31A8]">
                {PRIMARY_NEED_LABEL[latestAssessment.primary_need] ?? latestAssessment.primary_need}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#555]">{latestAssessment.rationale}</p>
          </div>
        )}

        {latestPlan && (
          <div className="mt-3 border-t border-[#EDF0F5] pt-3">
            <div className="text-sm font-bold text-[#333]">{t("last_plan")}</div>
            <p className="mt-2 text-sm leading-relaxed text-[#555]">{latestPlan.explanation}</p>
            <p className="mt-1 text-xs text-[#888]">
              ActionProposal {latestPlan.proposal_ids.length}건 저장
            </p>
          </div>
        )}

        {latestMessages.length > 0 && (
          <div className="mt-3 border-t border-[#EDF0F5] pt-3">
            <div className="text-sm font-bold text-[#333]">{t("transcript")}</div>
            <ol className="mt-2 space-y-2">
              {latestMessages.map((m, index) => (
                <li key={`${m.created_at}-${index}`} className="text-sm leading-relaxed">
                  <span className="mr-2 rounded bg-[#F2F4F8] px-2 py-0.5 text-xs font-bold text-[#666]">
                    {roleLabel(m.role)}
                  </span>
                  <span className="text-[#555]">{truncate(m.content, 72)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[#F6F7FB] p-2">
      <div className="text-lg font-extrabold text-[#0A31A8]">{value}</div>
      <div className="text-xs font-semibold text-[#777]">{label}</div>
    </div>
  );
}

// ── 작은 컴포넌트 ──
function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-bold text-[#848484]">{children}</h2>;
}
function Stat({ title, value, bad }: { title: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="text-xs text-[#999]">{title}</div>
      <div className={`mt-1 text-lg font-bold ${bad ? "text-[#1C56FF]" : "text-[#333]"}`}>{value}</div>
    </div>
  );
}
function SimBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-[#D5DBE5] bg-white py-4 text-left text-lg font-semibold text-[#333] active:bg-[#F0F4FF] disabled:opacity-50"
    >
      <span className="px-4">{children}</span>
    </button>
  );
}
function ActBtn({
  children,
  onClick,
  tone,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const cls =
    tone === "primary"
      ? "bg-[#0A31A8] text-white"
      : tone === "danger"
        ? "bg-white text-[#999] border border-[#E5E5E5]"
        : "bg-[#F0F4FF] text-[#1C56FF]";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-xl py-3 font-bold disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}
function Badge({ external }: { external: boolean }) {
  return external ? (
    <span className="shrink-0 rounded-full bg-[#1C56FF] px-2 py-1 text-xs font-bold text-white">{t("external_badge")}</span>
  ) : (
    <span className="shrink-0 rounded-full bg-[#E5E5E5] px-2 py-1 text-xs font-bold text-[#666]">{t("auto_badge")}</span>
  );
}
function StatusText({ status }: { status: string }) {
  const m: Record<string, string> = {
    proposed: "검토 중",
    executed: "완료",
    approved: "승인됨",
    rejected: "거절됨",
    deferred: "보류",
    failed: "실패",
  };
  return <span>{m[status] ?? status}</span>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-[#666]">{children}</div>;
}

function eventLabel(e: api.AgentEvent): string {
  switch (e.type) {
    case "state_transition":
      return `${label(String(e.detail.from ?? ""))} → ${label(String(e.detail.to ?? ""))}`;
    case "need_assessment":
      return `필요도 평가: ${PRIMARY_NEED_LABEL[String(e.detail.primary_need ?? "none")] ?? "확인"}`;
    case "plan":
      return "계획 생성";
    case "execution":
      return "액션 실행";
    case "memory":
      return "선호 기록";
    case "tool_call":
      return "데이터 조회";
    default:
      return e.type;
  }
}

function formatKrw(value: number): string {
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000)}억원`;
  if (value >= 10_000) return `${Math.round(value / 10_000)}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

function assessmentFromEvent(detail: Record<string, unknown>): api.ActiveNeeds {
  return {
    primary_need: typeof detail.primary_need === "string" ? detail.primary_need : "none",
    needs: Object.fromEntries(
      Object.keys(NEED_LABEL).map((key) => [key, typeof detail[key] === "string" ? String(detail[key]) : "none"]),
    ),
  };
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    user: "고객",
    system: "시스템",
    assistant: "Agent",
    tool: "Tool",
  };
  return labels[role] ?? role;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}
