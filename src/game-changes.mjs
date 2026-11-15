import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const SAMPLE_LIMIT = 5;

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k =>
      JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sample(values) { return values.slice(0, SAMPLE_LIMIT); }

export function compareGameTables(before, after, filename) {
  const previous = before && typeof before === 'object' && !Array.isArray(before) ? before : null;
  const next = after && typeof after === 'object' && !Array.isArray(after) ? after : null;
  if (!next) throw new Error('잘못된 게임 데이터 테이블: ' + filename);
  const newIds = Object.keys(next);
  if (!previous) {
    return {
      filename, status: 'new-table',
      previousCount: null, currentCount: newIds.length,
      added: newIds.length, removed: 0, modified: 0,
      sampleIds: { added: sample(newIds), removed: [], modified: [] },
    };
  }
  const oldIds = Object.keys(previous);
  const oldKeys = new Set(oldIds);
  const newKeys = new Set(newIds);
  const added = newIds.filter(id => !oldKeys.has(id));
  const removed = oldIds.filter(id => !newKeys.has(id));
  const modified = newIds.filter(id => oldKeys.has(id) && stable(previous[id]) !== stable(next[id]));
  return {
    filename, status: added.length || removed.length || modified.length ? 'changed' : 'unchanged',
    previousCount: oldIds.length, currentCount: newIds.length,
    added: added.length, removed: removed.length, modified: modified.length,
    sampleIds: { added: sample(added), removed: sample(removed), modified: sample(modified) },
  };
}

export function buildGameChangeReport(previous, next, tables, syncedAt = new Date().toISOString()) {
  const baseline = !previous;
  const all = tables.map(({ filename, before, after }) =>
    baseline
      ? { filename, status: 'baseline', previousCount: null,
          currentCount: Object.keys(after).length,
          added: 0, removed: 0, modified: 0,
          sampleIds: { added: [], removed: [], modified: [] } }
      : compareGameTables(before, after, filename));
  const totals = all.reduce((out, item) => {
    out.added += item.added;
    out.removed += item.removed;
    out.modified += item.modified;
    if (item.status === 'changed' || item.status === 'new-table') out.changedTables++;
    return out;
  }, { added: 0, removed: 0, modified: 0, changedTables: 0 });
  return {
    schemaVersion: 1,
    status: baseline ? 'initial' : totals.changedTables ? 'changed' : 'unchanged',
    previous: previous ? { version: previous.version, language: previous.language } : null,
    current: { version: next.version, language: next.language },
    syncedAt, totals, tables: all,
  };
}

async function tryJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function readPreviousGameSnapshot(store) {
  const current = await tryJson(join(store, 'current.json'));
  if (!current || typeof current.version !== 'string' || typeof current.language !== 'string') return null;
  return { version: current.version, language: current.language };
}

export async function compareGameSnapshots(store, previous, next, filenames, staging, syncedAt) {
  const tables = [];
  for (const filename of filenames) {
    const after = JSON.parse(await readFile(join(staging, filename), 'utf8'));
    const before = previous
      ? await tryJson(join(store, previous.version, previous.language, filename))
      : null;
    tables.push({ filename, before, after });
  }
  return buildGameChangeReport(previous, next, tables, syncedAt);
}

export async function saveGameChangeReport(store, report) {
  const directory = resolve(store, 'changes');
  await mkdir(directory, { recursive: true });
  const filename = report.syncedAt.replace(/[^\dA-Za-z]/g, '-') + '.json';
  await writeFile(join(directory, filename), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(join(directory, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
}

export async function readLatestGameChangeReport(root = process.cwd()) {
  return tryJson(resolve(root, '.local-data', 'game', 'changes', 'latest.json'));
}
