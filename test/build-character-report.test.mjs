import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacterReport } from '../src/build-character-report.mjs';

test('character report joins exact source references without changing skill coefficients', () => {
  const character = {
    id: '1001',
    name: '테스트',
    ranks: ['r1'],
    skills: ['s1'],
    skill_trees: ['t1'],
  };
  const tables = {
    character_ranks: { r1: { id: 'r1', rank: 1 } },
    character_skills: { s1: { id: 's1', desc: '#1[i]%', params: [[0.5], [0.6]] } },
    character_skill_trees: { t1: { id: 't1', level: 1 } },
    character_promotions: { 1001: { values: [1, 2, 3] } },
  };
  const result = buildCharacterReport(character, tables, { gameVersion: '4.7.0' });
  assert.equal(result.character.id, '1001');
  assert.equal(result.eidolons[0].rank, 1);
  assert.deepEqual(result.skills[0].params, [[0.5], [0.6]]);
  assert.equal(result.traces[0].id, 't1');
  assert.deepEqual(result.promotions.values, [1, 2, 3]);
  assert.equal(result.metadata.gameVersion, '4.7.0');
});

test('missing source references are omitted rather than fabricated', () => {
  const result = buildCharacterReport(
    { id: 'x', ranks: ['absent'], skills: [], skill_trees: [] },
    { character_ranks: {}, character_skills: {}, character_skill_trees: {} },
    {},
  );
  assert.deepEqual(result.eidolons, []);
  assert.equal(result.promotions, null);
});
