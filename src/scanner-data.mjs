import { buildCharacterReport } from './build-character-report.mjs';
import { buildLightConeReport, buildRelicSetReport } from './equipment-report.mjs';

// HSR-Scanner README currently documents export version 4.
export function validateScannerData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || data.source !== 'HSR-Scanner' || data.version !== 4) {
    throw new Error('HSR-Scanner JSON version 4 형식이 아닙니다.');
  }
  const keys = ['characters', 'light_cones', 'relics'];
  if (!keys.some((key) => Array.isArray(data[key]))) {
    throw new Error('스캔한 캐릭터, 광추 또는 유물 목록이 없습니다.');
  }
  for (const key of keys) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      throw new Error(key + ' 항목은 배열이어야 합니다.');
    }
  }
  return data;
}

export function buildAccountReport(scanner, tables, manifest, options = {}) {
  validateScannerData(scanner);
  const selectedIds = options.characterIds?.map(String) ?? [];
  const characters = scanner.characters ?? [];
  const lightCones = scanner.light_cones ?? [];
  const relics = scanner.relics ?? [];
  const wanted = selectedIds.length
    ? characters.filter((item) => selectedIds.includes(String(item.id)))
    : characters;

  if (selectedIds.length && new Set(wanted.map((item) => String(item.id))).size !== new Set(selectedIds).size) {
    throw new Error('선택한 캐릭터 중 스캐너 목록에서 찾을 수 없는 ID가 있습니다.');
  }

  const locations = new Set(wanted.map((item) => String(item.id)));
  const selectedLightCones = selectedIds.length
    ? lightCones.filter((item) => locations.has(String(item.location)))
    : lightCones;
  const selectedRelics = selectedIds.length
    ? relics.filter((item) => locations.has(String(item.location)))
    : relics;

  const ownedCharacters = wanted.map((owned) => {
    const reference = tables.characters?.[String(owned.id)] ?? null;
    return {
      owned, // Includes skills, traces, eidolon, affinitive_eidolons, memosprite, elation if scanned.
      game: reference ? buildCharacterReport(reference, tables, null) : null,
    };
  });
  const ownedLightCones = selectedLightCones.map((owned) => ({
    owned,
    game: tables.light_cones?.[String(owned.id)] ?? null,
  }));
  const ownedRelics = selectedRelics.map((owned) => ({
    owned, // Keep exact scanned mainstat, substats, preview_substats, location, etc.
    gameSet: tables.relic_sets?.[String(owned.set_id)] ?? null,
  }));

  const uniqueLightConeIds = [...new Set(selectedLightCones.map((item) => String(item.id)))];
  const uniqueRelicSetIds = [...new Set(selectedRelics.map((item) => String(item.set_id)))];
  const reference = {
    lightCones: Object.fromEntries(uniqueLightConeIds
      .filter((id) => tables.light_cones?.[id])
      .map((id) => [id, buildLightConeReport(tables.light_cones[id], tables)])),
    relicSets: Object.fromEntries(uniqueRelicSetIds
      .filter((id) => tables.relic_sets?.[id])
      .map((id) => [id, buildRelicSetReport(tables.relic_sets[id], tables)])),
  };

  return {
    metadata: {
      gameSource: manifest.source,
      gameVersion: manifest.version,
      gameSyncedAt: manifest.syncedAt,
      accountSource: 'HSR-Scanner',
      accountFormatVersion: scanner.version,
      scannerBuild: scanner.build ?? null,
      importedAt: options.importedAt ?? null,
      uidExcluded: true,
    },
    coverage: {
      charactersScanned: Array.isArray(scanner.characters),
      lightConesScanned: Array.isArray(scanner.light_cones),
      relicsScanned: Array.isArray(scanner.relics),
      personalSheetStats: false,
      resourcesAndWarpPity: false,
      note: '스캐너 설정의 제외 조건·인식 오류에 따라 결과가 전체 보유량보다 적을 수 있습니다.',
    },
    characters: ownedCharacters,
    lightCones: ownedLightCones,
    relics: ownedRelics,
    reference,
    unmatchedGameIds: {
      characters: ownedCharacters.filter((entry) => !entry.game).map((entry) => String(entry.owned.id)),
      lightCones: uniqueLightConeIds.filter((id) => !tables.light_cones?.[id]),
      relicSets: uniqueRelicSetIds.filter((id) => !tables.relic_sets?.[id]),
    },
  };
}
