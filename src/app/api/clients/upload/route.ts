import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/cms-auth';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Persistent-server file storage (works on Hostinger VPS / Node hosting,
// where the filesystem survives between requests). Files land in
// public/uploads/{slug}/ and are served at /uploads/{slug}/{filename}.
export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get('cms_auth')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const slug = form.get('slug');

    if (!(file instanceof File) || typeof slug !== 'string' || !slug) {
      return NextResponse.json({ error: 'Missing file or slug.' }, { status: 400 });
    }

    // Sanitize the filename and avoid collisions with a short prefix.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const prefix = Date.now().toString(36);
    const fileName = `${prefix}-${safeName}`;

    const dir = path.join(process.cwd(), 'public', 'uploads', slug);
    fs.mkdirSync(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, fileName), buffer);

    const url = `/uploads/${slug}/${fileName}`;
    return NextResponse.json({ url, name: file.name });
  } catch {
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
