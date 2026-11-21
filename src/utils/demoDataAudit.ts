import { SalesLead, Shop } from '../types';

export type AuditClassification = 'real' | 'demo' | 'test' | 'sample' | 'uncertain';

export interface AuditedRecordItem {
  id: string;
  collection: 'shops' | 'salesLeads';
  label: string;
  sublabel: string;
  classification: AuditClassification;
  reasons: string[];
  createdAt?: string;
}

export interface DemoDataAuditReport {
  generatedAt: string;
  totals: Record<AuditClassification, number>;
  items: AuditedRecordItem[];
}

const DEMO_SLUGS = new Set([
  'demo',
  'demo-shop',
  'demo-store',
  'sample',
  'sample-shop',
  'test',
  'test-shop',
  'test-store',
  'sandbox',
  'placeholder',
]);

const DEMO_KEYWORDS = /\b(demo|sample|dummy|lorem ipsum|fake|qa test|staging|placeholder)\b/i;
const TEST_EMAIL_REGEX = /@(example\.com|test\.com|dummy\.com|mailinator\.com|fake\.pk)$/i;
const PLACEHOLDER_PHONE_REGEX = /^(03000000000|03001234567|03123456789|00000000000|1234567890)$/;

function normalizeDigits(val?: string): string {
  return String(val || '').replace(/\D/g, '');
}

export function classifyShopRecord(shop: Shop): AuditedRecordItem {
  const slug = String(shop.slug || shop.id || '').toLowerCase().trim();
  const email = String(shop.ownerEmail || '').toLowerCase().trim();
  const name = String(shop.name || '').trim();
  const phoneDigits = normalizeDigits(shop.ownerPhone);
  const reasons: string[] = [];

  const hasPaidOrLiveUsage =
    (shop.usage?.ordersCount || 0) > 0 ||
    (shop.usage?.productsCount || 0) >= 5 ||
    (shop.subscription?.pricePaid || 0) > 0 ||
    (shop.subscription?.planId !== undefined && shop.subscription.planId !== 'free-starter' && shop.subscription.status === 'active');

  if (DEMO_SLUGS.has(slug)) reasons.push(`Slug "${slug}" matches known demo/test identifier`);
  if (TEST_EMAIL_REGEX.test(email)) reasons.push(`Placeholder email domain (${email})`);
  if (DEMO_KEYWORDS.test(name)) reasons.push('Shop name contains demo/sample/placeholder keyword');
  if (PLACEHOLDER_PHONE_REGEX.test(phoneDigits)) reasons.push('Placeholder phone pattern detected');
  if ((shop as any).isDemo === true) reasons.push('Explicit isDemo flag set');

  let classification: AuditClassification = 'real';
  if (reasons.length > 0 && hasPaidOrLiveUsage) {
    classification = 'uncertain';
    reasons.push('Preserved as uncertain because store also holds products, orders, or payment history');
  } else if (reasons.some((r) => r.includes('Placeholder email') || r.includes('test'))) {
    classification = slug.includes('demo') || (shop as any).isDemo ? 'demo' : 'test';
  } else if (reasons.some((r) => r.includes('sample'))) {
    classification = 'sample';
  } else if (reasons.length > 0) {
    classification = 'demo';
  } else {
    reasons.push('No demo or placeholder signatures detected');
  }

  return {
    id: shop.id,
    collection: 'shops',
    label: name || shop.id,
    sublabel: `${slug} · ${email || 'no email'} · ${shop.usage?.productsCount || 0} products / ${shop.usage?.ordersCount || 0} orders`,
    classification,
    reasons,
    createdAt: shop.createdAt,
  };
}

export function classifyLeadRecord(lead: SalesLead): AuditedRecordItem {
  const email = String(lead.email || '').toLowerCase().trim();
  const phoneDigits = normalizeDigits(lead.phone);
  const name = `${lead.businessName || ''} ${lead.ownerName || ''}`.trim();
  const reasons: string[] = [];

  if (TEST_EMAIL_REGEX.test(email)) reasons.push(`Placeholder email (${email})`);
  if (PLACEHOLDER_PHONE_REGEX.test(phoneDigits)) reasons.push('Placeholder phone pattern');
  if (DEMO_KEYWORDS.test(name)) reasons.push('Business or contact name contains demo/sample text');

  let classification: AuditClassification = 'real';
  if (reasons.length > 0) {
    classification = lead.status === 'Converted' ? 'uncertain' : DEMO_KEYWORDS.test(name) ? 'demo' : 'test';
  } else {
    reasons.push('Genuine lead contact signature');
  }

  return {
    id: lead.id,
    collection: 'salesLeads',
    label: lead.businessName || lead.id,
    sublabel: `${lead.ownerName || 'Contact'} · ${lead.phone || 'no phone'} · ${lead.city || 'Pakistan'}`,
    classification,
    reasons,
    createdAt: lead.createdAt,
  };
}

export function buildDemoDataAuditReport(params: {
  shops: Shop[];
  leads?: SalesLead[];
}): DemoDataAuditReport {
  const items: AuditedRecordItem[] = [
    ...params.shops.map(classifyShopRecord),
    ...(params.leads || []).map(classifyLeadRecord),
  ];

  const totals: Record<AuditClassification, number> = {
    real: 0,
    demo: 0,
    test: 0,
    sample: 0,
    uncertain: 0,
  };
  for (const item of items) {
    totals[item.classification] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    items,
  };
}
