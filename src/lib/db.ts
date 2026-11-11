import { Paste } from './types';
import { Pool } from 'pg';
import { neon } from '@neondatabase/serverless';

// In-memory store fallback when DATABASE_URL is not set
interface MemoryPaste {
  id: string;
  title: string | null;
  content: string;
  language: string;
  max_views: number | null;
  view_count: number;
  expires_at: number | null; // epoch ms
  created_at: number;        // epoch ms
}

declare global {
  var __memoryPastes: Map<string, MemoryPaste> | undefined;
  var __pgPool: Pool | undefined;
  var __dbInitialized: boolean | undefined;
}

const memoryPastes = globalThis.__memoryPastes ?? (globalThis.__memoryPastes = new Map<string, MemoryPaste>());

function getPgPool(): Pool | null {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  if (dbUrl.includes('.neon.tech')) {
    // Neon HTTP client will be used instead
    return null;
  }
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
    });
  }
  return globalThis.__pgPool;
}

function getNeonSql() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.includes('.neon.tech')) {
    return neon(dbUrl);
  }
  return null;
}

export type PasteLookupResult =
  | { success: true; paste: Paste }
  | { success: false; reason: 'not_found' | 'expired' | 'view_limit_reached' };

export async function initDb(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return; // In-memory store needs no init
  if (globalThis.__dbInitialized) return;

  const neonSql = getNeonSql();
  const pool = getPgPool();

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS pastes (
      id VARCHAR(32) PRIMARY KEY,
      title VARCHAR(255),
      content TEXT NOT NULL,
      language VARCHAR(50) DEFAULT 'plaintext',
      max_views INTEGER DEFAULT NULL,
      view_count INTEGER DEFAULT 0 NOT NULL,
      expires_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at);
  `;

  if (neonSql) {
    await neonSql`
      CREATE TABLE IF NOT EXISTS pastes (
        id VARCHAR(32) PRIMARY KEY,
        title VARCHAR(255),
        content TEXT NOT NULL,
        language VARCHAR(50) DEFAULT 'plaintext',
        max_views INTEGER DEFAULT NULL,
        view_count INTEGER DEFAULT 0 NOT NULL,
        expires_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `;
    await neonSql`CREATE INDEX IF NOT EXISTS idx_pastes_expires_at ON pastes(expires_at)`;
  } else if (pool) {
    await pool.query(createTableQuery);
  }

  globalThis.__dbInitialized = true;
}

export async function createPaste(data: {
  id: string;
  title?: string | null;
  content: string;
  language?: string | null;
  max_views?: number | null;
  expires_at?: Date | null;
}): Promise<Paste> {
  await initDb();

  const neonSql = getNeonSql();
  const pool = getPgPool();

  const title = data.title?.trim() || null;
  const language = data.language?.trim() || 'plaintext';
  const max_views = data.max_views && data.max_views > 0 ? Math.floor(data.max_views) : null;
  const expires_at_iso = data.expires_at ? data.expires_at.toISOString() : null;

  if (neonSql) {
    const rows = (await neonSql`
      INSERT INTO pastes (id, title, content, language, max_views, view_count, expires_at, created_at)
      VALUES (${data.id}, ${title}, ${data.content}, ${language}, ${max_views}, 0, ${expires_at_iso}, NOW())
      RETURNING id, title, content, language, max_views, view_count, expires_at, created_at
    `) as Array<{
      id: string;
      title: string | null;
      content: string;
      language: string;
      max_views: number | null;
      view_count: number;
      expires_at: string | Date | null;
      created_at: string | Date;
    }>;

    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      language: row.language,
      max_views: row.max_views,
      view_count: row.view_count,
      expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  if (pool) {
    const res = await pool.query(
      `INSERT INTO pastes (id, title, content, language, max_views, view_count, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, $6, NOW())
       RETURNING id, title, content, language, max_views, view_count, expires_at, created_at`,
      [data.id, title, data.content, language, max_views, expires_at_iso]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      language: row.language,
      max_views: row.max_views,
      view_count: row.view_count,
      expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  // Memory fallback
  const now = Date.now();
  const memoryPaste: MemoryPaste = {
    id: data.id,
    title,
    content: data.content,
    language,
    max_views,
    view_count: 0,
    expires_at: data.expires_at ? data.expires_at.getTime() : null,
    created_at: now,
  };
  memoryPastes.set(data.id, memoryPaste);

  return {
    id: memoryPaste.id,
    title: memoryPaste.title,
    content: memoryPaste.content,
    language: memoryPaste.language,
    max_views: memoryPaste.max_views,
    view_count: 0,
    expires_at: memoryPaste.expires_at ? new Date(memoryPaste.expires_at).toISOString() : null,
    created_at: new Date(memoryPaste.created_at).toISOString(),
  };
}

export async function getPasteAndIncrementViews(id: string): Promise<PasteLookupResult> {
  await initDb();

  const neonSql = getNeonSql();
  const pool = getPgPool();

  if (neonSql) {
    // Atomic update in Neon Postgres
    const updatedRows = (await neonSql`
      UPDATE pastes
      SET view_count = view_count + 1
      WHERE id = ${id}
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (max_views IS NULL OR view_count < max_views)
      RETURNING id, title, content, language, max_views, view_count, expires_at, created_at
    `) as Array<{
      id: string;
      title: string | null;
      content: string;
      language: string;
      max_views: number | null;
      view_count: number;
      expires_at: string | Date | null;
      created_at: string | Date;
    }>;

    if (updatedRows.length > 0) {
      const row = updatedRows[0];
      return {
        success: true,
        paste: {
          id: row.id,
          title: row.title,
          content: row.content,
          language: row.language,
          max_views: row.max_views,
          view_count: row.view_count,
          expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          created_at: new Date(row.created_at).toISOString(),
        },
      };
    }

    // Determine reason if update did not affect any rows
    const checkRows = (await neonSql`
      SELECT id, expires_at, max_views, view_count, NOW() as current_time
      FROM pastes
      WHERE id = ${id}
    `) as Array<{
      id: string;
      expires_at: string | Date | null;
      max_views: number | null;
      view_count: number;
      current_time: string | Date;
    }>;

    if (checkRows.length === 0) {
      return { success: false, reason: 'not_found' };
    }

    const check = checkRows[0];
    const now = new Date(check.current_time).getTime();
    if (check.expires_at && new Date(check.expires_at).getTime() <= now) {
      return { success: false, reason: 'expired' };
    }
    if (check.max_views !== null && check.view_count >= check.max_views) {
      return { success: false, reason: 'view_limit_reached' };
    }

    return { success: false, reason: 'not_found' };
  }

  if (pool) {
    // Atomic update in PostgreSQL Pool
    const res = await pool.query(
      `UPDATE pastes
       SET view_count = view_count + 1
       WHERE id = $1
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_views IS NULL OR view_count < max_views)
       RETURNING id, title, content, language, max_views, view_count, expires_at, created_at`,
      [id]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        success: true,
        paste: {
          id: row.id,
          title: row.title,
          content: row.content,
          language: row.language,
          max_views: row.max_views,
          view_count: row.view_count,
          expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          created_at: new Date(row.created_at).toISOString(),
        },
      };
    }

    const checkRes = await pool.query(
      `SELECT id, expires_at, max_views, view_count, NOW() as current_time FROM pastes WHERE id = $1`,
      [id]
    );
    if (checkRes.rows.length === 0) {
      return { success: false, reason: 'not_found' };
    }

    const check = checkRes.rows[0];
    const now = new Date(check.current_time).getTime();
    if (check.expires_at && new Date(check.expires_at).getTime() <= now) {
      return { success: false, reason: 'expired' };
    }
    if (check.max_views !== null && check.view_count >= check.max_views) {
      return { success: false, reason: 'view_limit_reached' };
    }

    return { success: false, reason: 'not_found' };
  }

  // Memory fallback with atomic check
  const item = memoryPastes.get(id);
  if (!item) {
    return { success: false, reason: 'not_found' };
  }

  const now = Date.now();
  if (item.expires_at !== null && item.expires_at <= now) {
    return { success: false, reason: 'expired' };
  }

  if (item.max_views !== null && item.view_count >= item.max_views) {
    return { success: false, reason: 'view_limit_reached' };
  }

  // Increment view count atomically
  item.view_count += 1;

  return {
    success: true,
    paste: {
      id: item.id,
      title: item.title,
      content: item.content,
      language: item.language,
      max_views: item.max_views,
      view_count: item.view_count,
      expires_at: item.expires_at ? new Date(item.expires_at).toISOString() : null,
      created_at: new Date(item.created_at).toISOString(),
    },
  };
}

export async function clearAllForTesting(): Promise<void> {
  memoryPastes.clear();
  const pool = getPgPool();
  const neonSql = getNeonSql();
  if (neonSql) {
    await neonSql`DELETE FROM pastes`;
  } else if (pool) {
    await pool.query('DELETE FROM pastes');
  }
}
