from fastapi import FastAPI
from dotenv import load_dotenv
from backend.routers import status, settings


load_dotenv()

app = FastAPI()
app.include_router(status.router)
app.include_router(settings.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

