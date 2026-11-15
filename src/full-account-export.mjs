import { createHash } from 'node:crypto';
import { resolveCharacterName } from './ai-report.mjs';
import { createRelicIndex, enrichRelic } from './relic-stats.mjs';

export const FULL_ACCOUNT_SCHEMA = 1;
export const INVENTORY_CHUNK_SIZE = 1000;
const JSON_EOL = '\n';
const IDENTITY_KEYS = new Set([
  'uid', 'account_uid', 'accountid', 'account_id',
  'player_uid', 'player_id', 'user_id', 'nickname', 'username',
]);

// Inventory entries are preserved verbatim except account-identifying keys.
// In particular, equipment _uid is a local item identifier, NOT the player's UID.
export function withoutAccountIdentity(value) {
  if (Array.isArray(value)) return value.map(withoutAccountIdentity);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !IDENTITY_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, withoutAccountIdentity(item)]));
  }
  return value;
}

const arrayOrNull = value => Array.isArray(value) ? value : null;
const stringId = value => value == null ? null : String(value);
const itemKey = (prefix, i) => prefix + ':' + i;

function makeRoster(scanner, tables) {
  const characters = arrayOrNull(scanner.characters) ?? [];
  const roster = characters.map((owned, index) => {
    const ref = tables.characters?.[String(owned.id)];
    return {
      key: itemKey('character', index),
      id: String(owned.id),
      name: resolveCharacterName(owned, tables),
      game: ref ? {
        name: resolveCharacterName(owned, tables),
        path: ref.path ?? null,
        pathName: tables.paths?.[ref.path]?.name ?? null,
        element: ref.element ?? null,
        elementName: tables.elements?.[ref.element]?.name ?? null,
      } : null,
      raw: withoutAccountIdentity(owned),
      equippedLightConeKeys: [],
      equippedRelicKeys: [],
    };
  });
  const idToEntries = new Map();
  for (const record of roster) {
    const existing = idToEntries.get(record.id) ?? [];
    existing.push(record);
    idToEntries.set(record.id, existing);
  }
  return { roster, idToEntries };
}

function equippedTo(item, idToEntries) {
  const id = stringId(item.location);
  if (!id) return { characterId: null, status: 'unequipped' };
  const owned = idToEntries.get(id) ?? [];
  return { characterId: id, status: owned.length === 1
    ? 'owned' : owned.length ? 'ambiguous-character-id' : 'unknown-character-id' };
}

function exportCones(scanner, tables, idToEntries) {
  return (arrayOrNull(scanner.light_cones) ?? []).map((item, index) => {
    const key = itemKey('lightCone', index);
    const equipped = equippedTo(item, idToEntries);
    if (equipped.status === 'owned') idToEntries.get(equipped.characterId)[0].equippedLightConeKeys.push(key);
    const id = String(item.id);
    const definition = tables.light_cones?.[id];
    return {
      key, scanIndex: index, inventoryId: item._uid ?? null,
      id, name: definition?.name ?? item.name ?? null,
      path: definition?.path ?? null,
      equippedBy: equipped,
      raw: withoutAccountIdentity(item),
    };
  });
}

function exportRelics(scanner, tables, idToEntries) {
  const index = createRelicIndex(tables.relics);
  return (arrayOrNull(scanner.relics) ?? []).map((item, scanIndex) => {
    const key = itemKey('relic', scanIndex);
    const equipped = equippedTo(item, idToEntries);
    if (equipped.status === 'owned') idToEntries.get(equipped.characterId)[0].equippedRelicKeys.push(key);
    return {
      key, scanIndex, inventoryId: item._uid ?? null,
      setId: String(item.set_id),
      setName: tables.relic_sets?.[String(item.set_id)]?.name ?? null,
      equippedBy: equipped,
      ...enrichRelic(item, tables, index),
      raw: withoutAccountIdentity(item),
    };
  });
}

function duplicateIds(records) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of records) {
    if (item.inventoryId == null) continue;
    const id = String(item.inventoryId);
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

function safeReferenceData(scanner, tables) {
  const coneIds = new Set((scanner.light_cones ?? []).map(c => String(c.id)));
  const setIds = new Set((scanner.relics ?? []).map(r => String(r.set_id)));
  return {
    lightConeEffects: Object.fromEntries([...coneIds].map(id => {
      const def = tables.light_cones?.[id];
      const rank = tables.light_cone_ranks?.[id];
      return [id, def ? {
        name: def.name ?? null, path: def.path ?? null,
        effect: rank ? { name: rank.skill ?? null, description: rank.desc ?? null,
          paramsBySuperimposition: rank.params ?? null } : null,
      } : null];
    })),
    relicSetEffects: Object.fromEntries([...setIds].map(id => {
      const ref = tables.relic_sets?.[id];
      return [id, ref ? { name: ref.name ?? null, descriptions: ref.desc ?? null } : null];
    })),
  };
}

export function buildFullAccountReport(scanner, tables, manifest, extra = {}) {
  if (!scanner || !['HSR-Scanner', 'reliquary_archiver'].includes(scanner.source) ||
      scanner.version !== 4 || !Array.isArray(scanner.characters) ||
      !Array.isArray(scanner.light_cones) || !Array.isArray(scanner.relics)) {
    throw new Error('전체 계정 출력에는 캐릭터·광추·유물 3종을 모두 스캔한 v4 계정 파일이 필요합니다.');
  }
  const { roster, idToEntries } = makeRoster(scanner, tables);
  const cones = exportCones(scanner, tables, idToEntries);
  const relics = exportRelics(scanner, tables, idToEntries);
  const materials = arrayOrNull(scanner.materials);
  const charDuplicate = [...idToEntries.entries()]
    .filter(([, items]) => items.length > 1).map(([id]) => id);
  const unknownConeLocations = cones.filter(c => c.equippedBy.status !== 'owned' && c.equippedBy.status !== 'unequipped').map(c => c.key);
  const unknownRelicLocations = relics.filter(r => r.equippedBy.status !== 'owned' && r.equippedBy.status !== 'unequipped').map(r => r.key);
  const original = {
    characters: scanner.characters.length,
    lightCones: scanner.light_cones.length,
    relics: scanner.relics.length,
    materials: materials?.length ?? null,
  };
  const exported = { characters: roster.length, lightCones: cones.length, relics: relics.length,
    materials: materials?.length ?? null };
  const complete = original.characters === exported.characters &&
    original.lightCones === exported.lightCones && original.relics === exported.relics &&
    original.materials === exported.materials;
  if (!complete) throw new Error('스캔 수량과 전체 AI 자료 수량이 다릅니다.');

  const materialEntries = materials === null ? null : materials.map((item, scanIndex) => ({
    key: itemKey('material', scanIndex),
    raw: withoutAccountIdentity(item),
    koreanName: tables.items?.[String(item.id)]?.name ?? null,
  }));
  const characterStats = extra.characterStats?.characters ?? {};
  const existingIds = new Set(roster.map(c => c.id));
  const knownStats = Object.fromEntries(Object.entries(characterStats)
    .filter(([id]) => existingIds.has(String(id)))
    .map(([id, data]) => [id, withoutAccountIdentity(data)]));

  return {
    schemaVersion: FULL_ACCOUNT_SCHEMA,
    metadata: {
      gameVersion: manifest.version,
      gameSource: manifest.source,
      gameSyncedAt: manifest.syncedAt ?? null,
      language: manifest.language ?? null,
      scannerSource: scanner.source,
      scannerVersion: scanner.version,
      scannerBuild: scanner.build ?? null,
      importedAt: extra.importedAt ?? null,
      uidExcluded: true,
      itemKeys: 'stable-within-this-scan-by-source-array-index',
    },
    coverage: {
      charactersScanned: true, lightConesScanned: true, relicsScanned: true,
      materialsScanned: materials !== null,
      gachaScanned: scanner.gacha !== undefined,
      supplementalCharacterStats: Object.keys(knownStats).length,
      manuallyRecordedWarpPity: Object.keys(extra.manualWarpState?.pools ?? {}).length,
      missingCategories: [
        ...(materials === null ? ['materials'] : []),
        ...(scanner.gacha === undefined ? ['gacha'] : []),
      ],
      note: '수집되지 않음(null)은 보유 0개([])와 다릅니다. 스캐너 설정에 따라 일부 게임 내 항목이 수집되지 않았을 수 있습니다.',
    },
    counts: { original, exported, allScannedEntriesExported: complete },
    audit: {
      duplicatedCharacterIds: charDuplicate,
      duplicateLightConeInventoryIds: duplicateIds(cones),
      duplicateRelicInventoryIds: duplicateIds(relics),
      unknownLightConeLocationKeys: unknownConeLocations,
      unknownRelicLocationKeys: unknownRelicLocations,
      missingCharacterGameIds: roster.filter(c => !c.game).map(c => c.id),
      missingLightConeGameIds: [...new Set(cones.filter(c => !tables.light_cones?.[c.id]).map(c => c.id))],
      missingRelicSetIds: [...new Set(relics.filter(c => !tables.relic_sets?.[c.setId]).map(c => c.setId))],
      note: '중복 inventoryId도 별도 scanIndex와 key로 구분됩니다. unknown location은 미장착으로 처리하지 않습니다.',
    },
    characters: roster,
    lightCones: cones,
    relics,
    resources: {
      gacha: scanner.gacha === undefined ? null : withoutAccountIdentity(scanner.gacha),
      materials: materialEntries,
      manualWarpPity: withoutAccountIdentity(extra.manualWarpState?.pools ?? {}),
    },
    supplemental: {
      characterStats: knownStats,
      analysisPreferences: typeof extra.analysisPreferences === 'string' ? extra.analysisPreferences : '',
    },
    reference: safeReferenceData(scanner, tables),
    limitations: {
      noAutomatedRecommendation: true,
      noUnscannedCharactersAssumed: true,
      noFilteredRelics: true,
      noFilteredLightCones: true,
      finalSheetStatsAreOptional: true,
      gameRecommendationsAndUpcomingBanners: '외부 AI가 웹에서 버전·출처를 확인하여 조사할 정보이며 계정 스캔에 포함하지 않습니다.',
    },
  };
}

const jsonText = value => JSON.stringify(value, null, 2) + JSON_EOL;

export function buildFullAccountBundle(report, chunkSize = INVENTORY_CHUNK_SIZE) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error('분할 크기는 1 이상의 정수여야 합니다.');
  if (!report?.counts?.allScannedEntriesExported) throw new Error('완전한 계정 자료가 아닙니다.');
  const files = {};
  const sections = [];
  function put(name, payload, count = null) {
    const text = typeof payload === 'string' ? payload : jsonText(payload);
    files[name] = text;
    sections.push({
      file: name, records: count,
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: createHash('sha256').update(text).digest('hex'),
    });
  }
  put('01-account-summary.json', {
    schemaVersion: report.schemaVersion, metadata: report.metadata,
    coverage: report.coverage, counts: report.counts, audit: report.audit,
    characters: report.characters.map(({ key, id, name, game, raw,
      equippedLightConeKeys, equippedRelicKeys }) => ({
      key, id, name, game,
      level: raw.level ?? null, ascension: raw.ascension ?? null,
      eidolon: raw.eidolon ?? null,
      equippedLightConeKeys, equippedRelicKeys,
    })),
    limitations: report.limitations,
  }, report.characters.length);
  put('02-characters.json', { section: 'characters', records: report.characters }, report.characters.length);
  for (const [section, prefix] of [['lightCones', '03-light-cones'], ['relics', '04-relics']]) {
    const rows = report[section];
    const total = Math.max(1, Math.ceil(rows.length / chunkSize));
    for (let i = 0; i < total; i++) {
      const subset = rows.slice(i * chunkSize, (i + 1) * chunkSize);
      const filename = prefix + '-' + String(i + 1).padStart(3, '0') + '.json';
      put(filename, { section, startIndex: i * chunkSize, records: subset }, subset.length);
    }
  }
  put('05-resources.json', { section: 'resources', ...report.resources },
    report.resources.materials?.length ?? null);
  put('06-supplemental.json', {
    section: 'supplemental',
    ...report.supplemental,
  });
  put('07-game-reference.json', { section: 'reference', ...report.reference });
  const guide = [
    '# 붕괴: 스타레일 — 전체 계정 AI 전달 자료',
    '',
    '이 묶음은 사용자의 보유 캐릭터, 광추, 유물 전체를 포함합니다.',
    '공략·미래 가챠 정보·세팅 기준은 계정 자료에 포함되지 않으므로 외부 AI가 최신 웹 자료와 대조하세요.',
    '01-account-summary.json과 manifest.json부터 읽고, 장비 추천 시 해당 장비 상세 파일을 확인하세요.',
    '다른 캐릭터가 장착한 장비도 전체 후보이며 equippedBy를 확인한 후 재배치 가능성을 평가하세요.',
    '유물과 광추 파일의 records는 필터나 추천 순위 없이 스캐너 원본 순서이며, 모든 원본 아이템이 포함됩니다.',
    '각 item의 raw에는 스캐너가 제공한 수치를 보존합니다. 사용자 계정 UID·닉네임은 제외합니다.',
    'scanIndex와 key는 이번 스캔 내 유일한 참조입니다. 장비 _uid가 중복·누락되어도 레코드를 합치지 않습니다.',
    'manifest.json의 SHA-256과 항목 수를 활용해 파일 누락 또는 변경 여부를 확인할 수 있습니다.',
    '자료의 시점은 metadata.importedAt 및 metadata.gameSyncedAt을 확인하세요.',
    '미수집 데이터는 null/coverage.missingCategories로 표시하며, 보유하지 않는다는 뜻이 아닙니다.',
    '',
  ].join('\n');
  put('00-READ-ME.md', guide);
  const manifest = {
    schemaVersion: report.schemaVersion,
    metadata: report.metadata,
    counts: report.counts,
    coverage: report.coverage,
    files: sections,
    contents: '전달할 때 반드시 manifest와 해당 JSON 파일을 함께 제공하세요.',
  };
  files['manifest.json'] = jsonText(manifest);
  const perSection = { characters: 0, lightCones: 0, relics: 0 };
  for (const item of sections) {
    if (item.file === '02-characters.json') perSection.characters += item.records;
    if (item.file.startsWith('03-light-cones-')) perSection.lightCones += item.records;
    if (item.file.startsWith('04-relics-')) perSection.relics += item.records;
  }
  for (const key of Object.keys(perSection)) {
    if (perSection[key] !== report.counts.original[key]) {
      throw new Error('분할 파일의 ' + key + ' 수량이 원본 스캔과 일치하지 않습니다.');
    }
  }
  return { manifest, files };
}
