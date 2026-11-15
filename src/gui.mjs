import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown, resolveCharacterName } from './ai-report.mjs';
import { buildCandidateFilterOptions } from './relic-filters.mjs';
import { exportPublicData } from './public-data-files.mjs';
import { readLatestGameChangeReport } from './game-changes.mjs';
import { readCharacterStats } from './character-stats.mjs';
import { readWarpState } from './warp-state.mjs';
import { readAnalysisPreferences } from './analysis-preferences.mjs';
import { buildFullAccountReport } from './full-account-export.mjs';
import { buildInventoryCatalog, selectInventoryForExport, formatSelectedInventory } from './inventory-explorer.mjs';

// Local-only preview UI. No game process, remote server, or AI API access.
const data = await loadAccountData();
const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8');
const characterList = data.scanner.characters.map(item => ({
  id: String(item.id), name: resolveCharacterName(item, data.tables),
  level: item.level, eidolon: item.eidolon,
})).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

async function getReport() {
  const [characterStats, manualWarpState, analysis] = await Promise.all([
    readCharacterStats(process.cwd(), data.scanner),
    readWarpState(process.cwd(), data.scanner),
    readAnalysisPreferences(process.cwd(), data.scanner),
  ]);
  return buildFullAccountReport(data.scanner, data.tables, data.manifest, {
    importedAt: data.imported.importedAt,
    characterStats, manualWarpState, analysisPreferences: analysis.text,
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html); return;
  }
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      version: data.manifest.version, importedAt: data.imported.importedAt,
      gameChanges: await readLatestGameChangeReport(process.cwd()),
      characters: characterList, lightCones: data.scanner.light_cones?.length ?? 0,
      relics: data.scanner.relics?.length ?? 0,
      unequippedRelics: data.scanner.relics?.filter(item => !item.location).length ?? null,
      candidateFilterOptions: buildCandidateFilterOptions(data.scanner, data.tables),
    })); return;
  }
  if (req.method === 'GET' && req.url === '/api/inventory/catalog') {
    try {
      const catalog = buildInventoryCatalog(await getReport());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store' });
      res.end(JSON.stringify(catalog));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/inventory/export') {
    try {
      const chunks = [];
      let received = 0;
      for await (const chunk of req) {
        received += chunk.length;
        if (received > 524288) throw new Error('출력 요청 크기 제한을 초과했습니다.');
        chunks.push(chunk);
      }
      const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const selected = selectInventoryForExport(await getReport(), request);
      const result = formatSelectedInventory(selected, request.format);
      const type = request.format === 'html' ? 'text/html' : 'text/plain';
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(result.text);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/full-account') {
    try {
      const report = await getReport();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hsr-account-complete.json"',
        'Cache-Control': 'no-store' });
      res.end(JSON.stringify(report, null, 2) + '\n');
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/export') {
    try {
      const chunks = [];
      let received = 0;
      for await (const chunk of req) {
        received += chunk.length;
        if (received > 32768) throw new Error('요청 크기 제한을 초과했습니다.');
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const options = {
        characterIds: body.characterIds,
        candidateMode: body.candidateMode ?? 'none',
        candidateSetIds: body.candidateSetIds ?? [],
        minRarity: body.minRarity ?? 0,
        candidateLimit: body.candidateLimit,
        candidateFilters: body.candidateFilters,
        includeResources: body.includeResources === true,
        importedAt: data.imported.importedAt,
      };
      const report = buildAiReport(data.scanner, data.tables, data.manifest, options);
      const output = body.format === 'markdown' ? toAiMarkdown(report) : JSON.stringify(report, null, 2);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(output);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/public') {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32768) throw new Error('검색 요청이 너무 큽니다.');
        chunks.push(chunk);
      }
      const options = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const result = await exportPublicData(process.cwd(), options);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.message);
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});
server.listen(8765, '127.0.0.1', () => {
  console.log('HSR-CHA-Optimizer GUI: http://127.0.0.1:8765');
  console.log('종료: Ctrl+C');
});
