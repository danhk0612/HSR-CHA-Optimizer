import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown, resolveCharacterName } from './ai-report.mjs';
import { buildCandidateFilterOptions } from './relic-filters.mjs';

// Local-only preview UI. No game process, remote server, or AI API access.
const data = await loadAccountData();
const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8');
const characterList = data.scanner.characters.map(item => ({
  id: String(item.id), name: resolveCharacterName(item, data.tables),
  level: item.level, eidolon: item.eidolon,
})).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html); return;
  }
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      version: data.manifest.version, importedAt: data.imported.importedAt,
      characters: characterList, lightCones: data.scanner.light_cones?.length ?? 0,
      relics: data.scanner.relics?.length ?? 0,
      unequippedRelics: data.scanner.relics?.filter(item => !item.location).length ?? null,
      candidateFilterOptions: buildCandidateFilterOptions(data.scanner, data.tables),
    })); return;
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
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});
server.listen(8765, '127.0.0.1', () => {
  console.log('HSR-CHA-Optimizer GUI: http://127.0.0.1:8765');
  console.log('종료: Ctrl+C');
});
