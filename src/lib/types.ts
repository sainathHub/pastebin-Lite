export interface Paste {
  id: string;
  title: string | null;
  content: string;
  language: string;
  max_views: number | null;
  view_count: number;
  expires_at: string | null; // ISO string
  created_at: string;        // ISO string
}

export interface CreatePasteInput {
  content: string;
  title?: string | null;
  language?: string | null;
  ttl_seconds?: number | null;
  max_views?: number | null;
}

export interface PasteResponse {
  id: string;
  title: string | null;
  content: string;
  language: string;
  created_at: string;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  remaining_views: number | null;
}

export interface CreatePasteResponse {
  id: string;
  url: string;
  raw_url: string;
  expires_at: string | null;
  max_views: number | null;
  remaining_views: number | null;
}

