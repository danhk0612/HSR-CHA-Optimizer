import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiReport, toAiMarkdown } from '../src/ai-report.mjs';

const scanner = {
  source: 'reliquary_archiver', build: '0.20.0', version: 4,
  metadata: { uid: 123456789 },
  characters: [
    { id: '1308', name: 'Acheron', level: 80, ascension: 6, eidolon: 1,
      skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: { ability_1: true },
      affinitive_eidolons: [130801] },
    { id: '1001', name: 'March 7th', level: 60, eidolon: 0, skills: { basic: 1 } },
  ],
  light_cones: [
    { id: '23024', _uid: 15, level: 80, ascension: 6, superimposition: 1, location: '1308' },
  ],
  relics: [
    { _uid: 11, set_id: '110', slot: 'Head', level: 15, rarity: 5, mainstat: 'HP', substats: [{ key: 'SPD', value: 2.4 }], location: '1308' },
    { _uid: 12, set_id: '110', slot: 'Body', level: 15, rarity: 5, mainstat: 'CRIT Rate', substats: [{ key: 'CRIT DMG_', value: 12.9 }], location: '1308' },
    { _uid: 13, set_id: '110', slot: 'Feet', level: 15, rarity: 5, mainstat: 'ATK', substats: [], location: '' },
    { _uid: 14, set_id: '314', slot: 'Planar Sphere', level: 15, rarity: 4, mainstat: 'ATK', substats: [], location: '' },
    { _uid: 15, set_id: '110', slot: 'Head', level: 15, rarity: 5, mainstat: 'HP', substats: [], location: '1001' },
  ],
  gacha: { stellar_jade: 358, oneric_shards: 0 },
  materials: [{ id: '102', name: 'Star Rail Special Pass', count: 118 }, { id: '999999', name: 'Unknown', count: 7 }],
};
const tables = {
  characters: { 1308: { id: '1308', name: '아케론', ranks: ['130801', '130802'], skills: ['130801', '130802'], skill_trees: [] } },
  character_ranks: { 130801: { rank: 1, name: '1돌', desc: '치확 강화' }, 130802: { rank: 2, name: '2돌', desc: '추가 강화' } },
  character_skills: {
    130801: { type: 'Normal', name: '일반 공격', desc: '#1[i]%', params: [[.5], [.6], [.7], [.8], [.9], [1]] },
    130802: { type: 'BPSkill', name: '전투 스킬', desc: '#1[i]%', params: Array(15).fill([1.6]) },
  },
  character_skill_trees: {},
  light_cones: { 23024: { id: '23024', name: '흘러가는 강가를 따라' } },
  light_cone_ranks: { 23024: { skill: '광추 효과', desc: '#1[i]%', params: [[.36], [.45]] } },
  relic_sets: {
    110: { id: '110', name: '밤낮의 경계를 나는 매', desc: ['2세트', '4세트'] },
    314: { id: '314', name: '이즈모', desc: ['2세트'] },
  },
  items: { 102: { id: '102', name: '별의 궤도 전용티켓' } },
};
const manifest = { version: '4.7.0', source: 'StarRailRes', syncedAt: '2026-11-15T00:00:00Z' };
const base = { characterIds: ['1308'] };

test('compact export includes only unlocked eidolons and selected skill coefficients', () => {
  const result = buildAiReport(scanner, tables, manifest, base);
  assert.equal(result.characters.length, 1);
  assert.equal(result.characters[0].name, '아케론');
  assert.deepEqual(result.characters[0].unlockedEidolons.map(e => e.rank), [1]);
  assert.deepEqual(result.characters[0].skills.basic.paramsAtLevel, [1]);
  assert.equal(result.characters[0].lightCones[0].name, '흘러가는 강가를 따라');
  assert.deepEqual(result.characters[0].lightCones[0].effect.paramsAtSuperimposition, [.36]);
  assert.equal(result.characters[0].relics.length, 2);
  assert.equal(result.characters[0].relicSetBonuses[0].active.length, 1);
  assert.equal(result.candidates, undefined);
  assert.equal(result.resources, undefined);
  assert.equal(result.limitations.characterSheetStatsCollected, false);
  assert.ok(!JSON.stringify(result).includes('123456789'));
});

test('candidate mode excludes other characters equipped gear', () => {
  const result = buildAiReport(scanner, tables, manifest, { ...base, candidateMode: 'equipped-sets', minRarity: 5 });
  assert.equal(result.candidates.matching, 1);
  assert.deepEqual(result.candidates.relics.map(r => r.inventoryId), [13]);
  const all = buildAiReport(scanner, tables, manifest, { ...base, candidateMode: 'all' });
  assert.equal(all.candidates.matching, 2);
  const limited = buildAiReport(scanner, tables, manifest, { ...base, candidateMode: 'all', candidateLimit: 1 });
  assert.equal(limited.candidates.included, 1);
  assert.equal(limited.candidates.matching, 2);
});

test('resources localize known item names and explicitly mark unknown items', () => {
  const result = buildAiReport(scanner, tables, manifest, { ...base, includeResources: true });
  assert.equal(result.resources.gacha.stellar_jade, 358);
  assert.equal(result.resources.materials[0].name, '별의 궤도 전용티켓');
  assert.equal(result.resources.materials[1].koreanNameUnavailable, true);
  assert.ok(toAiMarkdown(result).includes('별의 궤도 전용티켓'));
});

test('unowned characters and invalid candidate modes are rejected', () => {
  assert.throws(() => buildAiReport(scanner, tables, manifest, {}), /캐릭터 ID/);
  assert.throws(() => buildAiReport(scanner, tables, manifest, { characterIds: ['9999'] }), /보유 캐릭터 목록에 없는/);
  assert.throws(() => buildAiReport(scanner, tables, manifest, { ...base, candidateMode: 'unsafe' }), /후보 범위/);
});
