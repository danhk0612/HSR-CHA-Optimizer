import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateScannerData } from './scanner-data.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run import:scanner -- "C:\\path\\to\\HSRScanner.json"');
  process.exitCode = 1;
} else {
  const data = validateScannerData(JSON.parse(await readFile(resolve(input), 'utf8')));
  const directory = resolve('.local-data', 'account');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'scanner.json'), JSON.stringify(data, null, 2), 'utf8');
  const importedAt = new Date().toISOString();
  await writeFile(join(directory, 'import.json'), JSON.stringify({ importedAt, source: data.source, version: data.version }, null, 2), 'utf8');
  console.log('HSR-Scanner 자료를 로컬에 가져왔습니다.');
  console.log('캐릭터: ' + (data.characters?.length ?? '미수집'));
  console.log('광추: ' + (data.light_cones?.length ?? '미수집'));
  console.log('유물: ' + (data.relics?.length ?? '미수집'));
  console.log('저장 경로: ' + directory);
}
