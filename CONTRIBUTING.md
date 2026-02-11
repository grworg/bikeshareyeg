# Contributing to BikeShareYEG

Thanks for your interest in improving bike-share planning for Edmonton! Whether you're fixing a bug, proposing a feature, improving documentation, or just asking a question — all contributions are welcome.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## How to Contribute

### Reporting Bugs

Open a [Bug Report](../../issues/new?template=bug_report.md) issue. Include:

- Steps to reproduce
- What you expected vs. what happened
- Browser / OS / Python version if relevant
- Screenshots or console output if applicable

### Suggesting Features

Open a [Feature Request](../../issues/new?template=feature_request.md) issue. Describe:

- The problem or opportunity
- Your proposed solution
- Any alternatives you've considered

### Submitting Code

1. **Fork** the repo and create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes.** Follow the conventions already in the codebase:
   - **Python**: formatted with [Ruff](https://docs.astral.sh/ruff/), type hints encouraged
   - **TypeScript**: standard Next.js / ESLint conventions, Tailwind for styling

3. **Test locally.** Make sure the backend starts (`uvicorn src.api.main:app`) and the frontend compiles (`npm run build`).

4. **Commit** with a clear message describing *why*, not just *what*:
   ```bash
   git commit -m "Add equity weighting layer to suitability engine"
   ```

5. **Push** and open a Pull Request against `main`. Fill out the PR template.

### Improving Documentation

The docs live in two places:

- **`README.md`** and markdown files in the repo root
- **In-app docs** at `frontend/src/app/docs/content.ts` (structured TypeScript data)

Both are great places to contribute. Fixing a typo is just as valuable as writing a new section.

## Development Setup

See the [Getting Started](README.md#getting-started) section in the README for full setup instructions.

Quick reference:

```bash
# Backend
cd backend && uv venv && source .venv/bin/activate && uv pip install -e ".[dev]"
uvicorn src.api.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Type checks
cd frontend && npx tsc --noEmit

# Linting (Python)
cd backend && ruff check src/
```

## Project Structure

| Directory | What lives here |
|-----------|----------------|
| `backend/src/api/` | FastAPI route handlers |
| `backend/src/optimization/` | MCLP solver, greedy algorithm, suitability engine |
| `backend/src/data/` | Data fetchers (Overpass, GTFS, Edmonton Open Data, OTP) |
| `frontend/src/app/` | Next.js pages (main app, docs) |
| `frontend/src/components/` | React components (map, sidebar, controls) |
| `frontend/src/lib/` | API client, types, state utilities |
| `scripts/` | Data processing and setup scripts |

## Questions?

Open a [discussion](../../discussions) or an issue. No question is too small.
