from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from routes.api import router, limiter
from database import client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI-Assisted Emergency Triage System")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Triage AI System"}

@app.on_event("startup")
def startup():
    try:
        client.admin.command('ping')
        logger.info("✓ MongoDB connected successfully")
    except Exception as e:
        logger.error(f"✗ MongoDB connection failed: {e}")

@app.on_event("shutdown")
def shutdown():
    client.close()
