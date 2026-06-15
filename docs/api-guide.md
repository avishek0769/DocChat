# DocChat API Reference Guide

This document defines the REST API endpoints exposed by the DocChat server. All endpoints are prefixed with the base path `/api/v1`.

---

## Authentication Mechanism

DocChat utilizes a double-token architecture:
1. **Access Token**: Short-lived (1 day) JWT passed in the HTTP headers:
   `Authorization: Bearer <access_token>`
2. **Refresh Token**: Long-lived (10 days) JWT passed via HTTP-only cookies (`refreshToken`).

### Authentication Levels
* **Public**: No token required.
* **Strict JWT**: Requires a valid, unexpired Access Token in the Authorization header.
* **Admin**: Requires a strict JWT and the user's username must match `ADMIN_USERNAME` configured in environment variables.

---

## 1. User & Account Routes (`/user`)

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/user/register` | `POST` | Public | Registers a new user account. |
| `/user/login` | `POST` | Public | Logs in a user, returning tokens and caching cookies. |
| `/user/logout` | `GET` | Strict JWT | Clears session cookie and logs out. |
| `/user/profile` | `GET` | Strict JWT | Retrieves current user profile details. |
| `/user/send-verification-code` | `POST` | Public | Emails a 6-digit confirmation pin to the address. |
| `/user/verify-email` | `POST` | Public | Matches confirmation pin to set `isVerified: true`. |
| `/user/send-reset-code` | `POST` | Public | Sends password recovery code. |
| `/user/reset-password` | `PATCH` | Public | Updates user password using reset code. |
| `/user/refresh-tokens` | `PATCH` | JWT (weak) | Swaps active refresh token cookie for a new access token. |

### Register Request Payload (`POST /user/register`)
```json
{
  "fullname": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "Password123!"
}
```

### Log In Success Response (`POST /user/login`)
```json
{
  "statusCode": 200,
  "data": {
    "user": {
      "id": "e8a34241-1188-4672-881b-a9b09ff8272a",
      "username": "johndoe",
      "email": "john@example.com",
      "fullname": "John Doe",
      "isAdmin": false,
      "isVerified": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  },
  "message": "User logged in successfully"
}
```

---

## 2. API Key Management (`/apikey`)

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/apikey/add` | `POST` | Strict JWT | Stores encrypted provider keys (`OPENAI`, `ANTHROPIC`, `GOOGLE`, `XAI`, `OPENROUTER`). |
| `/apikey/list` | `GET` | Strict JWT | Lists configured provider key names and credentials (masked). |
| `/apikey/count` | `GET` | Strict JWT | Returns total count of active keys configured by the user. |
| `/apikey/:id` | `GET` | Strict JWT | Retrieves single key metadata. |
| `/apikey/:id` | `PATCH` | Strict JWT | Updates API key nickname/label or token value. |
| `/apikey/:id` | `DELETE` | Strict JWT | Deletes configured provider API key. |

### Add API Key Payload (`POST /apikey/add`)
```json
{
  "name": "My Gemini Key",
  "provider": "GOOGLE",
  "key": "AIzaSy..."
}
```

---

## 3. Ingestion & Chat Management (`/chat`)

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/chat/expectation` | `GET` | Strict JWT | Checks reuse status and calculates ingestion token expectations. |
| `/chat/create` | `POST` | Strict JWT | Triggers or reuses a document collection and registers a new chat. |
| `/chat/list` | `GET` | Strict JWT | Lists all user chats alongside aggregated usage totals. |
| `/chat/recent` | `GET` | Strict JWT | Returns the 6 most recent chats. |
| `/chat/:chatId` | `GET` | Strict JWT | Retrieves details for a specific chat ID (verifies ownership). |
| `/chat/:chatId` | `DELETE` | Strict JWT | Deletes chat thread history (preserves underlying sources). |
| `/chat/pages-indexed/:chatId`| `GET`| Strict JWT | Lists all page URLs indexed for the chat's source URL. |
| `/chat/status/:chatId` | `GET` | Strict JWT | Retrieves active ingestion run statistics and progress percent. |
| `/chat/cancel/:chatId` | `GET` | Strict JWT | Terminates active background worker queue job. |
| `/chat/:chatId/share` | `POST` | Strict JWT | Toggles a UUID `shareToken` link sharing state. |
| `/chat/shared/:shareToken` | `GET` | Public | Retrieves shared chat metadata & sources for viewing. |
| `/chat/shared/:shareToken/fork`| `POST` | Strict JWT | Forks a copy of shared conversation history to the user's list. |
| `/chat/qdrant-cleanup` | `GET` | Admin | Scans and deletes collections without DB mappings. |
| `/chat/ingestion-runs/failed`| `GET` | Strict JWT | Lists failed ingestion runs (Admin views all, User views own). |

### Expectation Request (`GET /chat/expectation?docsUrl=https://react.dev`)
Response (New URL):
```json
{
  "statusCode": 200,
  "data": {
    "alreadyIngested": false,
    "expectedTokens": 157892,
    "expectedCost": "0.0032",
    "totalPages": 86,
    "pagesIndexed": 0,
    "pageLimitWarning": false
  },
  "message": "Expectation calculated successfully"
}
```

---

## 4. Message & Query Streams (`/message`)

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/message/models` | `GET` | Strict JWT | Lists available LLM models based on configured provider keys. |
| `/message/send` | `POST` | Strict JWT | Submits a query. Returns Server-Sent Events (SSE) text stream. |
| `/message/all/:chatId` | `GET` | Strict JWT | Retrieves conversation list for the chat thread. |
| `/message/sources/:messageId`| `GET`| Strict JWT | Fetches context chunks (and score) used to build LLM response. |
| `/message/export/:chatId` | `GET` | Strict JWT | Exports plain-text transcript log of the conversation. |
| `/message/shared/:shareToken/messages`| `GET`| Public | Returns message list of shared chat. |
| `/message/shared/:shareToken/messages/:messageId/sources`| `GET`| Public | Returns sources context of shared message. |

### Send Message Payload (`POST /message/send`)
```json
{
  "chatId": "2c94318c-3081-424a-9eb4-8a4d2ee571d8",
  "userPrompt": "How do I implement custom hooks in React?",
  "provider": "GOOGLE",
  "model": "gemini-1.5-pro"
}
```

---

## 5. Usage Telemetry (`/usage`)

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/usage/lifetime-tokens`| `GET` | Strict JWT | Aggregates user lifetime tokens and costs. |
| `/usage/tokens/:groupBy`| `GET` | Strict JWT | Token count groups grouped by `day`, `week`, `month`, or `year`. |
| `/usage/top-chats` | `GET` | Strict JWT | Lists top 5 user chat sessions ranked by total token counts. |
| `/usage/breakdown` | `GET` | Strict JWT | Paginated breakdown of token usages grouped by models. |

---

## 6. Admin Control Panel (`/admin`)

All `/admin` endpoints require a Strict JWT with a user marked `isAdmin: true` in database.

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/admin/overview` | `GET` | Aggregated count summaries and latest Audit Log Events (24h/7d/30d). |
| `/admin/users` | `GET` | Paginated lists of all users with chat counts, token usage, and creation dates. |
| `/admin/users/:userId`| `GET` | Specific details of a user, their recent chats, audit logs, and breakdown. |
| `/admin/usage` | `GET` | Aggregate token consumption analytics and models breakdown ranking. |
| `/admin/ingestion` | `GET` | Indexing status aggregations and failed runs history. |
