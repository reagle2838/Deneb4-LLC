import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { DEFAULT_CAPABILITY_GROUPS, type CapabilityGroup } from '@/data/services';

const reader = createReader(process.cwd(), keystaticConfig);

export async function getCapabilityGroups(): Promise<CapabilityGroup[]> {
  try {
    const data = await reader.singletons.services.read();
    const groups = (data?.groups ?? [])
      .map((g) => ({
        id: (g.id || '').trim(),
        title: (g.title || '').trim(),
        tagline: g.tagline ?? '',
        items: (g.items ?? []).map((i) => (i ?? '').trim()).filter(Boolean),
      }))
      .filter((g) => g.id && g.title);
    return groups.length ? groups : DEFAULT_CAPABILITY_GROUPS;
  } catch {
    return DEFAULT_CAPABILITY_GROUPS;
  }
}
