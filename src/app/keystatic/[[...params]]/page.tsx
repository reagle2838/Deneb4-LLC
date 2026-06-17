import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/cms-auth';
import KeystaticApp from './keystatic-app';

export default async function KeystaticAdminPage() {
  const token = (await cookies()).get('cms_auth')?.value;
  if (!(await verifySession(token))) {
    redirect('/cms-login');
  }
  return (
    <>
      <KeystaticApp />
      <a
        href="/cms-admin"
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          zIndex: 1000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '6px',
          background: '#006b8f',
          color: '#ffffff',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
        }}
      >
        Client Manager →
      </a>
    </>
  );
}
