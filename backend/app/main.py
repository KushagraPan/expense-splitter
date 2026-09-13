"""FastAPI Application Entrypoint for Expense Splitter."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import router as api_router
from app.config import settings
from app.database import SessionLocal, init_db
from app.repository import seed_initial_data_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Ensure database schema is created and seed data is populated on startup."""
    init_db()
    with SessionLocal() as db:
        seed_initial_data_if_empty(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Canonical REST API for Expense Splitter application.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for local React development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Format Pydantic schema validation errors into 400 Bad Request matching openapi.yaml."""
    errors = exc.errors()
    msg = errors[0].get("msg", "Validation error") if errors else "Validation error"
    return JSONResponse(
        status_code=400,
        content={"detail": msg},
    )


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint to verify server status."""
    return {"status": "ok", "version": settings.app_version}


@app.get("/", tags=["Health"])
async def root() -> dict[str, str]:
    """Root endpoint providing service information."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


# Mount canonical routes both under /api (OpenAPI servers url) and root /
app.include_router(api_router, prefix="/api")
app.include_router(api_router)
