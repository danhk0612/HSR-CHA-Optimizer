import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAnalysisPreferences, saveAnalysisPreferences } from '../src/analysis-preferences.mjs';

const primary = { metadata: { uid: 123456789 } };
const alternate = { metadata: { uid: 999888777 } };

test('per-account AI analysis conditions are stored separately with no UID in filenames', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-pref-'));
  try {
    assert.equal((await readAnalysisPreferences(root, primary)).text, '');
    await saveAnalysisPreferences(root, primary, '남성 캐릭터 제외. 재화 최소 소모.');
    await saveAnalysisPreferences(root, alternate, '장비 재배치 허용.');
    assert.equal((await readAnalysisPreferences(root, primary)).text,
      '남성 캐릭터 제외. 재화 최소 소모.');
    assert.equal((await readAnalysisPreferences(root, alternate)).text,
      '장비 재배치 허용.');
    const names = await readdir(join(root, '.local-data', 'account'));
    assert.equal(names.length, 2);
    assert.ok(names.every(name => !name.includes('123456789') && !name.includes('999888777')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('empty personal conditions can be saved; oversized and UID-less writes are rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hsr-pref-empty-'));
  try {
    await saveAnalysisPreferences(root, primary, '');
    assert.equal((await readAnalysisPreferences(root, primary)).text, '');
    await assert.rejects(() => saveAnalysisPreferences(root, primary, 'A'.repeat(4001)), /4,000자/);
    assert.deepEqual(await readAnalysisPreferences(root, { metadata: {} }),
      { text: '', updatedAt: null });
    await assert.rejects(() => saveAnalysisPreferences(root, { metadata: {} }, '시험'), /UID/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
