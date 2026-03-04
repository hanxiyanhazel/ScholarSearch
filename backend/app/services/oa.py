from __future__ import annotations

from urllib.parse import quote

import httpx

from app.config import settings
from app.models import OAInfo


async def detect_oa_status(*, doi: str | None, pmcid: str | None, pmid: str | None) -> OAInfo:
    if pmcid:
        pmcid_clean = pmcid if pmcid.upper().startswith("PMC") else f"PMC{pmcid}"
        return OAInfo(
            status="open",
            pdf_url=f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid_clean}/pdf/",
            evidence_url=f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid_clean}/",
            source="pmc",
        )

    if pmid:
        pmc_lookup = await lookup_pmcid_from_pmid(pmid)
        if pmc_lookup:
            pmcid_clean = pmc_lookup if pmc_lookup.upper().startswith("PMC") else f"PMC{pmc_lookup}"
            return OAInfo(
                status="open",
                pdf_url=f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid_clean}/pdf/",
                evidence_url=f"https://pmc.ncbi.nlm.nih.gov/articles/{pmcid_clean}/",
                source="pmc",
            )

    if doi and settings.unpaywall_email:
        oa = await query_unpaywall(doi)
        if oa:
            return oa

    return OAInfo(status="closed", pdf_url=None, evidence_url=None, source=None)


async def lookup_pmcid_from_pmid(pmid: str) -> str | None:
    url = "https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/"
    params = {"ids": pmid, "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()
            records = payload.get("records", [])
            if not records:
                return None
            return records[0].get("pmcid")
    except httpx.HTTPError:
        return None


async def query_unpaywall(doi: str) -> OAInfo | None:
    url = f"https://api.unpaywall.org/v2/{quote(doi)}"
    params = {"email": settings.unpaywall_email}

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError:
        return None

    best_location = payload.get("best_oa_location") or {}
    pdf_url = best_location.get("url_for_pdf") or best_location.get("url")
    evidence_url = payload.get("doi_url") or best_location.get("url")
    if pdf_url:
        return OAInfo(status="open", pdf_url=pdf_url, evidence_url=evidence_url, source="unpaywall")

    if payload.get("is_oa"):
        return OAInfo(status="open", pdf_url=None, evidence_url=evidence_url, source="unpaywall")

    return OAInfo(status="closed", pdf_url=None, evidence_url=evidence_url, source="unpaywall")
