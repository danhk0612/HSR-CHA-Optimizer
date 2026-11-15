import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ENEMY_SOURCE, parseEnemyTemplates, buildEnemyIndex, searchEnemyIndex } from './enemy-data.mjs';

function enemyFile(root) {
  return resolve(root, '.local-data', 'game', 'enemies', 'index.json');
}

export async function readEnemyIndex(root) {
  try { return JSON.parse(await readFile(enemyFile(root), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function getRawJson(path, fetchImpl) {
  const url = 'https://raw.githubusercontent.com/DimbreathBot/TurnBasedGameData/' +
    ENEMY_SOURCE.commit + '/' + path;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error('적 데이터 다운로드 실패 (' + response.status + '): ' + path);
  return response.text();
}

// Explicit opt-in: never called during the core 20-source StarRailRes sync.
export async function syncEnemyData(root = process.cwd(), onProgress = () => {}, fetchImpl = fetch) {
  const base = resolve(root, '.local-data', 'game');
  const current = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'));
  if (current.version !== ENEMY_SOURCE.gameVersion || current.language !== 'kr') {
    throw new Error('적 자료의 정식 버전 ' + ENEMY_SOURCE.gameVersion +
      '과 현재 게임 데이터 버전이 다릅니다. 동일 버전 확인 전 혼합할 수 없습니다.');
  }
  const files = [];
  for (const path of ENEMY_SOURCE.files) {
    const body = await getRawJson(path, fetchImpl);
    files.push(body);
    onProgress({ done: files.length, total: ENEMY_SOURCE.files.length, filename: path });
  }
  const templates = parseEnemyTemplates(files[0]);
  const textMaps = files.slice(1).map(x => JSON.parse(x));
  const index = buildEnemyIndex(templates, textMaps);
  if (index.nameResolved === 0) throw new Error('한국어 적 이름을 하나도 연결하지 못해 이전 자료를 유지합니다.');
  index.preparedAt = new Date().toISOString();

  const folder = join(base, 'enemies');
  await mkdir(folder, { recursive: true });
  const staging = join(folder, '.index-' + process.pid + '-' + Date.now() + '.tmp');
  try {
    await writeFile(staging, JSON.stringify(index, null, 2), 'utf8');
    await rename(staging, join(folder, 'index.json'));
  } finally {
    await rm(staging, { force: true });
  }
  return {
    sourceGameVersion: index.sourceGameVersion,
    sourceCommit: index.sourceCommit,
    total: index.total,
    nameResolved: index.nameResolved,
    nameUnresolved: index.nameUnresolved,
    preparedAt: index.preparedAt,
  };
}

export async function exportEnemyData(root, request = {}) {
  const index = await readEnemyIndex(root);
  if (!index) throw new Error('적·보스 데이터가 없습니다. 별도 자료 준비 버튼을 누르세요.');
  const current = JSON.parse(await readFile(
    resolve(root, '.local-data', 'game', 'current.json'), 'utf8'));
  if (current.version !== index.sourceGameVersion) {
    throw new Error('현재 게임 버전과 적 원본 버전이 달라 조회할 수 없습니다.');
  }
  const results = searchEnemyIndex(index, request.query ?? '', request.limit ?? 20);
  const metadata = {
    gameVersion: current.version, source: index.source,
    sourceCommit: index.sourceCommit, sourceGameVersion: index.sourceGameVersion,
    language: index.language, preparedAt: index.preparedAt,
  };
  const json = { metadata, ...results };
  const output = request.format === 'markdown' ? [
    '# 붕괴: 스타레일 — 적·보스 원본 기준 데이터',
    '원본: ' + metadata.source + ' / ' + metadata.sourceCommit,
    '버전: ' + metadata.sourceGameVersion,
    '기초 수치: 전투 레벨/콘텐츠 보정 미적용',
    '한국어 이름 확인: ' + results.nameResolved + ' / ' +
      (results.nameResolved + results.nameUnresolved),
    '검색 결과: ' + results.included + ' / ' + results.total,
    '## 데이터',
    '```json\n' + JSON.stringify(results.items, null, 2) + '\n```',
  ].join('\n\n') + '\n' : JSON.stringify(json, null, 2);
  return {
    type: 'enemies', metadata, total: results.total, included: results.included,
    nameResolved: results.nameResolved, nameUnresolved: results.nameUnresolved,
    text: output,
  };
}
