# Backend (FastAPI) - Money Calendar

Money Calendar 백엔드 API 서버입니다.

## 1. 실행 방법

### 1.1 로컬 실행

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

또는 프로젝트 루트에서:

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI
uvicorn backend.asgi:app --reload --host 0.0.0.0 --port 8000
```

- Swagger UI: `http://localhost:8000/docs`
- Health Check: `GET http://localhost:8000/health`

### 1.2 의존성

- `fastapi`
- `uvicorn[standard]`
- `sqlmodel`
- `python-multipart`
- `aiofiles`

## 2. API 목록 및 간단 호출 예시

기본 URL: `http://localhost:8000`

### 2.1 거래(Transactions)

- `GET /api/transactions`
  - 쿼리: `start`, `end`(YYYY-MM-DD), `type`, `search`, `page`, `per_page`
  - 응답: `{ items, total, page, per_page }`

```bash
curl "http://localhost:8000/api/transactions?start=2026-01-01&end=2026-01-31&page=1&per_page=100"
```

- `POST /api/transactions` (배열 입력 권장)
  - 요청: 거래 객체 배열

```bash
curl -X POST "http://localhost:8000/api/transactions" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "date":"2026-02-01",
      "type":"수입",
      "major_category":"월급",
      "sub_category":"본봉",
      "amount":3000000,
      "description":"2월 급여"
    }
  ]'
```

- `GET /api/transactions/{txn_id}`
- `PUT /api/transactions/{txn_id}`
- `PATCH /api/transactions/{txn_id}`
- `DELETE /api/transactions/{txn_id}`

### 2.2 요약/일별/캘린더

- `GET /api/summary?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/daily?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/calendar?year=2026&month=2`

```bash
curl "http://localhost:8000/api/summary?start=2026-02-01&end=2026-02-28"
```

### 2.3 내보내기/카테고리

- `GET /api/transactions/export?kind=summary|transactions&start=...&end=...`
- `GET /api/categories`

```bash
curl -L "http://localhost:8000/api/transactions/export?kind=transactions&start=2026-02-01&end=2026-02-28" -o export.csv
```

### 2.4 고정지출(Fixed Expenses)

- `GET /api/fixed_expenses`
- `POST /api/fixed_expenses`
- `PATCH /api/fixed_expenses/{fe_id}`
- `DELETE /api/fixed_expenses/{fe_id}`

```bash
curl -X POST "http://localhost:8000/api/fixed_expenses" \
  -H "Content-Type: application/json" \
  -d '{
    "major_category":"주거",
    "sub_category":"월세",
    "description":"오피스텔",
    "amount":650000,
    "start_date":"2026-01-01",
    "end_date":"2026-12-31",
    "day_of_month":5
  }'
```

### 2.5 저축(Savings)

- `GET /api/savings`
- `POST /api/savings`
- `PATCH /api/savings/{sid}`
- `DELETE /api/savings/{sid}`
- `GET /api/savings/forecast?date=YYYY-MM-DD`

```bash
curl -X POST "http://localhost:8000/api/savings" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"비상금",
    "kind":"적금",
    "initial_balance":1000000,
    "contribution_amount":300000,
    "start_date":"2026-01-01",
    "day_of_month":25,
    "frequency":"monthly"
  }'
```

### 2.6 설정(Settings)

- `GET /api/settings/categories`
- `POST /api/settings/categories` (`{ majors: string[], subs: string[] }`)

```bash
curl -X POST "http://localhost:8000/api/settings/categories" \
  -H "Content-Type: application/json" \
  -d '{"majors":["식비","교통","주거"],"subs":["점심","버스","월세"]}'
```

## 3. 코드 파일별 목적

### 3.1 진입점/설정

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/asgi.py`
  - 루트에서 `backend.asgi:app`로 서버를 띄울 수 있게 `backend.app.main`의 `app`을 노출
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/asgi.py`
  - 최상위 경로에서 동일하게 `backend.app.main:app` 접근용 브리지
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/requirements.txt`
  - 백엔드 패키지 의존성 정의

### 3.2 API/비즈니스 로직

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/main.py`
  - FastAPI 라우팅 전체 정의
  - 거래/요약/일별/캘린더/CSV export/고정지출/저축/설정 카테고리 API 제공
  - 서버 시작 시 DB 테이블/컬럼/인덱스 보정 호출
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/crud.py`
  - 트랜잭션, 고정지출, 저축, 설정 카테고리 CRUD 처리
  - 타입/날짜/금액 정규화, 요약/검색/페이징, 저축 예측 계산 담당

### 3.3 데이터 모델/DB

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/models_core.py`
  - SQLModel 모델(`Transaction`, `FixedExpense`, `Saving`, `CategoryMajor`, `CategorySub`)
  - SQLite 엔진 생성, 데이터 디렉터리 보장, 스키마 보정(누락 컬럼/인덱스 생성)
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/models.py`
  - `models_core`의 모델/엔진 생성 함수를 재노출하는 호환 레이어
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/models/transaction.py`
  - SQLAlchemy(declarative) 기반 구모델 정의(호환/참고용 코드)
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/alembic/versions/0001_add_direction_column.py`
  - `transaction.direction` 컬럼 추가 및 기존 `type` 값 복사 마이그레이션
- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/alembic/versions/0002_create_indexes.py`
  - `transaction` 날짜/방향/대분류 인덱스 생성 마이그레이션

### 3.4 유틸리티

- `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/app/utils/csv_parser.py`
  - CSV 문자열을 거래 dict 리스트로 변환하는 파서(날짜/금액 파싱, 카테고리 보정)

## 4. 참고

- 데이터 파일은 기본적으로 `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/data/app.db`를 사용합니다.
- 프론트엔드 개발 서버는 `/api` 요청을 `http://localhost:8000`으로 프록시합니다.
