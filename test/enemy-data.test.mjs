import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMY_SOURCE, parseEnemyTemplates, buildEnemyIndex, searchEnemyIndex } from '../src/enemy-data.mjs';

const sampleRaw = `[
  {"MonsterTemplateID":1002011,"MonsterName":{"Hash":329737901974927635},
    "Rank":"MinionLv2","AttackBase":{"Value":80},"DefenceBase":{"Value":210},
    "HPBase":{"Value":69.75},"SpeedBase":{"Value":100},
    "StanceBase":{"Value":60},"StatusResistanceBase":{"Value":0.2},"StanceType":"Ice"},
  {"MonsterTemplateID":1002012,"MonsterName":{"Hash":10777782549674465000},
    "Rank":"BigBoss","AttackBase":{"Value":250},"HPBase":{"Value":1200},"StanceType":"Fire"},
  {"MonsterTemplateID":1002013,"MonsterName":{"Hash":3436113033951413041},
    "Rank":"Elite","SpeedBase":{"Value":80}}
]`;

test('monster name hash remains the exact 64-bit decimal value before JSON parsing', () => {
  const parsed = parseEnemyTemplates(sampleRaw);
  assert.equal(parsed[0].MonsterName.Hash, '329737901974927635');
  assert.equal(parsed[1].MonsterName.Hash, '10777782549674465000');
  assert.equal(parsed[2].MonsterName.Hash, '3436113033951413041');
  assert.equal(ENEMY_SOURCE.gameVersion, '4.7.0');
  assert.equal(ENEMY_SOURCE.files.length, 4);
});

test('enemy names join against Korean TextMap keys and base stats retain source values', () => {
  const templates = parseEnemyTemplates(sampleRaw);
  const index = buildEnemyIndex(templates, [
    { '329737901974927635': '아이스 적' },
    { '10777782549674465000': '강력한 보스' },
    {},
  ]);
  assert.equal(index.total, 3);
  assert.equal(index.nameResolved, 2);
  assert.equal(index.nameUnresolved, 1);
  assert.equal(index.enemies[0].name, '아이스 적');
  assert.equal(index.enemies[0].id, '1002011');
  assert.equal(index.enemies[0].hpBase, 69.75);
  assert.equal(index.enemies[0].defenceBase, 210);
  assert.equal(index.enemies[0].statusResistanceBase, 0.2);
  assert.equal(index.enemies[1].rank, 'BigBoss');
  assert.equal(index.enemies[2].name, null);
  assert.equal(index.enemies[2].hpBase, null);
  assert.equal('weaknesses' in index.enemies[0], false);
});

test('conflicting localization is permanently left unresolved rather than guessing', () => {
  const index = buildEnemyIndex(parseEnemyTemplates(sampleRaw), [
    { '329737901974927635': '이름 A' },
    { '329737901974927635': '이름 B' },
    { '329737901974927635': '이름 A' },
  ]);
  assert.equal(index.conflictingNameHashes, 1);
  assert.equal(index.enemies[0].name, null);
});

test('search finds exact ID or Korean name; limit applies after selection', () => {
  const index = buildEnemyIndex(parseEnemyTemplates(sampleRaw), [
    { '329737901974927635': '이름 1', '10777782549674465000': '이름 2' },
  ]);
  assert.deepEqual(searchEnemyIndex(index, '1002012').items.map(x => x.id), ['1002012']);
  assert.deepEqual(searchEnemyIndex(index, '이름').items.map(x => x.id),
    ['1002011', '1002012']);
  assert.equal(searchEnemyIndex(index, '이름', 1).total, 2);
  assert.equal(searchEnemyIndex(index, '이름', 1).included, 1);
  assert.equal(searchEnemyIndex(index, '없는 이름').total, 0);
});

test('invalid input IDs, missing arrays and invalid query limits are rejected', () => {
  assert.throws(() => parseEnemyTemplates('{}'), /배열/);
  assert.throws(() => buildEnemyIndex([], [{}]), /비어/);
  assert.throws(() => buildEnemyIndex(parseEnemyTemplates(sampleRaw), [null]), /형식/);
  assert.throws(() => buildEnemyIndex([...parseEnemyTemplates(sampleRaw), ...parseEnemyTemplates(sampleRaw)], [{}]), /중복/);
  const index = buildEnemyIndex(parseEnemyTemplates(sampleRaw), [{}]);
  assert.throws(() => searchEnemyIndex(index, '', 300), /1~200/);
  assert.throws(() => searchEnemyIndex(null), /준비/);
});
