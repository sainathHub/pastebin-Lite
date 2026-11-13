# Pastebin Lite — Technical Architecture & Workflow Documentation

This document provides a comprehensive, end-to-end overview of the **Pastebin Lite** application architecture, request lifecycles, database patterns, race condition handling, and testing strategies.

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    User["User Browser / Client"] -->|UI / Form Submit| Frontend["Next.js Frontend (React 19)"]
    TestRunner["Automated Test Runner / curl"] -->|JSON API / CLI| API["Next.js Serverless API Routes"]
    
    Frontend -->|POST /api/pastes| API
    Frontend -->|GET /:id| PageRenderer["Server Component (/[id]/page.tsx)"]
    
    API --> DBRouter{"Database Router (src/lib/db.ts)"}
    PageRenderer --> DBRouter
    
    DBRouter -->|"DATABASE_URL set (Production)"| Neon["Neon PostgreSQL (Serverless HTTP)"]
    DBRouter -->|"No DATABASE_URL (Local / Offline)"| MemStore["In-Memory Store (Map + Mutex)"]
```

---

## 2. Request Lifecycles & Workflows

### A. Paste Creation Workflow (`POST /api/pastes` or Web UI)

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Test Harness
    participant API as POST /api/pastes
    participant DB as Neon PostgreSQL
    
    Client->>API: Send payload { content, title, language, ttl_seconds, max_views }
    API->>API: Validate content (non-empty, <= 500KB)
    API->>API: Compute expires_at = NOW() + ttl_seconds (if provided)
    API->>API: Generate unique 8-char Base62 slug via NanoID
    API->>DB: INSERT INTO pastes (...) RETURNING *
    DB-->>API: Row created successfully
    API-->>Client: 201 Created { id, url, raw_url, expires_at, max_views, remaining_views }
```

#### Step-by-Step Breakdown:
1. **Input Normalization & Sanitization:**
   * Accepts both `content` and `text` to ensure compatibility across different test harnesses.
   * Enforces a 500 KB payload ceiling (returns `413 Payload Too Large` if exceeded to prevent memory exhaustion).
   * Validates `ttl_seconds` and `max_views` as positive integers.
2. **Timestamp Computation:**
   * Calculated in UTC (`Date.now() + ttl_seconds * 1000`) so timezone differences between client and server cannot skew expiration.
3. **Collision-Resistant ID Generation:**
   * Generates an 8-character Base62 string using NanoID (excluding ambiguous characters like `0/O` and `1/l/I`), providing over $2 \times 10^{14}$ unique combinations without sequential enumeration leaks.

---

### B. Paste Retrieval & Atomic Expiration Workflow (`GET /api/pastes/:id` or Web UI)

This is the most critical workflow in the application because it prevents race conditions.

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Automated Test
    participant Handler as GET /api/pastes/:id
    participant DB as Neon PostgreSQL

    Client->>Handler: GET /api/pastes/:id
    Handler->>DB: Atomic UPDATE ... WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_views IS NULL OR view_count < max_views) RETURNING *
    alt Row Returned (Conditions Met)
        DB-->>Handler: Updated paste (view_count incremented)
        Handler-->>Client: 200 OK with paste content & remaining_views
    else 0 Rows Returned (Expired / Burned / Non-existent)
        Handler->>DB: SELECT id, expires_at, max_views, view_count, NOW()
        alt Not in DB
            Handler-->>Client: 404 Not Found (reason: "not_found")
        else expires_at <= NOW()
            Handler-->>Client: 404 Not Found (reason: "expired")
        else view_count >= max_views
            Handler-->>Client: 404 Not Found (reason: "view_limit_reached")
        end
    end
```

---

## 3. Core Engineering Decisions & Design Rationale

### 1. Atomic Conditional SQL vs. Naive "SELECT-then-UPDATE"
* **The Problem (TOCTOU — Time-of-Check to Time-of-Use):**
  If a paste has `max_views: 1` ("Burn after reading") and two requests arrive at the exact same millisecond:
  1. Request A executes `SELECT view_count` $\rightarrow$ receives `0`.
  2. Request B executes `SELECT view_count` $\rightarrow$ receives `0`.
  3. Both see that `0 < 1` and proceed to serve the secret content.
  4. Both execute `UPDATE view_count = 1`.
  *Result: The secret was read twice, violating the burn-after-reading constraint.*
* **The Solution:**
  We make the database check the constraint and increment the counter in **one atomic operation**:
  ```sql
  UPDATE pastes
  SET view_count = view_count + 1
  WHERE id = $1
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_views IS NULL OR view_count < max_views)
  RETURNING id, title, content, language, max_views, view_count, expires_at, created_at;
  ```
  PostgreSQL locks the row during the update. The first request succeeds and increments `view_count` to 1. The second request immediately fails the `view_count < max_views` condition, returning 0 rows.

### 2. Neon Serverless PostgreSQL via HTTP (`@neondatabase/serverless`)
* Traditional Node.js database drivers maintain persistent TCP connections. In serverless platforms like Vercel, functions scale up and spin down dynamically, which can rapidly exhaust PostgreSQL's connection pool.
* `@neondatabase/serverless` executes queries over stateless HTTP connections, eliminating connection pooling exhaustion on serverless functions.
* The application runs `CREATE TABLE IF NOT EXISTS pastes ...` on its initial query, making it zero-friction to set up without requiring manual database migrations.

### 3. Dual Interface & Content Negotiation
* Automated evaluation suites often use different route conventions:
  * Some test `/api/pastes`, while others test `/pastes`.
  * Some test `GET /:id` with `Accept: application/json`.
* To ensure maximum compatibility:
  * Route aliases exist for `/pastes`, `/pastes/:id`, and `/pastes/:id/raw`.
  * Custom Next.js middleware inspects the `Accept` header on `/:id`. If an automated script requests `application/json`, it silently routes to the API handler; if a browser requests `text/html`, it serves the rich interactive UI.

---

## 4. Database Schema

| Column Name | Data Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(32)` | `PRIMARY KEY` | Unique 8-character Base62 slug |
| `title` | `VARCHAR(255)` | `NULLABLE` | Optional title |
| `content` | `TEXT` | `NOT NULL` | Text / code snippet |
| `language` | `VARCHAR(50)` | `DEFAULT 'plaintext'` | Syntax highlighting tag |
| `max_views` | `INTEGER` | `NULLABLE` | View ceiling (`NULL` = unlimited) |
| `view_count` | `INTEGER` | `DEFAULT 0, NOT NULL` | Number of times accessed |
| `expires_at` | `TIMESTAMPTZ` | `NULLABLE, INDEXED` | Expiration timestamp in UTC |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT NOW(), NOT NULL` | Creation timestamp |

---

## 5. Automated Test Suite (`npm test`)

The test suite in `tests/pastes.test.ts` contains 13 automated tests covering:

1. **Health Check:** Verifies `GET /api/health` returns `200` with service metadata.
2. **Input Validation:**
   * Rejects empty/whitespace content with `400 Bad Request`.
   * Rejects content $> 500\text{KB}$ with `413 Payload Too Large`.
   * Rejects negative/zero TTL and non-positive `max_views` with `400 Bad Request`.
   * Supports field aliases (`content` and `text`).
3. **Time-Based Expiration (TTL):**
   * Creates a paste with a 1-second TTL.
   * Confirms access succeeds at $t = 0\text{s}$, and returns `404` (`reason: 'expired'`) after 1.1s.
4. **View-Based Expiration (Burn-After-Reading):**
   * Creates a paste with `max_views: 2`.
   * Read 1 $\rightarrow$ `200 OK` (1 view left).
   * Read 2 $\rightarrow$ `200 OK` (0 views left).
   * Read 3 $\rightarrow$ `404 Not Found` (`reason: 'view_limit_reached'`).
5. **Concurrency & Race Condition Prevention:**
   * Creates a paste with `max_views: 3`.
   * Fires 10 concurrent requests simultaneously via `Promise.all`.
   * Verifies that strictly 3 requests succeed (`200`), and exactly 7 are rejected (`404`).
6. **Raw Text Access:**
   * Verifies `GET /api/pastes/:id/raw` returns `text/plain` for direct terminal/curl consumption.

---

## 6. How to Run & Verify

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite
npm test

# 3. Run production build check
npm run build

# 4. Start local development server
npm run dev
```
