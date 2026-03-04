from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OAInfo(BaseModel):
    status: str = Field(description="open | closed | unknown")
    pdf_url: str | None = None
    evidence_url: str | None = None
    source: str | None = None


class Paper(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    venue: str | None = None
    abstract: str | None = None
    doi: str | None = None
    pmid: str | None = None
    source_urls: list[str] = Field(default_factory=list)
    citations: int | None = None
    oa: OAInfo


class SearchRequest(BaseModel):
    query: str
    year_from: int | None = None
    year_to: int | None = None
    top_k: int = 10
    sources: list[str] = Field(default_factory=lambda: ["pubmed", "crossref"])


class SearchResponse(BaseModel):
    session_id: str
    papers: list[Paper]


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    assistant_message: str
    filters: dict[str, Any]
    papers: list[Paper]
    actions: list[str]


class BundleRequest(BaseModel):
    session_id: str
    paper_ids: list[str] = Field(default_factory=list)


class BundleResponse(BaseModel):
    bundle_id: str
    download_url: str
    included_count: int
    skipped_count: int
