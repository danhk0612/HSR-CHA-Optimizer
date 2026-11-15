import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildAccountReport } from './scanner-data.mjs';
import { findEntry } from './equipment-report.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const characterQueries = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') continue;
  if (args[i] === '--character') {
    const query = args[++i];
    if (!query || query.startsWith('--')) throw new Error('--character 뒤에 이름 또는 ID가 필요합니다.');
    characterQueries.push(query);
  } else {
    throw new Error('Unknown option: ' + args[i]);
  }
}

const gameRoot = resolve('.local-data', 'game');
const accountRoot = resolve('.local-data', 'account');
const current = JSON.parse(await readFile(join(gameRoot, 'current.json'), 'utf8'));
const gameBase = join(gameRoot, current.version, current.language);
const names = [
  'characters', 'character_ranks', 'character_skills',
  'character_skill_trees', 'character_promotions',
  'light_cones', 'light_cone_ranks', 'light_cone_promotions',
  'relics', 'relic_sets', 'relic_main_affixes', 'relic_sub_affixes',
  'paths', 'properties',
];
const tables = Object.fromEntries(await Promise.all(names.map(async (name) => [
  name, JSON.parse(await readFile(join(gameBase, name + '.json'), 'utf8')),
])));
const manifest = JSON.parse(await readFile(join(gameBase, 'manifest.json'), 'utf8'));
const scanner = JSON.parse(await readFile(join(accountRoot, 'scanner.json'), 'utf8'));
const imported = JSON.parse(await readFile(join(accountRoot, 'import.json'), 'utf8'));

const characterIds = characterQueries.map((query) => {
  const scanned = (scanner.characters ?? []).find((item) => String(item.id) === query);
  return scanned ? String(scanned.id) : findEntry(tables.characters, query, '캐릭터').id;
});
const report = buildAccountReport(scanner, tables, manifest, {
  characterIds,
  importedAt: imported.importedAt,
});

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const sections = [
    ['수집 범위', report.coverage],
    ['보유 캐릭터', report.characters],
    ['보유 광추', report.lightCones],
    ['보유 유물', report.relics],
    ['성옥·오래된 꿈(수집된 경우)', report.gacha],
    ['육성 재료 보유량(수집된 경우)', report.materials],
    ['광추·유물 원본 효과', report.reference],
    ['원본 매칭 실패 ID', report.unmatchedGameIds],
  ];
  const title = '# 스타레일 개인 계정 육성 데이터';
  const head = title + '\n\n출처: ' + report.metadata.accountSource + ' + StarRailRes\n\n';
  const markdown = head + '## 출처 및 버전\n\n\`\`\`json\n'
    + JSON.stringify(report.metadata, null, 2) + '\n\`\`\`\n\n'
    + sections.map(([name, data]) =>
      '## ' + name + '\n\n\`\`\`json\n'
      + JSON.stringify(data, null, 2) + '\n\`\`\`\n'
    ).join('\n');
  console.log(markdown);
}
