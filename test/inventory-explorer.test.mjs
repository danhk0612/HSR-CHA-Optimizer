import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventoryCatalog, filterInventoryCatalog, selectInventoryForExport,
  formatSelectedInventory, selectedInventoryToHtml,
} from '../src/inventory-explorer.mjs';

const account = {
  schemaVersion: 1,
  metadata: { gameVersion: '4.7.0', scannerSource: 'reliquary_archiver', uidExcluded: true },
  characters: [
    { key: 'character:0', id: '1308', name: '아케론',
      game: { path: 'Warlock', pathName: '공허', element: 'Thunder', elementName: '번개', rarity: 5 },
      raw: { level: 80, ascension: 6, eidolon: 1, skills: { ult: 10 } },
      equippedLightConeKeys: ['lightCone:0'], equippedRelicKeys: ['relic:0'] },
    { key: 'character:1', id: '1401', name: '테스트 캐릭터',
      game: { path: 'Shaman', pathName: '화합', element: 'Wind', elementName: '바람', rarity: 4 },
      raw: { level: 50, ascension: 3, eidolon: 0 },
      equippedLightConeKeys: [], equippedRelicKeys: ['relic:1'] },
  ],
  lightCones: [
    { key: 'lightCone:0', id: '21015', name: '광추 5성', rarity: 5, path: 'Warlock',
      equippedBy: { characterId: '1308', status: 'owned' },
      raw: { level: 80, ascension: 6, superimposition: 2, lock: true } },
    { key: 'lightCone:1', id: '21016', name: '광추 4성', rarity: 4, path: 'Warlock',
      equippedBy: { characterId: null, status: 'unequipped' },
      raw: { level: 1, ascension: 0, superimposition: 5, lock: false } },
  ],
  relics: [
    { key: 'relic:0', setId: '101', setName: '사수 세트',
      mainstatDetail: { value: 43.2 },
      substats: [{ name: '치명타 확률', key: 'CRIT Rate_', value: 5.8, count: 2 }],
      equippedBy: { characterId: '1308', status: 'owned' },
      raw: { set_id: '101', slot: 'Head', rarity: 5, level: 15,
        mainstat: 'HP', lock: true, discard: false,
        substats: [{ key: 'CRIT Rate_', value: 5.8, count: 2 }] } },
    { key: 'relic:1', setId: '201', setName: '투영 장신구',
      mainstatDetail: { value: 43.2 },
      substats: [{ name: '속도', key: 'SPD', value: 4.8, count: 2 }],
      equippedBy: { characterId: '1401', status: 'owned' },
      raw: { set_id: '201', slot: 'Planar Sphere', rarity: 5, level: 0,
        mainstat: 'ATK', lock: false, discard: false,
        substats: [{ key: 'SPD', value: 4.8, count: 2 }],
        preview_substats: [{ key: 'CRIT DMG_', value: 22, count: 4 }] } },
    { key: 'relic:2', setId: '101', setName: '사수 세트',
      mainstatDetail: null, substats: [],
      equippedBy: { characterId: null, status: 'unequipped' },
      raw: { set_id: '101', slot: 'Hands', rarity: 4, level: 0,
        mainstat: 'ATK', lock: false, discard: true,
        substats: [], preview_substats: [{ key: 'SPD', value: 12, count: 4 }] } },
  ],
  resources: {
    materials: [{ key: 'material:0', raw: { id: 101, name: 'Star Rail Pass', count: 3 },
      koreanName: '별의 궤도 티켓' }],
    gacha: { stellar_jade: 3200 },
    manualWarpPity: { character: { pity: 70, guarantee: 'unknown' } },
  },
  supplemental: { analysisPreferences: '재화 소모 최소화.',
    characterStats: { 1308: { manual: { values: { spd: 140 } } },
      1401: { manual: { values: { hp: 4000 } } } } },
  reference: {
    lightConeEffects: { 21015: { name: '광추 5성' }, 21016: { name: '광추 4성' } },
    relicSetEffects: { 101: { name: '사수 세트' }, 201: { name: '투영 장신구' } },
  },
};
const catalog = buildInventoryCatalog(account);

test('catalog keeps all categories; relics and planar ornaments are not mixed', () => {
  assert.deepEqual(catalog.counts, {
    characters: 2, lightCones: 2, relics: 2, ornaments: 1, materials: 1,
  });
  assert.equal(catalog.rows.length, 8);
  assert.equal(catalog.rows.filter(r => r.group === 'ornaments')[0].key, 'relic:1');
  assert.equal(catalog.rows.find(r => r.key === 'relic:1').equippedName, '테스트 캐릭터');
  assert.equal(catalog.rows.find(r => r.key === 'relic:1').substats[0].name, '속도');
  assert.equal(Object.hasOwn(catalog.rows[0], 'gender'), false);
});

test('character search supports source rarity, level, path, element and eidolon', () => {
  const result = filterInventoryCatalog(catalog.rows, {
    group: 'characters', rarities: [5], minLevel: 80,
    elements: ['Thunder'], paths: ['Warlock'], minEidolon: 1,
  });
  assert.deepEqual(result.map(r => r.id), ['1308']);
  assert.equal(filterInventoryCatalog(catalog.rows, { group: 'characters',
    minLevel: 90 }).length, 0);
});

test('light cones can be filtered by type, upgrade level, superimposition and lock state', () => {
  assert.deepEqual(filterInventoryCatalog(catalog.rows, {
    group: 'lightCones', rarities: [4], paths: ['Warlock'],
    minSuperimposition: 5, locked: false,
  }).map(r => r.key), ['lightCone:1']);
  assert.equal(filterInventoryCatalog(catalog.rows, {
    group: 'lightCones', minLevel: 10, equipped: 'unequipped',
  }).length, 0);
});

test('relic filtering uses real substat values and upgrade rolls, never preview-only', () => {
  const result = filterInventoryCatalog(catalog.rows, {
    group: 'ornaments', sets: ['201'], slots: ['Planar Sphere'],
    mainstats: ['ATK'], minLevel: 0, maxLevel: 0,
    statKey: 'SPD', minStatValue: 4.5, minStatCount: 2,
  });
  assert.deepEqual(result.map(r => r.key), ['relic:1']);
  assert.equal(filterInventoryCatalog(catalog.rows,
    { group: 'ornaments', statKey: 'CRIT DMG_', minStatValue: 1 }).length, 0);
  assert.equal(filterInventoryCatalog(catalog.rows,
    { group: 'relics', statKey: 'SPD' }).length, 0);
  assert.deepEqual(filterInventoryCatalog(catalog.rows,
    { group: 'relics', discard: true }).map(r => r.key), ['relic:2']);
});

test('sorting and query work without changing scanner inventory source order', () => {
  const orig = catalog.rows.map(r => r.key);
  const sorted = filterInventoryCatalog(catalog.rows, {
    group: 'lightCones', sortBy: 'level', descending: true });
  assert.deepEqual(sorted.map(r => r.key), ['lightCone:0', 'lightCone:1']);
  assert.equal(filterInventoryCatalog(catalog.rows, { query: '별의 궤도' })[0].key, 'material:0');
  assert.deepEqual(catalog.rows.map(r => r.key), orig);
});

test('selecting specific items exports only selected records and preserves external owner reference', () => {
  const output = selectInventoryForExport(account, {
    keys: ['relic:1', 'lightCone:1'], includeReference: true,
  });
  assert.equal(output.characters.length, 0);
  assert.equal(output.lightCones.length, 1);
  assert.equal(output.relics.length, 1);
  assert.equal(output.relics[0].equippedCharacterName, '테스트 캐릭터');
  assert.equal(output.relics[0].equippedBy.characterId, '1401');
  assert.deepEqual(output.selection.counts,
    { characters: 0, lightCones: 1, relics: 0, ornaments: 1, materials: 0 });
  assert.equal(output.selection.availableCounts.relics, 2);
  assert.equal(output.reference.lightConeEffects['21015'], undefined);
  assert.equal(output.reference.relicSetEffects['201'].name, '투영 장신구');
  assert.match(output.selection.note, /미보유/);
});

test('gacha, manual pity, supplement and references are explicitly optional', () => {
  const basic = selectInventoryForExport(account, { keys: ['character:0'] });
  assert.equal(basic.resources, undefined);
  assert.equal(basic.supplemental, undefined);
  assert.equal(basic.reference, undefined);
  const enriched = selectInventoryForExport(account, {
    keys: ['character:0', 'material:0'], includeGacha: true,
    includeWarp: true, includeSupplemental: true,
  });
  assert.equal(enriched.resources.materials.length, 1);
  assert.equal(enriched.resources.gacha.stellar_jade, 3200);
  assert.equal(enriched.resources.manualWarpPity.character.pity, 70);
  assert.deepEqual(Object.keys(enriched.supplemental.characterStats), ['1308']);
});

test('unknown keys, empty selection and unsupported formats are rejected', () => {
  assert.throws(() => selectInventoryForExport(account, { keys: [] }), /한 개 이상/);
  assert.throws(() => selectInventoryForExport(account, { keys: ['unknown:1'] }), /없는 항목/);
  assert.throws(() => selectInventoryForExport(account, {}), /키 목록/);
  const result = selectInventoryForExport(account, { keys: ['character:0'] });
  assert.throws(() => formatSelectedInventory(result, 'pdf'), /지원하지 않는/);
});

test('human-readable HTML escapes game data instead of executing markup', () => {
  const infected = {
    ...account, characters: [{ ...account.characters[0], name: '<script>alert("x")</script>' }],
  };
  const output = selectInventoryForExport(infected, { keys: ['character:0'] });
  const html = selectedInventoryToHtml(output);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<table>/);
  assert.match(html, /성혼 1/);
});

test('JSON, Markdown and HTML format preserve explicit selection metadata', () => {
  const selection = selectInventoryForExport(account, { keys: ['lightCone:0'] });
  assert.equal(JSON.parse(formatSelectedInventory(selection, 'json').text).lightCones.length, 1);
  assert.match(formatSelectedInventory(selection, 'markdown').text, /미선택/);
  assert.match(formatSelectedInventory(selection, 'markdown').text, /광추 5성/);
  assert.match(formatSelectedInventory(selection, 'html').text, /<html lang="ko">/);
});
