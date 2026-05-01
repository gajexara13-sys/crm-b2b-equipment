from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, clients, requests, samples, tests, protocols

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Lab CRM - ДСИЛ Башстройинвест", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(clients.router,   prefix="/api/clients",   tags=["clients"])
app.include_router(requests.router,  prefix="/api/requests",  tags=["requests"])
app.include_router(samples.router,   prefix="/api/samples",   tags=["samples"])
app.include_router(tests.router,     prefix="/api/tests",     tags=["tests"])
app.include_router(protocols.router, prefix="/api/protocols", tags=["protocols"])

@app.get("/api/health")
def health(): return {"status": "ok", "service": "Lab CRM"}
