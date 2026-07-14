import fs from 'fs';
import path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

/**
 * Wave (waveapps.com) integration: real invoices and real payment
 * detection, replacing the manual "mark it paid" step. Credential-gated
 * like every other integration — without WAVE_ACCESS_TOKEN +
 * WAVE_BUSINESS_ID, `waveEnabled()` is false and Billing behaves exactly
 * as before (portal record + Resend email + manual paid-marking).
 *
 * Flow when enabled:
 *  - Ridhi's "Approve & send" creates a real Wave invoice (customer
 *    auto-created once per client, cached), approves it, and has WAVE
 *    email it with the PDF attached. The Wave viewUrl lands on the
 *    client's portal record, so "View invoice" opens the real thing.
 *  - billing-watch polls Wave for unpaid invoices' status each heartbeat;
 *    PAID flips the local record automatically, which triggers the
 *    existing all-paid → handoff automation. Payments Ridhi records by
 *    hand inside Wave (a check, a wire) are detected the same way.
 *
 * Self-contained by design (no imports from other lib modules) so it can
 * be exercised directly by a test harness outside Next.
 *
 * Wave-side bookkeeping lives in content/admin/wave/: one `_business.yaml`
 * (shared product id) and one `<slug>.yaml` per client (customer id).
 * These are ids, not secrets — safe to track.
 */

const GQL_URL = 'https://gql.waveapps.com/graphql/public';
const WAVE_DIR = path.join(process.cwd(), 'content', 'admin', 'wave');
const PRODUCT_NAME = 'Deneb4 Web Services';

export function waveEnabled(): boolean {
  return Boolean(process.env.WAVE_ACCESS_TOKEN && process.env.WAVE_BUSINESS_ID);
}

const businessId = () => process.env.WAVE_BUSINESS_ID as string;

// ── GraphQL plumbing ─────────────────────────────────────────────────────

interface GqlError {
  message: string;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WAVE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
    const json = (await res.json()) as { data?: T; errors?: GqlError[] };
    if (json.errors?.length) throw new Error(`Wave API: ${json.errors.map((e) => e.message).join('; ')}`);
    if (!json.data) throw new Error(`Wave API: empty response (HTTP ${res.status})`);
    return json.data;
  } finally {
    clearTimeout(t);
  }
}

/** Mutations all share this result envelope; throw a readable error on failure. */
function assertSucceeded(
  label: string,
  payload: { didSucceed: boolean; inputErrors?: { message: string; path?: string[] }[] | null }
): void {
  if (payload.didSucceed) return;
  const details = (payload.inputErrors ?? []).map((e) => `${e.path?.join('.') ?? ''}: ${e.message}`).join('; ');
  throw new Error(`Wave ${label} failed${details ? `: ${details}` : ''}`);
}

// ── Local id cache (ids only, never secrets) ─────────────────────────────

function readState<T>(file: string): T | null {
  const fp = path.join(WAVE_DIR, file);
  if (!fs.existsSync(fp)) return null;
  try {
    return (yamlLoad(fs.readFileSync(fp, 'utf-8')) as T) ?? null;
  } catch {
    return null;
  }
}

function writeState(file: string, data: unknown): void {
  if (!fs.existsSync(WAVE_DIR)) fs.mkdirSync(WAVE_DIR, { recursive: true });
  fs.writeFileSync(path.join(WAVE_DIR, file), yamlDump(data, { lineWidth: -1, quotingType: '"' }), 'utf-8');
}

// ── Customer (one per client, created on first invoice) ─────────────────

export async function ensureCustomer(slug: string, name: string, email: string): Promise<string> {
  // Inline slug guard (this module stays self-contained for the test
  // harness): the slug becomes a filename below, so reject traversal.
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)) throw new Error('Invalid slug.');
  const cached = readState<{ customerId?: string }>(`${slug}.yaml`);
  if (cached?.customerId) return cached.customerId;

  const data = await gql<{
    customerCreate: { didSucceed: boolean; inputErrors?: { message: string; path?: string[] }[]; customer?: { id: string } };
  }>(
    `mutation C($input: CustomerCreateInput!) {
       customerCreate(input: $input) { didSucceed inputErrors { message path } customer { id } }
     }`,
    { input: { businessId: businessId(), name, email: email || undefined } }
  );
  assertSucceeded('customer creation', data.customerCreate);
  const id = data.customerCreate.customer!.id;
  writeState(`${slug}.yaml`, { customerId: id, name, createdAt: new Date().toISOString() });
  return id;
}

// ── Product (one shared line-item product for the whole business) ────────

async function findIncomeAccountId(): Promise<string | undefined> {
  const data = await gql<{
    business: { accounts: { edges: { node: { id: string; name: string } }[] } };
  }>(
    `query A($businessId: ID!) {
       business(id: $businessId) {
         accounts(types: [INCOME], page: 1, pageSize: 5) { edges { node { id name } } }
       }
     }`,
    { businessId: businessId() }
  );
  return data.business.accounts.edges[0]?.node.id;
}

export async function ensureProduct(): Promise<string> {
  const cached = readState<{ productId?: string }>('_business.yaml');
  if (cached?.productId) return cached.productId;

  const create = async (incomeAccountId?: string) =>
    gql<{
      productCreate: { didSucceed: boolean; inputErrors?: { message: string; path?: string[] }[]; product?: { id: string } };
    }>(
      `mutation P($input: ProductCreateInput!) {
         productCreate(input: $input) { didSucceed inputErrors { message path } product { id } }
       }`,
      {
        input: {
          businessId: businessId(),
          name: PRODUCT_NAME,
          unitPrice: '0',
          description: 'Website design, build, and related services.',
          ...(incomeAccountId ? { incomeAccountId } : {}),
        },
      }
    );

  let data = await create();
  if (!data.productCreate.didSucceed) {
    // Some businesses require an income account on products; retry with one.
    const incomeId = await findIncomeAccountId();
    if (incomeId) data = await create(incomeId);
  }
  assertSucceeded('product creation', data.productCreate);
  const id = data.productCreate.product!.id;
  writeState('_business.yaml', { productId: id, productName: PRODUCT_NAME, createdAt: new Date().toISOString() });
  return id;
}

// ── Invoices ─────────────────────────────────────────────────────────────

export interface WaveInvoice {
  id: string;
  invoiceNumber: string;
  viewUrl: string;
  pdfUrl: string;
  status: string;
}

export async function createInvoice(input: {
  customerId: string;
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  memo?: string;
}): Promise<WaveInvoice> {
  const productId = await ensureProduct();
  const data = await gql<{
    invoiceCreate: {
      didSucceed: boolean;
      inputErrors?: { message: string; path?: string[] }[];
      invoice?: WaveInvoice;
    };
  }>(
    `mutation I($input: InvoiceCreateInput!) {
       invoiceCreate(input: $input) {
         didSucceed inputErrors { message path }
         invoice { id invoiceNumber viewUrl pdfUrl status }
       }
     }`,
    {
      input: {
        businessId: businessId(),
        customerId: input.customerId,
        // SAVED = approved and ready to send (skips the separate approve step).
        status: 'SAVED',
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate,
        memo: input.memo?.slice(0, 4000),
        items: [
          {
            productId,
            description: input.description,
            quantity: '1',
            unitPrice: input.amount.toFixed(2),
          },
        ],
      },
    }
  );
  assertSucceeded('invoice creation', data.invoiceCreate);
  return data.invoiceCreate.invoice!;
}

/**
 * Have Wave email the invoice (PDF attached). NOTE: verified 2026-07-13
 * that personal access tokens get "Action not authorized" here — Wave
 * reserves API emailing for full OAuth apps. Kept for that future; the
 * live flow instead uses markInvoiceSent + our own branded Resend email
 * carrying the Wave viewUrl, which reads better to clients anyway.
 */
export async function sendInvoice(invoiceId: string, to: string, subject: string, message: string): Promise<void> {
  const data = await gql<{
    invoiceSend: { didSucceed: boolean; inputErrors?: { message: string; path?: string[] }[] };
  }>(
    `mutation S($input: InvoiceSendInput!) {
       invoiceSend(input: $input) { didSucceed inputErrors { message path } }
     }`,
    { input: { invoiceId, to: [to], subject, message, attachPDF: true, ccMyself: true } }
  );
  assertSucceeded('invoice send', data.invoiceSend);
}

/**
 * Flip the invoice into Wave's "sent" lifecycle (we deliver the email
 * ourselves). Verified working with a personal access token.
 */
export async function markInvoiceSent(invoiceId: string): Promise<void> {
  const data = await gql<{
    invoiceMarkSent: { didSucceed: boolean; inputErrors?: { message: string; path?: string[] }[] };
  }>(
    `mutation M($input: InvoiceMarkSentInput!) {
       invoiceMarkSent(input: $input) { didSucceed inputErrors { message path } }
     }`,
    { input: { invoiceId, sendMethod: 'NOT_SENT' } }
  );
  assertSucceeded('invoice mark-sent', data.invoiceMarkSent);
}

export interface WaveInvoiceStatus {
  status: string; // DRAFT|SAVED|SENT|VIEWED|PARTIAL|PAID|OVERPAID|OVERDUE|UNPAID
  amountDue: number;
  amountPaid: number;
  viewUrl: string;
}

export async function getInvoiceStatus(invoiceId: string): Promise<WaveInvoiceStatus | null> {
  const data = await gql<{
    business: {
      invoice: { status: string; amountDue: { value: string }; amountPaid: { value: string }; viewUrl: string } | null;
    };
  }>(
    `query V($businessId: ID!, $invoiceId: ID!) {
       business(id: $businessId) {
         invoice(id: $invoiceId) { status amountDue { value } amountPaid { value } viewUrl }
       }
     }`,
    { businessId: businessId(), invoiceId }
  );
  const inv = data.business.invoice;
  if (!inv) return null;
  // Wave returns money as a display string WITH thousands separators
  // (e.g. "1,800.00"); Number() on that yields NaN, so strip non-numerics.
  const num = (v: string) => Number(String(v).replace(/[^0-9.-]/g, ''));
  return {
    status: inv.status,
    amountDue: num(inv.amountDue.value),
    amountPaid: num(inv.amountPaid.value),
    viewUrl: inv.viewUrl,
  };
}

/** A Wave invoice counts as settled when nothing remains due on it. */
export function isSettled(s: WaveInvoiceStatus): boolean {
  return s.status === 'PAID' || s.status === 'OVERPAID' || s.amountDue <= 0;
}

// ── Cleanup helpers (test harness + future admin needs) ─────────────────

export async function deleteInvoice(invoiceId: string): Promise<void> {
  const data = await gql<{ invoiceDelete: { didSucceed: boolean; inputErrors?: { message: string }[] } }>(
    `mutation D($input: InvoiceDeleteInput!) { invoiceDelete(input: $input) { didSucceed inputErrors { message } } }`,
    { input: { invoiceId } }
  );
  assertSucceeded('invoice delete', data.invoiceDelete);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const data = await gql<{ customerDelete: { didSucceed: boolean; inputErrors?: { message: string }[] } }>(
    `mutation D($input: CustomerDeleteInput!) { customerDelete(input: $input) { didSucceed inputErrors { message } } }`,
    { input: { id: customerId } }
  );
  assertSucceeded('customer delete', data.customerDelete);
}
