import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDesktopState, exportDesktopReport } from '../src/desktop-service.mjs';
import { importAccountArchive } from '../src/account-import.mjs';

const files = [
  'characters', 'character_ranks', 'character_skills',
  'character_skill_trees', 'light_cones', 'light_cone_ranks',
  'relic_sets', 'items', 'paths', 'elements',
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
      relics: [],
    };
    await writeFile(source, JSON.stringify(archive), 'utf8');
    const imported = await importAccountArchive(source, root);
    assert.equal(imported.characters, 2);
    const state = await getDesktopState(root);
    assert.equal(state.ready, true);
    assert.equal(state.characters.find(item => item.id === '8002').name, '개척자 (파멸 · 물리)');
    const output = await exportDesktopReport(root, { characterIds: ['1308'], format: 'json' });
    const data = JSON.parse(output);
    assert.equal(data.characters[0].name, '아케론');
    assert.equal(data.characters.length, 1);
    assert.ok(!output.includes('123456789'));
    const saved = JSON.parse(await readFile(join(root, '.local-data', 'account', 'scanner.json'), 'utf8'));
    assert.equal(saved.metadata.uid, 123456789);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
