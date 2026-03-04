from __future__ import annotations

import re

from app.models import Paper


def run_chat_filter(message: str, papers: list[Paper]) -> tuple[str, dict, list[Paper], list[str]]:
    lowered = message.lower()
    filtered = papers
    filters: dict = {}
    actions: list[str] = []

    if "open access" in lowered or "oa" in lowered or "pmc" in lowered:
        filtered = [p for p in filtered if p.oa.status == "open"]
        filters["oa_only"] = True
        actions.append("filtered_open_access")

    year_match = re.search(r"(19|20)\d{2}", lowered)
    if year_match:
        year = int(year_match.group())
        filtered = [p for p in filtered if p.year and p.year >= year]
        filters["year_from"] = year
        actions.append("filtered_by_year")

    limit_match = re.search(r"top\s*(\d+)", lowered)
    if limit_match:
        top_n = max(1, int(limit_match.group(1)))
        filtered = filtered[:top_n]
        filters["top_n"] = top_n
        actions.append("limited_results")

    assistant_message = (
        f"I found {len(filtered)} paper(s) after applying filters. "
        "I only include OA/PMC PDF links for downloadable bundles."
    )
    return assistant_message, filters, filtered, actions
