import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import * as api from "./api";
import { t } from "./i18n";

type Page = "login" | "main" | "records" | "readiness" | "approvals";

type CustomerContext = {
  insurance: Awaited<ReturnType<typeof api.getInsurance>>;
  portfolio: Awaited<ReturnType<typeof api.getPortfolio>>;
  memory: Awaited<ReturnType<typeof api.getMemory>>;
  health: Awaited<ReturnType<typeof api.getHealth>>;
  accounts: Awaited<ReturnType<typeof api.getAccounts>>;
  transactions: Awaited<ReturnType<typeof api.getTransactions>>;
  cardBills: Awaited<ReturnType<typeof api.getCardBills>>;
  loans: Awaited<ReturnType<typeof api.getLoans>>;
  precheck: Awaited<ReturnType<typeof api.getLoanSwitchPrecheck>>;
};

type ReadinessModel = {
  score: number;
  assetRatio: number;
  liquidityRatio: number;
  peerAssetRatio: number;
  peerLiquidityRatio: number;
  totalAssets: number;
  liquidCash: number;
  monthlyOutflow: number;
  medicalMonthly: number;
  fixedCost: number;
  loanMonthly: number;
  cardDue: number;
  currentMedicalReserve: number;
  peerDiseaseMonthly: number;
  advisedMedicalReserve: number;
  worseningNeed: number;
  worseningCoverageRatio: number;
  healthLabel: string;
  insuranceGap: string | null;
  summary: string;
};

const PEER_NET_ASSETS = 250_000_000;
const PEER_EMERGENCY_MONTHS = 6;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/main" replace />} />
      <Route path="/login" element={<AppShell page="login" />} />
      <Route path="/main" element={<AppShell page="main" />} />
      <Route path="/readiness" element={<AppShell page="readiness" />} />
      <Route path="/approvals" element={<AppShell page="approvals" />} />
      <Route path="/records" element={<AppShell page="records" />} />
      <Route path="*" element={<Navigate to="/main" replace />} />
    </Routes>
  );
}

function AppShell({ page }: { page: Page }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sid, setSid] = useState<string | null>(() => localStorage.getItem("jbwm_session_id"));
  const [customerId, setCustomerId] = useState<string | null>(() => localStorage.getItem("jbwm_customer_id"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [hasCustomerRequest, setHasCustomerRequest] = useState(false);

  const customers = useQuery({ queryKey: ["customers"], queryFn: api.listCustomers });
  const customer = customers.data?.find((c) => c.id === customerId) ?? null;
  const context = useCustomerContext(customerId);
  const activeSession = useQuery({
    queryKey: ["active-session", customerId],
    queryFn: () => api.createSession(customerId!, false),
    enabled: !!customerId && page !== "login",
    refetchInterval: 2500,
  });

  const session = useQuery({
    queryKey: ["session", sid],
    queryFn: () => api.getSession(sid!),
    enabled: !!sid,
    refetchInterval: 2500,
  });
  const records = useQuery({
    queryKey: ["records", sid],
    queryFn: () => api.getRecords(sid!),
    enabled: !!sid,
    refetchInterval: 3500,
  });
  const detailSnapshot = useQuery({
    queryKey: ["detail-snapshot", customerId],
    queryFn: () => api.getDetailSnapshot(customerId!),
    enabled: !!customerId && detailOpen,
  });

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ["session", sid] });
    qc.invalidateQueries({ queryKey: ["records", sid] });
    qc.invalidateQueries({ queryKey: ["customer-context", customerId] });
  };

  const message = useMutation({
    mutationFn: (text: string) => api.postMessage(sid!, text),
    onSuccess: refetchAll,
  });
  const decide = useMutation({
    mutationFn: ({ pid, action }: { pid: string; action: "approve" | "reject" | "revise" }) =>
      api.decide(sid!, pid, action),
    onSuccess: refetchAll,
  });

  useEffect(() => {
    const nextThreadId = activeSession.data?.thread_id;
    if (!nextThreadId || nextThreadId === sid) return;
    localStorage.setItem("jbwm_session_id", nextThreadId);
    setSid(nextThreadId);
    setHasCustomerRequest(false);
    qc.invalidateQueries({ queryKey: ["session", nextThreadId] });
    qc.invalidateQueries({ queryKey: ["records", nextThreadId] });
  }, [activeSession.data?.thread_id, qc, sid]);

  const login = async (nextCustomer: api.Customer) => {
    const nextSession = await api.createSession(nextCustomer.id, false);
    localStorage.setItem("jbwm_customer_id", nextCustomer.id);
    localStorage.setItem("jbwm_session_id", nextSession.thread_id);
    setCustomerId(nextCustomer.id);
    setSid(nextSession.thread_id);
    qc.clear();
    navigate("/main");
  };

  const logout = () => {
    localStorage.removeItem("jbwm_customer_id");
    localStorage.removeItem("jbwm_session_id");
    localStorage.removeItem("jbwm_access_token");
    setCustomerId(null);
    setSid(null);
    qc.clear();
    setMenuOpen(false);
    navigate("/login");
  };

  if (customers.isLoading) return <Centered>{t("loading")}</Centered>;
  if (page === "login") return <LoginPage customers={customers.data ?? []} onLogin={login} />;
  if (!customer) return <Navigate to="/login" replace />;
  if (!sid) return <Centered>{t("loading")}</Centered>;
  if (page === "records") return <RecordsPage customer={customer} records={records.data} onBack={() => navigate("/main")} />;

  const readiness = context.data ? buildReadiness(context.data) : null;
  const progress = progressInfo(session.data, session.data?.proposals ?? [], hasCustomerRequest);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gradient-to-b from-[#EEF6FF] via-[#F8FBFF] to-white pb-10">
      <AppHeader
        onMenu={() => setMenuOpen(true)}
      />
      <MenuPanel open={menuOpen} customer={customer} onClose={() => setMenuOpen(false)} onLogout={logout} />
      <DataDetailModal
        open={detailOpen}
        loading={detailSnapshot.isLoading}
        data={detailSnapshot.data}
        onClose={() => setDetailOpen(false)}
      />

      {page === "readiness" ? (
        <ReadinessPage
          customer={customer}
          context={context.data}
          readiness={readiness}
          loading={context.isLoading}
          onBack={() => navigate("/main")}
          onOpenDetail={() => setDetailOpen(true)}
        />
      ) : page === "approvals" ? (
        <ApprovalsPage
          proposals={session.data?.proposals ?? []}
          busy={decide.isPending}
          onBack={() => navigate("/main")}
          onDecision={(pid, action) => decide.mutate({ pid, action }, { onSuccess: () => navigate("/main") })}
        />
      ) : (
        <main className="space-y-5 px-5 py-5">
          <button
            onClick={() => navigate("/records")}
            className="flex items-center gap-2 text-left text-2xl font-extrabold text-[#222]"
          >
            <span>{customer.name}님</span>
            <span className="text-[#777]">›</span>
          </button>
          <ReadinessHero
            readiness={readiness}
            loading={context.isLoading}
            onOpen={() => navigate("/readiness")}
          />
          <ChatPanel
            busy={message.isPending}
            onSend={(text) => {
              setHasCustomerRequest(true);
              message.mutate(text);
            }}
          />
          {progress && <CustomerProgress progress={progress} />}
          <ProposalHistory proposals={session.data?.proposals ?? []} onOpenApprovals={() => navigate("/approvals")} />
          <RecordsPanel records={records.data} onOpen={() => navigate("/records")} />
        </main>
      )}
    </div>
  );
}

function useCustomerContext(customerId: string | null) {
  return useQuery({
    queryKey: ["customer-context", customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<CustomerContext> => {
      const [insurance, portfolio, memory, health, accounts, transactions, cardBills, loans, precheck] =
        await Promise.all([
          api.getInsurance(customerId!),
          api.getPortfolio(customerId!),
          api.getMemory(customerId!),
          api.getHealth(customerId!),
          api.getAccounts(customerId!),
          api.getTransactions(customerId!),
          api.getCardBills(customerId!),
          api.getLoans(customerId!),
          api.getLoanSwitchPrecheck(customerId!),
        ]);
      return { insurance, portfolio, memory, health, accounts, transactions, cardBills, loans, precheck };
    },
  });
}

function AppHeader({
  onMenu,
}: {
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#EDF0F5] bg-white/95 px-5 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xl font-extrabold tracking-tight text-[#222]">JB WM</div>
        <button
          aria-label="menu"
          onClick={onMenu}
          className="grid h-10 w-10 place-items-center rounded-lg bg-[#F7F9FC] text-2xl font-bold text-[#333]"
        >
          ☰
        </button>
      </div>
    </header>
  );
}

function LoginPage({ customers, onLogin }: { customers: api.Customer[]; onLogin: (customer: api.Customer) => void }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#F6F7FB] px-5 py-8">
      <div className="mb-6">
        <div className="text-3xl font-extrabold text-[#0A31A8]">JB WM</div>
        <p className="mt-2 text-base font-semibold leading-relaxed text-[#555]">고객 계정을 선택해 시작합니다.</p>
      </div>
      <div className="space-y-2">
        {customers.map((customer) => (
          <button
            key={customer.id}
            onClick={() => onLogin(customer)}
            className="w-full rounded-xl bg-white p-4 text-left shadow-sm active:bg-[#F0F4FF]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-[#333]">{customer.name}</div>
                <div className="mt-1 text-xs font-semibold text-[#888]">{customer.age_band} · {shortId(customer.id)}</div>
              </div>
              <span className="rounded-full bg-[#EAF0FF] px-3 py-1 text-xs font-bold text-[#0A31A8]">로그인</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadinessHero({
  readiness,
  loading,
  onOpen,
}: {
  readiness: ReadinessModel | null;
  loading: boolean;
  onOpen: () => void;
}) {
  const score = readiness?.score ?? 0;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#666]">나의 종합 대비 상태</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#222]">
            {loading ? "확인 중" : `${score}% 준비`}
          </h1>
        </div>
        <button onClick={onOpen} className="rounded-full bg-[#F0F4FF] px-3 py-2 text-sm font-extrabold text-[#0A31A8]">
          자세히
        </button>
      </div>
      <div className="mt-5">
        <ProgressBar value={score} />
        <div className="mt-2 flex justify-between text-xs font-bold text-[#999]">
          <span>부족</span>
          <span>충분</span>
        </div>
      </div>
      <p className="mt-4 text-base font-semibold leading-relaxed text-[#444]">
        {loading
          ? "계좌, 지출, 보험, 건강 변화를 함께 확인하고 있어요."
          : readiness?.summary}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <HeroMini label="현금 여유" value={readiness ? `${Math.round(readiness.liquidityRatio)}%` : "-"} />
        <HeroMini label="의료 대비" value={readiness ? formatKrw(readiness.currentMedicalReserve) : "-"} />
        <HeroMini label="보험 상태" value={readiness?.insuranceGap ? "보완" : "양호"} />
      </div>
    </section>
  );
}

function ReadinessPage({
  customer,
  context,
  readiness,
  loading,
  onBack,
  onOpenDetail,
}: {
  customer: api.Customer;
  context?: CustomerContext;
  readiness: ReadinessModel | null;
  loading: boolean;
  onBack: () => void;
  onOpenDetail: () => void;
}) {
  if (loading || !context || !readiness) {
    return <Centered>{t("loading")}</Centered>;
  }

  return (
    <main className="space-y-5 px-5 py-5">
      <button onClick={onBack} className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#0A31A8] shadow-sm">
        ← 메인
      </button>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#666]">{customer.name}님의 대비점수</p>
            <h1 className="mt-2 text-4xl font-extrabold text-[#0A31A8]">{readiness.score}%</h1>
          </div>
          <DetailButton onClick={onOpenDetail} />
        </div>
        <div className="mt-4">
          <ProgressBar value={readiness.score} />
        </div>
        <p className="mt-4 text-base font-semibold leading-relaxed text-[#444]">{readiness.summary}</p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SectionTitle title="보유자산과 현금 여유" />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <DonutGauge label="보유자산" value={readiness.assetRatio} center={formatPercent(readiness.assetRatio)} />
          <DonutGauge label="현금유동성" value={readiness.liquidityRatio} center={formatPercent(readiness.liquidityRatio)} />
        </div>
        <div className="mt-4 rounded-xl bg-[#F6F7FB] p-4">
          <InfoRow label="보유자산 합계" value={formatKrw(readiness.totalAssets)} />
          <InfoRow label="출금가능 현금" value={formatKrw(readiness.liquidCash)} />
          <InfoRow label="월 지출 합계" value={formatKrw(readiness.monthlyOutflow + readiness.loanMonthly + readiness.cardDue)} />
          <InfoRow label="또래 평균 순자산" value={formatKrw(PEER_NET_ASSETS)} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SectionTitle title="의료비 대비" />
        <div className="mt-4 space-y-3">
          <BarCompare label="최근 월 의료비" value={readiness.medicalMonthly} max={readiness.advisedMedicalReserve} />
          <BarCompare label="유사 질환 참고액" value={readiness.peerDiseaseMonthly} max={readiness.advisedMedicalReserve} />
          <BarCompare label="권장 준비액" value={readiness.advisedMedicalReserve} max={readiness.advisedMedicalReserve} />
        </div>
        <p className="mt-4 rounded-xl bg-[#F0F4FF] p-3 text-sm font-semibold leading-relaxed text-[#0A31A8]">
          현재 건강 신호는 {readiness.healthLabel}입니다. 치료 선택은 의료진과 결정하고, JB도우미는 비용과 현금흐름 부담만 계산합니다.
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SectionTitle title="보험 대비" />
        <div className="mt-3 space-y-2">
          {context.insurance.policies?.map((policy, index) => (
            <div key={`${policy.product_name}-${index}`} className="rounded-xl border border-[#EDF0F5] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-[#333]">{policy.product_name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#777]">{policy.type}</p>
                </div>
                <span className="rounded-full bg-[#EAF0FF] px-2 py-1 text-xs font-bold text-[#0A31A8]">
                  {policy.active ? "유지" : "비활성"}
                </span>
              </div>
            </div>
          ))}
        </div>
        {readiness.insuranceGap && (
          <p className="mt-3 rounded-xl bg-[#FFF4D8] p-3 text-sm font-bold text-[#6E5200]">{readiness.insuranceGap}</p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SectionTitle title="건강 악화 시 추가 부담" />
        <div className="mt-4 space-y-3">
          <BarCompare label="현재 현금 여유" value={readiness.liquidCash} max={Math.max(readiness.liquidCash, readiness.worseningNeed)} />
          <BarCompare label="악화 시 예상 필요액" value={readiness.worseningNeed} max={Math.max(readiness.liquidCash, readiness.worseningNeed)} />
        </div>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-[#555]">
          현재 현금으로 예상 부담의 {formatPercent(readiness.worseningCoverageRatio)} 정도를 감당할 수 있습니다.
        </p>
      </section>
    </main>
  );
}

function ApprovalsPage({
  proposals,
  busy,
  onDecision,
  onBack,
}: {
  proposals: api.Proposal[];
  busy: boolean;
  onDecision: (pid: string, action: "approve" | "reject" | "revise") => void;
  onBack: () => void;
}) {
  const approvalItems = proposals.filter((p) => p.has_external_effect && p.status === "proposed");
  return (
    <main className="space-y-5 px-5 py-5">
      <button onClick={onBack} className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#0A31A8] shadow-sm">
        ← 메인
      </button>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#666]">고객님의 확인이 필요합니다</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#222]">승인할 제안</h1>
        <p className="mt-3 text-base font-semibold leading-relaxed text-[#555]">
          실제 반영이 필요한 일은 고객님의 선택 후에만 진행됩니다.
        </p>
      </section>
      {approvalItems.length === 0 ? (
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-extrabold text-[#333]">지금 승인할 제안이 없습니다.</p>
          <button onClick={onBack} className="mt-5 rounded-xl bg-[#EAF0FF] px-6 py-3 font-extrabold text-[#0A31A8]">
            돌아가기
          </button>
        </section>
      ) : (
        <div className="space-y-3">
          {approvalItems.map((p) => (
            <section key={p.id} className="rounded-2xl border border-[#D5DBE5] bg-white p-5 shadow-sm">
              <Badge external={p.has_external_effect} />
              <h2 className="mt-4 text-2xl font-extrabold leading-snug text-[#222]">{p.summary}</h2>
              {p.rationale && <p className="mt-4 text-base font-semibold leading-relaxed text-[#555]">{p.rationale}</p>}
              <div className="mt-6 grid grid-cols-3 gap-2">
                <ActBtn tone="primary" disabled={busy} onClick={() => onDecision(p.id, "approve")}>승인</ActBtn>
                <ActBtn tone="danger" disabled={busy} onClick={() => onDecision(p.id, "reject")}>거절</ActBtn>
                <ActBtn tone="ghost" disabled={busy} onClick={onBack}>나중에</ActBtn>
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function ChatPanel({
  busy,
  onSend,
}: {
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [path, setPath] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [localMessages, setLocalMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const quickItems = guidedTree(path);

  const submitText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLocalMessages((items) => [...items, { role: "user", content: trimmed }]);
    onSend(trimmed);
    setText("");
    setPath([]);
  };

  const sendQuick = (label: string) => {
    const message = [...path, label].join(" > ");
    setLocalMessages((items) => [...items, { role: "user", content: label }]);
    onSend(message);
    setPath([]);
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-[#EDF0F5] px-5 py-4">
        <SectionTitle title="JB도우미와 대화" />
        <p className="mt-1 text-sm font-semibold text-[#777]">말로 적거나 아래 버튼을 골라 알려주세요.</p>
      </div>

      <div className="space-y-2 bg-white px-4 py-4">
        <div className="min-h-64 space-y-3 py-2">
          {localMessages.map((message, index) =>
            message.role === "user" ? (
              <UserBubble key={`${message.content}-${index}`}>{message.content}</UserBubble>
            ) : (
              <AssistantBubble key={`${message.content}-${index}`}>{message.content}</AssistantBubble>
            ),
          )}
          {busy && <AssistantBubble>확인하고 있어요.</AssistantBubble>}
          <BotMenuCard
            path={path}
            items={quickItems}
            busy={busy}
            onBack={() => setPath(path.slice(0, -1))}
            onPick={(item) => {
              if (item.children) {
                setLocalMessages((items) => [...items, { role: "user", content: item.label }]);
                setPath([...path, item.label]);
              } else {
                sendQuick(item.label);
              }
            }}
          />
        </div>

        <div className="flex gap-2 rounded-full bg-white p-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitText();
            }}
            placeholder="JB도우미에게 메시지 보내기"
            className="min-w-0 flex-1 rounded-full px-3 text-base font-semibold outline-none"
          />
          <button
            onClick={submitText}
            disabled={busy || !text.trim()}
            className="rounded-full bg-[#EAF0FF] px-4 py-2 text-sm font-extrabold text-[#0A31A8] disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </div>
    </section>
  );
}

function BotMenuCard({
  path,
  items,
  busy,
  onBack,
  onPick,
}: {
  path: string[];
  items: GuidedItem[];
  busy: boolean;
  onBack: () => void;
  onPick: (item: GuidedItem) => void;
}) {
  return (
    <div className="flex justify-start">
      <div className="w-[88%] rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF0FF] text-sm font-extrabold text-[#0A31A8]">
            JB
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#333]">JB도우미</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#555]">
              {path.length === 0
                ? "무엇을 도와드릴까요? 아래에서 편하게 골라주세요."
                : "조금 더 자세히 알려주시면 바로 확인해볼게요."}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {path.length > 0 && (
            <button
              onClick={onBack}
              disabled={busy}
              className="w-full rounded-xl border border-[#D5DBE5] bg-white px-4 py-3 text-left text-sm font-extrabold text-[#666] disabled:opacity-50"
            >
              ← 돌아가기
            </button>
          )}
          {items.map((item, index) => (
            <button
              key={item.label}
              disabled={busy}
              onClick={() => onPick(item)}
              className="flex w-full items-center gap-3 rounded-xl border border-[#D5DBE5] bg-white px-4 py-3 text-left text-sm font-extrabold text-[#333] shadow-sm disabled:opacity-50"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F0F4FF] text-xs font-extrabold text-[#0A31A8]">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              <span className="text-[#999]">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-[#333] shadow-sm">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[#FFDC35] px-4 py-3 text-sm font-semibold leading-relaxed text-[#333]">
        {children}
      </div>
    </div>
  );
}

type ProgressInfo = {
  activeStep: number;
  title: string;
  subtitle: string;
};

function CustomerProgress({ progress }: { progress: ProgressInfo }) {
  const activeStep = progress.activeStep;
  const steps = ["응답 분석중", "확인 필요", "기록 완료"];
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight text-[#222]">{progress.title}</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#666]">{progress.subtitle}</p>
        </div>
        <div className="rounded-xl bg-[#E8FAF7] px-3 py-2 text-center">
          <p className="text-xs font-bold text-[#59958C]">현재</p>
          <p className="text-lg font-extrabold text-[#2F7F89]">{activeStep + 1}/3</p>
        </div>
      </div>
      <div className="px-5 pb-5 pt-6">
        <div className="relative mx-2 h-6">
          <div className="absolute left-[10px] right-[10px] top-1/2 grid -translate-y-1/2 grid-cols-2 gap-0">
            {[0, 1].map((segment) => (
              <div key={segment} className="h-3 bg-[#E7EAF0]">
                <div className={`h-full ${activeStep > segment ? "bg-[#54C7BD]" : "bg-transparent"}`} />
              </div>
            ))}
          </div>
          {steps.map((step, index) => {
            const active = index <= activeStep;
            return (
              <div
                key={step}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${index * 50}%`, transform: index === 0 ? "translate(0, -50%)" : index === 2 ? "translate(-100%, -50%)" : "translate(-50%, -50%)" }}
              >
                <div className={`h-5 w-5 rounded-full border-4 border-white shadow ${active ? "bg-[#54C7BD]" : "bg-[#D5DBE5]"}`} />
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {steps.map((step, index) => (
            <p key={step} className={`text-center text-xs font-extrabold leading-tight ${index <= activeStep ? "text-[#0A31A8]" : "text-[#999]"}`}>
              {step}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProposalHistory({ proposals, onOpenApprovals }: { proposals: api.Proposal[]; onOpenApprovals: () => void }) {
  if (proposals.length === 0) return null;
  const pending = proposals.filter((proposal) => proposal.has_external_effect && proposal.status === "proposed");
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title="도우미 제안" />
        {pending.length > 0 && (
          <button onClick={onOpenApprovals} className="rounded-full bg-[#EAF0FF] px-3 py-1 text-xs font-extrabold text-[#0A31A8]">
            승인하기 {pending.length}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {proposals.map((p) => (
          <button
            key={p.id}
            onClick={() => p.has_external_effect && p.status === "proposed" && onOpenApprovals()}
            className="w-full rounded-xl bg-white p-4 text-left shadow-sm active:bg-[#F0F4FF]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-extrabold leading-snug">{p.summary}</p>
              <Badge external={p.has_external_effect} />
            </div>
            <div className="mt-1 text-xs font-bold text-[#999]">
              {kindLabel(p.kind)} · <StatusText status={p.status} external={p.has_external_effect} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RecordsPanel({ records, onOpen }: { records?: api.SessionRecords; onOpen: () => void }) {
  if (!records) return null;
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <SectionTitle title="저장된 기록" />
        <button onClick={onOpen} className="rounded-full bg-[#F0F4FF] px-3 py-1 text-xs font-bold text-[#0A31A8]">
          전문 보기
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniCount label="대화" value={records.messages.length} />
        <MiniCount label="판단" value={records.need_assessments.length} />
        <MiniCount label="계획" value={records.plans.length} />
      </div>
    </section>
  );
}

function RecordsPage({
  customer,
  records,
  onBack,
}: {
  customer: api.Customer;
  records?: api.SessionRecords;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#F6F7FB] pb-8">
      <header className="sticky top-0 z-10 border-b border-[#EDF0F5] bg-white/95 px-5 py-4 backdrop-blur">
        <button onClick={onBack} className="mb-3 rounded-lg bg-[#F7F9FC] px-3 py-2 text-sm font-bold text-[#333]">← 메인</button>
        <div className="text-2xl font-extrabold text-[#222]">저장된 전체 기록</div>
        <div className="mt-1 text-sm font-semibold text-[#777]">{customer.name} · 대화 / 판단 / 계획</div>
      </header>
      <main className="space-y-4 px-5 py-5">
        {!records && <Centered>{t("loading")}</Centered>}
        {records && (
          <>
            <FullRecordSection title="대화 전체" items={records.messages} />
            <FullRecordSection title="판단 전체" items={records.need_assessments} />
            <FullRecordSection title="계획 전체" items={records.plans} />
          </>
        )}
      </main>
    </div>
  );
}

function MenuPanel({
  open,
  customer,
  onClose,
  onLogout,
}: {
  open: boolean;
  customer: api.Customer;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 bg-black/25" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-72 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-extrabold text-[#333]">{customer.name}</div>
            <div className="mt-1 text-xs font-semibold text-[#888]">{shortId(customer.id)}</div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-[#F2F4F8] px-3 py-2 font-bold text-[#666]">×</button>
        </div>
        <div className="mt-6 space-y-2">
          <MenuButton onClick={onLogout}>로그아웃</MenuButton>
          <MenuButton>설정</MenuButton>
          <MenuButton>알림</MenuButton>
          <MenuButton>서류함</MenuButton>
          <MenuButton>상담 예약</MenuButton>
        </div>
      </aside>
    </div>
  );
}

function DataDetailModal({
  open,
  loading,
  data,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  data?: api.DetailSnapshot;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/35 px-4 py-8" onClick={onClose}>
      <section
        className="mx-auto flex max-h-full max-w-md flex-col rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#EDF0F5] px-4 py-3">
          <div>
            <div className="text-lg font-extrabold text-[#333]">상세 데이터</div>
            <div className="text-xs font-semibold text-[#888]">API body shape 기반 mock 원천값</div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-[#F2F4F8] px-3 py-2 font-bold text-[#666]">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {loading && <p className="p-4 text-sm text-[#777]">{t("loading")}</p>}
          {!loading && (
            <pre className="whitespace-pre-wrap rounded-xl bg-[#F6F7FB] p-3 text-xs leading-relaxed text-[#333]">
              {JSON.stringify(data ?? {}, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}

function buildReadiness(context: CustomerContext): ReadinessModel {
  const liquidCash = context.accounts.liquidity_summary.available_cash_krw ?? 0;
  const totalPortfolio = context.portfolio.total_value ?? 0;
  const accountAssets = context.accounts.accounts.reduce((sum, account) => sum + account.balance_krw, 0);
  const totalAssets = totalPortfolio + accountAssets;
  const monthlyOutflow = context.transactions.spending_summary.monthly_outflow_krw ?? 0;
  const fixedCost = context.transactions.spending_summary.fixed_cost_krw ?? 0;
  const medicalMonthly = Math.round((context.transactions.spending_summary.medical_spending_krw ?? 0) / 3);
  const cardDue = context.cardBills.upcoming_card_payment_krw ?? 0;
  const loanMonthly = context.loans.loans.reduce((sum, loan) => sum + loan.monthly_payment, 0);
  const emergencyMonths = context.accounts.liquidity_summary.emergency_fund_months ?? 0;
  const highRisk = Math.round((context.portfolio.high_risk_weight ?? 0) * 100);
  const healthPenalty = context.health.events.length > 0 ? 9 : 0;
  const insurancePenalty = context.insurance.gaps_hint ? 8 : 0;
  const investmentPenalty = highRisk >= 70 ? 10 : highRisk >= 55 ? 6 : 0;
  const liquidityRatio = clamp((emergencyMonths / PEER_EMERGENCY_MONTHS) * 100, 0, 140);
  const assetRatio = clamp((totalAssets / PEER_NET_ASSETS) * 100, 0, 160);
  const cashScore = clamp((emergencyMonths / 6) * 30, 0, 30);
  const assetScore = clamp((totalAssets / PEER_NET_ASSETS) * 25, 0, 25);
  const insuranceScore = context.insurance.gaps_hint ? 10 : 18;
  const healthScore = context.health.events.length > 0 ? 11 : 17;
  const investmentScore = clamp(20 - investmentPenalty, 8, 20);
  const score = Math.round(clamp(cashScore + assetScore + insuranceScore + healthScore + investmentScore - healthPenalty - insurancePenalty, 18, 96));
  const peerDiseaseMonthly = Math.max(450_000, Math.round(medicalMonthly * 1.7));
  const advisedMedicalReserve = Math.max(3_000_000, peerDiseaseMonthly * 6);
  const currentMedicalReserve = Math.max(0, liquidCash - monthlyOutflow * 2);
  const worseningNeed = Math.max(advisedMedicalReserve, peerDiseaseMonthly * 9 + fixedCost * 2);
  const worseningCoverageRatio = clamp((liquidCash / worseningNeed) * 100, 0, 160);
  const healthLabel = context.health.events.length > 0 ? "주의가 필요한 상태" : "안정적인 상태";
  const summary =
    score >= 75
      ? "큰 변화가 생겨도 현재 자산과 현금흐름으로 대응 여지가 있습니다. 도우미가 계속 변화를 살피고 있어요."
      : score >= 55
        ? "기본 대비는 되어 있지만 의료비, 보험, 현금흐름 중 일부 보완이 필요합니다."
        : "예상치 못한 건강·자산 변화에 대비해 현금 여유와 보장 상태를 먼저 점검하는 편이 좋습니다.";

  return {
    score,
    assetRatio,
    liquidityRatio,
    peerAssetRatio: 100,
    peerLiquidityRatio: 100,
    totalAssets,
    liquidCash,
    monthlyOutflow,
    medicalMonthly,
    fixedCost,
    loanMonthly,
    cardDue,
    currentMedicalReserve,
    peerDiseaseMonthly,
    advisedMedicalReserve,
    worseningNeed,
    worseningCoverageRatio,
    healthLabel,
    insuranceGap: context.insurance.gaps_hint,
    summary,
  };
}

type GuidedItem = {
  label: string;
  children?: GuidedItem[];
};

function guidedTree(path: string[]): GuidedItem[] {
  const root: GuidedItem[] = [
    {
      label: "지병/건강 상태가 달라졌어요",
      children: [
        { label: "새로운 지병을 진단받았어요" },
        { label: "기존 지병이 악화됐어요" },
        { label: "치료 방법이나 약이 바뀌었어요" },
        { label: "병원비가 늘었어요" },
      ],
    },
    {
      label: "금융 변동 사항이 있어요",
      children: [
        { label: "소득이 줄었어요" },
        { label: "큰 지출이 생겼어요" },
        { label: "대출 상환이 부담돼요" },
        { label: "투자 손실이 걱정돼요" },
      ],
    },
    {
      label: "보험 가입/해지 변화가 있어요",
      children: [
        { label: "새 보험에 가입했어요" },
        { label: "보험을 해지했어요" },
        { label: "보장 내용을 확인하고 싶어요" },
      ],
    },
    {
      label: "부동산, 차량 등 자산 변동이 있어요",
      children: [
        { label: "부동산을 매도했어요" },
        { label: "부동산을 매수했어요" },
        { label: "차량을 매도/구매했어요" },
        { label: "큰 금액을 증여/상속했어요" },
      ],
    },
    {
      label: "전체 상태를 검토하고 싶어요",
      children: [
        { label: "전체 자산과 건강 대비를 다시 봐주세요" },
        { label: "노후 현금흐름을 점검해주세요" },
        { label: "투자 성향을 바꾸고 싶어요" },
      ],
    },
  ];
  if (path.length === 0) return root;
  return root.find((item) => item.label === path[0])?.children ?? root;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-7 overflow-hidden rounded-full bg-[#E8EBF2]">
      <div
        className="flex h-full items-center justify-end rounded-full bg-[#54C7BD] pr-3 text-sm font-extrabold text-white"
        style={{ width: `${clamp(value, 3, 100)}%` }}
      >
        {Math.round(value)}%
      </div>
    </div>
  );
}

function DonutGauge({ label, value, center }: { label: string; value: number; center: string }) {
  const color = value >= 100 ? "#0A31A8" : value >= 65 ? "#598AFF" : "#F4CE54";
  return (
    <div className="text-center">
      <div
        className="mx-auto grid h-32 w-32 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${clamp(value, 0, 100)}%, #EEF0F5 0)` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-2xl font-extrabold text-[#333]">
          {center}
        </div>
      </div>
      <p className="mt-2 text-sm font-extrabold text-[#555]">{label}</p>
    </div>
  );
}

function BarCompare({ label, value, max }: { label: string; value: number; max: number }) {
  const width = `${clamp((value / Math.max(max, 1)) * 100, 3, 100)}%`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm font-bold">
        <span className="text-[#555]">{label}</span>
        <span className="text-[#333]">{formatKrw(value)}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-[#EEF0F5]">
        <div className="h-full rounded-full bg-[#598AFF]" style={{ width }} />
      </div>
    </div>
  );
}

function HeroMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F6F7FB] p-3 text-center">
      <div className="text-xs font-bold text-[#888]">{label}</div>
      <div className="mt-1 text-base font-extrabold text-[#0A31A8]">{value}</div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="text-base font-extrabold text-[#333]">{title}</h2>;
}

function DetailButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full bg-[#F0F4FF] px-3 py-1 text-xs font-bold text-[#0A31A8]">
      자세히 보기
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex justify-between gap-3 first:mt-0">
      <span className="font-semibold text-[#666]">{label}</span>
      <b className="text-right text-[#333]">{value}</b>
    </div>
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

function FullRecordSection({ title, items }: { title: string; items: unknown[] }) {
  return (
    <section>
      <SectionTitle title={title} />
      <div className="mt-3 space-y-2">
        {items.length === 0 && <p className="rounded-xl bg-white p-4 text-sm text-[#888]">저장된 기록이 없습니다.</p>}
        {items.map((item, index) => (
          <pre key={index} className="max-h-80 overflow-auto rounded-xl bg-white p-3 text-xs leading-relaxed text-[#444] shadow-sm">
            {JSON.stringify(item, null, 2)}
          </pre>
        ))}
      </div>
    </section>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-[#EDF0F5] px-4 py-3 text-left font-bold text-[#555]">
      {children}
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
      ? "bg-[#EAF0FF] text-[#0A31A8]"
      : tone === "danger"
        ? "border border-[#E5E5E5] bg-white text-[#777]"
        : "bg-[#F0F4FF] text-[#1C56FF]";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-xl py-3 font-bold disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

function Badge({ external }: { external: boolean }) {
  return external ? (
    <span className="shrink-0 rounded-full bg-[#EAF0FF] px-2 py-1 text-xs font-bold text-[#0A31A8]">승인 필요</span>
  ) : (
    <span className="shrink-0 rounded-full bg-[#E5E5E5] px-2 py-1 text-xs font-bold text-[#666]">자동 처리</span>
  );
}

function StatusText({ status, external }: { status: string; external: boolean }) {
  if (external && status === "executed") return <span className="font-bold text-[#0A31A8]">승인 완료</span>;
  const statusLabel: Record<string, string> = {
    proposed: external ? "승인 필요" : "검토 중",
    executed: "완료",
    approved: "승인됨",
    rejected: "거절됨",
    deferred: "수정 요청",
    failed: "실패",
  };
  return <span>{statusLabel[status] ?? status}</span>;
}

function progressInfo(
  session: api.Session | undefined,
  proposals: api.Proposal[],
  hasCustomerRequest: boolean,
): ProgressInfo | null {
  const activeStep = customerStep(session, proposals);
  const pending = session?.proposals?.find((proposal) => proposal.has_external_effect && proposal.status === "proposed");
  if (pending) {
    const label = detectedLabel(session);
    return {
      activeStep,
      title: `${label}가 감지되었어요`,
      subtitle: "고객님 선택이 필요한 제안이 준비됐어요. 아래 도우미 제안에서 확인할 수 있습니다.",
    };
  }
  const hasExecuted = proposals.some((proposal) => proposal.status === "executed" || proposal.status === "approved");
  if (hasExecuted) {
    return {
      activeStep,
      title: "반영을 마쳤어요",
      subtitle: "승인한 내용을 기록하고 다음 변화를 기다리고 있어요.",
    };
  }
  if (hasExternalWorkflowEvent(session)) {
    const label = detectedLabel(session);
    return {
      activeStep,
      title: `${label}가 감지되었어요`,
      subtitle: "JB도우미가 고객님의 최근 변화와 자산 상태를 함께 확인하고 있어요.",
    };
  }
  if (!hasCustomerRequest) return null;
  return {
    activeStep,
    title: activeStep === 0 ? "살펴보고 있어요" : activeStep === 1 ? "확인이 필요해요" : "반영을 마쳤어요",
    subtitle:
      activeStep === 0
        ? "고객님의 요청과 자산 상태를 함께 확인하고 있어요."
        : activeStep === 1
          ? "고객님 선택이 필요한 제안이 준비됐어요."
          : "승인한 내용을 기록하고 다음 변화를 기다리고 있어요.",
  };
}

function hasExternalWorkflowEvent(session: api.Session | undefined): boolean {
  return (session?.events ?? []).some((event) =>
    ["agent_job", "need_assessment", "plan", "policy"].includes(event.type),
  );
}

function detectedLabel(session: api.Session | undefined): string {
  const latestEvent = [...(session?.events ?? [])].reverse().find((event) =>
    ["agent_job", "need_assessment", "plan", "policy", "graph_state", "state_transition"].includes(event.type),
  );
  const latestProposal = [...(session?.proposals ?? [])].reverse()[0];
  const raw = String(
    asRecord(latestEvent?.detail.signal)?.kind ??
      latestEvent?.detail.kind ??
      latestEvent?.detail.signal_kind ??
      latestEvent?.detail.primary_need ??
      latestProposal?.kind ??
      latestEvent?.type ??
      "state_transition",
  );
  const labels: Record<string, string> = {
    portfolio_loss: "투자 손실",
    bp_rising: "건강 변화",
    insurance_gap: "보험 보장 공백",
    cashflow: "현금흐름 변화",
    investment_adjust: "투자 조정 필요",
    medical_cost: "의료비 부담",
    rebalance_portfolio: "투자 조정 필요",
    review_insurance: "보험 점검 필요",
    cashflow_plan: "현금흐름 점검 필요",
    report: "상태 변화",
    notify: "확인 필요 사항",
    need_assessment: "상태 변화",
    agent_job: "상태 변화",
    plan: "제안 필요",
    policy: "확인 필요 사항",
    graph_state: "상태 변화",
    state_transition: "상태 변화",
  };
  return labels[raw] ?? "상태 변화";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function customerStep(session: api.Session | undefined, proposals: api.Proposal[]): number {
  const hasPendingApproval = proposals.some((proposal) => proposal.has_external_effect && proposal.status === "proposed");
  const hasExecuted = proposals.some((proposal) => proposal.status === "executed" || proposal.status === "approved");
  if (hasPendingApproval || session?.state === "UserApproval") return 1;
  if (hasExecuted || (proposals.length > 0 && !hasPendingApproval && session?.state === "Monitoring")) return 2;
  return 0;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-[#666]">{children}</div>;
}

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    rebalance_portfolio: "투자 조정",
    cashflow_plan: "현금흐름",
    review_insurance: "보험 점검",
    report: "보고서",
    notify: "알림",
  };
  return labels[kind] ?? kind;
}

function formatKrw(value: number): string {
  if (!Number.isFinite(value)) return "0원";
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000)}억원`;
  if (value >= 10_000) return `${Math.round(value / 10_000)}만원`;
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
