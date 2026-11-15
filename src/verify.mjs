import assert from 'node:assert/strict';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown } from './ai-report.mjs';

// Read actual local files; never upload, modify, or print user UID.
const { tables, scanner, manifest, imported } = await loadAccountData();
assert.equal(manifest.language, 'kr', '한국어 게임 데이터가 필요합니다.');
assert.ok(scanner.characters?.length, '캐릭터 수집 목록이 비었습니다.');
assert.ok(scanner.relics?.length, '유물 수집 목록이 비었습니다.');
assert.ok(scanner.light_cones?.length, '광추 수집 목록이 비었습니다.');
const id = String(scanner.characters.find(item => tables.characters?.[String(item.id)])?.id ?? '');
assert.ok(id, '원본 데이터와 연결할 수 있는 캐릭터가 없습니다.');
const report = buildAiReport(scanner, tables, manifest, {
  characterIds: [id], candidateMode: 'equipped-sets', minRarity: 5,
  includeResources: true, importedAt: imported.importedAt,
});
const encoded = JSON.stringify(report);
assert.ok(!encoded.includes(String(scanner.metadata?.uid ?? 'never-match')), '내보내기에 UID가 포함됐습니다.');
assert.equal(report.characters.length, 1);
assert.equal(report.characters[0].gameDataAvailable, true);
assert.ok(report.characters[0].name);
assert.ok(Array.isArray(report.resources.materials));
assert.ok(toAiMarkdown(report).includes('AI 분석용 계정 자료'));
const matchingCharacters = scanner.characters.filter(item => tables.characters[String(item.id)]).length;
const materialMatches = scanner.materials?.filter(item => tables.items[String(item.id)]).length ?? 0;
console.log(`통합 검증 통과: 게임 ${manifest.version}, 캐릭터 ${matchingCharacters}/${scanner.characters.length}, 광추 ${scanner.light_cones.length}, 유물 ${scanner.relics.length}, 한국어 재료 ${materialMatches}/${scanner.materials?.length ?? 0}`);
console.log(`AI용 실제 데이터 출력: 캐릭터 1명, 미장착 후보 ${report.candidates?.included ?? 0}개, UID 제외 확인`);
