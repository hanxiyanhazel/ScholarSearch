from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.models import BundleRequest, BundleResponse, ChatRequest, ChatResponse, SearchRequest, SearchResponse
from app.services.bundle import BUNDLE_DIR, build_bundle
from app.services.chat import run_chat_filter
from app.services.literature import search_literature
from app.services.session_store import store

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/search", response_model=SearchResponse)
async def api_search(payload: SearchRequest) -> SearchResponse:
    papers = await search_literature(
        query=payload.query,
        year_from=payload.year_from,
        year_to=payload.year_to,
        top_k=payload.top_k,
        sources=payload.sources,
    )
    session_id = str(uuid.uuid4())
    store.create(session_id, papers)
    return SearchResponse(session_id=session_id, papers=papers)


@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(payload: ChatRequest) -> ChatResponse:
    session = store.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session_id not found")

    assistant_message, filters, papers, actions = run_chat_filter(payload.message, session.papers)
    return ChatResponse(assistant_message=assistant_message, filters=filters, papers=papers, actions=actions)


@app.post("/api/bundle", response_model=BundleResponse)
async def api_bundle(payload: BundleRequest) -> BundleResponse:
    session = store.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session_id not found")

    selected = [p for p in session.papers if p.id in set(payload.paper_ids)]
    bundle_id, included_count, skipped_count = build_bundle(selected)
    return BundleResponse(
        bundle_id=bundle_id,
        download_url=f"/api/bundle/{bundle_id}/download",
        included_count=included_count,
        skipped_count=skipped_count,
    )


@app.get("/api/bundle/{bundle_id}/download")
async def download_bundle(bundle_id: str) -> FileResponse:
    zip_path = BUNDLE_DIR / f"{bundle_id}.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="bundle not found")
    return FileResponse(path=zip_path, filename=f"papers-{bundle_id}.zip", media_type="application/zip")
