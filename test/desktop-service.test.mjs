import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDesktopState, exportDesktopReport, saveManualSheet, clearManualSheet, importSavedShowcase } from '../src/desktop-service.mjs';
import { importAccountArchive } from '../src/account-import.mjs';

const files = [
  'characters', 'character_ranks', 'character_skills',
  'character_skill_trees', 'light_cones', 'light_cone_ranks',
  'relic_sets', 'relics', 'relic_main_affixes', 'properties', 'items', 'paths', 'elements',
];

async function prepareGame(root) {
  const gameRoot = join(root, '.local-data', 'game');
  const sourceDir = join(gameRoot, '4.7.0', 'kr');
  await mkdir(sourceDir, { recursive: true });
  const tables = {
    characters: {
      1308: { id: '1308', name: '아케론', ranks: [], skills: [], skill_trees: [] },
      8002: { id: '8002', name: '{NICKNAME}', path: 'Warrior', element: 'Physical', ranks: [], skills: [], skill_trees: [] },
    },
    paths: { Warrior: { name: '파멸' } },
    elements: { Physical: { name: '물리' } },
  };
  for (const name of files) {
    await writeFile(join(sourceDir, name + '.json'), JSON.stringify(tables[name] ?? {}), 'utf8');
  }
  await writeFile(join(sourceDir, 'manifest.json'), JSON.stringify({ source: 'StarRailRes', version: '4.7.0', language: 'kr' }), 'utf8');
  await writeFile(join(gameRoot, 'current.json'), JSON.stringify({ version: '4.7.0', language: 'kr' }), 'utf8');
}

test('desktop launches with no user data and shows game version after independent sync', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-desktop-'));
  try {
    const empty = await getDesktopState(root);
    assert.equal(empty.ready, false);
    assert.equal(empty.gameReady, false);
    await prepareGame(root);
    const synced = await getDesktopState(root);
    assert.equal(synced.ready, false);
    assert.equal(synced.gameReady, true);
    assert.equal(synced.accountReady, false);
    assert.equal(synced.version, '4.7.0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('desktop imports actual v4-compatible file, labels Trailblazer and excludes UID from AI exports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-desktop-import-'));
  try {
    await prepareGame(root);
    const source = join(root, 'archive.json');
    const archive = {
      source: 'reliquary_archiver', build: '0.20.0', version: 4,
      metadata: { uid: 123456789 },
      characters: [
        { id: '8002', level: 80, eidolon: 6, skills: {}, traces: {} },
        { id: '1308', level: 80, eidolon: 1, skills: { basic: 6 }, traces: {} },
      ],
      light_cones: [],
      relics: [
        { _uid: 'r1', set_id: '110', slot: 'Head', level: 15, rarity: 5, mainstat: 'HP', substats: [], location: '1308' },
        { _uid: 'r2', set_id: '110', slot: 'Feet', level: 0, rarity: 5, mainstat: 'SPD', substats: [], location: '' },
        { _uid: 'r3', set_id: '111', slot: 'Body', level: 0, rarity: 5, mainstat: 'ATK', substats: [], location: '' },
      ],
    };
    await writeFile(source, JSON.stringify(archive), 'utf8');
    const imported = await importAccountArchive(source, root);
    assert.equal(imported.characters, 2);
    const state = await getDesktopState(root);
    assert.equal(state.ready, true);
    assert.equal(state.unequippedRelics, 2);
    assert.deepEqual(state.candidateFilterOptions.sets.map(item => item.value), ['110', '111']);
    assert.ok(state.candidateFilterOptions.slots.some(item => item.value === 'Body'));
    assert.equal(state.characters.find(item => item.id === '8002').name, '개척자 (파멸 · 물리)');
    const output = await exportDesktopReport(root, { characterIds: ['1308'], format: 'json' });
    const data = JSON.parse(output);
    assert.equal(data.characters[0].name, '아케론');
    assert.equal(data.characters.length, 1);
    assert.ok(!output.includes('123456789'));
    const candidateOutput = JSON.parse(await exportDesktopReport(root, {
      characterIds: ['1308'], candidateMode: 'all', candidateLimit: 1, format: 'json',
    }));
    assert.equal(candidateOutput.candidates.matching, 2);
    assert.equal(candidateOutput.candidates.included, 1);
    assert.equal(candidateOutput.candidates.relics.length, 1);
    const precise = JSON.parse(await exportDesktopReport(root, {
      characterIds: ['1308'], candidateMode: 'all', format: 'json',
      candidateFilters: { setIds: ['111'], slots: ['Body'], mainstats: ['ATK'] },
    }));
    assert.deepEqual(precise.candidates.relics.map(item => item.inventoryId), ['r3']);
    assert.equal(precise.candidates.matching, 1);
    assert.deepEqual(precise.candidates.filters.setIds, ['111']);
    const restricted = JSON.parse(await exportDesktopReport(root, {
      characterIds: ['1308'], candidateMode: 'equipped-sets', format: 'json',
      candidateFilters: { setIds: ['111'] },
    }));
    assert.equal(restricted.candidates.matching, 0);
    await saveManualSheet(root, '1308', { hp: 3500, spd: 143.5, crit_dmg: 180.2 });
    const publicFile = join(root, 'mihomo.json');
    await writeFile(publicFile, JSON.stringify({
      player: { uid: 123456789, nickname: 'DO NOT EXPORT' },
      characters: [{ id: '1308', level: 80, rank: 1,
        attributes: [{ field: 'hp', name: 'HP', value: 2500, percent: false }],
        additions: [{ field: 'hp', name: 'HP', value: 1000, percent: false }],
        properties: [] }],
    }), 'utf8');
    await importSavedShowcase(root, publicFile);
    const updated = await getDesktopState(root);
    assert.equal(updated.characterStatsSummary.manual, 1);
    assert.equal(updated.characterStatsSummary.showcase, 1);
    const enhancedOutput = await exportDesktopReport(root, {
      characterIds: ['1308'], format: 'json',
    });
    const enhanced = JSON.parse(enhancedOutput);
    assert.equal(enhanced.characters[0].characterSheet.manualObserved.values.spd, 143.5);
    assert.equal(enhanced.characters[0].characterSheet.publicShowcaseCalculated.attributes[0].value, 2500);
    assert.equal(enhanced.limitations.characterSheetStatsCollected, true);
    assert.equal(enhanced.limitations.characterSheetCoverage.manuallyObserved, 1);
    assert.ok(!enhancedOutput.includes('DO NOT EXPORT'));
    assert.ok(!enhancedOutput.includes('123456789'));
    await clearManualSheet(root, '1308');
    const afterClear = JSON.parse(await exportDesktopReport(root, {
      characterIds: ['1308'], format: 'json',
    }));
    assert.equal(afterClear.characters[0].characterSheet.manualObserved, undefined);
    assert.ok(afterClear.characters[0].characterSheet.publicShowcaseCalculated);
    assert.equal(afterClear.limitations.characterSheetStatsCollected, false);
    const saved = JSON.parse(await readFile(join(root, '.local-data', 'account', 'scanner.json'), 'utf8'));
    assert.equal(saved.metadata.uid, 123456789);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
