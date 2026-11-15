import assert from 'node:assert/strict';
import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown } from './ai-report.mjs';

// Read actual local files; never upload, modify, or print user UID.
const { tables, scanner, manifest, imported } = await loadAccountData();
assert.equal(manifest.language, 'kr', '한국어 게임 데이터가 필요합니다.');
assert.ok(scanner.characters?.length, '캐릭터 수집 목록이 비었습니다.');
assert.ok(scanner.relics?.length, '유물 수집 목록이 비었습니다.');
assert.ok(scanner.light_cones?.length, '광추 수집 목록이 비었습니다.');
const withGear = scanner.characters.find(item =>
  tables.characters?.[String(item.id)] && scanner.relics.some(relic => String(relic.location) === String(item.id))
);
const id = String((withGear ?? scanner.characters.find(item => tables.characters?.[String(item.id)]))?.id ?? '');
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
const actualRelics = report.characters[0].relics;
assert.ok(actualRelics.length > 0, '검증 대상 캐릭터에 장착된 유물이 없습니다.');
const derivedRelics = actualRelics.filter(relic => relic.mainstatDetail !== null);
assert.ok(derivedRelics.length > 0, '주옵션 원본 데이터 연결에 실패했습니다.');
assert.ok(derivedRelics.every(relic => Number.isFinite(relic.mainstatDetail.value)), '유물 주옵션 숫자가 유효하지 않습니다.');
assert.ok(Array.isArray(report.resources.materials));
assert.ok(toAiMarkdown(report).includes('AI 분석용 계정 자료'));
// Verify exact set/slot/main/substat filtering against the user's real local inventory.
const probe = (scanner.relics ?? []).find(item => !item.location && item.substats?.length);
assert.ok(probe, '필터 검증에 사용할 미장착 유물이 없습니다.');
const specific = buildAiReport(scanner, tables, manifest, {
  characterIds: [id], candidateMode: 'all', candidateLimit: 1,
  candidateFilters: {
    setIds: [String(probe.set_id)], slots: [String(probe.slot)],
    mainstats: [String(probe.mainstat)], substats: [String(probe.substats[0].key)],
  },
});
assert.ok(specific.candidates.matching >= 1, '실제 미장착 유물 필터 매칭에 실패했습니다.');
assert.equal(specific.candidates.included, 1);
assert.equal(String(specific.candidates.relics[0].setId), String(probe.set_id));
assert.equal(specific.candidates.relics[0].slot, probe.slot);
assert.equal(specific.candidates.relics[0].mainstat, probe.mainstat);
assert.ok(specific.candidates.relics[0].substats.some(item => item.key === probe.substats[0].key));
assert.ok(!specific.candidates.relics[0].equippedBy, '장착 유물이 필터 후보에 포함됐습니다.');
assert.ok(!JSON.stringify(specific).includes(String(scanner.metadata?.uid ?? 'never-match')), '필터 결과에 UID가 포함됐습니다.');
const matchingCharacters = scanner.characters.filter(item => tables.characters[String(item.id)]).length;
const matchingCones = (scanner.light_cones ?? []).filter(item => tables.light_cones[String(item.id)]).length;
const matchingRelics = (scanner.relics ?? []).filter(item => tables.relic_sets[String(item.set_id)]).length;
assert.equal(matchingCharacters, scanner.characters.length, '일부 캐릭터의 게임 원본 ID 매칭 실패');
assert.equal(matchingCones, scanner.light_cones.length, '일부 광추의 게임 원본 ID 매칭 실패');
assert.equal(matchingRelics, scanner.relics.length, '일부 유물의 게임 원본 세트 매칭 실패');
const materialMatches = scanner.materials?.filter(item => tables.items[String(item.id)]).length ?? 0;
console.log(`통합 검증 통과: 게임 ${manifest.version}, 캐릭터 ${matchingCharacters}/${scanner.characters.length}, 광추 ${matchingCones}/${scanner.light_cones.length}, 유물 ${matchingRelics}/${scanner.relics.length}, 한국어 재료 ${materialMatches}/${scanner.materials?.length ?? 0}`);
console.log(`AI용 실제 데이터 출력: 캐릭터 1명, 장착 유물 주옵션 ${derivedRelics.length}/${actualRelics.length}개 값 연결, 조건별 미장착 유물 필터 ${specific.candidates.matching}개 일치/1개 출력, UID 제외 확인`);
