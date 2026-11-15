import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Deliberately separate from Reliquary Archiver; never overwrite the scanner snapshot.
const FORMAT = 1;
const STATS = {
  hp: ['HP', 'flat'], atk: ['공격력', 'flat'], def: ['방어력', 'flat'],
  spd: ['속도', 'flat'], crit_rate: ['치명타 확률', '%'],
  crit_dmg: ['치명타 피해', '%'], break_effect: ['격파 특수효과', '%'],
  effect_hit: ['효과 명중', '%'], effect_res: ['효과 저항', '%'],
  energy_regen: ['에너지 회복효율', '%'],
};
export const MANUAL_STAT_FIELDS = Object.fromEntries(
  Object.entries(STATS).map(([field, [name, unit]]) => [field, { name, unit }]),
);

function file(root) { return resolve(root, '.local-data', 'account', 'character-stats.json'); }

export async function readCharacterStats(root = process.cwd()) {
  let data;
  try { data = JSON.parse(await readFile(file(root), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { schemaVersion: FORMAT, characters: {} }; throw e; }
  if (data.schemaVersion !== FORMAT || !data.characters || typeof data.characters !== 'object' ||
      Array.isArray(data.characters)) throw new Error('지원하지 않는 능력치 저장 형식');
  return data;
}

async function saveCharacterStats(root, data) {
  await mkdir(join(resolve(root), '.local-data', 'account'), { recursive: true });
  await writeFile(file(root), JSON.stringify(data, null, 2), 'utf8');
}

function ownedId(id, scanner) {
  const key = String(id);
  if (!/^\d+$/.test(key) || !scanner.characters?.some(item => String(item.id) === key))
    throw new Error('현재 계정에 등록되지 않은 캐릭터 ID입니다.');
  return key;
}

export async function saveManualCharacterStats(root, scanner, id, values) {
  const key = ownedId(id, scanner);
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('능력치 형식 오류');
  const cleaned = {};
  for (const [field, raw] of Object.entries(values)) {
    if (!STATS[field]) throw new Error('지원하지 않는 캐릭터 능력치: ' + field);
    if (raw === '' || raw == null) continue;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0)
      throw new Error('유효하지 않은 능력치: ' + field);
    cleaned[field] = raw;
  }
  if (!Object.keys(cleaned).length) throw new Error('능력치를 한 항목 이상 입력하세요.');
  const data = await readCharacterStats(root);
  data.characters[key] ??= {};
  data.characters[key].manual = {
    source: 'game-character-screen-manual',
    recordedAt: new Date().toISOString(),
    values: cleaned,
  };
  await saveCharacterStats(root, data);
  return data.characters[key].manual;
}

export async function clearManualCharacterStats(root, scanner, id) {
  const key = ownedId(id, scanner);
  const data = await readCharacterStats(root);
  if (data.characters[key]) {
    delete data.characters[key].manual;
    if (!Object.keys(data.characters[key]).length) delete data.characters[key];
    await saveCharacterStats(root, data);
  }
  return true;
}

function stripProperty(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      typeof raw.field !== 'string' || !raw.field ||
      typeof raw.value !== 'number' || !Number.isFinite(raw.value) ||
      typeof raw.percent !== 'boolean') return null;
  return {
    field: raw.field,
    ...(typeof raw.type === 'string' ? { type: raw.type } : {}),
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
    value: raw.value, percent: raw.percent,
    ...(typeof raw.display === 'string' ? { display: raw.display } : {}),
  };
}

function propertyArray(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Mihomo 능력치 배열 형식 오류');
  if (value.length > 200) throw new Error('Mihomo 능력치 항목 수가 비정상적으로 많습니다.');
  const sanitized = value.map(stripProperty);
  if (sanitized.some(p => p === null)) throw new Error('Mihomo 능력치 배열 값이 유효하지 않습니다.');
  return sanitized;
}

// Imports user-saved Mihomo parsed JSON, NEVER calls any UID API.
// A missing or mismatched UID must not pollute another account's local snapshot.
export async function importMihomoParsed(root, scanner, input, importedAt = new Date().toISOString()) {
  if (!input || !input.player || !Array.isArray(input.characters) || input.detailInfo)
    throw new Error('Mihomo Parsed API JSON(player/characters) 형식이 아닙니다.');
  const localUid = scanner.metadata?.uid;
  const providedUid = input.player.uid;
  if (!localUid || !providedUid || String(localUid) !== String(providedUid))
    throw new Error('JSON의 UID가 현재 계정 UID와 일치하지 않습니다.');
  if (!input.characters.length) throw new Error('공개 전시에 등록된 캐릭터가 없습니다.');

  const data = await readCharacterStats(root);
  const parsed = new Map();
  for (const char of input.characters) {
    const key = ownedId(char.id, scanner);
    if (parsed.has(key)) throw new Error('공개 전시에 중복된 캐릭터 ID가 있습니다.');
    if (!Array.isArray(char.attributes) || !Array.isArray(char.additions))
      throw new Error('Mihomo의 attributes/additions 배열이 없습니다.');
    const attributes = propertyArray(char.attributes);
    const additions = propertyArray(char.additions);
    const properties = propertyArray(char.properties);
    if (!attributes.length || !additions.length) throw new Error('공개 전시의 능력치 정보가 비어 있습니다.');
    parsed.set(key, {
      source: 'mihomo-parsed-local-file',
      importedAt,
      originalCaptureTimeKnown: false,
      ...(Number.isInteger(char.level) ? { levelAtImport: char.level } : {}),
      ...(Number.isInteger(char.rank) ? { eidolonAtImport: char.rank } : {}),
      attributes, additions, properties,
    });
  }
  // Replace the showcase snapshot as a group: stale showcase characters are not retained.
  for (const entry of Object.values(data.characters)) delete entry.showcase;
  for (const [key, showcase] of parsed) {
    data.characters[key] ??= {};
    data.characters[key].showcase = showcase;
  }
  for (const [key, entry] of Object.entries(data.characters)) {
    if (!Object.keys(entry).length) delete data.characters[key];
  }
  await saveCharacterStats(root, data);
  return { characters: parsed.size, importedAt, source: 'mihomo-parsed-local-file' };
}

export function getCharacterStatsSummary(data) {
  const counts = { manual: 0, showcase: 0 };
  for (const record of Object.values(data.characters)) {
    if (record.manual) counts.manual++;
    if (record.showcase) counts.showcase++;
  }
  return counts;
}

export function statsForExport(data, id) {
  const entry = data.characters[String(id)];
  if (!entry) return null;
  const result = {};
  if (entry.manual) result.manualObserved = entry.manual;
  if (entry.showcase) result.publicShowcaseCalculated = entry.showcase;
  return Object.keys(result).length ? result : null;
}
