import { NextRequest, NextResponse } from 'next/server';
import { getPasteAndIncrementViews } from '@/lib/db';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id) {
      return new NextResponse('Invalid paste ID', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const result = await getPasteAndIncrementViews(id);

    if (!result.success) {
      const messages: Record<string, string> = {
        not_found: '404: Paste not found',
        expired: '404: Paste has expired',
        view_limit_reached: '404: Paste has reached its maximum view limit',
      };

      return new NextResponse(messages[result.reason] || '404: Paste not found or expired', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    return new NextResponse(result.paste.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error in raw paste handler:', error);
    return new NextResponse('Internal server error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
