from fastapi import FastAPI
from dotenv import load_dotenv
from backend.routers import status, settings, admin
from backend.auth import router as auth_router


load_dotenv()

app = FastAPI()
app.include_router(status.router)
app.include_router(settings.router)
app.include_router(auth_router.router)
app.include_router(admin.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}

