import { relicMainProperty, localizeSubstat } from './relic-stats.mjs';

// Same-category values are ORed. Different categories are ANDed.
// Only actually rolled substats are filtered; preview_substats are excluded.
export const CANDIDATE_FILTER_FIELDS = ['setIds', 'slots', 'mainstats', 'substats'];

export const RELIC_SLOT_LABELS = {
  Head: '머리',
  Hands: '장갑',
  Body: '몸통',
  Feet: '신발',
  'Planar Sphere': '차원 구체',
  'Link Rope': '연결 매듭',
};

export function normalizeCandidateFilters(input = {}) {
  const filters = {};
  for (const field of CANDIDATE_FILTER_FIELDS) {
    const values = input?.[field] ?? [];
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string' && typeof value !== 'number')) {
      throw new Error('올바르지 않은 유물 필터 항목: ' + field);
    }
    filters[field] = [...new Set(values.map(String))];
  }
  return filters;
}

export function filterCandidateRelics(relics, input = {}) {
  const filters = normalizeCandidateFilters(input);
  const selected = Object.fromEntries(CANDIDATE_FILTER_FIELDS.map(field => [field, new Set(filters[field])]));
  const matches = relics.filter(item => {
    if (selected.setIds.size && !selected.setIds.has(String(item.set_id))) return false;
    if (selected.slots.size && !selected.slots.has(String(item.slot))) return false;
    if (selected.mainstats.size && !selected.mainstats.has(String(item.mainstat))) return false;
    if (selected.substats.size &&
      !(item.substats ?? []).some(stat => selected.substats.has(String(stat.key)))) return false;
    return true;
  });
  return { relics: matches, filters };
}

export function buildCandidateFilterOptions(scanner, tables) {
  const relics = (scanner.relics ?? []).filter(item => !item.location);
  const categories = {
    sets: new Map(), slots: new Map(), mainstats: new Map(), substats: new Map(),
  };

  function add(category, value, label) {
    const key = String(value);
    const current = categories[category].get(key);
    if (current) current.count += 1;
    else categories[category].set(key, { value: key, label, count: 1 });
  }

  for (const relic of relics) {
    const setId = String(relic.set_id);
    add('sets', setId, tables.relic_sets?.[setId]?.name ?? setId);
    add('slots', relic.slot, RELIC_SLOT_LABELS[relic.slot] ?? relic.slot);
    const mainProperty = relicMainProperty(relic);
    add('mainstats', relic.mainstat,
      tables.properties?.[mainProperty]?.name ?? relic.mainstat);
    const uniqueKeys = new Set((relic.substats ?? []).map(stat => String(stat.key)));
    for (const key of uniqueKeys) {
      const localized = localizeSubstat({ key }, tables.properties);
      add('substats', key, localized.name
        ? localized.name + (localized.unit === '%' ? ' (%)' : '') : key);
    }
  }
  return Object.fromEntries(Object.entries(categories).map(([name, map]) => [
    name, [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ko') || a.value.localeCompare(b.value)),
  ]));
}
