import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compareGameTables, buildGameChangeReport,
  compareGameSnapshots, saveGameChangeReport, readLatestGameChangeReport,
} from '../src/game-changes.mjs';

test('nested JSON key reordering does not register a false resource change', () => {
  const previous = { '1': { name: '테스트', data: { a: 1, b: 2 } } };
  const current = { '1': { data: { b: 2, a: 1 }, name: '테스트' } };
  const result = compareGameTables(previous, current, 'characters.json');
  assert.equal(result.status, 'unchanged');
  assert.deepEqual([result.added, result.removed, result.modified], [0, 0, 0]);
});

test('sync change detection distinguishes added, removed and edited IDs with bounded samples', () => {
  const oldTable = { '1': { name: '구 캐릭터' }, '2': { name: '퇴장' } };
  const next = { '1': { name: '변경 캐릭터' },
    ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 10), { name: String(i) }])) };
  const result = compareGameTables(oldTable, next, 'characters.json');
  assert.equal(result.status, 'changed');
  assert.equal(result.added, 12);
  assert.equal(result.removed, 1);
  assert.equal(result.modified, 1);
  assert.ok(result.sampleIds.added.length <= 5);
  assert.deepEqual(result.sampleIds.removed, ['2']);
  assert.deepEqual(result.sampleIds.modified, ['1']);
});

test('initial sync is recorded as baseline and missing old tables are visibly new', () => {
  const initial = buildGameChangeReport(null, { version: '4.7.0', language: 'kr' },
    [{ filename: 'items.json', before: null, after: { '1': { name: '아이템' } } }],
    '2026-11-15T12:00:00.000Z');
  assert.equal(initial.status, 'initial');
  assert.equal(initial.totals.added, 0);
  assert.equal(initial.tables[0].status, 'baseline');

  const upgrade = buildGameChangeReport({ version: '4.7.0', language: 'kr' },
    { version: '4.8.0', language: 'kr' },
    [{ filename: 'simulated_curios.json', before: null, after: { '1': { name: '기물' } } }],
    '2026-11-15T12:05:00.000Z');
  assert.equal(upgrade.status, 'changed');
  assert.equal(upgrade.tables[0].status, 'new-table');
  assert.equal(upgrade.totals.added, 1);
  assert.equal(upgrade.previous.version, '4.7.0');
  assert.equal(upgrade.current.version, '4.8.0');
});

test('same-version comparison reads existing snapshot and keeps history separate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-changes-'));
  try {
    const game = join(root, '.local-data', 'game');
    const oldDir = join(game, '4.7.0', 'kr');
    const staging = join(game, 'staging');
    await mkdir(oldDir, { recursive: true });
    await mkdir(staging, { recursive: true });
    await writeFile(join(oldDir, 'items.json'),
      JSON.stringify({ 1: { name: '옛 이름' }, 2: { name: '삭제' } }));
    await writeFile(join(staging, 'items.json'),
      JSON.stringify({ 1: { name: '새 이름' }, 3: { name: '추가' } }));
    const result = await compareGameSnapshots(game,
      { version: '4.7.0', language: 'kr' },
      { version: '4.7.0', language: 'kr' },
      ['items.json'], staging, '2026-11-15T12:00:00.000Z');
    assert.deepEqual(result.totals, { added: 1, removed: 1, modified: 1, changedTables: 1 });
    await saveGameChangeReport(game, result);
    const latest = await readLatestGameChangeReport(root);
    const historical = JSON.parse(await readFile(join(game, 'changes', '2026-11-15T12-00-00-000Z.json'), 'utf8'));
    assert.deepEqual(historical, latest);
    assert.equal(latest.current.version, '4.7.0');
    assert.equal(latest.tables[0].filename, 'items.json');
    const old = JSON.parse(await readFile(join(oldDir, 'items.json'), 'utf8'));
    assert.equal(old['1'].name, '옛 이름');
  } finally { await rm(root, { recursive: true, force: true }); }
});
