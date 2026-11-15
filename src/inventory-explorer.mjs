// One searchable view of the data already collected by the scanner.
// No gender inference, recommendation engine, or additional game-data collection.
export const INVENTORY_GROUPS = Object.freeze({
  characters: '캐릭터',
  lightCones: '광추',
  relics: '유물',
  ornaments: '차원 장신구',
  materials: '재료·티켓',
});
const ORNAMENT_SLOTS = new Set(['Planar Sphere', 'Link Rope']);
const finite = n => typeof n === 'number' && Number.isFinite(n) ? n : null;
const value = v => v == null ? '' : String(v);

export function buildInventoryCatalog(report) {
  if (!report || !Array.isArray(report.characters) ||
      !Array.isArray(report.lightCones) || !Array.isArray(report.relics))
    throw new Error('전체 계정 자료가 필요합니다.');
  const owners = new Map(report.characters.map(c => [String(c.id), c.name]));
  const rows = [];
  for (const c of report.characters) {
    rows.push({
      key: c.key, group: 'characters', id: String(c.id), name: c.name,
      rarity: finite(c.game?.rarity), level: finite(c.raw.level),
      ascension: finite(c.raw.ascension), eidolon: finite(c.raw.eidolon),
      element: c.game?.element ?? null, elementName: c.game?.elementName ?? null,
      path: c.game?.path ?? null, pathName: c.game?.pathName ?? null,
      equipped: c.equippedLightConeKeys?.length || c.equippedRelicKeys?.length
        ? 'owned' : 'unequipped',
      lightConeCount: c.equippedLightConeKeys?.length ?? 0,
      relicCount: c.equippedRelicKeys?.length ?? 0,
    });
  }
  for (const cone of report.lightCones) {
    rows.push({
      key: cone.key, group: 'lightCones', id: String(cone.id), name: cone.name,
      rarity: finite(cone.rarity), level: finite(cone.raw.level),
      ascension: finite(cone.raw.ascension),
      superimposition: finite(cone.raw.superimposition),
      path: cone.path ?? null, pathName: cone.pathName ?? null,
      locked: typeof cone.raw.lock === 'boolean' ? cone.raw.lock : null,
      equipped: cone.equippedBy.status,
      equippedCharacterId: cone.equippedBy.characterId,
      equippedName: owners.get(String(cone.equippedBy.characterId)) ?? null,
    });
  }
  for (const relic of report.relics) {
    const raw = relic.raw;
    rows.push({
      key: relic.key, group: ORNAMENT_SLOTS.has(raw.slot) ? 'ornaments' : 'relics',
      id: String(relic.setId), name: raw.name ?? relic.setName ?? String(relic.setId),
      rarity: finite(raw.rarity), level: finite(raw.level),
      setId: relic.setId, setName: relic.setName,
      slot: raw.slot ?? null, mainstat: raw.mainstat ?? null,
      mainstatName: relic.mainstatDetail?.name ?? raw.mainstat ?? null,
      mainstatValue: finite(relic.mainstatDetail?.value),
      mainstatUnit: relic.mainstatDetail?.unit ?? null,
      substats: (raw.substats ?? []).map((s, i) => ({
        key: value(s.key), name: relic.substats?.[i]?.name ?? value(s.key),
        value: finite(s.value), displayValue: finite(relic.substats?.[i]?.displayValue),
        unit: relic.substats?.[i]?.unit ?? null, count: finite(s.count),
      })),
      previewSubstats: (raw.preview_substats ?? []).map(s => ({
        key: value(s.key), value: finite(s.value), count: finite(s.count),
      })),
      locked: typeof raw.lock === 'boolean' ? raw.lock : null,
      discard: typeof raw.discard === 'boolean' ? raw.discard : null,
      equipped: relic.equippedBy.status,
      equippedCharacterId: relic.equippedBy.characterId,
      equippedName: owners.get(String(relic.equippedBy.characterId)) ?? null,
    });
  }
  for (const material of report.resources.materials ?? []) {
    rows.push({
      key: material.key, group: 'materials', id: value(material.raw.id),
      name: material.koreanName ?? material.raw.name ?? String(material.raw.id),
      count: finite(material.raw.count), rarity: null,
    });
  }
  return { schemaVersion: 1, metadata: report.metadata,
    groups: INVENTORY_GROUPS,
    counts: Object.fromEntries(Object.keys(INVENTORY_GROUPS).map(
      group => [group, rows.filter(r => r.group === group).length])),
    rows };
}

function matchesStat(item, filter) {
  const options = item.substats ?? [];
  const wanted = filter.substats ?? [];
  if (wanted.length && !wanted.every(key => options.some(stat => stat.key === key))) return false;
  if (filter.statKey) {
    const match = options.find(s => s.key === filter.statKey);
    if (!match) return false;
    if (filter.minStatValue != null && (match.value == null || match.value < filter.minStatValue)) return false;
    if (filter.minStatCount != null && (match.count == null || match.count < filter.minStatCount)) return false;
  }
  return true;
}
const numberAtLeast = (v, minimum) => minimum == null || (v != null && v >= minimum);
const numberAtMost = (v, maximum) => maximum == null || (v != null && v <= maximum);

export function filterInventoryCatalog(rows, filter = {}) {
  const category = filter.group ?? 'all';
  const q = (filter.query ?? '').trim().toLocaleLowerCase('ko');
  const set = (name, key) => !filter[name]?.length || filter[name].includes(key);
  const selected = rows.filter(item =>
    (category === 'all' || item.group === category) &&
    (!q || [item.name, item.id, item.setName, item.equippedName]
      .some(s => value(s).toLocaleLowerCase('ko').includes(q))) &&
    set('rarities', item.rarity) &&
    set('elements', item.element) &&
    set('paths', item.path) &&
    set('sets', item.setId) &&
    set('slots', item.slot) &&
    set('mainstats', item.mainstat) &&
    numberAtLeast(item.level, filter.minLevel) &&
    numberAtMost(item.level, filter.maxLevel) &&
    numberAtLeast(item.eidolon, filter.minEidolon) &&
    numberAtLeast(item.superimposition, filter.minSuperimposition) &&
    numberAtLeast(item.count, filter.minCount) &&
    (filter.equipped == null || filter.equipped === 'all' || item.equipped === filter.equipped) &&
    (filter.locked == null || filter.locked === 'all' || item.locked === filter.locked) &&
    (filter.discard == null || filter.discard === 'all' || item.discard === filter.discard) &&
    matchesStat(item, filter));
  const sort = filter.sortBy ?? 'name';
  const order = filter.descending ? -1 : 1;
  const textFields = new Set(['name', 'setName', 'slot', 'mainstat', 'equipped', 'pathName']);
  const numberFields = new Set(['rarity', 'level', 'eidolon', 'superimposition', 'count', 'mainstatValue']);
  if (textFields.has(sort) || numberFields.has(sort)) {
    selected.sort((a, b) => {
      const av = a[sort], bv = b[sort];
      if (av == null && bv != null) return 1;
      if (bv == null && av != null) return -1;
      if (av == null && bv == null) return a.key.localeCompare(b.key);
      const diff = numberFields.has(sort) ? av - bv : String(av).localeCompare(String(bv), 'ko');
      return diff * order || a.key.localeCompare(b.key);
    });
  }
  return selected;
}

const normalizeSelections = keys => {
  if (!Array.isArray(keys)) throw new Error('출력 대상 키 목록이 필요합니다.');
  if (keys.length > 20000 || keys.some(k => typeof k !== 'string')) throw new Error('출력 대상 키 목록이 잘못됐습니다.');
  return new Set(keys);
};

export function selectInventoryForExport(report, request) {
  const catalog = buildInventoryCatalog(report);
  const selected = normalizeSelections(request?.keys);
  const available = new Set(catalog.rows.map(x => x.key));
  const unknown = [...selected].filter(k => !available.has(k));
  if (unknown.length) throw new Error('현재 계정에 없는 항목 키가 있습니다: ' + unknown[0]);
  if (!selected.size) throw new Error('출력할 항목을 한 개 이상 선택하세요.');
  const sortBy = request.sortBy ?? 'name';
  const descending = request.descending === true;
  const sorted = filterInventoryCatalog(catalog.rows, { sortBy, descending });
  let exportOrder = sorted;
  if (request.orderKeys !== undefined) {
    if (!Array.isArray(request.orderKeys) || request.orderKeys.length !== selected.size ||
        request.orderKeys.some(key => typeof key !== 'string') ||
        new Set(request.orderKeys).size !== selected.size ||
        request.orderKeys.some(key => !selected.has(key))) {
      throw new Error('종류별 정렬 순서와 선택 목록이 일치하지 않습니다.');
    }
    const index = new Map(catalog.rows.map(row => [row.key, row]));
    exportOrder = request.orderKeys.map(key => index.get(key));
  }
  const order = new Map(exportOrder.map((row, i) => [row.key, i]));
  const choose = items => items.filter(x => selected.has(x.key))
    .sort((a, b) => order.get(a.key) - order.get(b.key));
  const selectedRows = exportOrder.filter(row => selected.has(row.key));
  const selectedCharacters = choose(report.characters);
  const selectedCones = choose(report.lightCones);
  const selectedRelics = choose(report.relics);
  const selectedMaterials = choose(report.resources.materials ?? []);
  const selectedCharIds = new Set(selectedCharacters.map(c => String(c.id)));
  const selectedConeIds = new Set(selectedCones.map(c => String(c.id)));
  const selectedSetIds = new Set(selectedRelics.map(r => String(r.setId)));
  const ownerNames = Object.fromEntries(report.characters.map(c => [String(c.id), c.name]));
  const withOwner = x => ({
    ...x,
    equippedCharacterName: ownerNames[String(x.equippedBy?.characterId)] ?? null,
  });
  const resources = {};
  if (selectedMaterials.length && request.includeMaterials !== false) resources.materials = selectedMaterials;
  if (request.includeGacha === true) resources.gacha = report.resources.gacha;
  if (request.includeWarp === true) resources.manualWarpPity = report.resources.manualWarpPity;
  const supplemental = request.includeSupplemental === true ? {
    analysisPreferences: report.supplemental.analysisPreferences,
    characterStats: Object.fromEntries(Object.entries(report.supplemental.characterStats)
      .filter(([id]) => selectedCharIds.has(String(id)))),
  } : undefined;
  const reference = request.includeReference === true ? {
    lightConeEffects: Object.fromEntries(Object.entries(report.reference.lightConeEffects)
      .filter(([id]) => selectedConeIds.has(String(id)))),
    relicSetEffects: Object.fromEntries(Object.entries(report.reference.relicSetEffects)
      .filter(([id]) => selectedSetIds.has(String(id)))),
  } : undefined;
  const counts = Object.fromEntries(Object.keys(INVENTORY_GROUPS).map(g =>
    [g, selectedRows.filter(row => row.group === g).length]));
  return {
    schemaVersion: 1, metadata: report.metadata,
    selection: {
      mode: 'explicit-keys', counts,
      sortBy: request.orderKeys ? 'per-category' : sortBy, descending: request.orderKeys ? null : descending,
      availableCounts: catalog.counts,
      note: '선택 출력입니다. 미선택 항목은 미보유를 의미하지 않습니다. 장착 관계는 원래 계정 전체를 기준으로 표시합니다.',
    },
    characters: selectedCharacters,
    lightCones: selectedCones.map(withOwner),
    relics: selectedRelics.map(withOwner),
    ... (Object.keys(resources).length ? { resources } : {}),
    ... (supplemental ? { supplemental } : {}),
    ... (reference ? { reference } : {}),
  };
}

const escapeHtml = v => value(v).replace(/[&<>"']/g,
  ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const printable = v => v == null ? '-' : String(v);
const statText = item => (item.substats?.length ? item.substats : (item.raw?.substats ?? []))
  .map(s => (s.name ?? s.key) + ' ' +
    (s.displayValue ?? s.value ?? '?') + (s.unit === '%' ? '%' : '') +
    (s.count == null ? '' : ' (' + s.count + '회)')).join(', ');

function humanRows(report) {
  const list = [];
  for (const c of report.characters) list.push({
    group: 'characters', name: c.name, rarity: c.game?.rarity,
    level: c.raw.level, detail: '성혼 ' + (c.raw.eidolon ?? '?') +
      ' / ' + (c.game?.pathName ?? c.game?.path ?? '-') +
      ' / ' + (c.game?.elementName ?? c.game?.element ?? '-') +
      ' / 스킬 ' + JSON.stringify(c.raw.skills ?? {}) +
      ' / 장착 광추 ' + (c.equippedLightConeKeys?.length ?? 0) +
      '개·유물 ' + (c.equippedRelicKeys?.length ?? 0) + '개',
  });
  for (const c of report.lightCones) list.push({
    group: 'lightCones', name: c.name, rarity: c.rarity, level: c.raw.level,
    detail: '중첩 ' + (c.raw.superimposition ?? '?') +
      ' / 장착 ' + (c.equippedCharacterName ?? '없음') +
      ' / 잠금 ' + (c.raw.lock === true ? '예' : '아니오') +
      ' / ' + (c.pathName ?? c.path ?? '-'),
  });
  for (const r of report.relics) list.push({
    group: ORNAMENT_SLOTS.has(r.raw.slot) ? 'ornaments' : 'relics',
    name: r.setName ?? r.raw.name ?? r.setId, rarity: r.raw.rarity, level: r.raw.level,
    detail: '부위 ' + r.raw.slot + ' / 주옵션 ' +
      (r.mainstatDetail?.name ?? r.raw.mainstat) +
      (r.mainstatDetail?.value == null ? '' :
        ' ' + r.mainstatDetail.value + (r.mainstatDetail.unit === '%' ? '%' : '')) +
      ' / 부옵션 ' + statText(r) +
      ' / 장착 ' + (r.equippedCharacterName ?? '없음'),
  });
  for (const m of report.resources?.materials ?? []) list.push({
    group: 'materials', name: m.koreanName ?? m.raw.name ?? m.raw.id,
    rarity: null, level: null, detail: '수량 ' + (m.raw.count ?? '?'),
  });
  return list;
}

export function selectedInventoryToMarkdown(report) {
  const lines = [
    '# 붕괴: 스타레일 — 선택한 계정 자료',
    '',
    '게임 버전: ' + report.metadata.gameVersion,
    '출처: ' + report.metadata.scannerSource,
    '주의: 선택하지 않은 항목은 보유하지 않는다는 의미가 아닙니다.',
    '',
  ];
  const rows = humanRows(report);
  for (const [group, label] of Object.entries(INVENTORY_GROUPS)) {
    const groupRows = rows.filter(r => r.group === group);
    if (!groupRows.length) continue;
    lines.push('## ' + label + ' (' + groupRows.length + '개)', '',
      '| 이름 | 등급 | 레벨 | 상세 |', '| --- | --- | --- | --- |');
    for (const r of groupRows) {
      const cell = s => printable(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      lines.push('| ' + [r.name, r.rarity, r.level, r.detail].map(cell).join(' | ') + ' |');
    }
    lines.push('');
  }
  if (report.resources?.gacha !== undefined) lines.push('## 가챠 재화', '',
    '```json', JSON.stringify(report.resources.gacha, null, 2), '```', '');
  if (report.supplemental) lines.push('## 개인 분석 조건 및 보완 능력치', '',
    '```json', JSON.stringify(report.supplemental, null, 2), '```', '');
  lines.push('## 분석 및 재현을 위한 선택 원본 JSON', '',
    '```json', JSON.stringify(report, null, 2), '```', '');
  return lines.join('\n');
}

export function selectedInventoryToHtml(report) {
  const groups = humanRows(report);
  const sections = Object.entries(INVENTORY_GROUPS).map(([group, label]) => {
    const rows = groups.filter(x => x.group === group);
    if (!rows.length) return '';
    return '<section><h2>' + escapeHtml(label) + ' <small>(' + rows.length + '개)</small></h2>' +
      '<table><thead><tr><th>이름</th><th>등급</th><th>레벨</th><th>상세</th></tr></thead><tbody>' +
      rows.map(x => '<tr>' + [x.name, x.rarity, x.level, x.detail].map(v =>
        '<td>' + escapeHtml(printable(v)) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></section>';
  }).join('');
  const readableBlock = (title, payload) => payload == null || !Object.keys(payload).length ? '' :
    '<section><h2>' + escapeHtml(title) + '</h2><pre>' +
    escapeHtml(JSON.stringify(payload, null, 2)) + '</pre></section>';
  const more = [
    report.resources?.gacha === undefined ? '' : readableBlock('보유 가챠 재화', report.resources.gacha),
    readableBlock('수동 천장 기록', report.resources?.manualWarpPity),
    report.supplemental?.analysisPreferences
      ? '<section><h2>개인 분석 조건</h2><p>' +
        escapeHtml(report.supplemental.analysisPreferences) + '</p></section>' : '',
    readableBlock('선택 캐릭터의 보완 능력치', report.supplemental?.characterStats),
    readableBlock('선택 장비의 원본 효과', report.reference),
  ].join('');
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>붕괴: 스타레일 — 계정 자료</title><style>' +
    'body{font-family:system-ui,Malgun Gothic,sans-serif;color:#162238;max-width:1080px;margin:36px auto;padding:0 22px;line-height:1.55}' +
    'h1{font-size:26px}h2{font-size:18px;margin-top:32px}small,p{color:#546078}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px 11px;border-bottom:1px solid #d6dce5;vertical-align:top}' +
    'th{background:#eff3f9}tr{break-inside:avoid}section{break-inside:auto}' +
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f5fa;padding:14px;font-size:12px;border-radius:8px}' +
    '@media print{body{margin:0;padding:0}h2{break-after:avoid}}' +
    '</style></head><body><h1>붕괴: 스타레일 — 선택한 계정 자료</h1>' +
    '<p>게임 버전 ' + escapeHtml(report.metadata.gameVersion) +
    ' · 미선택 항목은 미보유를 의미하지 않습니다.</p>' +
    sections + more + '</body></html>';
}

export function formatSelectedInventory(report, format = 'json') {
  if (format === 'json') return { text: JSON.stringify(report, null, 2) + '\n', extension: 'json' };
  if (format === 'markdown') return { text: selectedInventoryToMarkdown(report), extension: 'md' };
  if (format === 'html') return { text: selectedInventoryToHtml(report), extension: 'html' };
  throw new Error('지원하지 않는 출력 형식입니다.');
}
