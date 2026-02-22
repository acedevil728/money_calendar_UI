# Money Calendar UI

가계부 관리용 웹 애플리케이션입니다.

- `backend`: Python + FastAPI + SQLModel 기반 API 서버
- `frontend`: TypeScript + React + Vite 기반 웹 UI

## 1. 사용자 관점 주요 기능

- 거래(수입/지출) 다건 입력 및 저장
- 기간(시작일/종료일) 조회, 월 단위 기본 조회, 최대 1년 조회 제한
- 요약 탭: 수입/지출 > 대분류/소분류 합계 표시
- 캘린더 탭: 일자별 수입/지출 배지 및 선택 날짜 상세 내역
- 일별 탭: 날짜별 거래 목록/합계 확인 및 개별 삭제
- 고정지출 탭: 월 반복 지출 정의, 수정/삭제 (연동 거래 자동 생성/재생성)
- 저축 탭: 저축 항목 관리 및 기준일 예측 잔액 조회
- 설정 탭: 대분류/소분류 목록 관리 (입력 검증에 사용)
- CSV 내보내기: 요약 CSV, 일별 CSV, 저축 CSV

## 2. 버전별 업데이트 (git 이력 기준)

아래 내용은 `git log` 커밋 메시지 기준입니다.  
메시지에서 확인 불가능한 세부 사항은 공란으로 두었습니다.

| 버전/태그(커밋 메시지) | 날짜 | 커밋 | 변경 요약 | 세부 변경사항(확인 불가 시 공란) |
|---|---|---|---|---|
| Initial commit | 2025-12-27 | `4a77510` | 초기 커밋 | |
| V0.1 - 단순 파일 기반 UI화면 | 2025-12-27 | `5a95b31` | 파일 기반 UI 화면 추가 | |
| V0.2 - 수입/지출 내역 추가 및 제거 기능 추가, 불필요 기능 제거 | 2025-12-28 | `6e0500a` | 거래 추가/삭제 기능, 불필요 기능 제거 | |
| V0.3.b - 고정지출, 저축 추가 (UI 수정 필요) | 2026-01-04 | `64c825a` | 고정지출/저축 기능 추가 | UI 수정 필요(메시지에 명시) |
| V0.3 - 버그 수정, 대분류/소분류 항목 리스트 고정 | 2026-01-04 | `9ed0e35` | 버그 수정, 카테고리 목록 고정 | |
| V1.0.b - 가계부 Web Page | 2026-01-04 | `44c6f97` | 웹 페이지 버전 반영 | |
| V1.0 가계부 기본 기능 구현 완료 (데이터 많을 시 안나오던 버그 수정) | 2026-01-05 | `76995bd` | 기본 기능 완료, 대용량 데이터 표시 버그 수정 | |
| [ignore] app.db | 2026-01-05 | `d61f109` | DB 파일 무시 관련 커밋 | |
| V1.1 데이터 중복 적재 버그 수정 | 2026-01-21 | `d513389` | 데이터 중복 적재 버그 수정 | |

## 3. 빠른 실행

### 3.1 Backend 실행

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3.2 Frontend 실행

```bash
cd /Users/bskoon/Documents/GitHub/money_calendar_UI/frontend
npm install
npm run dev
```

- 프론트 개발 서버: `http://localhost:5173`
- 백엔드 API: `http://localhost:8000`
- 프론트 Vite 프록시(`/api`)를 통해 백엔드로 전달됩니다.

## 4. 문서 안내

- 백엔드 상세: `/Users/bskoon/Documents/GitHub/money_calendar_UI/backend/README.md`
- 프론트엔드 상세: `/Users/bskoon/Documents/GitHub/money_calendar_UI/frontend/README.md`
