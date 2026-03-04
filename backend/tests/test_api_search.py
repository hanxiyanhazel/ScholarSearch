from fastapi.testclient import TestClient

from app import main
from app.models import OAInfo, Paper


client = TestClient(main.app)


async def _fake_search_literature(**kwargs):
    return [
        Paper(
            id='p1',
            title='Mock Paper',
            authors=['Tester'],
            year=2023,
            venue='MockConf',
            abstract='mock',
            doi='10.1/mock',
            pmid='111',
            source_urls=['https://pubmed.ncbi.nlm.nih.gov/111/'],
            citations=1,
            oa=OAInfo(status='open', pdf_url='https://pmc.ncbi.nlm.nih.gov/articles/PMC1/pdf/', evidence_url='https://pmc.ncbi.nlm.nih.gov/articles/PMC1/', source='pmc'),
        )
    ]


def test_search_smoke(monkeypatch):
    monkeypatch.setattr(main, 'search_literature', _fake_search_literature)
    resp = client.post(
        '/api/search',
        json={
            'query': 'cancer',
            'year_from': 2020,
            'year_to': 2024,
            'top_k': 5,
            'sources': ['pubmed'],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data['session_id']
    assert len(data['papers']) == 1
    assert data['papers'][0]['oa']['status'] == 'open'
