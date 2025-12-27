# Backend (FastAPI) - Money Calendar

빠른 실행(추천: 프로젝트 루트에서):

1. 가상환경 및 설치 (한 번만)
   cd backend
   ./setup.sh
   # 또는
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

2. 프로젝트 루트에서 서버 실행 (권장 — 엔트리포인트 충돌 방지):
   cd /workspaces/money_calendar_UI
   uvicorn asgi:app --reload --host 0.0.0.0 --port 8000

   (대안 — backend 디렉터리에서 직접 실행 가능)
   cd backend
   uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

3. Swagger UI:
   "$BROWSER" http://localhost:8000/docs

문제 발생 시:
- 위 명령을 실행하는 현재 작업 디렉터리와 PYTHONPATH(가상환경 활성화 여부)를 확인하세요.
- 여전히 같은 오류가 뜨면 실행한 정확한 uvicorn 명령과 현재 디렉터리 경로를 알려주시면 추가로 진단해 드립니다.
