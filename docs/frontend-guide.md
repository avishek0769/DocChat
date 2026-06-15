# DocChat Frontend Development Guide

This guide is designed for developers working on the React frontend of DocChat. It details routing, client-side caching, authentication mechanics, and style guidelines.

---

## 1. Stack and Libraries

* **Core**: React 19, TypeScript, and Vite.
* **Routing**: React Router DOM (v7) for client-side navigation.
* **Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin) and Framer Motion for animations.
* **Charts**: Chart.js and `react-chartjs-2` for rendering usage graphs.
* **Markdown & Code Rendering**: `react-markdown` along with `remark-gfm` (GitHub Flavored Markdown) and `highlight.js` for beautiful syntax highlighting in chatbot responses.

---

## 2. Directory Layout

The `src/` folder is divided into components, page containers, and library utilities:

* **`main.tsx`**: Entry point that mounts the React application in the DOM.
* **`App.tsx`**: Defines routes, layouts, and applies access control guards:
  * `ProtectedRoute`: Restricts pages to signed-in users. Optionally restricts to admin-only via the `adminOnly` prop.
  * `PublicOnlyRoute`: Restricts guest-only pages (e.g. login/signup pages) from logged-in users.
* **`index.css`**: Global stylesheet initializing Tailwind CSS imports and custom styling defaults.
* **`lib/`**: Contains core client utilities:
  * `api.ts`: API wrapper client. Manages endpoint fetch calls, inserts JWT tokens, invalidates cache groups, parses validation errors, and handles streaming SSE chunk decoding.
  * `auth.ts`: Handles token management (storing/reading access tokens and user records from `localStorage`) and logout operations.
  * `cache.ts`: Simple in-memory Cache implementation. Offers `getFromCache` and `setInCache` with TTL tracking, plus wildcard key-matching removal.
  * `format.ts`: Numeric token formatting and date helper functions.
* **`components/`**: Shared layouts and visual widgets:
  * `ProtectedRoute.tsx`: Routing guards checking session validity.
  * `Sidebar.tsx` / `Navbar.tsx`: Core layouts.
* **`pages/`**: Complete page components:
  * `LandingPage.tsx`: Elegant landing page showcasing DocChat features.
  * `SignIn.tsx` / `SignUp.tsx`: Credentials forms with input checks.
  * `Dashboard.tsx`: User dashboard to start ingestions, check processing steps, and view recent chats.
  * `ChatPage.tsx`: Interactive chat workspace featuring scrolling message lists, sources details modals, streaming LLM text output, and chat exports.
  * `SharedChatPage.tsx` / `AllChats.tsx`: Shared layouts, history view, and data management.
  * `Settings.tsx`: Form configuration interface to store custom keys (OpenAI, Anthropic, Gemini, Grok, OpenRouter) and delete accounts.
  * `Usage.tsx` / `Profile.tsx`: Token visualization charts and profile details.
  * `AdminOverview.tsx` / `AdminUsers.tsx` / `AdminUserDetail.tsx` / `AdminUsage.tsx` / `AdminIngestion.tsx`: Admin-specific telemetry.

---

## 3. Client Caching System (`src/lib/cache.ts`)

To avoid redundant server API round-trips for static or slowly-changing resources (like chat lists, key counts, user profiles, and indexing pages), the frontend client incorporates an in-memory cache system:

1. **Caching Utility**: Wraps API requests using `withCache(key, ttlMs, fetcher)`.
2. **TTL (Time to Live)**: Stores values in memory along with an expiration timestamp. If the cached item is expired or missing, it queries the backend.
3. **Invalidation**: Invalidation triggers clean cache segments using prefix sweeping (e.g. `removeMatchingFromCache` matching `api:<userId>:/chat/list`) when mutating endpoints succeed (like deleting a chat or creating a new key).

---

## 4. Authentication Flow

* **Tokens**: Uses dual JWT tokens:
  1. Access Token: Short-lived token sent as a `Bearer` token inside the request `Authorization` header.
  2. Refresh Token: Long-lived token stored securely by the backend in HTTP-Only cookies.
* **Authorization Interceptor**: If an API request encounters a `401 Unauthorized` or `403 Forbidden` response, the client triggers `forceSignOut()`, clears LocalStorage, and redirects the browser window to `/signin`.

---

## 5. UI and Design Standards

* **Animations**: Hover scales, layout morphs, transitions, and loading skeletons use Framer Motion tags (`motion.div`, `AnimatePresence`).
* **Responsiveness**: Flexbox and CSS Grid classes ensure adaptability from desktop monitors to mobile browser views.
* **Color Palette**: Sleek dark modes and subtle color gradients are applied using Tailwind classes to convey a premium visual feel.
