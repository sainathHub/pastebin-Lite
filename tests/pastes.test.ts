import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { clearAllForTesting } from '@/lib/db';
import { POST as createPasteHandler } from '@/app/api/pastes/route';
import { GET as getPasteHandler } from '@/app/api/pastes/[id]/route';
import { GET as getRawPasteHandler } from '@/app/api/pastes/[id]/raw/route';
import { GET as healthHandler } from '@/app/api/health/route';

describe('Pastebin-Lite API & Core Logic', () => {
  beforeEach(async () => {
    await clearAllForTesting();
  });

  describe('Health Check', () => {
    it('returns status ok', async () => {
      const res = await healthHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.service).toBe('pastebin-lite');
    });
  });

  describe('Paste Creation (POST /api/pastes)', () => {
    it('creates a simple paste successfully', async () => {
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Hello, world!',
          title: 'My First Paste',
          language: 'markdown',
        }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.url).toContain(data.id);
      expect(data.raw_url).toContain(`/api/pastes/${data.id}/raw`);
      expect(data.expires_at).toBeNull();
      expect(data.max_views).toBeNull();
    });

    it('creates a paste using alternative field name "text"', async () => {
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Using text instead of content',
        }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
    });

    it('rejects empty content with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('required');
    });

    it('rejects oversized content with 413', async () => {
      const hugeContent = 'a'.repeat(500_001);
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: hugeContent }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(413);
    });

    it('rejects invalid TTL with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test', ttl_seconds: -10 }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(400);
    });

    it('rejects invalid max_views with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test', max_views: 0 }),
      });

      const res = await createPasteHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe('Paste Retrieval (GET /api/pastes/:id)', () => {
    it('returns paste content and increments view count', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Secret message',
          title: 'Classified',
        }),
      });
      const createRes = await createPasteHandler(createReq);
      const { id } = await createRes.json();

      // First fetch
      const getReq1 = new NextRequest(`http://localhost:3000/api/pastes/${id}`);
      const getRes1 = await getPasteHandler(getReq1, { params: Promise.resolve({ id }) });
      expect(getRes1.status).toBe(200);
      const data1 = await getRes1.json();
      expect(data1.content).toBe('Secret message');
      expect(data1.view_count).toBe(1);

      // Second fetch
      const getReq2 = new NextRequest(`http://localhost:3000/api/pastes/${id}`);
      const getRes2 = await getPasteHandler(getReq2, { params: Promise.resolve({ id }) });
      expect(getRes2.status).toBe(200);
      const data2 = await getRes2.json();
      expect(data2.view_count).toBe(2);
    });

    it('returns 404 for non-existent paste', async () => {
      const getReq = new NextRequest('http://localhost:3000/api/pastes/nonexistent');
      const getRes = await getPasteHandler(getReq, { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(getRes.status).toBe(404);
      const data = await getRes.json();
      expect(data.reason).toBe('not_found');
    });
  });

  describe('Time-Based Expiration (TTL)', () => {
    it('expires after specified TTL seconds', async () => {
      // 1-second TTL
      const createReq = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'This will self-destruct in 1 second',
          ttl_seconds: 1,
        }),
      });
      const createRes = await createPasteHandler(createReq);
      const { id } = await createRes.json();

      // Check immediately - should succeed
      const getReq1 = new NextRequest(`http://localhost:3000/api/pastes/${id}`);
      const getRes1 = await getPasteHandler(getReq1, { params: Promise.resolve({ id }) });
      expect(getRes1.status).toBe(200);

      // Wait 1.1 seconds for TTL to elapse
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Check after expiration - should return 404 expired
      const getReq2 = new NextRequest(`http://localhost:3000/api/pastes/${id}`);
      const getRes2 = await getPasteHandler(getReq2, { params: Promise.resolve({ id }) });
      expect(getRes2.status).toBe(404);
      const data = await getRes2.json();
      expect(data.reason).toBe('expired');
    });
  });

  describe('View-Based Expiration (Burn-After-Reading)', () => {
    it('expires exactly after max_views is reached', async () => {
      // 2 views max
      const createReq = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Burn after 2 views',
          max_views: 2,
        }),
      });
      const createRes = await createPasteHandler(createReq);
      const { id } = await createRes.json();

      // View 1
      const res1 = await getPasteHandler(
        new NextRequest(`http://localhost:3000/api/pastes/${id}`),
        { params: Promise.resolve({ id }) }
      );
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.view_count).toBe(1);
      expect(body1.remaining_views).toBe(1);

      // View 2
      const res2 = await getPasteHandler(
        new NextRequest(`http://localhost:3000/api/pastes/${id}`),
        { params: Promise.resolve({ id }) }
      );
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.view_count).toBe(2);
      expect(body2.remaining_views).toBe(0);

      // View 3 - should fail!
      const res3 = await getPasteHandler(
        new NextRequest(`http://localhost:3000/api/pastes/${id}`),
        { params: Promise.resolve({ id }) }
      );
      expect(res3.status).toBe(404);
      const body3 = await res3.json();
      expect(body3.reason).toBe('view_limit_reached');
    });
  });

  describe('Concurrency & Race Condition Prevention', () => {
    it('allows strictly N reads when N concurrent requests compete', async () => {
      const allowedViews = 3;
      const totalConcurrentRequests = 10;

      const createReq = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'High-concurrency test',
          max_views: allowedViews,
        }),
      });
      const createRes = await createPasteHandler(createReq);
      const { id } = await createRes.json();

      // Launch 10 simultaneous requests
      const promises = Array.from({ length: totalConcurrentRequests }).map(() =>
        getPasteHandler(
          new NextRequest(`http://localhost:3000/api/pastes/${id}`),
          { params: Promise.resolve({ id }) }
        )
      );

      const responses = await Promise.all(promises);
      const successCount = responses.filter((r) => r.status === 200).length;
      const blockedCount = responses.filter((r) => r.status === 404).length;

      expect(successCount).toBe(allowedViews);
      expect(blockedCount).toBe(totalConcurrentRequests - allowedViews);
    });
  });

  describe('Raw Text Endpoint (/api/pastes/:id/raw)', () => {
    it('returns raw text with text/plain content-type', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/pastes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'RAW_UNFORMATTED_TEXT_123',
        }),
      });
      const createRes = await createPasteHandler(createReq);
      const { id } = await createRes.json();

      const rawRes = await getRawPasteHandler(
        new NextRequest(`http://localhost:3000/api/pastes/${id}/raw`),
        { params: Promise.resolve({ id }) }
      );

      expect(rawRes.status).toBe(200);
      expect(rawRes.headers.get('Content-Type')).toContain('text/plain');
      const text = await rawRes.text();
      expect(text).toBe('RAW_UNFORMATTED_TEXT_123');
    });
  });
});

