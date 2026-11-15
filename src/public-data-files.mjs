import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PUBLIC_TABLES, searchPublicData, publicDataMarkdown } from './public-resources.mjs';

export async function exportPublicData(root, request) {
  const type = request.type;
  const entry = PUBLIC_TABLES[type];
  if (!entry) throw new Error('지원하지 않는 공개 자료 종류입니다.');
  const base = resolve(root, '.local-data', 'game');
  const current = JSON.parse(await readFile(join(base, 'current.json'), 'utf8'));
  const folder = join(base, current.version, current.language);
  const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'));
  let table;
  try {
    table = JSON.parse(await readFile(join(folder, entry.filename + '.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('확장 자료가 없습니다. 게임 데이터 동기화를 다시 실행하세요.');
    throw error;
  }
  const result = searchPublicData(table, type, request.query ?? '', request.limit ?? 20);
  const metadata = {
    gameSource: manifest.source,
    gameVersion: manifest.version,
    language: manifest.language,
    gameSyncedAt: manifest.syncedAt,
  };
  const payload = { metadata, ...result };
  return {
    metadata, type: result.type, total: result.total, included: result.included,
    text: request.format === 'markdown'
      ? publicDataMarkdown(result, manifest)
      : JSON.stringify(payload, null, 2),
  };
}
