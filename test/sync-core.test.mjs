import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncGameData } from '../src/sync-core.mjs';

const rawFiles = [
  'paths', 'elements', 'properties',
  'characters', 'character_ranks', 'character_skills',
  'character_skill_trees', 'character_promotions',
  'light_cones', 'light_cone_ranks', 'light_cone_promotions',
  'relics', 'relic_sets', 'relic_main_affixes', 'relic_sub_affixes', 'items',
];

function source(rejectFile = '') {
  return async url => {
    if (rejectFile && url.endsWith('/' + rejectFile)) return { ok: false, status: 404 };
    const data = url.endsWith('/info.json')
      ? { version: '4.7.0', folder: 'index_min', timestamp: 12345678 }
      : { sample: { id: 'sample' } };
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  };
}

test('shared game sync downloads 16 indexed tables and stores manifest for desktop', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-sync-'));
  try {
    const events = [];
    const result = await syncGameData(root, event => events.push(event), source());
    assert.equal(result.version, '4.7.0');
    assert.equal(result.language, 'kr');
    assert.equal(result.files.length, rawFiles.length);
    assert.equal(events.length, 16);
    const current = JSON.parse(await readFile(join(root, '.local-data', 'game', 'current.json'), 'utf8'));
    assert.equal(current.version, '4.7.0');
    const items = JSON.parse(await readFile(join(root, '.local-data', 'game', '4.7.0', 'kr', 'items.json'), 'utf8'));
    assert.ok(items.sample);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('failed resync keeps previous complete indexed game data intact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-sync-fail-'));
  try {
    await syncGameData(root, () => {}, source());
    const base = join(root, '.local-data', 'game');
    const original = await readFile(join(base, '4.7.0', 'kr', 'items.json'), 'utf8');
    await assert.rejects(() => syncGameData(root, () => {}, source('relics.json')), /Download failed: 404/);
    assert.equal(await readFile(join(base, '4.7.0', 'kr', 'items.json'), 'utf8'), original);
    const current = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'));
    assert.equal(current.version, '4.7.0');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
