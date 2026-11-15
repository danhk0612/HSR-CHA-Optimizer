import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCharacterSheet } from '../src/stat-comparison.mjs';

const make = (values, attributes, additions, other = {}) => ({
  manual: { source: 'game-character-screen-manual', recordedAt: '2026-11-15T01:00:00.000Z', values },
  showcase: {
    source: 'mihomo-parsed-local-file', importedAt: '2026-11-15T02:00:00.000Z',
    originalCaptureTimeKnown: false,
    levelAtImport: 80, eidolonAtImport: 2, attributes, additions, properties: [], ...other,
  },
});
const stat = (field, value, percent = false) => ({ field, value, percent });

test('stat comparison converts fractional percent sources into manual screen percentage points', () => {
  const entry = make(
    { hp: 3500, spd: 143.2, crit_rate: 65.3, crit_dmg: 180.4 },
    [stat('hp', 2300), stat('spd', 100), stat('crit_rate', 0.05, true), stat('crit_dmg', 0.5, true)],
    [stat('hp', 1200), stat('spd', 43.2), stat('crit_rate', 0.603, true), stat('crit_dmg', 1.304, true)],
  );
  const result = compareCharacterSheet(entry, { level: 80, eidolon: 2 });
  assert.equal(result.fieldsCompared, 4);
  for (const row of result.rows) assert.equal(row.difference, 0);
  assert.equal(result.rows.find(row => row.field === 'crit_rate').publicCalculated, 65.3);
  assert.equal(result.rows.find(row => row.field === 'crit_dmg').publicCalculated, 180.4);
  assert.equal(result.sameCharacterLevelAsCurrentScan, true);
  assert.equal(result.sameEidolonAsCurrentScan, true);
  assert.equal(result.showcaseOriginalCaptureTimeKnown, false);
});

test('comparison computes signed differences only, without automatic match judgments or overwrites', () => {
  const entry = make({ hp: 4000, spd: 150 }, [stat('hp', 2300), stat('spd', 100)],
    [stat('hp', 1200), stat('spd', 43)]);
  const before = structuredClone(entry);
  const result = compareCharacterSheet(entry, { level: 79, eidolon: 1 });
  assert.equal(result.rows.find(r => r.field === 'hp').difference, 500);
  assert.equal(result.rows.find(r => r.field === 'spd').difference, 7);
  assert.equal(result.sameCharacterLevelAsCurrentScan, false);
  assert.equal(result.sameEidolonAsCurrentScan, false);
  assert.deepEqual(entry, before);
});

test('missing public base or inconsistent units are incomparable instead of assumed zero', () => {
  const entry = make({ effect_hit: 60, spd: 147 }, [stat('spd', 100)],
    [stat('effect_hit', 0.6, true), stat('spd', 0.10, true)]);
  const result = compareCharacterSheet(entry);
  assert.equal(result.fieldsCompared, 0);
  assert.equal(result.rows.find(r => r.field === 'effect_hit').publicCalculated, null);
  assert.equal(result.rows.find(r => r.field === 'spd').difference, null);
  assert.equal(result.sameCharacterLevelAsCurrentScan, null);
});

test('no manual or no showcase values do not create a comparison', () => {
  assert.equal(compareCharacterSheet({ manual: { values: { hp: 1000 } } }), null);
  assert.equal(compareCharacterSheet({ showcase: { attributes: [], additions: [] } }), null);
  assert.equal(compareCharacterSheet(undefined), null);
});
