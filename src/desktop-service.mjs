import { access, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown, resolveCharacterName } from './ai-report.mjs';
import { buildCandidateFilterOptions } from './relic-filters.mjs';
import { exportPublicData } from './public-data-files.mjs';
import { readCharacterStats, getCharacterStatsSummary, MANUAL_STAT_FIELDS,
  saveManualCharacterStats, clearManualCharacterStats, importMihomoParsed } from './character-stats.mjs';

async function hasFile(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function getDesktopState(root) {
  const base = resolve(root, '.local-data');
  const gameReady = await hasFile(join(base, 'game', 'current.json'));
  const accountReady = await hasFile(join(base, 'account', 'scanner.json'));
  const empty = {
    ready: false, gameReady, accountReady,
    version: null, importedAt: null,
    characters: [], lightCones: 0, relics: 0, unequippedRelics: null,
    candidateFilterOptions: { sets: [], slots: [], mainstats: [], substats: [] },
    characterStatFields: MANUAL_STAT_FIELDS,
    characterStats: {},
    characterStatsSummary: { manual: 0, showcase: 0 },
  };
  if (gameReady) {
    const current = JSON.parse(await readFile(join(base, 'game', 'current.json'), 'utf8'));
    empty.version = current.version ?? null;
  }
  if (!gameReady || !accountReady) return empty;
  const data = await loadAccountData(root);
  const sheet = await readCharacterStats(root, data.scanner);
  return {
    ...empty,
    ready: true,
    version: data.manifest.version,
    importedAt: data.imported.importedAt,
    characters: (data.scanner.characters ?? []).map(owned => ({
      id: String(owned.id),
      name: resolveCharacterName(owned, data.tables),
      level: owned.level,
      eidolon: owned.eidolon,
    })).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    lightCones: data.scanner.light_cones?.length ?? 0,
    relics: data.scanner.relics?.length ?? 0,
    unequippedRelics: data.scanner.relics?.filter(item => !item.location).length ?? null,
    candidateFilterOptions: buildCandidateFilterOptions(data.scanner, data.tables),
    characterStats: sheet.characters,
    characterStatsSummary: getCharacterStatsSummary(sheet),
  };
}

export async function exportDesktopReport(root, request) {
  const data = await loadAccountData(root);
  const sheet = await readCharacterStats(root, data.scanner);
  const report = buildAiReport(data.scanner, data.tables, data.manifest, {
    characterIds: request.characterIds,
    candidateMode: request.candidateMode ?? 'none',
    candidateSetIds: request.candidateSetIds ?? [],
    minRarity: request.minRarity ?? 0,
    candidateLimit: request.candidateLimit,
    candidateFilters: request.candidateFilters,
    includeResources: request.includeResources === true,
    characterStats: sheet,
    importedAt: data.imported.importedAt,
  });
  return request.format === 'markdown'
    ? toAiMarkdown(report)
    : JSON.stringify(report, null, 2);
}

export async function saveManualSheet(root, id, values) {
  const { scanner } = await loadAccountData(root);
  return saveManualCharacterStats(root, scanner, id, values);
}

export async function clearManualSheet(root, id) {
  const { scanner } = await loadAccountData(root);
  return clearManualCharacterStats(root, scanner, id);
}

export async function importSavedShowcase(root, inputPath) {
  const { scanner } = await loadAccountData(root);
  const parsed = JSON.parse(await readFile(inputPath, 'utf8'));
  return importMihomoParsed(root, scanner, parsed);
}

export async function exportPublicInfo(root, request) {
  return exportPublicData(root, request);
}
