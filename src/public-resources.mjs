export const PUBLIC_TABLES = {
  blessings: { filename: 'simulated_blessings', label: '시뮬레이션 우주 축복' },
  curios: { filename: 'simulated_curios', label: '시뮬레이션 우주 기물' },
  events: { filename: 'simulated_events', label: '시뮬레이션 우주 사건' },
  blocks: { filename: 'simulated_blocks', label: '시뮬레이션 우주 구역' },
};

// Read-only lookup of StarRailRes public resources; never scores or recommends.
export function searchPublicData(table, type, query = '', limit = 20) {
  if (!PUBLIC_TABLES[type]) throw new Error('지원하지 않는 공개 자료 종류입니다.');
  if (!table || typeof table !== 'object' || Array.isArray(table))
    throw new Error('공개 자료가 준비되지 않았습니다. 게임 데이터를 다시 동기화하세요.');
  if (typeof query !== 'string') throw new Error('검색어는 문자열이어야 합니다.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200)
    throw new Error('최대 결과 개수는 1~200이어야 합니다.');
  const normalized = query.trim().toLocaleLowerCase();
  const all = Object.values(table).filter(item => item && typeof item === 'object' && !Array.isArray(item));
  const matches = normalized
    ? all.filter(item => String(item.id) === normalized ||
      String(item.name ?? '').toLocaleLowerCase().includes(normalized))
    : all;
  const items = matches.slice(0, limit).map(item => ({ ...item }));
  return { type, name: PUBLIC_TABLES[type].label, query: query.trim(),
    total: matches.length, included: items.length, items };
}

export function publicDataMarkdown(result, manifest) {
  return [
    '# 붕괴: 스타레일 — ' + result.name,
    '공개 게임 데이터: ' + manifest.source + ' / ' + manifest.version,
    '검색어: ' + (result.query || '(전체)'),
    '결과: ' + result.included + ' / ' + result.total,
    '## 원본 데이터',
    '```json\n' + JSON.stringify(result.items, null, 2) + '\n```',
  ].join('\n\n') + '\n';
}
