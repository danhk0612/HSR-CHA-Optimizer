import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WARP_POOLS, readWarpState, saveManualWarpPool, clearManualWarpPool } from '../src/warp-state.mjs';

const scanner = { metadata: { uid: 100000999 } };

test('manual warp state keeps event pools separate and source metadata explicit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-warp-'));
  try {
    assert.deepEqual((await readWarpState(root, scanner)).pools, {});
    await saveManualWarpPool(root, scanner, 'character', { pity: 64, guarantee: 'yes' });
    await saveManualWarpPool(root, scanner, 'lightCone', { pity: 36, guarantee: 'unknown' });
    const data = await readWarpState(root, scanner);
    assert.equal(data.pools.character.pity, 64);
    assert.equal(data.pools.character.guarantee, 'yes');
    assert.equal(data.pools.lightCone.pity, 36);
    assert.equal(data.pools.lightCone.guarantee, 'unknown');
    assert.equal(data.pools.character.source, 'game-warp-screen-manual');
    assert.ok(data.pools.character.recordedAt);
    const filename = (await readdir(join(root, '.local-data', 'account')))[0];
    assert.ok(!filename.includes(String(scanner.metadata.uid)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('standard and departure pools cannot accept unsupported pickup guarantees', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-warp-standard-'));
  try {
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'standard',
      { pity: 22, guarantee: 'yes' }), /보장 상태/);
    await saveManualWarpPool(root, scanner, 'standard', { pity: 22 });
    const data = await readWarpState(root, scanner);
    assert.equal(data.pools.standard.guarantee, undefined);
    assert.equal(data.pools.standard.pity, 22);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('warp pity validation rejects unsupported types, nonintegers and out-of-range values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-warp-invalid-'));
  try {
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'character', { pity: 90.5 }), /스택/);
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'lightCone', { pity: 81 }), /스택/);
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'departure', { pity: -1 }), /스택/);
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'eventCustom', { pity: 10 }), /지원하지 않는/);
    await assert.rejects(() => saveManualWarpPool(root, scanner, 'character',
      { pity: 20, guarantee: true }), /보장 상태/);
    assert.equal(Object.keys(WARP_POOLS).length, 6);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('clear and account switching do not cross-populate manually recorded warp records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-warp-switch-'));
  try {
    const other = { metadata: { uid: 200000111 } };
    await saveManualWarpPool(root, scanner, 'character', { pity: 10, guarantee: 'no' });
    assert.deepEqual((await readWarpState(root, other)).pools, {});
    await saveManualWarpPool(root, other, 'character', { pity: 77, guarantee: 'yes' });
    assert.equal((await readWarpState(root, scanner)).pools.character.pity, 10);
    assert.equal((await readWarpState(root, other)).pools.character.pity, 77);
    await clearManualWarpPool(root, scanner, 'character');
    assert.deepEqual((await readWarpState(root, scanner)).pools, {});
    assert.equal((await readWarpState(root, other)).pools.character.pity, 77);
    assert.deepEqual((await readWarpState(root, { metadata: {} })).pools, {});
  } finally { await rm(root, { recursive: true, force: true }); }
});
