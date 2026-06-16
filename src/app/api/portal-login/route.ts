import { NextRequest, NextResponse } from 'next/server';
import { getClientByEmail } from '@/lib/clients';
import { verifyPassword, signPortalSession } from '@/lib/portal-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const client = await getClientByEmail(email);

    if (!client || !client.active || !client.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = verifyPassword(password, client.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const jwt = await signPortalSession(client.slug);
    const response = NextResponse.json({ ok: true });
    response.cookies.set('portal_session', jwt, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
