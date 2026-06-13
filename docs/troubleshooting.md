# DocChat Setup & Troubleshooting Guide

This guide describes all configuration variables used by DocChat and provides instructions for resolving common setup issues.

---

## 1. Environment Variable Reference

### Backend Configuration (`backend/.env`)

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `3000` | Port the Express server listens on. |
| `NODE_ENV` | No | `development`| Mode of execution (`development` or `production`). Controls SSL cookie flag. |
| `CORS_ORIGIN` | Yes | — | Domain allowed to access the backend APIs (e.g. `http://localhost:5173`). |
| `CORS_METHODS` | Yes | — | Allowed HTTP request methods (e.g. `GET,POST,PUT,DELETE`). |
| **Database & Cache** | | | |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:pass@host:port/db?schema=public`). |
| `QDRANT_URL` | Yes (Vector) | — | Base URL of the Qdrant Vector database server. |
| `QDRANT_API_KEY` | No | — | Authorization token for Qdrant (if required). |
| `REDIS_HOST` / `REDIS_PORT` | No | `localhost`/`6379`| Connection coordinates for Redis. |
| **Authentication & Encryption** | | | |
| `ACCESS_TOKEN_SECRET` | Yes | — | Secret key for signing client access tokens. |
| `ACCESS_TOKEN_EXPIRY` | No | `1d` | Lifetime duration for access tokens. |
| `REFRESH_TOKEN_SECRET`| Yes | — | Secret key for signing refresh tokens. |
| `REFRESH_TOKEN_EXPIRY`| No | `10d` | Lifetime duration for refresh tokens. |
| `CIPHER_KEY` | Yes | — | **32-byte Base64 string** used for encrypting user API keys in DB. |
| `ENCRYPTION_ALGORITHM`| No | `aes-256-gcm` | Symmetric encryption standard. |
| **LLM Providers** | | | |
| `OPENROUTER_LLM_API_KEY` | No (Default)| — | OpenRouter key used if a user selects the "DEFAULT" provider models. |
| `OPENROUTER_EMBEDDING_API_KEY` | Yes (Vector) | — | OpenRouter API key used to generate 1536-dimension vectors. |
| `TREEINDEX_API_KEY` | Yes (Tree) | — | API key supplied to the `treeindex` constructor. |
| `MODEL` | Yes (Tree) | — | LLM Model name used to construct structure index tree (e.g., `meta-llama/llama-3-8b-instruct`). |
| **Crawling & Worker Options** | | | |
| `CRAWL_MAX_PAGES_PER_JOB` | No | `300` | Maximum link scraping depth allowed per chat source. |
| `CRAWL_VECTORLESS_BATCH_SIZE` | No | `5` | Batch concurrency for TreeIndex web scrapes. |
| `CHAT_WORKER_CONCURRENCY` | No | `1` | Concurrency limit of ingestion workers. |
| `CRAWL_USER_AGENT` | No | `DocChatBot/1.0` | HTTP User-Agent string sent during scraping. |
| `CRAWL_RESPECT_ROBOTS_TXT` | No | `true` | Respect instructions inside `robots.txt` paths. |
| `CRAWL_DELAY_MS` | No | `1000` | Delay between consecutive page scrapes. |
| `CRAWL_MAX_CONCURRENCY_PER_DOMAIN`| No | `2` | Parallel page fetch requests per domain. |
| `CRAWL_ROBOTS_TIMEOUT_MS` | No | `5000` | HTTP fetch timeout for robots.txt files. |
| **Optional Features** | | | |
| `MEM0_API_KEY` | No | — | Mem0 service token to enable persistent long-term memories. |
| `RESEND_API_KEY` | No | — | Transactional Resend token to dispatch user confirmation pins. |
| `DAILY_TOKEN_BUDGET` | No | — | Token limit allowed per user per day. |
| `ADMIN_USERNAME` | No | — | User account name designated with administrative permissions. |
| `QDRANT_CLEANUP_MIN_AGE_DAYS` | No | `7` | Retention limit for swept Qdrant collections. |

### Frontend Configuration (`.env`)

| Variable | Required? | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Yes | `http://localhost:3000/api/v1` | Server endpoint URL queried by the frontend. |

---

## 2. Troubleshooting Common Scenarios

### Scenario A: Database Connection & Migrations Failure
* **Symptoms**: Node console shows `DATABASE connection Failed` or database queries throw `PrismaClientInitializationError`.
* **Fixes**:
  1. Confirm your PostgreSQL instance is running and accepts connections on the designated port.
  2. Verify your `DATABASE_URL` format. Special characters in passwords (like `@` or `/`) must be URL-encoded.
  3. Ensure migrations have been applied locally. Run:
     ```bash
     pnpm dlx prisma migrate dev --name init
     pnpm dlx prisma generate
     ```

### Scenario B: Chats Stuck in `QUEUED` or `PROCESSING` Indefinitely
* **Symptoms**: Chats show a loading indicator on the dashboard but never transition to `READY`. The progress bar stays at 0% or is missing.
* **Fixes**:
  1. BullMQ requires the background worker task to be running. Start it in a separate terminal:
     ```bash
     cd backend
     node chatWorker.js
     ```
  2. Confirm Redis is active. If running via Docker, make sure the `redis-stack` container is running:
     ```bash
     docker compose ps
     ```
     If it is stopped, run `docker compose up -d redis-stack`.

### Scenario C: Chat Ingestion Instantly Fails (`FAILED` Status)
* **Symptoms**: Immediately after starting ingestion, the chat transitions to `FAILED` with error messages like `No data scraped` or `Failed to generate embeddings`.
* **Fixes**:
  1. Check if the target site forbids crawling. If it blocks scrapers, check your console logs. You can disable strict robots checking for local testing by setting:
     `CRAWL_RESPECT_ROBOTS_TXT=false`
  2. Confirm `OPENROUTER_EMBEDDING_API_KEY` (Vector mode) or `TREEINDEX_API_KEY` (Vectorless mode) is defined and valid. Ingestion will fail if the embeddings or tree generation API requests return `401 Unauthorized` or quota limit errors.

### Scenario D: Decryption Errors on API Keys
* **Symptoms**: User messages fail to send with internal errors like `Unsupported state or key size` or `decryption failed`.
* **Fixes**:
  1. The `CIPHER_KEY` environment variable must be a valid **Base64 string representing a 32-byte key**.
  2. Generate a valid key using:
     ```bash
     openssl rand -base64 32
     ```
  3. **Warning**: If you modify `CIPHER_KEY` after users have stored API keys, previously encrypted keys can no longer be decrypted, and users will need to re-add their API keys in the Settings page.

### Scenario E: API Key Decryption Mismatch on Production Deployments
* **Symptoms**: API Keys work in development but throw errors on production.
* **Fixes**: Ensure that both your primary server node (`index.js`) and your background runner (`chatWorker.js`) share the exact same environment variables, especially `CIPHER_KEY` and database URLs.
