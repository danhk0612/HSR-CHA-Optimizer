import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildFullAccountReport, buildFullAccountBundle, withoutAccountIdentity,
} from '../src/full-account-export.mjs';

const scanner = {
  source: 'reliquary_archiver', version: 4, build: '0.20.0',
  metadata: { uid: 123456789, nickname: 'private-account' },
  characters: [
    { id: '1308', level: 80, eidolon: 2, skills: { ult: 10 },
      traces: { ability_1: true }, customField: { scannerOnly: true } },
    { id: '1401', level: 60, eidolon: 0, skills: {}, traces: {} },
  ],
  light_cones: [
    { _uid: 'cone-1', id: '21015', location: '1308', level: 80, superimposition: 5 },
    { _uid: 'cone-1', id: '21015', location: '1401', level: 1, superimposition: 1 },
    { id: '21015', location: '', level: 40, superimposition: 2 },
  ],
  relics: [
    { _uid: 'relic-1', set_id: '101', slot: 'Head', location: '1308',
      rarity: 5, level: 15, mainstat: 'HP', substats: [{ key: 'CRIT DMG_', value: 12.9 }] },
    { _uid: 'relic-2', set_id: '101', slot: 'Feet', location: '1401',
      rarity: 5, level: 0, mainstat: 'SPD', substats: [{ key: 'CRIT Rate_', value: 2.9 }],
      preview_substats: [{ key: 'CRIT DMG_', value: 5.8 }] },
    { _uid: 'relic-3', set_id: '101', slot: 'Body', location: '',
      rarity: 5, level: 0, mainstat: 'CRIT Rate', substats: [] },
    { _uid: 'relic-4', set_id: '999', slot: 'Body', location: '9999',
      rarity: 4, level: 3, mainstat: 'ATK', substats: [] },
  ],
  materials: [
    { id: 11001, count: 19 },
    { id: 11002, count: 0 },
  ],
  gacha: { stellar_jade: 1000, oneric_shards: 0, uid: 123456789 },
};
const tables = {
  characters: {
    1308: { name: '아케론', path: 'Warlock', element: 'Thunder' },
    1401: { name: '테스트 캐릭터', path: 'Warrior', element: 'Physical' },
  },
  paths: { Warlock: { name: '공허' }, Warrior: { name: '파멸' } },
  elements: { Thunder: { name: '번개' }, Physical: { name: '물리' } },
  light_cones: { 21015: { name: '땀방울처럼 빛나는 결심', path: 'Warlock' } },
  light_cone_ranks: { 21015: { skill: '디버프', desc: '효과', params: [[0.12], [0.14]] } },
  relic_sets: { 101: { name: '테스트 유물', desc: ['2세트', '4세트'] } },
  relics: {},
  relic_main_affixes: {},
  properties: {},
  items: { 11001: { name: '육성 재료' } },
};
const manifest = { source: 'StarRailRes', version: '4.7.0', language: 'kr' };
const extra = {
  importedAt: '2026-11-15T09:00:00.000Z',
  characterStats: { characters: {
    1308: { manual: { values: { crit_rate: 85 } } },
    9999: { manual: { values: { hp: 1000 } } },
  } },
  manualWarpState: { pools: { character: { pity: 42, guarantee: 'unknown' } } },
  analysisPreferences: '남성 캐릭터 사용하지 않음. 재화 최소 소모.',
};

test('full AI handoff contains all characters, cones, and relics without candidate filtering', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  assert.deepEqual(report.counts.original,
    { characters: 2, lightCones: 3, relics: 4, materials: 2 });
  assert.deepEqual(report.counts.exported, report.counts.original);
  assert.equal(report.counts.allScannedEntriesExported, true);
  assert.equal(report.characters[0].name, '아케론');
  assert.equal(report.characters[0].raw.customField.scannerOnly, true);
  assert.equal(report.lightCones.length, 3);
  assert.equal(report.relics.length, 4);
});

test('equipped gear from OTHER owned characters remains available for AI reassignment', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  assert.deepEqual(report.characters[0].equippedLightConeKeys, ['lightCone:0']);
  assert.deepEqual(report.characters[1].equippedLightConeKeys, ['lightCone:1']);
  assert.deepEqual(report.characters[1].equippedRelicKeys, ['relic:1']);
  assert.deepEqual(report.relics[1].equippedBy,
    { characterId: '1401', status: 'owned' });
  assert.deepEqual(report.relics[2].equippedBy,
    { characterId: null, status: 'unequipped' });
  assert.deepEqual(report.relics[3].equippedBy,
    { characterId: '9999', status: 'unknown-character-id' });
  assert.deepEqual(report.audit.unknownRelicLocationKeys, ['relic:3']);
});

test('duplicate or missing scanner inventoryId never collapses item copies', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  assert.deepEqual(report.lightCones.map(c => c.key), ['lightCone:0', 'lightCone:1', 'lightCone:2']);
  assert.deepEqual(report.audit.duplicateLightConeInventoryIds, ['cone-1']);
  assert.equal(report.lightCones[2].inventoryId, null);
  assert.equal(report.lightCones[0].raw._uid, 'cone-1');
  assert.equal(report.lightCones[1].raw._uid, 'cone-1');
});

test('scanner original rolled and previewed relic stats remain unmodified', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  assert.deepEqual(report.relics[1].raw, scanner.relics[1]);
  assert.equal(report.relics[1].raw.substats[0].value, 2.9);
  assert.equal(report.relics[1].raw.preview_substats[0].value, 5.8);
  assert.equal(report.relics[1].raw.level, 0);
  assert.equal(report.relics[3].setName, null);
  assert.deepEqual(report.audit.missingRelicSetIds, ['999']);
});

test('personal UID and nickname are removed while equipment _uid stays intact', () => {
  const sanitized = withoutAccountIdentity({
    uid: 123456789, nickname: 'hidden', nested: [{ account_id: 'id',
      _uid: 'equipment-id', id: '1308', level: 80 }],
  });
  assert.deepEqual(sanitized, {
    nested: [{ _uid: 'equipment-id', id: '1308', level: 80 }],
  });
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes('123456789'));
  assert.ok(!serialized.includes('private-account'));
  assert.ok(serialized.includes('cone-1'));
  assert.equal(report.resources.gacha.uid, undefined);
});

test('missing scan categories are unknown, while a scanned zero inventory remains zero', () => {
  const noResources = { ...scanner };
  delete noResources.gacha;
  delete noResources.materials;
  const report = buildFullAccountReport(noResources, tables, manifest);
  assert.equal(report.resources.materials, null);
  assert.equal(report.resources.gacha, null);
  assert.equal(report.counts.original.materials, null);
  assert.deepEqual(report.coverage.missingCategories, ['materials', 'gacha']);
  const empty = buildFullAccountReport({ ...scanner,
    light_cones: [], relics: [], materials: [] }, tables, manifest);
  assert.equal(empty.lightCones.length, 0);
  assert.equal(empty.relics.length, 0);
  assert.equal(empty.counts.original.materials, 0);
  assert.equal(empty.coverage.materialsScanned, true);
});

test('complete JSON includes optional personal constraints and no stats from unknown character ID', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  assert.equal(report.supplemental.analysisPreferences, extra.analysisPreferences);
  assert.deepEqual(Object.keys(report.supplemental.characterStats), ['1308']);
  assert.equal(report.resources.manualWarpPity.character.pity, 42);
  assert.equal(report.reference.lightConeEffects['21015'].effect.description, '효과');
  assert.equal(report.reference.relicSetEffects['101'].descriptions[1], '4세트');
});

test('bundle splitting records all items exactly once even when chunked by 2', () => {
  const report = buildFullAccountReport(scanner, tables, manifest, extra);
  const { files, manifest: listing } = buildFullAccountBundle(report, 2);
  assert.ok(files['manifest.json']);
  assert.ok(files['00-READ-ME.md']);
  assert.ok(files['01-account-summary.json']);
  assert.deepEqual(Object.keys(files).filter(k => k.startsWith('03-light-cones-')),
    ['03-light-cones-001.json', '03-light-cones-002.json']);
  assert.deepEqual(Object.keys(files).filter(k => k.startsWith('04-relics-')),
    ['04-relics-001.json', '04-relics-002.json']);
  const getRecords = prefix => Object.entries(files)
    .filter(([name]) => name.startsWith(prefix))
    .flatMap(([, text]) => JSON.parse(text).records);
  assert.deepEqual(getRecords('03-light-cones-').map(c => c.key), report.lightCones.map(c => c.key));
  assert.deepEqual(getRecords('04-relics-').map(c => c.key), report.relics.map(c => c.key));
  assert.equal(listing.counts.allScannedEntriesExported, true);
  for (const entry of listing.files) {
    assert.equal(createHash('sha256').update(files[entry.file]).digest('hex'), entry.sha256);
    assert.equal(Buffer.byteLength(files[entry.file], 'utf8'), entry.bytes);
  }
  assert.equal(listing.files.find(x => x.file === '02-characters.json').records, 2);
  assert.ok(!JSON.stringify(files).includes('123456789'));
});

test('missing required inventory scans and invalid chunk sizes are rejected', () => {
  assert.throws(() => buildFullAccountReport({ ...scanner, relics: undefined }, tables, manifest), /3종을 모두/);
  assert.throws(() => buildFullAccountReport({ ...scanner, light_cones: undefined }, tables, manifest), /3종을 모두/);
  assert.throws(() => buildFullAccountReport({ ...scanner, characters: undefined }, tables, manifest), /3종을 모두/);
  const report = buildFullAccountReport(scanner, tables, manifest);
  assert.throws(() => buildFullAccountBundle(report, 0), /분할 크기/);
});
