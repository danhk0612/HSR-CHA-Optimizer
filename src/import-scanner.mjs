import { importAccountArchive } from './account-import.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run import:archive -- "C:\\path\\to\\archive_output.json"');
  process.exitCode = 1;
} else {
  const result = await importAccountArchive(input);
  console.log(result.source + ' 자료를 로컬에 가져왔습니다.');
  console.log('캐릭터: ' + (result.characters ?? '미수집'));
  console.log('광추: ' + (result.lightCones ?? '미수집'));
  console.log('유물: ' + (result.relics ?? '미수집'));
  console.log('저장 경로: ' + result.directory);
}
