from __future__ import annotations

import csv
import io
import json
import uuid
import zipfile
from pathlib import Path

from app.models import Paper


BUNDLE_DIR = Path("backend/bundles")
BUNDLE_DIR.mkdir(parents=True, exist_ok=True)


def build_bundle(papers: list[Paper]) -> tuple[str, int, int]:
    bundle_id = str(uuid.uuid4())
    zip_path = BUNDLE_DIR / f"{bundle_id}.zip"

    included = [p for p in papers if p.oa.status == "open" and p.oa.pdf_url]
    skipped = len(papers) - len(included)

    manifest = [
        {
            "id": p.id,
            "title": p.title,
            "doi": p.doi,
            "pmid": p.pmid,
            "pdf_url": p.oa.pdf_url,
            "evidence_url": p.oa.evidence_url,
            "oa_source": p.oa.source,
        }
        for p in included
    ]

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        zf.writestr(
            "README.txt",
            "This bundle contains OA/PMC PDF links only. Paywalled content is intentionally excluded.",
        )

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["id", "title", "doi", "pmid", "pdf_url", "evidence_url", "oa_source"])
        writer.writeheader()
        writer.writerows(manifest)
        zf.writestr("manifest.csv", output.getvalue())

    return bundle_id, len(included), skipped
