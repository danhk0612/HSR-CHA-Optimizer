import { access, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown, resolveCharacterName } from './ai-report.mjs';

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
    characters: [], lightCones: 0, relics: 0,
  };
  if (gameReady) {
    const current = JSON.parse(await readFile(join(base, 'game', 'current.json'), 'utf8'));
    empty.version = current.version ?? null;
  }
  if (!gameReady || !accountReady) return empty;
  const data = await loadAccountData(root);
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
  };
}

export async function exportDesktopReport(root, request) {
  const data = await loadAccountData(root);
  const report = buildAiReport(data.scanner, data.tables, data.manifest, {
    characterIds: request.characterIds,
    candidateMode: request.candidateMode ?? 'none',
    candidateSetIds: request.candidateSetIds ?? [],
    minRarity: request.minRarity ?? 0,
    includeResources: request.includeResources === true,
    importedAt: data.imported.importedAt,
  });
  return request.format === 'markdown'
    ? toAiMarkdown(report)
    : JSON.stringify(report, null, 2);
}
