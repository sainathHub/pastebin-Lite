# Pastebin Lite

A fast, modern, and ephemeral text sharing application built with **Next.js (App Router, TypeScript)**, **Tailwind CSS**, and **PostgreSQL (Neon)**. Users can store and share text or code snippets via unique links, with optional expiration based on time (TTL) or view count ("burn after reading").

---

## ✨ Features

- **Quick & Intuitive Paste Creation:** Share code, markdown, logs, or plain text with syntax options, line counters, and Tab key indentation.
- **Optional Time-Based Expiration (TTL):** Set snippets to expire after 5 minutes, 10 minutes, 1 hour, 1 day, 7 days, or 30 days.
- **Optional View-Based Expiration (Burn-After-Reading):** Limit access to a strictly enforced view count (e.g. 1 view for self-destructing secrets, 5 views, 10 views).
- **Concurrency & Race Condition Proof:** Uses atomic conditional database updates so view limits cannot be bypassed even under heavy concurrent traffic.
- **Dual Interface:**
  - **Modern Web Interface:** Dark mode UI with line numbers, live countdown timers, copy buttons, and burn warnings.
  - **Full REST API:** Direct endpoints for automated evaluation test suites, curl, and programmatic integrations.
  - **Raw Text Output:** Direct `text/plain` output via `/:id/raw` or `/api/pastes/:id/raw`.
- **Zero-Friction Database:** Native support for **Neon Serverless PostgreSQL** via `@neondatabase/serverless` with automatic fallback to an in-memory store for local testing without external database dependencies.

---

## 🛠️ Tech Stack & Design Decisions

| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router, React 19) | Combines server-side rendering, client interactivity, and serverless API routes into a single deployment. Zero-config on Vercel. |
| **Language** | TypeScript | Strong typing across data models, database queries, and API request/response contracts. |
| **Database** | PostgreSQL (Neon Serverless) | ACID-compliant storage with connection pooling optimized for serverless functions. |
| **Styling** | Tailwind CSS v4 + Lucide Icons | Clean, responsive, developer-friendly interface. |
| **ID Generation** | NanoID (Base62) | Non-sequential, URL-safe, collision-resistant 8-character slugs. |
| **Testing** | Vitest | Fast automated unit and integration tests covering concurrency, TTL, and validation. |

### 🔒 Atomic Concurrency & View Limits (Crucial Design Detail)

In standard applications, a naive check-then-update pattern causes race conditions:
```text
Thread A: SELECT views (returns 0) -> view < 1 -> ok
Thread B: SELECT views (returns 0) -> view < 1 -> ok
Thread A: UPDATE views = 1
Thread B: UPDATE views = 1  <-- Both users accessed a 1-view paste!
```

To eliminate this vulnerability, Pastebin Lite performs an **atomic conditional update** in PostgreSQL:
```sql
UPDATE pastes
SET view_count = view_count + 1
WHERE id = $1
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_views IS NULL OR view_count < max_views)
RETURNING id, title, content, language, max_views, view_count, expires_at, created_at;
```
If 0 rows are updated, the request immediately checks whether the paste expired or exhausted its view count, returning `404 Not Found` (with reasons `expired` or `view_limit_reached`). Our automated test suite includes a test with 10 simultaneous concurrent requests competing for 3 view slots—strictly 3 succeed and 7 are rejected.

---

## 🚀 REST API Specification

### 1. Health Check
* **Endpoint:** `GET /api/health`
* **Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "pastebin-lite",
  "timestamp": "2026-11-11T22:30:00.000Z"
}
```

---

### 2. Create Paste
* **Endpoint:** `POST /api/pastes`
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "content": "Secret configuration string", // required (or "text")
  "title": "Database Config",               // optional (max 255 chars)
  "language": "json",                       // optional (default: "plaintext")
  "ttl_seconds": 3600,                      // optional integer (or "ttl", "expires_in")
  "max_views": 5                            // optional integer (or "views", >= 1)
}
```
* **Response (`201 Created`):**
```json
{
  "id": "abc1234z",
  "url": "https://your-domain.vercel.app/abc1234z",
  "raw_url": "https://your-domain.vercel.app/api/pastes/abc1234z/raw",
  "expires_at": "2026-11-11T23:30:00.000Z",
  "max_views": 5,
  "remaining_views": 5
}
```

---

### 3. Retrieve Paste Metadata & Content
* **Endpoint:** `GET /api/pastes/:id`
* **Behavior:** Atomically increments `view_count` on valid access.
* **Response (`200 OK`):**
```json
{
  "id": "abc1234z",
  "title": "Database Config",
  "content": "Secret configuration string",
  "language": "json",
  "created_at": "2026-11-11T22:30:00.000Z",
  "expires_at": "2026-11-11T23:30:00.000Z",
  "max_views": 5,
  "view_count": 1,
  "remaining_views": 4
}
```
* **Error Response (`404 Not Found`):**
```json
{
  "error": "Paste has reached its view limit and is no longer accessible",
  "reason": "view_limit_reached"
}
```

---

### 4. Retrieve Raw Content
* **Endpoints:** `GET /api/pastes/:id/raw` or `GET /:id/raw`
* **Response (`200 OK`):**
  * `Content-Type: text/plain; charset=utf-8`
  * Body: Unformatted string content.

---

## 🧪 Automated Testing

We provide a comprehensive Vitest test suite testing all endpoints, error handling, TTL timing, burn limits, and concurrency:

```bash
# Run the automated test suite
npm test
```

### Test Coverage Highlights:
- ✅ **Paste Creation:** Validates input sanitization, size limits (413 for >500KB), flexible field names (`content` vs `text`), positive integers for TTL and max views.
- ✅ **Retrieval:** Validates view count incrementation and 404 for non-existent IDs.
- ✅ **TTL Expiration:** Verifies that a paste with 1-second TTL succeeds immediately and fails with `404 (reason: 'expired')` after 1 second.
- ✅ **Burn-After-Reading:** Verifies that a paste with `max_views: 2` is accessible on reads 1 and 2, and strictly returns 404 on read 3.
- ✅ **Concurrency Race Test:** Launches 10 simultaneous asynchronous requests against a paste with `max_views: 3`—verifies that exactly 3 succeed and 7 fail.
- ✅ **Raw Text:** Verifies plain text HTTP responses for CLI/curl usage.

---

## 💻 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/sainathHub/pastebin-Lite.git
   cd pastebin-Lite
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** If `DATABASE_URL` is omitted, the app automatically runs using its high-speed in-memory store.

---

## ☁️ Deployment Instructions (Vercel + Neon)

### 1. Database Setup on Neon (Free Postgres)
1. Go to [neon.tech](https://neon.tech) and sign up for a free account.
2. Create a new project (e.g. `pastebin-lite`).
3. Under **Dashboard > Connection Details**, copy the connection string:
   ```env
   DATABASE_URL="postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
   *(Pastebin Lite automatically runs `CREATE TABLE IF NOT EXISTS pastes ...` on first query—no manual migrations required!)*

### 2. Deploying on Vercel
1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import your `pastebin-Lite` repository.
4. Under **Environment Variables**, add:
   - `DATABASE_URL`: Your Neon connection string.
   - `NEXT_PUBLIC_BASE_URL`: Your deployed Vercel domain (e.g., `https://pastebin-lite.vercel.app`).
5. Click **Deploy**. Your app will build and deploy in under 60 seconds.

---

## 📄 License
MIT
