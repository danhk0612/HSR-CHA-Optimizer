import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Explicitly user-recorded only; do not infer pity/guarantee from inventory ownership.
export const WARP_POOLS = {
  character: { name: '캐릭터 이벤트', maxPity: 90, guarantee: true },
  lightCone: { name: '광추 이벤트', maxPity: 80, guarantee: true },
  standard: { name: '상시', maxPity: 90, guarantee: false },
  departure: { name: '초보자', maxPity: 50, guarantee: false },
  collaborationCharacter: { name: '컬래버 캐릭터', maxPity: 90, guarantee: true },
  collaborationLightCone: { name: '컬래버 광추', maxPity: 80, guarantee: true },
};

function location(root, scanner) {
  const uid = scanner?.metadata?.uid;
  if (!uid) throw new Error('계정 UID를 확인할 수 없어 천장 값을 저장할 수 없습니다.');
  const key = createHash('sha256').update(String(uid)).digest('hex').slice(0, 16);
  return resolve(root, '.local-data', 'account', 'warp-state-' + key + '.json');
}

export async function readWarpState(root, scanner) {
  const path = location(root, scanner);
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    if (data.schemaVersion !== 1 || !data.pools || typeof data.pools !== 'object' ||
        Array.isArray(data.pools)) throw new Error('지원하지 않는 천장 기록 형식입니다.');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, pools: {} };
    throw error;
  }
}

async function writeWarpState(root, scanner, data) {
  const dir = resolve(root, '.local-data', 'account');
  await mkdir(dir, { recursive: true });
  await writeFile(location(root, scanner), JSON.stringify(data, null, 2), 'utf8');
}

export async function saveManualWarpPool(root, scanner, name, input) {
  const spec = WARP_POOLS[name];
  if (!spec) throw new Error('지원하지 않는 워프 종류입니다.');
  const pity = input?.pity;
  const guarantee = input?.guarantee ?? 'unknown';
  if (!Number.isInteger(pity) || pity < 0 || pity > spec.maxPity)
    throw new Error('입력한 천장 스택의 범위가 잘못됐습니다.');
  if (!['unknown', 'yes', 'no'].includes(guarantee) || (!spec.guarantee && guarantee !== 'unknown'))
    throw new Error('보장 상태는 해당 워프에서 입력할 수 없습니다.');
  const record = {
    source: 'game-warp-screen-manual',
    recordedAt: new Date().toISOString(),
    pity,
    ...(spec.guarantee ? { guarantee } : {}),
  };
  const data = await readWarpState(root, scanner);
  data.pools[name] = record;
  await writeWarpState(root, scanner, data);
  return record;
}

export async function clearManualWarpPool(root, scanner, name) {
  if (!WARP_POOLS[name]) throw new Error('지원하지 않는 워프 종류입니다.');
  const data = await readWarpState(root, scanner);
  if (data.pools[name]) {
    delete data.pools[name];
    await writeWarpState(root, scanner, data);
  }
  return true;
}
