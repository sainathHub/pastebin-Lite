import { NextRequest, NextResponse } from 'next/server';
import { getPasteAndIncrementViews } from '@/lib/db';
import { PasteResponse } from '@/lib/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid paste ID' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const result = await getPasteAndIncrementViews(id);

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: 'Paste not found',
        expired: 'Paste has expired',
        view_limit_reached: 'Paste has reached its view limit and is no longer accessible',
      };

      return NextResponse.json(
        {
          error: messages[result.reason] || 'Paste not found or has expired',
          reason: result.reason,
        },
        {
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const paste = result.paste;
    const remainingViews =
      paste.max_views !== null ? Math.max(0, paste.max_views - paste.view_count) : null;

    const responsePayload: PasteResponse = {
      id: paste.id,
      title: paste.title,
      content: paste.content,
      language: paste.language,
      created_at: paste.created_at,
      expires_at: paste.expires_at,
      max_views: paste.max_views,
      view_count: paste.view_count,
      remaining_views: remainingViews,
    };

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error fetching paste:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching paste' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
