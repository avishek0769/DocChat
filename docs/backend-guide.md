# DocChat Backend Development Guide

This guide is designed for developers working on the Express backend of DocChat. It details the directory layout, database schema, background worker orchestration, encryption schemes, and caching layers.

---

## 1. Directory Structure

The `backend/` folder contains the following core modules:

* **`app.js`**: Initialises Express. Applies global middlewares (`cors`, `express.json()`, `cookieParser()`, `express.static("public")`). Declares route prefixes (e.g. `/api/v1/user`, `/api/v1/chat`). Incorporates a global `errorHandler` middleware that translates validation errors (including fields and structured reasons) into standard JSON responses for the client.
* **`index.js`**: The entry point. Connects to PostgreSQL using Prisma, and starts the HTTP server listening on the configured `PORT`.
* **`chatWorker.js`**: Background worker process that subscribes to the `chatCreation` BullMQ queue. Responsible for executing crawling, splitting, embedding, and tree generation tasks.
* **`controllers/`**: Core request-handling logic:
  * `admin.controller.js`: Handles system statistics, user lists, database inspection, and Qdrant cleanup operations.
  * `apikey.controller.js`: Encrypts, lists, and modifies provider credentials for users.
  * `chat.controller.js`: Manages ingestion expectation checking, chat creation, status polling, cancellation, sharing, and deletion.
  * `chatMessage.controller.js`: Streams LLM responses, retrieves vector/vectorless context, fetches available models, and handles export.
  * `usage.controller.js`: Returns user usage summaries, charts, breakdowns, and lifetime statistics.
  * `user.controller.js`: Controls user signup, signin, token refreshment, profile details, and email validation.
* **`routers/`**: Express Router mapping paths to controllers. Protected endpoints utilize auth verification middlewares.
* **`middlewares/`**: Middlewares including:
  * `auth.middleware.js`: Extracts Bearer/Cookie tokens, decodes JWT access tokens, attaches the user object to `req.user`, and verifies admin roles.
* **`prisma/`**: Contains `schema.prisma` (model definitions) and SQL migrations.
* **`utils/`**: Helper files:
  * `contextBuilder.js`: Prompts formatting and tags compilation for context insertion.
  * `decrypt.js`: AES Decryption utilities for user API keys.
  * `qdrantCleanup.js`: sweeps orphan or outdated Qdrant collections.
  * `ragClients.js`: Exports shared clients for Qdrant and TreeIndex.
  * `ragUtilities.js`: Core text crawlers, robots.txt parsers, and embeddings generation helpers.
  * `redis.js`: Exports the Redis connection and helper function for progress cache keys.
  * `validationSchemas.js`: Contains Joi schemas for validating incoming query parameters and payloads.

---

## 2. Database Schema & Models

DocChat uses PostgreSQL, modeled with Prisma ORM. Key tables include:

```
┌──────────────┐         ┌──────────────┐         ┌────────────────────┐
│     User     │───1:N──>│     Chat     │───1:N──>│    IngestionRun    │
└──────────────┘         └──────────────┘         └────────────────────┘
       │                        │                            │
      1:N                      N:M                          N:1
       │                        │                            │
┌──────────────┐         ┌──────────────┐<───────────┴────────────
│    ApiKey    │         │  ChatSource  │
└──────────────┘         └──────────────┘
                                │
                        ┌───────┴───────┐
                       1:1             1:N
                        │               │
                 ┌──────────────┐┌──────────────┐
                 │ DocumentTree ││ DocumentPage │
                 └──────────────┘└──────────────┘
```

* **`User`**: Account records. Stores hashed passwords, refresh tokens, emails, and verification/admin flags.
* **`ApiKey`**: User-provided LLM credentials. Stores encrypted key data, IV, and GCM authentication tags.
* **`Chat`**: A conversation session referencing a specific document collection. Status values: `QUEUED`, `PROCESSING`, `READY`, `FAILED`.
* **`ChatSource`**: Represents the crawled documentation root. A unique constraint exists on `(documentationUrl, isVectorLess)`. If two users create chats with the same URL and mode, they map to the same `ChatSource` row, enabling instant ingestion reuse.
* **`IngestionRun`**: Tracks historical crawl attempts for a source (started, succeeded, failed, errors).
* **`DocumentPage`**: List of crawled sub-page URLs and titles linked to a `ChatSource`.
* **`DocumentTree`**: Stores the hierarchical JSON representation and raw text for TreeIndex retrieval.
* **`ChatMessage`**: Dialogue prompt and response strings with associated LLM model labels.
* **`ChatMessageSource`**: Chunks of text or tree nodes retrieved as context reference for a specific message, including similarity score.
* **`UsageEvents`**: Logs token counts and calculated cost per request.
* **`AuditEvent`**: System audits (e.g. `chat.created`, `ingestion.started`, `message.sent`).

---

## 3. Asynchronous Processing (BullMQ & Redis)

To prevent blocking HTTP requests, documentation scraping and vector indexing run inside a background worker using **BullMQ**.

1. **Queue Creation**: Backend initialises `chatCreationQueue = new Queue("chatCreation", { connection: redis })`.
2. **Job Addition**: During `/chat/create`, the server adds a job `chatCreationQueue.add(name, payload, { jobId: chatId })`.
3. **Worker Processing**: In `chatWorker.js`, a `Worker` handles the job. 
4. **Progress Updates**: As pages are processed, the worker stores progress percentages in Redis:
   * Key: `progress:<chatId>`
   * Value: JSON containing `status`, `current`, `total`, and `progress` (0 to 100).
5. **Worker Listeners**: Once complete, the worker updates the `Chat` record status to `READY` or `FAILED` in the database, updating the progress cache.

---

## 4. Encryption & Security

DocChat supports custom API keys which are stored securely:
* **Algorithm**: `aes-256-gcm` (Authenticated Encryption with Associated Data).
* **Key Derivation**: Configured using `CIPHER_KEY` (a base64 string derived from 32 random bytes) and a randomly generated Initialization Vector (`IV`) per record.
* **Storage**: Encryption outputs three components stored in the database: `encryptedKey`, `iv` (hex), and `tag` (hex auth tag).
* **Usage**: Decryption occurs *only* in-memory within `chatMessage.controller.js` when streaming requests are sent to providers.

---

## 5. Token Budgeting

To prevent abuse, the backend implements a daily token budget:
* **Trigger**: Enabled when `DAILY_TOKEN_BUDGET` is set in the environment.
* **Budget Tracking**:
  1. For every message request, the system checks Redis key `tokenBudget:<userId>:<YYYY-MM-DD>`.
  2. If the key doesn't exist, it aggregates the sum of `inputTokens` and `outputTokens` from the `UsageEvents` database table for the current UTC day and caches it in Redis with an expiration set to the remaining time until UTC midnight.
  3. If the token count exceeds `DAILY_TOKEN_BUDGET`, it returns a `429 Too Many Requests` error.
  4. On successful completion of LLM responses, the system increments the Redis counter using `redis.incrby` and updates the database usage event.

---

## 6. Integrations & Extensions

* **Mem0**: If `MEM0_API_KEY` is present, the system registers user prompts and assistant replies to the Mem0 service to query/maintain long-term user context.
* **Resend**: Used for transactional mail delivery, e.g., verifying user accounts.
