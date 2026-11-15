import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const REQUIRED_TABLES = [
  'characters', 'character_ranks', 'character_skills',
  'character_skill_trees', 'light_cones', 'light_cone_ranks',
  'relic_sets', 'items', 'paths', 'elements',
];

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function loadAccountData(root = process.cwd()) {
  const gameRoot = resolve(root, '.local-data', 'game');
  const accountRoot = resolve(root, '.local-data', 'account');
  const current = await json(join(gameRoot, 'current.json'));
  const dir = join(gameRoot, current.version, current.language);
  const tables = Object.fromEntries(await Promise.all(REQUIRED_TABLES.map(async name => [
    name, await json(join(dir, `${name}.json`)),
  ])));
  return {
    tables,
    manifest: await json(join(dir, 'manifest.json')),
    scanner: await json(join(accountRoot, 'scanner.json')),
    imported: await json(join(accountRoot, 'import.json')),
  };
}
