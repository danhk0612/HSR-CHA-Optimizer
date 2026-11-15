import { loadAccountData } from './account-files.mjs';
import { buildAiReport, toAiMarkdown } from './ai-report.mjs';
import { findEntry } from './equipment-report.mjs';

const args = process.argv.slice(2);
const options = { characterQueries: [], candidateQueries: [], candidateMode: 'none', includeResources: false };
let jsonOutput = false;
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (['--character', '--candidates', '--candidate-set', '--min-rarity', '--limit'].includes(flag)) {
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} 옵션의 값이 없습니다.`);
    if (flag === '--character') options.characterQueries.push(value);
    else if (flag === '--candidates') options.candidateMode = value;
    else if (flag === '--candidate-set') options.candidateQueries.push(value);
    else if (flag === '--min-rarity') options.minRarity = Number(value);
    else if (flag === '--limit') options.candidateLimit = Number(value);
  } else if (flag === '--resources') options.includeResources = true;
  else if (flag === '--json') jsonOutput = true;
  else throw new Error('지원하지 않는 옵션: ' + flag);
}
if (!options.characterQueries.length) throw new Error('--character "캐릭터 이름 또는 ID" 옵션을 입력하세요.');
if (options.candidateQueries.length && options.candidateMode === 'none') {
  options.candidateMode = 'equipped-sets';
}
if (options.minRarity !== undefined && (!Number.isInteger(options.minRarity) || options.minRarity < 1 || options.minRarity > 5)) {
  throw new Error('--min-rarity는 1~5 사이의 정수여야 합니다.');
}
const data = await loadAccountData();
const characterIds = options.characterQueries.map(query => {
  const match = data.scanner.characters.find(item => String(item.id) === query);
  return match ? String(match.id) : findEntry(data.tables.characters, query, '캐릭터').id;
});
const candidateSetIds = options.candidateQueries.map(query =>
  findEntry(data.tables.relic_sets, query, '유물 세트').id
);
const report = buildAiReport(data.scanner, data.tables, data.manifest, {
  ...options, characterIds, candidateSetIds, importedAt: data.imported.importedAt,
});
process.stdout.write(jsonOutput ? JSON.stringify(report, null, 2) + '\n' : toAiMarkdown(report));
