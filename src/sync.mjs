import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const BASE_URL = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master';
const STORE = resolve('.local-data', 'game');
const LANGUAGE = 'kr';

// File names follow the StarRailRes README. Keep original identifiers and fields.
const INDEX_FILES = [
  'paths.json',
  'elements.json',
  'properties.json',
  'characters.json',
  'character_ranks.json',
  'character_skills.json',
  'character_skill_trees.json',
  'character_promotions.json',
  'light_cones.json',
  'light_cone_ranks.json',
  'light_cone_promotions.json',
  'relics.json',
  'relic_sets.json',
  'relic_main_affixes.json',
  'relic_sub_affixes.json',
  'items.json',
];

async function fetchJson(path) {
  const url = `${BASE_URL}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }
  const body = await response.text();
  const data = JSON.parse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Unexpected JSON format: ${url}`);
  }
  return { body, data };
}

const { data: info } = await fetchJson('info.json');
const version = info.version;
const folder = info.folder;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Unsupported source version in info.json');
}
if (folder !== 'index_min' && folder !== 'index_new') {
  throw new Error('Unsupported source folder in info.json');
}

await mkdir(STORE, { recursive: true });
const staging = join(STORE, `.staging-${process.pid}`);
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });

const files = [];
try {
  for (const filename of INDEX_FILES) {
    const { body, data } = await fetchJson(`${folder}/${LANGUAGE}/${filename}`);
    await writeFile(join(staging, filename), body, 'utf8');
    const count = Object.keys(data).length;
    files.push({ filename, count });
    console.log(`[${files.length}/${INDEX_FILES.length}] ${filename} (${count})`);
  }

  const syncedAt = new Date().toISOString();
  const manifest = {
    source: 'https://github.com/Mar-7th/StarRailRes',
    version,
    sourceTimestamp: info.timestamp ?? null,
    sourceFolder: folder,
    language: LANGUAGE,
    syncedAt,
    files,
  };
  await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const target = join(STORE, version, LANGUAGE);
  await mkdir(join(STORE, version), { recursive: true });
  await rm(target, { recursive: true, force: true });
  await rename(staging, target);

  // Only advertise an updated version after all data files have been saved.
  await writeFile(join(STORE, 'current.json'), JSON.stringify({ version, language: LANGUAGE, syncedAt }, null, 2), 'utf8');
  console.log(`Saved StarRailRes ${version} -> ${target}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
