import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCandidateRelics, buildCandidateFilterOptions, normalizeCandidateFilters } from '../src/relic-filters.mjs';

const relics = [
  { _uid: 'a', set_id: '110', slot: 'Feet', rarity: 5, level: 15,
    mainstat: 'SPD', substats: [{ key: 'CRIT Rate_', value: 5.8 }, { key: 'CRIT DMG_', value: 11.6 }], location: '' },
  { _uid: 'b', set_id: '110', slot: 'Body', rarity: 5, level: 15,
    mainstat: 'CRIT Rate', substats: [{ key: 'SPD', value: 4.6 }], location: '' },
  { _uid: 'c', set_id: '314', slot: 'Planar Sphere', rarity: 5, level: 0,
    mainstat: 'ATK', substats: [{ key: 'ATK_', value: 3.9 }],
    preview_substats: [{ key: 'CRIT DMG_', value: 5.1 }], location: '' },
  { _uid: 'd', set_id: '314', slot: 'Link Rope', rarity: 5, level: 15,
    mainstat: 'Break Effect', substats: [{ key: 'SPD', value: 2.3 }], location: '' },
  { _uid: 'equipped', set_id: '110', slot: 'Body', rarity: 5, level: 15,
    mainstat: 'CRIT DMG', substats: [{ key: 'SPD', value: 2.3 }], location: '1308' },
];
const onlyUnequipped = relics.filter(relic => !relic.location);
const tables = {
  relic_sets: { '110': { name: '사수' }, '314': { name: '이즈모' } },
  properties: {
    SpeedDelta: { name: '속도', percent: false },
    CriticalChanceBase: { name: '치명타 확률', percent: true },
    CriticalDamageBase: { name: '치명타 피해', percent: true },
    BreakDamageAddedRatioBase: { name: '격파 특수효과', percent: true },
    AttackAddedRatio: { name: '공격력', percent: true },
  },
};

test('within-category alternatives OR, between-category filters AND', () => {
  const result = filterCandidateRelics(onlyUnequipped, {
    setIds: ['110', '314'],
    slots: ['Feet', 'Link Rope'],
    mainstats: ['SPD', 'Break Effect'],
    substats: ['CRIT Rate_', 'SPD'],
  });
  assert.deepEqual(result.relics.map(item => item._uid), ['a', 'd']);
  assert.deepEqual(result.filters.slots, ['Feet', 'Link Rope']);
});

test('substat filters match current rolled stats, never preview-only stats', () => {
  const result = filterCandidateRelics(onlyUnequipped, { substats: ['CRIT DMG_'] });
  assert.deepEqual(result.relics.map(item => item._uid), ['a']);
});

test('no filters preserve input order and duplicate selections are normalized', () => {
  assert.deepEqual(filterCandidateRelics(onlyUnequipped).relics.map(x => x._uid), ['a', 'b', 'c', 'd']);
  assert.deepEqual(normalizeCandidateFilters({ setIds: ['110', '110', 314] }).setIds, ['110', '314']);
});

test('filter options represent actual unequipped inventory with Korean names and counts', () => {
  const choices = buildCandidateFilterOptions({ relics }, tables);
  assert.deepEqual(choices.sets.map(x => [x.value, x.count]), [['314', 2], ['110', 2]]);
  assert.equal(choices.slots.length, 4);
  assert.equal(choices.slots.find(x => x.value === 'Feet').label, '신발');
  assert.equal(choices.mainstats.find(x => x.value === 'CRIT Rate').label, '치명타 확률');
  assert.equal(choices.substats.find(x => x.value === 'CRIT DMG_').label, '치명타 피해 (%)');
  assert.equal(choices.substats.find(x => x.value === 'SPD').count, 2);
  assert.ok(!choices.mainstats.some(x => x.value === 'CRIT DMG'), '착용 중인 유물은 선택 목록에서 제외');
});

test('invalid filter data is not silently ignored', () => {
  assert.throws(() => filterCandidateRelics(onlyUnequipped, { slots: 'Feet' }), /올바르지 않은 유물 필터/);
  assert.throws(() => filterCandidateRelics(onlyUnequipped, { substats: [null] }), /올바르지 않은 유물 필터/);
});
