import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildCharacterReport } from './build-character-report.mjs';
import { findEntry, buildLightConeReport, buildRelicSetReport } from './equipment-report.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const lightConeQueries = [];
const relicSetQueries = [];
const characterWords = [];

for (let i = 0; i < args.length; i++) {
  const value = args[i];
  if (value === '--json') continue;
  if (value === '--light-cone' || value === '--relic-set') {
    const query = args[++i];
    if (!query || query.startsWith('--')) throw new Error(`${value} 뒤에 이름 또는 ID가 필요합니다.`);
    (value === '--light-cone' ? lightConeQueries : relicSetQueries).push(query);
  } else {
    characterWords.push(value);
  }
}
const query = characterWords.join(' ').trim();

if (!query) {
  console.error('Usage: npm run export:character -- "<캐릭터 이름 또는 ID>" [--json] [--light-cone "<광추>"] [--relic-set "<유물 세트>"]');
  process.exitCode = 1;
} else {
  const root = resolve('.local-data', 'game');
  const current = JSON.parse(await readFile(join(root, 'current.json'), 'utf8'));
  const base = join(root, current.version, current.language);
  const filenameList = [
    'characters', 'character_ranks', 'character_skills',
    'character_skill_trees', 'character_promotions',
  ];
  if (lightConeQueries.length) {
    filenameList.push('light_cones', 'light_cone_ranks', 'light_cone_promotions', 'paths');
  }
  if (relicSetQueries.length) {
    filenameList.push('relic_sets', 'relics', 'relic_main_affixes', 'relic_sub_affixes', 'properties');
  }
  const tables = Object.fromEntries(await Promise.all(filenameList.map(async (name) => [
    name, JSON.parse(await readFile(join(base, `${name}.json`), 'utf8')),
  ])));

  const all = Object.values(tables.characters);
  const normalized = query.toLocaleLowerCase();
  const exact = all.filter((item) => (
    item.id === query || item.name?.toLocaleLowerCase() === normalized
  ));
  const matches = exact.length ? exact : all.filter((item) => (
    item.name?.toLocaleLowerCase().includes(normalized)
  ));

  if (matches.length !== 1) {
    const names = matches.slice(0, 15).map((item) => `${item.name} (${item.id})`).join(', ');
    console.error(matches.length ? `Ambiguous character: ${names}` : `Character not found: ${query}`);
    process.exitCode = 1;
  } else {
    const character = matches[0];
    const metadata = JSON.parse(await readFile(join(base, 'manifest.json'), 'utf8'));
    const report = buildCharacterReport(character, tables, {
      source: metadata.source,
      gameVersion: metadata.version,
      language: metadata.language,
      syncedAt: metadata.syncedAt,
      note: 'Public game data only. No personal inventory or equipped relics.',
    });

    if (lightConeQueries.length || relicSetQueries.length) {
      report.selectedEquipment = {
        lightCones: lightConeQueries.map((name) => buildLightConeReport(
          findEntry(tables.light_cones, name, '광추'), tables
        )),
        relicSets: relicSetQueries.map((name) => buildRelicSetReport(
          findEntry(tables.relic_sets, name, '유물 세트'), tables
        )),
      };
    }

    if (jsonOutput) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const sections = [
        ['기본 정보', report.character],
        ['성혼', report.eidolons],
        ['스킬(레벨별 원본 계수 포함)', report.skills],
        ['행적', report.traces],
        ['승급/레벨', report.promotions],
      ];
      if (report.selectedEquipment) {
        if (lightConeQueries.length) sections.push(['선택 광추(중첩·승급 효과)', report.selectedEquipment.lightCones]);
        if (relicSetQueries.length) sections.push(['선택 유물 세트(부위·옵션)', report.selectedEquipment.relicSets]);
      }
      // Preserve original JSON in code blocks: placeholders such as #1[i]
      // and their params need to remain paired for accurate AI interpretation.
      const markdown = `# ${character.name} (${character.id})\n\n` +
        `출처: ${metadata.source}\n\n게임 버전: ${metadata.version}\n\n수집 시각: ${metadata.syncedAt}\n\n` +
        sections.map(([name, data]) =>
          `## ${name}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
        ).join('\n');
      console.log(markdown);
    }
  }
}
