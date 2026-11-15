import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAccountData } from './account-files.mjs';
import { readCharacterStats } from './character-stats.mjs';
import { readWarpState } from './warp-state.mjs';
import { readAnalysisPreferences, saveAnalysisPreferences } from './analysis-preferences.mjs';
import { buildFullAccountReport } from './full-account-export.mjs';
import { buildInventoryCatalog, selectInventoryForExport, formatSelectedInventory } from './inventory-explorer.mjs';

// Local-only browser view: no server outside 127.0.0.1 and no AI API calls.
const data = await loadAccountData();
const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8');

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

async function receiveJson(request, maximum = 524288) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) throw new Error('요청 크기 제한을 초과했습니다.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }
  try {
    if (req.method === 'GET' && req.url === '/api/state') {
      const prefs = await readAnalysisPreferences(process.cwd(), data.scanner);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        ready: true, version: data.manifest.version,
        importedAt: data.imported.importedAt,
        analysisPreferences: prefs,
      }));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/inventory/catalog') {
      const catalog = buildInventoryCatalog(await getReport());
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(catalog));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/inventory/export') {
      const options = await receiveJson(req);
      const result = formatSelectedInventory(
        selectInventoryForExport(await getReport(), options), options.format);
      res.writeHead(200, {
        'Content-Type': (options.format === 'html' ? 'text/html' : 'text/plain') + '; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(result.text);
      return;
    }
    if (req.method === 'POST' && req.url === '/api/preferences') {
      const body = await receiveJson(req, 8192);
      const prefs = await saveAnalysisPreferences(process.cwd(), data.scanner, body.text);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(prefs));
      return;
    }
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(error.message);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(8765, '127.0.0.1', () => {
  console.log('HSR-CHA-Optimizer GUI: http://127.0.0.1:8765');
  console.log('종료: Ctrl+C');
});
