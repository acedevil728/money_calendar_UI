# Backend Unit Test Guide

이 문서는 `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/test` 내 단위 테스트 실행 방법과 테스트 케이스 설명을 정리합니다.

## 1. 실행 방법

프로젝트 기준 경로:

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/backend
```

전체 테스트 실행:

```bash
./venv/bin/python -m unittest discover -s test -p 'test_*.py'
```

개별 파일 실행 예시:

```bash
./venv/bin/python -m unittest test.test_transactions
./venv/bin/python -m unittest test.test_fixed_expenses
./venv/bin/python -m unittest test.test_savings_and_settings
./venv/bin/python -m unittest test.test_csv_parser
./venv/bin/python -m unittest test.test_models_exports
```

## 2. Coverage 측정 방법

권장(coverage.py가 설치된 경우):

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/backend
./venv/bin/python -m coverage run -m unittest discover -s test -p 'test_*.py'
./venv/bin/python -m coverage report -m
```

HTML 리포트 생성:

```bash
./venv/bin/python -m coverage html
```

- 결과 파일: `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/htmlcov/index.html`

참고: 현재 가상환경에 `coverage`가 없다면 설치 후 실행해야 합니다.

```bash
./venv/bin/pip install coverage
```

## 3. 테스트 코드별 내용

### 3.1 `test/test_transactions.py`

- `test_normalize_transaction_dict_maps_type_and_parses_fields`
  - `type -> direction` 매핑, 날짜/금액 파싱, 필드 정규화 확인
- `test_normalize_transaction_dict_raises_for_invalid_date`
  - 비정상 날짜 문자열 입력 시 예외 발생 확인
- `test_transactions_crud_and_query_filters`
  - 거래 생성/조회 필터/수정/삭제 흐름 검증
  - `tx_type`, `search`, 기간 필터와 업데이트 반영 확인
- `test_get_categories_returns_major_sub_map`
  - 거래 데이터 기반 대분류/소분류 집계 결과 검증

### 3.2 `test/test_fixed_expenses.py`

- `test_create_fixed_expense_generates_monthly_transactions`
  - 고정지출 생성 시 월별 거래가 자동 생성되는지 검증
  - 말일 보정(예: 2월 28일) 케이스 포함
- `test_update_fixed_expense_regenerates_transactions`
  - 고정지출 수정 시 기존 생성 거래 삭제 후 재생성되는지 검증
- `test_delete_fixed_expense_removes_generated_transactions`
  - 고정지출 삭제 시 연결 거래(`raw_source=fixed:{id}`)도 함께 삭제되는지 검증

### 3.3 `test/test_savings_and_settings.py`

- `test_create_saving_requires_kind`
  - 저축 생성 시 필수값(`kind`) 검증
- `test_forecast_savings_monthly_and_withdrawn_cases`
  - 월 적립 예측 계산과 `withdrawn=True` 계좌 처리(예측 0) 검증
- `test_forecast_respects_end_date`
  - 저축 종료일 이후 적립이 계산에서 제외되는지 검증
- `test_setting_categories_replace_and_get_sorted_unique`
  - 설정 카테고리 저장 시 중복 제거/정렬 및 재저장 시 치환 동작 검증

### 3.4 `test/test_csv_parser.py`

- `test_parse_csv_transactions_parses_required_and_optional_fields`
  - CSV 파싱(콤마 포함 금액, category 분해, 선택 필드 처리) 검증
- `test_parse_csv_transactions_raises_when_required_field_missing`
  - 필수 컬럼 값 누락 시 예외 발생 검증

### 3.5 `test/test_models_exports.py`

- `test_models_module_reexports_models_core_symbols`
  - `app.models`가 `app.models_core`의 엔진/모델/초기화 함수를 동일 객체로 재노출하는지 검증
