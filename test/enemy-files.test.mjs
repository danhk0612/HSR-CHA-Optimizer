import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENEMY_SOURCE } from '../src/enemy-data.mjs';
import { readEnemyIndex, syncEnemyData, exportEnemyData } from '../src/enemy-files.mjs';
import { exportPublicData } from '../src/public-data-files.mjs';

const raw = '[{"MonsterTemplateID":1002011,"MonsterName":{"Hash":329737901974927635},' +
  '"Rank":"BigBoss","HPBase":{"Value":1000},"AttackBase":{"Value":200},"StanceType":"Ice"}]';

async function prepare(root, version = '4.7.0') {
  const dir = join(root, '.local-data', 'game');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'current.json'), JSON.stringify({ version, language: 'kr' }));
}

test('opt-in enemy sync uses one verified release commit and writes separate indexed file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-enemies-'));
  try {
    await prepare(root);
    const requested = [];
    const progress = [];
    const source = async url => {
      requested.push(url);
      const path = url.split('/').slice(-2).join('/');
      let body = '{}';
      if (path === 'ExcelOutput/MonsterTemplateConfig.json') body = raw;
      if (path === 'TextMap/TextMapKR_0.json')
        body = '{"329737901974927635":"한국어 테스트 보스"}';
      return { ok: true, status: 200, text: async () => body };
    };
    const result = await syncEnemyData(root, p => progress.push(p), source);
    assert.equal(result.total, 1);
    assert.equal(result.nameResolved, 1);
    assert.equal(progress.length, 4);
    assert.ok(requested.every(url => url.includes(ENEMY_SOURCE.commit)));
    const index = await readEnemyIndex(root);
    assert.equal(index.enemies[0].name, '한국어 테스트 보스');
    assert.equal(index.enemies[0].hpBase, 1000);
    assert.equal(index.enemies[0].nameHash, '329737901974927635');
    const fromUi = await exportPublicData(root,
      { type: 'enemies', query: '한국어', format: 'json' });
    const parsed = JSON.parse(fromUi.text);
    assert.equal(parsed.metadata.sourceGameVersion, '4.7.0');
    assert.equal(parsed.total, 1);
    assert.equal(parsed.items[0].name, '한국어 테스트 보스');
    const markdown = await exportEnemyData(root, { query: '1002011', format: 'markdown' });
    assert.match(markdown.text, /한국어 테스트 보스/);
    assert.match(markdown.text, /전투 레벨\/콘텐츠 보정 미적용/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('source mismatch blocks download and unsupported prior versions remain untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-enemy-mismatch-'));
  try {
    await prepare(root, '4.8.0');
    let invoked = false;
    await assert.rejects(() => syncEnemyData(root, () => {}, async () => {
      invoked = true;
      return { ok: true, text: async () => '{}' };
    }), /버전이 다릅니다/);
    assert.equal(invoked, false);
    assert.equal(await readEnemyIndex(root), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed optional download preserves last valid enemy index and never replaces core game data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-enemy-rollback-'));
  try {
    await prepare(root);
    const good = async url => ({
      ok: true, status: 200,
      text: async () => url.endsWith('/MonsterTemplateConfig.json') ? raw
        : url.endsWith('/TextMapKR_1.json')
          ? '{"329737901974927635":"최종 이름"}' : '{}',
    });
    await syncEnemyData(root, () => {}, good);
    const before = await readEnemyIndex(root);
    await assert.rejects(() => syncEnemyData(root, () => {}, async url =>
      url.endsWith('/TextMapKR_1.json')
        ? { ok: false, status: 404 }
        : good(url)), /다운로드 실패/);
    assert.deepEqual(await readEnemyIndex(root), before);
    assert.equal(JSON.parse(await readFile(join(root, '.local-data', 'game', 'current.json'))).version, '4.7.0');
  } finally { await rm(root, { recursive: true, force: true }); }
});
