import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScannerData, buildAccountReport } from '../src/scanner-data.mjs';

const manifest = { source: 'StarRailRes', version: '4.7.0', syncedAt: '2026-11-15T00:00:00.000Z' };
const tables = {
  characters: { 1308: { id: '1308', name: '아케론', ranks: ['130801'], skills: [], skill_trees: [] } },
  character_ranks: { 130801: { id: '130801', rank: 1, desc: 'test' } },
  character_skills: {},
  character_skill_trees: {},
  character_promotions: {},
  light_cones: { 21015: { id: '21015', name: '땀방울처럼 빛나는 결심', path: 'Warlock' } },
  light_cone_ranks: { 21015: { params: [[0.1], [0.2]] } },
  light_cone_promotions: {},
  paths: { Warlock: { name: '공허' } },
  relics: { 31011: { id: '31011', set_id: '101', main_affix_id: '21', sub_affix_id: '2' } },
  relic_sets: { 101: { id: '101', name: '테스트 유물', properties: [] } },
  relic_main_affixes: { 21: { affixes: {} } },
  relic_sub_affixes: { 2: { affixes: {} } },
  properties: {},
};
const scanner = {
  source: 'HSR-Scanner',
  version: 4,
  build: 'v1.6.0',
  metadata: { uid: 987654321, trailblazer: 'Stelle' },
  characters: [
    { id: '1308', name: 'Acheron', level: 80, eidolon: 2, skills: { basic: 1, ult: 10, elation: 1 }, traces: { ability_1: true }, affinitive_eidolons: [130801] },
  ],
  light_cones: [
    { id: '21015', location: '1308', level: 80, superimposition: 5 },
    { id: '21015', location: '', level: 1, superimposition: 1 },
  ],
  relics: [
    { set_id: '101', slot: 'Hands', rarity: 5, level: 15, mainstat: 'ATK', substats: [{ key: 'CRIT DMG_', value: 31.7 }], location: '1308' },
    { set_id: '101', slot: 'Feet', rarity: 5, level: 0, mainstat: 'SPD', substats: [], location: '' },
  ],
};

test('HSR-Scanner version 4 is accepted; invalid version is rejected', () => {
  assert.equal(validateScannerData(scanner), scanner);
  assert.throws(() => validateScannerData({ ...scanner, version: 5 }), /version 4/);
  assert.throws(() => validateScannerData({ source: 'HSR-Scanner', version: 4 }), /목록/);
});

test('owned character, equipped gear and original Korean effects join by ID', () => {
  const report = buildAccountReport(scanner, tables, manifest, { importedAt: '2026-11-15T00:01:00.000Z' });
  assert.equal(report.characters[0].game.character.name, '아케론');
  assert.equal(report.characters[0].owned.eidolon, 2);
  assert.deepEqual(report.characters[0].owned.affinitive_eidolons, [130801]);
  assert.equal(report.lightCones[0].game.name, '땀방울처럼 빛나는 결심');
  assert.equal(report.relics[0].gameSet.name, '테스트 유물');
  assert.equal(report.relics[0].owned.substats[0].value, 31.7);
  assert.ok(report.reference.lightCones['21015'].superimpositions);
  assert.equal(report.reference.relicSets['101'].pieces[0].relic.id, '31011');
  assert.ok(!JSON.stringify(report).includes('987654321'));
});

test('filtered character export excludes other characters and unassigned inventory', () => {
  const report = buildAccountReport(scanner, tables, manifest, { characterIds: ['1308'] });
  assert.equal(report.characters.length, 1);
  assert.equal(report.lightCones.length, 1);
  assert.equal(report.relics.length, 1);
  assert.throws(() => buildAccountReport(scanner, tables, manifest, { characterIds: ['9999'] }), /찾을 수 없는 ID/);
});

test('missing scan categories remain visibly unscanned and not fabricated', () => {
  const partial = { source: 'HSR-Scanner', version: 4, characters: [{ id: '9999' }] };
  const report = buildAccountReport(partial, tables, manifest);
  assert.equal(report.coverage.lightConesScanned, false);
  assert.equal(report.coverage.relicsScanned, false);
  assert.equal(report.characters[0].game, null);
  assert.deepEqual(report.unmatchedGameIds.characters, ['9999']);
  assert.equal(report.coverage.personalSheetStats, false);
});
