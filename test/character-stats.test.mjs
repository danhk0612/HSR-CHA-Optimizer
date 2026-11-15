import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readCharacterStats, saveManualCharacterStats, clearManualCharacterStats,
  importMihomoParsed, statsForExport, getCharacterStatsSummary,
} from '../src/character-stats.mjs';

const scanner = {
  metadata: { uid: 100000999 },
  characters: [{ id: '1308', level: 80 }, { id: '8002', level: 80 }],
};
const affix = (field, value, percent = false) => ({
  field, value, percent, name: field, display: String(value),
});
const response = (ids = ['1308']) => ({
  player: { uid: '100000999', nickname: 'sample-user' },
  characters: ids.map(id => ({
    id, level: 80, rank: 1,
    attributes: [affix('hp', 2000), affix('spd', 101)],
    additions: [affix('hp', 2300), affix('crit_rate', 0.6, true)],
    properties: [{ ...affix('crit_rate', 0.6, true), type: 'CriticalChanceBase' }],
  })),
});

test('sheet storage begins empty and manual input accepts partial fields including zero', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-sheet-'));
  try {
    assert.deepEqual((await readCharacterStats(root)).characters, {});
    await saveManualCharacterStats(root, scanner, '1308', { hp: 4300, spd: 153.2, crit_rate: 0 });
    const store = await readCharacterStats(root);
    assert.equal(store.characters['1308'].manual.values.hp, 4300);
    assert.equal(store.characters['1308'].manual.values.spd, 153.2);
    assert.equal(store.characters['1308'].manual.values.crit_rate, 0);
    assert.equal(store.characters['1308'].manual.values.crit_dmg, undefined);
    assert.equal(getCharacterStatsSummary(store).manual, 1);
    assert.equal(statsForExport(store, '8002'), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('manual editor rejects invalid account IDs and nonfinite numbers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-sheet-invalid-'));
  try {
    await assert.rejects(() => saveManualCharacterStats(root, scanner, '9999', { hp: 100 }), /등록되지 않은/);
    await assert.rejects(() => saveManualCharacterStats(root, scanner, '1308', { hp: Infinity }), /유효하지 않은/);
    await assert.rejects(() => saveManualCharacterStats(root, scanner, '1308', { fake_field: 10 }), /지원하지 않는/);
    await assert.rejects(() => saveManualCharacterStats(root, scanner, '1308', {}), /한 항목 이상/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('offline Mihomo parsed import checks UID and copies only whitelisted stat fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-showcase-'));
  try {
    await saveManualCharacterStats(root, scanner, '1308', { hp: 4500 });
    const wrong = response();
    wrong.player.uid = '999888777';
    await assert.rejects(() => importMihomoParsed(root, scanner, wrong), /UID/);
    const result = await importMihomoParsed(root, scanner, response(['1308', '8002']), '2026-11-15T10:00:00.000Z');
    assert.equal(result.characters, 2);
    const store = await readCharacterStats(root);
    assert.equal(store.characters['1308'].manual.values.hp, 4500);
    assert.equal(store.characters['1308'].showcase.attributes[0].value, 2000);
    assert.equal(store.characters['1308'].showcase.additions[0].value, 2300);
    assert.equal(store.characters['1308'].showcase.importedAt, '2026-11-15T10:00:00.000Z');
    assert.equal(store.characters['1308'].showcase.originalCaptureTimeKnown, false);
    assert.equal(store.characters['1308'].showcase.source, 'mihomo-parsed-local-file');
    assert.equal(getCharacterStatsSummary(store).showcase, 2);
    const selected = statsForExport(store, '1308');
    assert.ok(selected.manualObserved);
    assert.ok(selected.publicShowcaseCalculated);
    assert.ok(!JSON.stringify(store).includes('100000999'));
    assert.ok(!JSON.stringify(store).includes('sample-user'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('showcase refresh replaces old showcase entries without erasing manual observations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-showcase-refresh-'));
  try {
    await saveManualCharacterStats(root, scanner, '8002', { spd: 140 });
    await importMihomoParsed(root, scanner, response(['1308', '8002']));
    const smaller = response(['1308']);
    smaller.characters[0].additions = [];
    await importMihomoParsed(root, scanner, smaller);
    const data = await readCharacterStats(root);
    assert.equal(data.characters['8002'].manual.values.spd, 140);
    assert.equal(data.characters['8002'].showcase, undefined);
    assert.equal(data.characters['1308'].showcase.additions.length, 0);
    await clearManualCharacterStats(root, scanner, '8002');
    const after = await readCharacterStats(root);
    assert.equal(after.characters['8002'], undefined);
    assert.equal(after.characters['1308'].showcase.attributes.length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('showcase import rejects unsupported/raw arrays, duplicates and unowned IDs atomically', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-showcase-structure-'));
  try {
    await assert.rejects(() => importMihomoParsed(root, scanner, { detailInfo: {} }), /Parsed API/);
    await assert.rejects(() => importMihomoParsed(root, scanner, response(['1308', '1308'])), /중복/);
    await assert.rejects(() => importMihomoParsed(root, scanner, response(['1308', '9999'])), /등록되지 않은/);
    const state = await readCharacterStats(root);
    assert.deepEqual(state.characters, {});
  } finally { await rm(root, { recursive: true, force: true }); }
});
