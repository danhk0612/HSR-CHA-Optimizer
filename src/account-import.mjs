import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateScannerData } from './scanner-data.mjs';

export async function importAccountArchive(input, root = process.cwd()) {
  const data = validateScannerData(JSON.parse(await readFile(resolve(input), 'utf8')));
  const directory = resolve(root, '.local-data', 'account');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'scanner.json'), JSON.stringify(data, null, 2), 'utf8');
  const importedAt = new Date().toISOString();
  await writeFile(join(directory, 'import.json'),
    JSON.stringify({ importedAt, source: data.source, version: data.version }, null, 2), 'utf8');
  return {
    source: data.source,
    importedAt,
    characters: data.characters?.length ?? null,
    lightCones: data.light_cones?.length ?? null,
    relics: data.relics?.length ?? null,
    directory,
  };
}
