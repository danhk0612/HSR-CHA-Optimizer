// Translate scanned relic stats using original StarRailRes definitions.
// The displayed main-stat number is derived from public base+step data, never observed on the character sheet.
const SLOT_TYPE = {
  Head: 'HEAD',
  Hands: 'HAND',
  Body: 'BODY',
  Feet: 'FOOT',
  'Planar Sphere': 'NECK',
  'Link Rope': 'OBJECT',
};

const MAIN_PROPERTY = {
  DEF: 'DefenceAddedRatio',
  SPD: 'SpeedDelta',
  'CRIT Rate': 'CriticalChanceBase',
  'CRIT DMG': 'CriticalDamageBase',
  'Outgoing Healing Boost': 'HealRatioBase',
  'Effect Hit Rate': 'StatusProbabilityBase',
  'Energy Regeneration Rate': 'SPRatioBase',
  'Break Effect': 'BreakDamageAddedRatioBase',
  'Physical DMG Boost': 'PhysicalAddedRatio',
  'Fire DMG Boost': 'FireAddedRatio',
  'Ice DMG Boost': 'IceAddedRatio',
  'Lightning DMG Boost': 'ThunderAddedRatio',
  'Wind DMG Boost': 'WindAddedRatio',
  'Quantum DMG Boost': 'QuantumAddedRatio',
  'Imaginary DMG Boost': 'ImaginaryAddedRatio',
};

const SUB_PROPERTY = {
  HP: 'HPDelta',
  HP_: 'HPAddedRatio',
  ATK: 'AttackDelta',
  ATK_: 'AttackAddedRatio',
  DEF: 'DefenceDelta',
  DEF_: 'DefenceAddedRatio',
  SPD: 'SpeedDelta',
  'CRIT Rate_': 'CriticalChanceBase',
  'CRIT DMG_': 'CriticalDamageBase',
  'Effect Hit Rate_': 'StatusProbabilityBase',
  'Effect RES_': 'StatusResistanceBase',
  'Break Effect_': 'BreakDamageAddedRatioBase',
};

const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;

export function relicMainProperty(item) {
  if (item.mainstat === 'HP') return item.slot === 'Head' ? 'HPDelta' : 'HPAddedRatio';
  if (item.mainstat === 'ATK') return item.slot === 'Hands' ? 'AttackDelta' : 'AttackAddedRatio';
  return MAIN_PROPERTY[item.mainstat] ?? null;
}

// Some 4-star relic definitions share the same set, rarity and slot but have different affix tables.
// Such cases must remain unknown instead of silently choosing one.
export function createRelicIndex(relics = {}) {
  const result = new Map();
  for (const relic of Object.values(relics)) {
    const key = [relic.set_id, relic.rarity, relic.type].join('|');
    if (!result.has(key)) result.set(key, relic);
    else result.set(key, null);
  }
  return result;
}

export function resolveMainStat(item, tables, index) {
  const type = SLOT_TYPE[item.slot];
  const property = relicMainProperty(item);
  if (!type || !property || !Number.isInteger(item.level) || item.level < 0) return null;
  const relic = index.get([item.set_id, item.rarity, type].join('|'));
  if (!relic || item.level > relic.max_level) return null;
  const group = tables.relic_main_affixes?.[String(relic.main_affix_id)]?.affixes;
  const matches = Object.values(group ?? {}).filter(entry => entry.property === property);
  if (matches.length !== 1) return null;
  const stat = tables.properties?.[property];
  const [affix] = matches;
  if (!stat || !stat.name || typeof stat.percent !== 'boolean') return null;
  if (!Number.isFinite(affix.base) || !Number.isFinite(affix.step)) return null;
  const calculated = affix.base + affix.step * item.level;
  return {
    property, name: stat.name,
    value: round2(stat.percent ? calculated * 100 : calculated),
    unit: stat.percent ? '%' : 'flat',
    derivedFrom: 'StarRailRes relic_main_affixes (base + step × level)',
  };
}

export function localizeSubstat(item, properties = {}) {
  const property = SUB_PROPERTY[item.key];
  const stat = property ? properties[property] : null;
  if (!stat?.name || typeof stat.percent !== 'boolean') return { ...item };
  // Scanner stores percent substats in percentage points already (e.g. 5.832 = 5.832%).
  return {
    ...item, name: stat.name, property,
    displayValue: Number.isFinite(item.value) ? round2(item.value) : null,
    unit: stat.percent ? '%' : 'flat',
  };
}

export function enrichRelic(item, tables, index) {
  const mainstatDetail = resolveMainStat(item, tables, index);
  return {
    mainstatDetail,
    substats: (item.substats ?? []).map(s => localizeSubstat(s, tables.properties)),
    ...(item.preview_substats?.length ? {
      previewSubstats: item.preview_substats.map(s => localizeSubstat(s, tables.properties)),
    } : {}),
    ...(item.reroll_substats?.length ? {
      rerollSubstats: item.reroll_substats.map(s => localizeSubstat(s, tables.properties)),
    } : {}),
  };
}
