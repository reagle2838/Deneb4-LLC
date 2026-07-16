import { NextRequest, NextResponse } from 'next/server';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { verifyPortalSession } from '@/lib/portal-auth';
import { addClientFile } from '@/lib/clients';

export const dynamic = 'force-dynamic';

/**
 * Client asset uploads (the in-house replacement for the GAS Drive folder
 * — Logos / Photos / Copywriting / Catalog). Vercel Blob in production
 * (BLOB_READ_WRITE_TOKEN), a local public/uploads fallback in dev — same
 * pattern d4-cms-core's own admin upload route already uses for client
 * sites, applied here to the studio app itself.
 */

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
const MAX_BYTES = 15 * 1024 * 1024;
const CATEGORIES = ['Logos', 'Photos', 'Copywriting', 'Catalog'] as const;

export async function POST(req: NextRequest) {
  const slug = await verifyPortalSession(req.cookies.get('portal_session')?.value);
  if (!slug) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const category = String(form.get('category') ?? '');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: `Category must be one of: ${CATEGORIES.join(', ')}.` }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 15 MB limit.' }, { status: 400 });
  }

  const safeBase = (file.name.replace(/\.[^.]*$/, '') || 'upload')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .slice(0, 80);
  const name = `${safeBase}-${Date.now().toString(36)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import('@vercel/blob');
      // Private: these are client business documents (price lists, unreleased
      // branding), not public assets. Served back only through the
      // authenticated /api/portal-file proxy, by pathname, never a bare URL.
      const pathname = `client-uploads/${slug}/${category}/${name}`;
      await put(pathname, buffer, { access: 'private', contentType: file.type });
      url = `/api/portal-file?path=${encodeURIComponent(pathname)}`;
    } catch (e) {
      console.error('[deneb4] portal upload (blob) failed:', e);
      return NextResponse.json({ error: 'Could not store the file. Please try again.' }, { status: 500 });
    }
  } else {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'clients', slug, category);
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, name), buffer);
      url = `/uploads/clients/${slug}/${category}/${name}`;
    } catch (e) {
      console.error('[deneb4] portal upload (local) failed:', e);
      return NextResponse.json({ error: 'Could not store the file. Please try again.' }, { status: 500 });
    }
  }

  addClientFile(slug, {
    name: file.name.slice(0, 200),
    url,
    description: `${category} — uploaded by you`,
    date: new Date().toISOString().slice(0, 10),
  });

  return NextResponse.json({ ok: true, url });
}
