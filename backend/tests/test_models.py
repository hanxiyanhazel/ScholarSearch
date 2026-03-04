from app.models import OAInfo, Paper


def test_paper_schema_has_required_fields() -> None:
    paper = Paper(
        id="abc123",
        title="Example",
        authors=["A. Author"],
        year=2024,
        venue="Journal",
        abstract="Abstract",
        doi="10.1000/example",
        pmid="12345",
        source_urls=["https://example.org"],
        citations=4,
        oa=OAInfo(status="open", pdf_url="https://example.org/p.pdf", evidence_url="https://example.org", source="unpaywall"),
    )

    dumped = paper.model_dump()
    assert dumped["oa"]["status"] == "open"
    assert dumped["title"] == "Example"
