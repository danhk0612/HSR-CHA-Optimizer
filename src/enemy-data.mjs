// Enemy source snapshot: release commit OSPRODWin4.7.0_D17180467_A17176203_L17175930.
// Preserves unsigned 64-bit name hashes as decimal strings to avoid JS Number truncation.
export const ENEMY_SOURCE = Object.freeze({
  repository: 'https://github.com/DimbreathBot/TurnBasedGameData',
  commit: 'dad9155eb00fdeda31fb8456507c53590d49071f',
  gameVersion: '4.7.0',
  files: [
    'ExcelOutput/MonsterTemplateConfig.json',
    'TextMap/TextMapMainKR.json',
    'TextMap/TextMapKR_0.json',
    'TextMap/TextMapKR_1.json',
  ],
});

// JSON.parse normally loses precision for 64-bit MonsterName.Hash integers.
// Convert only hash literals to JSON strings BEFORE parsing.
export function parseEnemyTemplates(raw) {
  const parsed = JSON.parse(raw.replace(/("Hash"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"'));
  if (!Array.isArray(parsed)) throw new Error('적 원본이 배열 형식이 아닙니다.');
  return parsed;
}

function baseNumber(row, key) {
  const n = row?.[key]?.Value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function extractHash(row) {
  const value = row?.MonsterName?.Hash;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return value;
}

export function buildEnemyIndex(templates, textMaps) {
  if (!Array.isArray(templates) || !templates.length) throw new Error('적 원본 테이블이 비어 있습니다.');
  if (!Array.isArray(textMaps) || !textMaps.length) throw new Error('한국어 이름 자료가 없습니다.');
  const lookup = new Map();
  let conflicts = 0;
  const wanted = new Set(templates.map(extractHash).filter(Boolean));
  for (const textMap of textMaps) {
    if (!textMap || typeof textMap !== 'object' || Array.isArray(textMap))
      throw new Error('한국어 TextMap 형식이 잘못됐습니다.');
    for (const hash of wanted) {
      const text = textMap[hash];
      if (typeof text !== 'string' || !text.trim()) continue;
      if (lookup.has(hash) && lookup.get(hash) !== text) {
        lookup.set(hash, null); conflicts++;
      } else if (!lookup.has(hash)) lookup.set(hash, text);
    }
  }
  const byId = new Map();
  const rows = templates.map(item => {
    const id = item.MonsterTemplateID;
    if (!Number.isSafeInteger(id) || id < 1 || byId.has(id))
      throw new Error('적 원본 ID가 누락되거나 중복됩니다.');
    byId.set(id, true);
    const nameHash = extractHash(item);
    const name = nameHash && lookup.get(nameHash) || null;
    return {
      id: String(id), name, nameHash, rank: item.Rank ?? null,
      attackBase: baseNumber(item, 'AttackBase'),
      defenceBase: baseNumber(item, 'DefenceBase'),
      hpBase: baseNumber(item, 'HPBase'),
      speedBase: baseNumber(item, 'SpeedBase'),
      stanceBase: baseNumber(item, 'StanceBase'),
      statusResistanceBase: baseNumber(item, 'StatusResistanceBase'),
      stanceType: item.StanceType ?? null,
      // StanceType is the source field, NOT necessarily a weakness element.
    };
  });
  const named = rows.filter(row => row.name !== null).length;
  return {
    source: ENEMY_SOURCE.repository,
    sourceCommit: ENEMY_SOURCE.commit,
    sourceGameVersion: ENEMY_SOURCE.gameVersion,
    language: 'kr',
    nameResolved: named,
    nameUnresolved: rows.length - named,
    conflictingNameHashes: conflicts,
    total: rows.length,
    statScope: '원본 MonsterTemplateConfig 기준값 (전투 레벨/모드 보정 미적용)',
    limitations: '원본 Rank/기본 능력치/ StanceType만 표시하며 약점, 저항 속성, 보스 스킬은 이 자료만으로 추정하지 않습니다.',
    enemies: rows,
  };
}

export function searchEnemyIndex(index, query = '', limit = 20) {
  if (!index || !Array.isArray(index.enemies)) throw new Error('적·보스 데이터를 먼저 준비하세요.');
  if (typeof query !== 'string') throw new Error('검색어는 문자열이어야 합니다.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200)
    throw new Error('최대 결과 개수는 1~200이어야 합니다.');
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle
    ? index.enemies.filter(row => row.id === needle ||
        (row.name ?? '').toLocaleLowerCase().includes(needle))
    : index.enemies;
  return {
    type: 'enemies', name: '적·보스 (원본 템플릿)',
    query: query.trim(), total: matches.length,
    included: Math.min(matches.length, limit), items: matches.slice(0, limit),
    sourceCommit: index.sourceCommit,
    nameResolved: index.nameResolved,
    nameUnresolved: index.nameUnresolved,
    statScope: index.statScope, limitations: index.limitations,
  };
}
