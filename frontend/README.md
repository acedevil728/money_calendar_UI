# Frontend (React + TypeScript) - Money Calendar

Money Calendar의 웹 UI입니다.  
React + TypeScript + Vite로 구성되어 있으며 `/api` 요청은 개발 시 백엔드로 프록시됩니다.

## 1. 실행 방법

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/frontend
npm install
npm run dev
```

- 기본 주소: `http://localhost:5173`
- 개발 프록시: `/api` -> `http://localhost:8000`

### 빌드/미리보기

```bash
npm run build
npm run preview
```

## 2. 화면 기능 요약

- `Summary`: 수입/지출별 대분류/소분류 합계
- `Entries`: 다건 거래 입력 후 배치 저장(청크 업로드)
- `Calendar`: 월 달력에서 일자별 수입/지출 배지와 선택일 상세
- `Daily`: 날짜별 거래 리스트, 합계, 개별 삭제
- `Fixed Expenses`: 고정지출 생성/수정/삭제
- `Savings`: 저축 항목 생성/수정/삭제, CSV 내보내기, 예측 조회
- `Settings`: 대분류/소분류 목록 관리(입력 검증 기준 데이터)

## 3. 코드 파일별 목적

### 3.1 진입/설정

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/package.json`
  - npm 스크립트(`dev`, `build`, `preview`) 및 패키지 버전 정의
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/vite.config.ts`
  - Vite + React 플러그인 설정, 개발 서버 포트/호스트, `/api` 프록시 설정
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/tsconfig.json`
  - TypeScript 컴파일 옵션 설정
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/index.html`
  - 브라우저 루트 템플릿 (`#root`)

### 3.2 앱 루트

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/main.tsx`
  - React 루트 마운트, 전역 스타일 로드
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/App.tsx`
  - 탭 네비게이션/기간 필터/페이지네이션/CSV export
  - 거래 로딩/저장/삭제, 설정 카테고리 동기화, 각 View 컴포넌트 조합
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/styles.css`
  - 전체 레이아웃, 탭, 캘린더, 일별 목록, 폼 그리드 반응형 스타일
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/types.ts`
  - 거래/고정지출/저축/예측 등 타입 정의 및 금액 포맷 유틸

### 3.3 컴포넌트

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/SummaryView.tsx`
  - 거래 배열을 수입/지출 > 대분류 > 소분류로 집계해 렌더링
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/TransactionForm.tsx`
  - 다중 행 입력 UI, 카테고리 유효성 검사, 청크 단위 저장
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/CalendarView.tsx`
  - 월별 달력 렌더링, 날짜 클릭 시 상세 거래 표시
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/DailyView.tsx`
  - 날짜별 그룹화 리스트와 수입/지출 일합계 표시, 삭제 버튼 제공
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/FixedExpensesView.tsx`
  - 고정지출 CRUD 폼/목록 UI
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/SavingsView.tsx`
  - 저축 CRUD, CSV export, 기준일 예측(백엔드 forecast API 호출)
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/src/components/SettingsView.tsx`
  - 대분류/소분류 목록 편집 및 부모 컴포넌트 변경 전파

## 4. 백엔드 연동 API (프론트에서 직접 사용하는 경로)

- `GET /api/transactions`, `POST /api/transactions`, `DELETE /api/transactions/{id}`
- `GET /api/fixed_expenses`, `POST /api/fixed_expenses`, `PATCH /api/fixed_expenses/{id}`, `DELETE /api/fixed_expenses/{id}`
- `GET /api/savings`, `POST /api/savings`, `PATCH /api/savings/{id}`, `DELETE /api/savings/{id}`
- `GET /api/savings/forecast`
- `GET /api/settings/categories`, `POST /api/settings/categories`
