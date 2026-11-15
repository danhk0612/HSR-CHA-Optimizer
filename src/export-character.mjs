import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildCharacterReport } from './build-character-report.mjs';

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const query = args.filter((arg) => arg !== '--json').join(' ').trim();

if (!query) {
  console.error('Usage: npm run export:character -- "<name or ID>" [--json]');
  process.exitCode = 1;
} else {
  const root = resolve('.local-data', 'game');
  const current = JSON.parse(await readFile(join(root, 'current.json'), 'utf8'));
  const base = join(root, current.version, current.language);
  const filenameList = [
    'characters', 'character_ranks', 'character_skills',
    'character_skill_trees', 'character_promotions',
  ];
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
