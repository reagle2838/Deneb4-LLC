import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Clears the portal session cookie so shared computers stay safe. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('portal_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
