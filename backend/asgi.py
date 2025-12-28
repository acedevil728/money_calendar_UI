from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Money Calendar - Minimal API")

# Keep permissive CORS for dev; tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# Note: CSV listing/serving endpoints were removed. Use /api/transactions and DB endpoints from backend.app.main.
