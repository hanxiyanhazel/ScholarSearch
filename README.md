<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ScholarSearch (Frontend + Literature Chat Backend)

This repo now contains:
- A Vite/React frontend (existing app)
- A new FastAPI backend in `backend/` for literature search + OA/PMC-safe bundling

## Frontend (existing)

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set `GEMINI_API_KEY` in `.env.local`
3. Run:
   ```bash
   npm run dev
   ```

## Backend (new)

**Prerequisites:** Python 3.11+

1. Create and activate a virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
   - `UNPAYWALL_EMAIL` is required to enable Unpaywall OA checks.
   - PMC lookups are attempted automatically when PMID/PMCID exists.
4. Start the API:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### CORS

Backend CORS is configured for `http://localhost:5173` by default.

### API Endpoints

- `POST /api/search`
  - Input: `{ query, year_from, year_to, top_k, sources[] }`
  - Output: `{ session_id, papers[] }`
- `POST /api/chat`
  - Input: `{ session_id, message }`
  - Output: `{ assistant_message, filters, papers[], actions[] }`
- `POST /api/bundle`
  - Input: `{ session_id, paper_ids[] }`
  - Output: `{ bundle_id, download_url, included_count, skipped_count }`
- `GET /api/bundle/{bundle_id}/download`
  - Downloads the generated zip bundle manifest.

### OA / Download policy

- OA detection uses:
  - PMC (PMCID or PMID -> PMCID conversion)
  - Unpaywall (`UNPAYWALL_EMAIL`)
- Bundle generation includes **only OA/PMC PDF links**.
- Paywalled publisher scraping is intentionally not performed.

## Run backend tests

```bash
cd backend
pytest -q
```
