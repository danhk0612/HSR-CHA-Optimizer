import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const BASE_URL = 'https://raw.githubusercontent.com/Mar-7th/StarRailRes/master';
const LANGUAGE = 'kr';
const INDEX_FILES = [
  'paths.json', 'elements.json', 'properties.json',
  'characters.json', 'character_ranks.json', 'character_skills.json',
  'character_skill_trees.json', 'character_promotions.json',
  'light_cones.json', 'light_cone_ranks.json', 'light_cone_promotions.json',
  'relics.json', 'relic_sets.json', 'relic_main_affixes.json',
  'relic_sub_affixes.json', 'items.json',
  'simulated_blessings.json', 'simulated_curios.json',
  'simulated_events.json', 'simulated_blocks.json',
];

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const body = await response.text();
  const data = JSON.parse(body);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Unexpected JSON format: ${url}`);
  }
  return { body, data };
}

export async function syncGameData(root = process.cwd(), onProgress = () => {}, fetchImpl = fetch) {
  const store = resolve(root, '.local-data', 'game');
  const { data: info } = await fetchJson(`${BASE_URL}/info.json`, fetchImpl);
  const { version, folder } = info;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Unsupported source version in info.json');
  }
  if (folder !== 'index_min' && folder !== 'index_new') {
    throw new Error('Unsupported source folder in info.json');
  }
  await mkdir(store, { recursive: true });
  const staging = join(store, `.staging-${process.pid}-${Date.now()}`);
  const backup = join(store, `.backup-${process.pid}-${Date.now()}`);
  await mkdir(staging, { recursive: true });
  const files = [];
  try {
    for (const filename of INDEX_FILES) {
      const { body, data } = await fetchJson(`${BASE_URL}/${folder}/${LANGUAGE}/${filename}`, fetchImpl);
      await writeFile(join(staging, filename), body, 'utf8');
      const count = Object.keys(data).length;
      files.push({ filename, count });
      onProgress({ done: files.length, total: INDEX_FILES.length, filename, count });
    }
    const syncedAt = new Date().toISOString();
    const manifest = {
      source: 'https://github.com/Mar-7th/StarRailRes',
      version, sourceTimestamp: info.timestamp ?? null,
      sourceFolder: folder, language: LANGUAGE, syncedAt, files,
    };
    await writeFile(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    const target = join(store, version, LANGUAGE);
    await mkdir(join(store, version), { recursive: true });
    let movedOld = false;
    try {
      // Leave the previous complete snapshot intact until download succeeds.
      try {
        await rename(target, backup);
        movedOld = true;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await rename(staging, target);
    } catch (error) {
      if (movedOld) await rename(backup, target);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    await writeFile(join(store, 'current.json'),
      JSON.stringify({ version, language: LANGUAGE, syncedAt }, null, 2), 'utf8');
    return { ...manifest, target };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
