'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { PORTAL_STAGE_SUMMARIES } from '@/lib/stages';
import type { ClientUpdate, ClientFile, ClientRevision, ClientInvoice, ClientStaging, ClientFeedback } from '@/lib/clients';
import PortalHeader from './components/PortalHeader';
import NextStepBanner from './components/NextStepBanner';
import ApprovalsSection from './components/ApprovalsSection';
import ProgressSection from './components/ProgressSection';
import PreviewSiteCard from './components/PreviewSiteCard';
import MessagesSection from './components/MessagesSection';
import FilesSection from './components/FilesSection';
import BillingSection from './components/BillingSection';
import NotesTimeline from './components/NotesTimeline';

export interface PortalData {
  slug: string;
  name: string;
  projectName: string;
  stage: string;
  driveFolder: string;
  staging: ClientStaging;
  updates: ClientUpdate[];
  files: ClientFile[];
  revisions: ClientRevision[];
  invoices: ClientInvoice[];
  feedbackOpen: boolean;
  feedback: ClientFeedback[];
  unreadMessages: number;
}

/**
 * The client's one-page home for their project: what's happening now,
 * anything that needs them, the preview, messages, files, billing, and
 * the full progress record. Everything is visible; nothing is hidden
 * behind tabs.
 */
export default function PortalView({ client }: { client: PortalData }) {
  const [updates, setUpdates] = useState<ClientUpdate[]>(client.updates);
  const [unread, setUnread] = useState(client.unreadMessages);

  const pendingApprovals = updates.filter((u) => u.status === 'pending-signoff').length;
  const clearUnread = useCallback(() => setUnread(0), []);

  return (
    <section style={{ background: 'var(--bg-base)' }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
        <PortalHeader name={client.name} projectName={client.projectName} />

        <NextStepBanner
          pendingApprovals={pendingApprovals}
          unreadMessages={unread}
          stageSummary={PORTAL_STAGE_SUMMARIES[client.stage] ?? ''}
        />

        <ApprovalsSection updates={updates} onUpdated={setUpdates} />

        <ProgressSection stage={client.stage} />

        <PreviewSiteCard staging={client.staging} />

        <MessagesSection
          initial={client.feedback}
          canComment={client.feedbackOpen}
          unread={unread}
          onSeen={clearUnread}
        />

        <FilesSection files={client.files} driveFolder={client.driveFolder} />

        <BillingSection invoices={client.invoices} />

        <NotesTimeline updates={updates} revisions={client.revisions} />

        <div className="mt-8 card p-6 accent-banner">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Prefer email? Write to{' '}
            <a href="mailto:hello@deneb4.com" style={{ color: 'var(--accent-light)' }}>hello@deneb4.com</a>{' '}or use the{' '}
            <Link href="/contact" style={{ color: 'var(--accent-light)' }}>contact form</Link>. Either way, you reach a person.
          </p>
        </div>
      </div>
    </section>
  );
}
