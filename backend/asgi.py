from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pathlib import Path
import csv

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

app = FastAPI(title="Money Calendar CSV API")

# Allow requests from dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발환경: 필요시 도메인으로 제한하세요
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def list_csv_files() -> List[Path]:
    if not DATA_DIR.exists():
        return []
    return sorted([p for p in DATA_DIR.iterdir() if p.is_file() and p.suffix.lower() == ".csv"])

def read_csv(path: Path) -> List[dict]:
    if not path.exists():
        raise FileNotFoundError()
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        return [dict(row) for row in reader]

@app.get("/api/files")
def api_files():
    files = [p.name for p in list_csv_files()]
    return JSONResponse(files)

@app.get("/api/files/{name}")
def api_file(name: str):
    if not name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="only .csv files allowed")
    target = DATA_DIR / name
    # path traversal protection
    try:
        resolved = target.resolve(strict=False)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid path")
    if not str(resolved).startswith(str(DATA_DIR.resolve())):
        raise HTTPException(status_code=400, detail="invalid path")
    try:
        data = read_csv(resolved)
        return JSONResponse(data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transactions")
def api_transactions():
    # Prefer transactions.csv -> sample_transactions.csv -> first CSV
    preferred = ["transactions.csv", "sample_transactions.csv"]
    files = list_csv_files()
    if not files:
        return JSONResponse([])  # 빈 배열로 응답 (프론트가 처리)
    chosen = None
    for name in preferred:
        if (DATA_DIR / name).exists():
            chosen = DATA_DIR / name
            break
    if chosen is None:
        chosen = files[0]
    try:
        data = read_csv(chosen)
        return JSONResponse(data)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
