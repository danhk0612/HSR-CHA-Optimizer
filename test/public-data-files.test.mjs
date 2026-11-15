import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportPublicData } from '../src/public-data-files.mjs';

test('public data export reads local synced snapshot, not account or network', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-public-'));
  try {
    const dir = join(root, '.local-data', 'game', '4.7.0', 'kr');
    await mkdir(dir, { recursive: true });
    await writeFile(join(root, '.local-data', 'game', 'current.json'),
      JSON.stringify({ version: '4.7.0', language: 'kr' }));
    await writeFile(join(dir, 'manifest.json'),
      JSON.stringify({ version: '4.7.0', language: 'kr', source: 'StarRailRes', syncedAt: '2026-11-15T00:00Z' }));
    await writeFile(join(dir, 'simulated_curios.json'),
      JSON.stringify({ 12: { id: '12', name: '위상 차감 주사위', desc: '전투 후 선택 횟수 증가' } }));
    const output = await exportPublicData(root, { type: 'curios', query: '주사위', limit: 10, format: 'json' });
    const parsed = JSON.parse(output.text);
    assert.equal(parsed.metadata.gameVersion, '4.7.0');
    assert.equal(parsed.total, 1);
    assert.equal(parsed.items[0].name, '위상 차감 주사위');
    const markdown = await exportPublicData(root, { type: 'curios', format: 'markdown' });
    assert.match(markdown.text, /위상 차감 주사위/);
    await assert.rejects(
      () => exportPublicData(root, { type: 'blessings' }),
      /확장 자료가 없습니다/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
