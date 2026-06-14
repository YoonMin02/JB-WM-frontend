# JB든든 AI매니저 Frontend

JB든든 AI매니저 Frontend는 고객이 로그인해서 자신의 건강/자산 대비 상태를 보고, JB든든
채팅 선택지 또는 자유 입력으로 workflow를 시작하고, 승인 필요한 제안을 승인/거절/수정하는
React 고객 화면이다.

프론트는 비즈니스 판단이나 실행 권한을 갖지 않는다. 백엔드 상태를 렌더링하고,
사용자 선택을 `/workflow-sessions/{thread_id}/messages`로 전달하며, 승인 결정은
`/workflow-sessions/{thread_id}/decisions`로 보낸다.

## 실행

백엔드를 먼저 로컬에서 띄운다.

```bash
cd /home/tomasyms/JB-WM/JB-WM-backend
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

프론트 실행:

```bash
cd /home/tomasyms/JB-WM/JB-WM-frontend-v2
pnpm install
pnpm dev
```

브라우저:

```text
http://127.0.0.1:5173
```

API 주소는 `.env`의 `VITE_API_BASE_URL`이 우선이다.

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`src/api.ts`는 하위 호환으로 `VITE_API_BASE`도 읽지만, 현재 기준 env 이름은
`VITE_API_BASE_URL`이다.

## 로그인과 세션

현재 고객 화면은 고객 계정 로그인을 전제로 한다.

```text
customer01@jbwm.local / customer1234
customer02@jbwm.local / customer1234
...
```

로그인 성공 시 localStorage에 다음 값을 저장한다.

```text
jbwm_access_token
jbwm_customer_id
jbwm_session_id
```

`jbwm_session_id`는 백엔드의 `AgentThread.graph_thread_id`다. Codex CLI 세션 id가
아니며, 같은 고객의 active workflow thread를 조회하기 위한 opaque id다.

로그아웃은 localStorage 값을 지우고 `/login`으로 이동한다.

## 주요 라우트

| Route | 역할 |
|---|---|
| `/login` | 고객 계정 로그인 |
| `/main` | 종합 대비 상태, JB든든 채팅, 진행 상태, 제안/기록 요약 |
| `/readiness` | 자산, 현금유동성, 의료비, 보험, 악화 시 부담 상세 |
| `/approvals` | 승인 필요한 proposal을 크게 보고 승인/거절/나중에 선택 |
| `/records` | 저장된 대화, 판단, 계획 기록 전체 보기 |

루트(`/`)와 알 수 없는 경로는 `/main`으로 보낸다. 로그인되지 않은 상태에서는
`/login`으로 이동한다.

## 채팅 선택지와 Signal Kind

JB든든 선택지는 단계형 트리다. 사용자가 마지막 선택지를 누르면 프론트는 화면에
보이는 선택 경로와 함께 `kind`, `choice_path`를 백엔드로 보낸다.

```json
{
  "text": "금융 변동 사항이 있어요 > 투자 손실이 걱정돼요 > 최근 투자 손실이 커졌어요",
  "kind": "portfolio_loss",
  "choice_path": [
    "금융 변동 사항이 있어요",
    "투자 손실이 걱정돼요",
    "최근 투자 손실이 커졌어요"
  ]
}
```

이 `kind`는 LLM이 추론하는 값이 아니다. 프론트 선택지에 하드 매핑된 입력 분류값이고,
백엔드 `SignalDetect`는 이 값을 signal kind로 사용한다. 자유 입력처럼 kind가 없는
메시지는 백엔드에서 `routine_check`로 처리된다.

현재 선택지에서 보내는 signal kind:

```text
health_deterioration
medical_spending_spike
income_drop
spending_spike
repayment_pressure
portfolio_loss
upcoming_card_payment_pressure
insurance_policy_change
insurance_gap
non_financial_asset_change
routine_check
preference_update
```

치매/인지저하 진단 선택지는 `health_deterioration`으로 들어간다. 앱이 치매를 추론하거나
진단하는 구조가 아니라, 고객이 선택한 건강 상태 변화 이벤트를 재무/보험/현금흐름
준비 관점에서 검토하도록 signal을 보내는 구조다.

## 승인 흐름

백엔드 proposal에는 별도의 proposal kind가 있다.

```text
book_hospital
review_insurance
cashflow_plan
rebalance_portfolio
notify
report
```

signal kind와 proposal kind는 다르다. 예를 들어 사용자가 `portfolio_loss` 선택지를
눌러도 Codex CLI가 만든 proposal은 `report`, `cashflow_plan`, `rebalance_portfolio`
등이 될 수 있다.

승인 필요한 proposal은 두 곳에 표시된다.

- 채팅창 안의 승인 bubble
- `/approvals` 페이지

현재 프론트의 채팅 bubble은 `has_external_effect && status === "proposed"`인 proposal을
승인 대상으로 보여준다. 백엔드 세션 상태가 `UserApproval`이면 `allowed_actions`는
`approve`, `reject`, `revise`다.

주의할 점:

- `notify`가 `has_external_effect=false`로 오면 현재 백엔드 정책상 자동 실행될 수 있다.
- 담당자/보호자/외부 채널 알림을 무조건 승인 대상으로 만들려면 백엔드 정책 확장이 필요하다.

## Polling과 네트워크 요청

현재 화면은 TanStack Query polling으로 백엔드 상태를 갱신한다.

```text
POST /customers/{customer_id}/workflow-sessions  every 2.5s
GET  /workflow-sessions/{thread_id}              every 2.5s
records 조회                                    every 3.5s
```

그래서 DevTools Network에 몇 초마다 요청이 보이는 것은 정상이다. 문제로 봐야 하는 것은
요청 자체가 아니라 다음 상황이다.

- 같은 고객인데 계속 다른 `thread_id`가 생김
- `GET /workflow-sessions/{thread_id}`가 반복적으로 404
- 로그인 고객과 다른 customer id의 데이터가 보임

## 데이터 조회

메인/상세 화면은 다음 백엔드 API를 조회한다.

```text
GET /customers
GET /customers/{customer_id}/portfolio
GET /customers/{customer_id}/insurance
GET /customers/{customer_id}/memory
GET /customers/{customer_id}/health
GET /customers/{customer_id}/accounts
GET /customers/{customer_id}/transactions
GET /customers/{customer_id}/card-bills
GET /customers/{customer_id}/loans
GET /customers/{customer_id}/loan-switch-precheck
GET /customers/{customer_id}/detail-snapshot
```

프론트의 대비 점수는 고객 이해를 돕는 표시용 계산이다. 최종 agent 판단과 제안은
백엔드 workflow의 `NeedAssessment`, `Plan`, `ActionProposal` 결과를 따른다.

## Push/PWA 상태

프론트에는 service worker 등록과 Web Push 구독 시도 코드가 있다.

현재 백엔드 구현은 subscription 등록/조회/해제 API까지만 있다.

```text
POST   /push-subscriptions
GET    /push-subscriptions
DELETE /push-subscriptions/{subscription_id}
```

반면 프론트는 `GET /push-subscriptions/public-key`, `POST /push-subscriptions/test`도
호출한다. 이 두 endpoint와 실제 VAPID 발송 로직은 아직 백엔드에 없다. 따라서 현재
Push는 완성 기능이 아니라 추가 구현이 필요한 영역이다.

## 기술 스택

| 영역 | 현재 코드 |
|---|---|
| Framework | React 19 + TypeScript |
| Bundler | Vite |
| Routing | React Router |
| Server state | TanStack Query |
| Styling | Tailwind CSS |
| Package manager | pnpm |
| i18n | `src/i18n.ts`의 최소 dict |

아래는 현재 `package.json`에 없는 계획성 의존성이다.

```text
Zustand
shadcn/ui
React Hook Form / Zod
TanStack Table
Recharts
react-i18next
```

## 개발 명령

```bash
pnpm dev
pnpm build
pnpm exec tsc -b --pretty false
pnpm preview
```

## 구현 위치

```text
src/App.tsx
  라우팅, 로그인, 화면 구성, polling, 챗봇 선택지, 승인 bubble.

src/api.ts
  백엔드 API client와 타입.

src/push.ts
  service worker / Web Push 구독 시도.

src/i18n.ts
  최소 번역 dict.

src/index.css
  Tailwind와 전역 스타일.
```
