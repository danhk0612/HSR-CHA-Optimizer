import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function file(root, scanner) {
  const uid = scanner?.metadata?.uid;
  if (uid === undefined || uid === null || uid === '')
    throw new Error('계정 UID가 없어 개인 분석 조건을 안전하게 구분할 수 없습니다.');
  const hash = createHash('sha256').update(String(uid)).digest('hex').slice(0, 16);
  return resolve(root, '.local-data', 'account', 'analysis-preferences-' + hash + '.json');
}

export async function readAnalysisPreferences(root, scanner) {
  if (scanner?.metadata?.uid === undefined || scanner.metadata.uid === null || scanner.metadata.uid === '')
    return { text: '', updatedAt: null };
  try {
    const data = JSON.parse(await readFile(file(root, scanner), 'utf8'));
    if (data.schemaVersion !== 1 || typeof data.text !== 'string') throw new Error('분석 조건 저장 형식이 올바르지 않습니다.');
    return { text: data.text, updatedAt: data.updatedAt ?? null };
  } catch (error) {
    if (error.code === 'ENOENT') return { text: '', updatedAt: null };
    throw error;
  }
}

export async function saveAnalysisPreferences(root, scanner, value) {
  if (typeof value !== 'string' || value.length > 4000)
    throw new Error('분석 조건은 4,000자 이하의 텍스트여야 합니다.');
  const data = { schemaVersion: 1, text: value, updatedAt: new Date().toISOString() };
  await mkdir(join(resolve(root), '.local-data', 'account'), { recursive: true });
  await writeFile(file(root, scanner), JSON.stringify(data, null, 2), 'utf8');
  return { text: data.text, updatedAt: data.updatedAt };
}
