import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/cms-auth';
import { getAllClients } from '@/lib/clients';
import KeystaticApp from './keystatic-app';
import KeystaticClientManager from './KeystaticClientManager';

export const dynamic = 'force-dynamic';

export default async function KeystaticAdminPage() {
  const token = (await cookies()).get('cms_auth')?.value;
  if (!(await verifySession(token))) {
    redirect('/cms-login');
  }
  const clients = await getAllClients();
  const activeClients = clients.filter((c) => c.active).length;
  return (
    <>
      <KeystaticApp />
      <KeystaticClientManager activeClients={activeClients} />
    </>
  );
}
