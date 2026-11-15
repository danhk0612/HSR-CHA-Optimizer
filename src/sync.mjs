import { syncGameData } from './sync-core.mjs';

const result = await syncGameData(process.cwd(), ({ done, total, filename, count }) => {
  console.log(`[${done}/${total}] ${filename} (${count})`);
});
console.log(`Saved StarRailRes ${result.version} -> ${result.target}`);
const changes = result.changes;
console.log(changes.status === 'initial'
  ? '변경 비교: 첫 스냅샷이므로 기준 데이터만 저장했습니다.'
  : `변경 비교: ${changes.previous.version} → ${changes.current.version}, ${changes.totals.changedTables}/${changes.tables.length}개 테이블, 추가 ${changes.totals.added}, 삭제 ${changes.totals.removed}, 변경 ${changes.totals.modified}`);
