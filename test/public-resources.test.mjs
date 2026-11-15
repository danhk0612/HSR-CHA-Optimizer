import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPublicData, publicDataMarkdown } from '../src/public-resources.mjs';

const blessings = {
  12: { id: '12', name: '보존의 축복', desc: '실드 강화', enhanced_desc: '실드 보강' },
  13: { id: '13', name: '기억의 축복', desc: '기억 강화' },
  14: { id: '14', name: '보존의 메아리', desc: '메아리 효과' },
};

test('public resources match Korean names, id and retain original source fields', () => {
  const results = searchPublicData(blessings, 'blessings', '보존');
  assert.equal(results.total, 2);
  assert.deepEqual(results.items.map(item => item.id), ['12', '14']);
  assert.equal(results.items[0].enhanced_desc, '실드 보강');
  assert.equal(results.name, '시뮬레이션 우주 축복');
  const exact = searchPublicData(blessings, 'blessings', '13');
  assert.deepEqual(exact.items.map(item => item.id), ['13']);
});

test('public search limits output without misreporting matching count', () => {
  const results = searchPublicData(blessings, 'blessings', '', 1);
  assert.equal(results.total, 3);
  assert.equal(results.included, 1);
  assert.equal(results.items.length, 1);
});

test('public Markdown exports source version and original JSON without personal data', () => {
  const result = searchPublicData(blessings, 'blessings', '기억', 2);
  const md = publicDataMarkdown(result, { source: 'StarRailRes', version: '4.7.0' });
  assert.match(md, /StarRailRes \/ 4\.7\.0/);
  assert.match(md, /기억의 축복/);
  assert.match(md, /json/);
});

test('unknown public categories and invalid limits are rejected', () => {
  assert.throws(() => searchPublicData(blessings, 'monsters'), /지원하지 않는/);
  assert.throws(() => searchPublicData(blessings, 'blessings', '', 201), /1~200/);
  assert.throws(() => searchPublicData(null, 'blessings'), /준비되지/);
});
