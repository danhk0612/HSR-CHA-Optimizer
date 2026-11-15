import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelicIndex, enrichRelic, resolveMainStat, localizeSubstat } from '../src/relic-stats.mjs';

const tables = {
  relics: {
    61011: { id: '61011', set_id: '101', rarity: 5, type: 'HEAD', main_affix_id: '51', max_level: 15 },
    61013: { id: '61013', set_id: '101', rarity: 5, type: 'BODY', main_affix_id: '53', max_level: 15 },
    61014: { id: '61014', set_id: '101', rarity: 5, type: 'FOOT', main_affix_id: '54', max_level: 15 },
    51013: { id: '51013', set_id: '101', rarity: 4, type: 'BODY', main_affix_id: '43', max_level: 12 },
    55001: { id: '55001', set_id: '101', rarity: 4, type: 'BODY', main_affix_id: '433', max_level: 12 },
  },
  relic_main_affixes: {
    51: { affixes: { 1: { property: 'HPDelta', base: 112.896, step: 39.5136 } } },
    53: { affixes: {
      4: { property: 'CriticalChanceBase', base: 0.05184, step: 0.018144 },
      5: { property: 'CriticalDamageBase', base: 0.10368, step: 0.036288 },
    } },
    54: { affixes: { 4: { property: 'SpeedDelta', base: 4.032, step: 1.4 } } },
    43: { affixes: { 4: { property: 'CriticalChanceBase', base: 0.041472, step: 0.014515 } } },
    433: { affixes: { 1: { property: 'DefenceAddedRatio', base: 0.06912, step: 0.024192 } } },
  },
  properties: {
    HPDelta: { name: 'HP', percent: false },
    SpeedDelta: { name: '속도', percent: false },
    CriticalChanceBase: { name: '치명타 확률', percent: true },
    CriticalDamageBase: { name: '치명타 피해', percent: true },
    AttackAddedRatio: { name: '공격력', percent: true },
    StatusResistanceBase: { name: '효과 저항', percent: true },
  },
};
const index = createRelicIndex(tables.relics);

test('5-star relic main stats are derived from exact source base and upgrade steps', () => {
  const hp = resolveMainStat({ set_id: '101', slot: 'Head', rarity: 5, level: 15, mainstat: 'HP' }, tables, index);
  assert.equal(hp.name, 'HP');
  assert.equal(hp.value, 705.6);
  assert.equal(hp.unit, 'flat');
  const chance = resolveMainStat({ set_id: '101', slot: 'Body', rarity: 5, level: 15, mainstat: 'CRIT Rate' }, tables, index);
  assert.equal(chance.value, 32.4);
  assert.equal(chance.unit, '%');
  const damage = resolveMainStat({ set_id: '101', slot: 'Body', rarity: 5, level: 15, mainstat: 'CRIT DMG' }, tables, index);
  assert.equal(damage.value, 64.8);
  const speed = resolveMainStat({ set_id: '101', slot: 'Feet', rarity: 5, level: 15, mainstat: 'SPD' }, tables, index);
  assert.equal(speed.value, 25.03);
});

test('ambiguous rarity+slot and unrecognized affixes are left null without fabricating values', () => {
  assert.equal(resolveMainStat({ set_id: '101', slot: 'Body', rarity: 4, level: 12, mainstat: 'CRIT Rate' }, tables, index), null);
  assert.equal(resolveMainStat({ set_id: '101', slot: 'Body', rarity: 5, level: 16, mainstat: 'CRIT Rate' }, tables, index), null);
  assert.equal(resolveMainStat({ set_id: '101', slot: 'Body', rarity: 5, level: 15, mainstat: 'UNKNOWN' }, tables, index), null);
  assert.equal(resolveMainStat({ set_id: '999', slot: 'Feet', rarity: 5, level: 15, mainstat: 'SPD' }, tables, index), null);
});

test('scanner substat raw floating values remain intact with Korean display names and units', () => {
  const original = { key: 'CRIT DMG_', value: 11.6640005, count: 2, step: 2 };
  const localized = localizeSubstat(original, tables.properties);
  assert.equal(localized.value, 11.6640005);
  assert.equal(localized.displayValue, 11.66);
  assert.equal(localized.name, '치명타 피해');
  assert.equal(localized.unit, '%');
  assert.equal(localized.count, 2);
  assert.deepEqual(localizeSubstat({ key: 'UNLISTED', value: 8 }, tables.properties), { key: 'UNLISTED', value: 8 });
});

test('previewed substats are labeled and calculated main stat includes a source marker', () => {
  const item = {
    set_id: '101', slot: 'Body', rarity: 5, level: 15,
    mainstat: 'CRIT Rate', substats: [{ key: 'Effect RES_', value: 3.8880002 }],
    preview_substats: [{ key: 'ATK_', value: 4.32 }],
  };
  const enriched = enrichRelic(item, tables, index);
  assert.equal(enriched.mainstatDetail.value, 32.4);
  assert.match(enriched.mainstatDetail.derivedFrom, /StarRailRes/);
  assert.equal(enriched.substats[0].name, '효과 저항');
  assert.equal(enriched.previewSubstats[0].name, '공격력');
  assert.equal(enriched.previewSubstats[0].unit, '%');
});
