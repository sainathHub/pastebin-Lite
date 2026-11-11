import { NextRequest, NextResponse } from 'next/server';
import { createPaste } from '@/lib/db';
import { generatePasteId, getBaseUrl } from '@/lib/utils';
import { CreatePasteResponse } from '@/lib/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    } else {
      // Fallback: try parsing as JSON or text
      const rawText = await request.text();
      try {
        body = JSON.parse(rawText);
      } catch {
        body = { content: rawText };
      }
    }

    // Flexible field names: content or text
    const content = typeof body.content === 'string' ? body.content : typeof body.text === 'string' ? body.text : '';
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required and cannot be empty' },
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Check payload size limit (500 KB)
    if (content.length > 500_000) {
      return NextResponse.json(
        { error: 'Content exceeds the maximum permitted size of 500KB' },
        {
          status: 413,
          headers: { 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const title = typeof body.title === 'string' ? body.title.slice(0, 255) : null;
    const language = typeof body.language === 'string' ? body.language.slice(0, 50) : 'plaintext';

    // Flexible TTL parsing: ttl_seconds, ttl, or expires_in
    let ttlSeconds: number | null = null;
    const rawTtl = body.ttl_seconds ?? body.ttl ?? body.expires_in;
    if (rawTtl !== undefined && rawTtl !== null && rawTtl !== '') {
      const parsed = Number(rawTtl);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'TTL must be a positive integer representing seconds' },
          {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
      ttlSeconds = Math.floor(parsed);
    }

    // Flexible max views parsing: max_views or views
    let maxViews: number | null = null;
    const rawViews = body.max_views ?? body.views;
    if (rawViews !== undefined && rawViews !== null && rawViews !== '') {
      const parsedViews = Number(rawViews);
      if (isNaN(parsedViews) || parsedViews <= 0) {
        return NextResponse.json(
          { error: 'max_views must be an integer greater than or equal to 1' },
          {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
      maxViews = Math.floor(parsedViews);
    }

    const id = generatePasteId();
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    const paste = await createPaste({
      id,
      title,
      content,
      language,
      max_views: maxViews,
      expires_at: expiresAt,
    });

    const baseUrl = getBaseUrl(request);
    const responsePayload: CreatePasteResponse = {
      id: paste.id,
      url: `${baseUrl}/${paste.id}`,
      raw_url: `${baseUrl}/api/pastes/${paste.id}/raw`,
      expires_at: paste.expires_at,
      max_views: paste.max_views,
      remaining_views: paste.max_views,
    };

    return NextResponse.json(responsePayload, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Location': responsePayload.url,
      },
    });
  } catch (error) {
    console.error('Error creating paste:', error);
    return NextResponse.json(
      { error: 'Internal server error while creating paste' },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
