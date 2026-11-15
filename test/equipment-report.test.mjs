import test from 'node:test';
import assert from 'node:assert/strict';
import { findEntry, buildLightConeReport, buildRelicSetReport } from '../src/equipment-report.mjs';

test('findEntry finds an exact Korean name or original ID', () => {
  const data = { '2001': { id: '2001', name: '빛나는 광추' } };
  assert.equal(findEntry(data, '2001', '광추').id, '2001');
  assert.equal(findEntry(data, '빛나는 광추', '광추').name, '빛나는 광추');
});

test('light cone report preserves all superimposition levels and promotions', () => {
  const cone = { id: '2001', path: 'Warlock' };
  const tables = {
    paths: { Warlock: { id: 'Warlock', name: '공허' } },
    light_cone_ranks: { 2001: { params: [[0.1], [0.2], [0.3], [0.4], [0.5]] } },
    light_cone_promotions: { 2001: { values: [{ hp: { base: 38.4 } }] } },
  };
  const report = buildLightConeReport(cone, tables);
  assert.equal(report.path.name, '공허');
  assert.deepEqual(report.superimpositions.params[4], [0.5]);
  assert.equal(report.promotions.values[0].hp.base, 38.4);
});

test('relic set report includes all pieces and linked main/sub affix definitions', () => {
  const set = { id: '101', name: '예시 세트', properties: [[{ type: 'AttackAddedRatio' }]] };
  const tables = {
    relics: {
      31011: { id: '31011', set_id: '101', main_affix_id: '21', sub_affix_id: '2' },
      31012: { id: '31012', set_id: '102', main_affix_id: '21', sub_affix_id: '2' },
    },
    relic_main_affixes: { 21: { affixes: { 1: { property: 'HPDelta', base: 1 } } } },
    relic_sub_affixes: { 2: { affixes: { 1: { property: 'AttackAddedRatio', base: 2 } } } },
    properties: { HPDelta: { name: 'HP' }, AttackAddedRatio: { name: '공격력' } },
  };
  const report = buildRelicSetReport(set, tables);
  assert.equal(report.pieces.length, 1);
  assert.equal(report.pieces[0].mainAffixes.affixes[1].base, 1);
  assert.equal(report.pieces[0].subAffixes.affixes[1].base, 2);
  assert.equal(report.properties.AttackAddedRatio.name, '공격력');
});

test('ambiguous equipment search refuses to choose silently', () => {
  const data = { a: { id: 'a', name: '광추 A' }, b: { id: 'b', name: '광추 B' } };
  assert.throws(() => findEntry(data, '광추', '광추'), /검색 결과가 여러 개/);
});
