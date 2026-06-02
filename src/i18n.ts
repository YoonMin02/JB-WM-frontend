// 최소 i18n — ko 우선. en은 dict만 추가하면 동작 (구조만 대비).
const ko = {
  app_title: "JB WM",
  app_subtitle: "건강·자산을 함께 돌보는 도우미",
  resilience: "회복탄력성 상태",
  health_risk: "건강",
  cashflow_risk: "현금흐름",
  insurance_gap: "보험 보장",
  investment_risk: "투자 위험도",
  need_assessment: "통합 필요도",
  financial_context: "금융 컨텍스트",
  available_cash: "출금가능 현금",
  monthly_outflow: "월 지출",
  card_due: "카드 결제",
  loan_due: "대출 상환",
  medical_spending: "최근 의료비",
  record_count: "거래 기록",
  loan_switch: "대출이동 사전조회",
  records: "저장된 판단 기록",
  messages: "전문",
  assessments: "평가",
  plans: "계획",
  last_assessment: "최근 필요도 평가",
  last_plan: "최근 계획",
  transcript: "최근 전문",
  simulate: "상황 시뮬레이션",
  sim_portfolio_loss: "투자 손실 발생",
  sim_health: "건강 이벤트 감지",
  sim_utterance: "\"투자는 보수적으로\"",
  recommended: "에이전트 제안",
  approve: "승인",
  reject: "거절",
  revise: "수정 요청",
  pending: "확인이 필요해요",
  no_pending: "지금은 확인할 항목이 없어요",
  timeline: "진행 내역",
  state: "현재 단계",
  reset: "새로 시작",
  external_badge: "승인 필요",
  auto_badge: "자동 처리",
  loading: "불러오는 중…",
  customer: "고객",
  processing: "에이전트가 분석 중이에요…",
} as const;

type Key = keyof typeof ko;
const dict: Record<string, Record<Key, string>> = { ko };
let locale = "ko";

export function t(key: Key): string {
  return dict[locale]?.[key] ?? key;
}
export function setLocale(l: string) {
  locale = l;
}
