# Expense Splitter Backend

FastAPI backend service implementing the canonical OpenAPI 3.1 contract for Expense Splitter.

## Development

```bash
# Install dependencies
uv sync --all-extras

# Run development server
uv run uvicorn app.main:app --reload --port 8000

# Run test suite
uv run pytest
```
