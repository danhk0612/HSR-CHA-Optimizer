import { syncGameData } from './sync-core.mjs';

const result = await syncGameData(process.cwd(), ({ done, total, filename, count }) => {
  console.log(`[${done}/${total}] ${filename} (${count})`);
});
console.log(`Saved StarRailRes ${result.version} -> ${result.target}`);
