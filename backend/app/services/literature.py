from __future__ import annotations

import hashlib
from typing import Any

import httpx

from app.config import settings
from app.models import Paper
from app.services.oa import detect_oa_status


def _paper_id(seed: str) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]


async def search_literature(
    *,
    query: str,
    year_from: int | None,
    year_to: int | None,
    top_k: int,
    sources: list[str],
) -> list[Paper]:
    source_set = {s.lower() for s in sources}
    candidates: list[dict[str, Any]] = []

    if "pubmed" in source_set:
        candidates.extend(await _search_pubmed(query, year_from, year_to, top_k))

    if "crossref" in source_set:
        candidates.extend(await _search_crossref(query, year_from, year_to, top_k))

    dedup: dict[str, dict[str, Any]] = {}
    for item in candidates:
        key = (item.get("doi") or "").lower().strip() or (item.get("title") or "").lower().strip()
        if key and key not in dedup:
            dedup[key] = item

    papers: list[Paper] = []
    for item in list(dedup.values())[:top_k]:
        oa = await detect_oa_status(doi=item.get("doi"), pmcid=item.get("pmcid"), pmid=item.get("pmid"))
        paper = Paper(
            id=_paper_id(f"{item.get('doi') or item.get('title')}::{item.get('pmid') or ''}"),
            title=item.get("title") or "Untitled",
            authors=item.get("authors", []),
            year=item.get("year"),
            venue=item.get("venue"),
            abstract=item.get("abstract"),
            doi=item.get("doi"),
            pmid=item.get("pmid"),
            source_urls=item.get("source_urls", []),
            citations=item.get("citations"),
            oa=oa,
        )
        papers.append(paper)

    return papers


async def _search_pubmed(query: str, year_from: int | None, year_to: int | None, top_k: int) -> list[dict[str, Any]]:
    term = query
    if year_from:
        term += f" AND {year_from}:3000[pdat]"
    if year_to:
        term += f" AND 1000:{year_to}[pdat]"

    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    params = {"db": "pubmed", "term": term, "retmode": "json", "retmax": str(top_k)}

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            search_resp = await client.get(f"{base}/esearch.fcgi", params=params)
            search_resp.raise_for_status()
            ids = search_resp.json().get("esearchresult", {}).get("idlist", [])
            if not ids:
                return []

            summary_resp = await client.get(
                f"{base}/esummary.fcgi",
                params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"},
            )
            summary_resp.raise_for_status()
            summary = summary_resp.json().get("result", {})
    except httpx.HTTPError:
        return []

    results: list[dict[str, Any]] = []
    for pmid in ids:
        row = summary.get(pmid, {})
        title = row.get("title")
        if not title:
            continue
        article_ids = row.get("articleids", [])
        doi = next((a.get("value") for a in article_ids if a.get("idtype") == "doi"), None)
        pmc = next((a.get("value") for a in article_ids if a.get("idtype") == "pmc"), None)
        authors = [a.get("name") for a in row.get("authors", []) if a.get("name")]

        results.append(
            {
                "title": title,
                "authors": authors,
                "year": _extract_year(row.get("pubdate")),
                "venue": row.get("fulljournalname") or row.get("source"),
                "abstract": None,
                "doi": doi,
                "pmid": pmid,
                "pmcid": pmc,
                "source_urls": [f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"],
                "citations": None,
            }
        )

    return results


async def _search_crossref(query: str, year_from: int | None, year_to: int | None, top_k: int) -> list[dict[str, Any]]:
    params: dict[str, str | int] = {
        "query": query,
        "rows": top_k,
        "select": "DOI,title,author,issued,container-title,is-referenced-by-count,URL,abstract",
    }
    filter_parts: list[str] = []
    if year_from:
        filter_parts.append(f"from-pub-date:{year_from}")
    if year_to:
        filter_parts.append(f"until-pub-date:{year_to}")
    if filter_parts:
        params["filter"] = ",".join(filter_parts)

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            resp = await client.get("https://api.crossref.org/works", params=params)
            resp.raise_for_status()
            items = resp.json().get("message", {}).get("items", [])
    except httpx.HTTPError:
        return []

    results: list[dict[str, Any]] = []
    for row in items:
        title = (row.get("title") or [None])[0]
        doi = row.get("DOI")
        if not title or not doi:
            continue
        authors = []
        for a in row.get("author", []):
            given = a.get("given", "").strip()
            family = a.get("family", "").strip()
            full_name = " ".join(part for part in [given, family] if part)
            if full_name:
                authors.append(full_name)

        results.append(
            {
                "title": title,
                "authors": authors,
                "year": _extract_year_from_parts(row.get("issued", {}).get("date-parts", [])),
                "venue": (row.get("container-title") or [None])[0],
                "abstract": row.get("abstract"),
                "doi": doi,
                "pmid": None,
                "pmcid": None,
                "source_urls": [row.get("URL")] if row.get("URL") else [],
                "citations": row.get("is-referenced-by-count"),
            }
        )

    return results


def _extract_year(pubdate: str | None) -> int | None:
    if not pubdate:
        return None
    for token in pubdate.replace("/", " ").split():
        if token.isdigit() and len(token) == 4:
            return int(token)
    return None


def _extract_year_from_parts(parts: list[list[int]]) -> int | None:
    if not parts or not parts[0]:
        return None
    year = parts[0][0]
    return year if isinstance(year, int) else None
