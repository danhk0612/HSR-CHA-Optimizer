// Read-only AI hand-off: use original account values and Korean game definitions.
// Do not simulate in-game final stats or score relics.
const SKILL_TYPES = { basic: 'Normal', skill: 'BPSkill', ult: 'Ultra', talent: 'Talent' };

export function resolveCharacterName(owned, tables) {
  const ref = tables.characters?.[String(owned.id)];
  const original = ref?.name ?? owned.name ?? '';
  if (!original.includes('{NICKNAME}')) return original;
  const path = tables.paths?.[ref?.path]?.name;
  const element = tables.elements?.[ref?.element]?.name;
  const variant = [path, element].filter(Boolean).join(' · ');
  // The actual account nickname is not present in the scanner export.
  return variant ? `개척자 (${variant})` : `개척자 (${owned.id})`;
}

function compactRelic(item, tables) {
  return {
    inventoryId: item._uid ?? null,
    setId: String(item.set_id),
    setName: tables.relic_sets?.[String(item.set_id)]?.name ?? item.name ?? null,
    slot: item.slot,
    rarity: item.rarity,
    level: item.level,
    mainstat: item.mainstat,
    substats: item.substats ?? [],
    ...(item.preview_substats?.length ? { previewSubstats: item.preview_substats } : {}),
    ...(item.reroll_substats?.length ? { rerollSubstats: item.reroll_substats } : {}),
    equippedBy: item.location || null,
  };
}

function compactCone(item, tables) {
  const def = tables.light_cones?.[String(item.id)];
  const rank = tables.light_cone_ranks?.[String(item.id)];
  const tier = item.superimposition;
  return {
    inventoryId: item._uid ?? null,
    id: String(item.id), name: def?.name ?? item.name ?? null,
    level: item.level, ascension: item.ascension,
    superimposition: tier, equippedBy: item.location || null,
    effect: rank ? {
      name: rank.skill ?? null,
      descriptionTemplate: rank.desc ?? null,
      paramsAtSuperimposition: rank.params?.[tier - 1] ?? null,
    } : null,
  };
}

function compactSkills(owned, ref, tables) {
  const skillDefs = (ref.skills ?? []).map(id => tables.character_skills?.[String(id)]).filter(Boolean);
  const results = {};
  for (const [key, level] of Object.entries(owned.skills ?? {})) {
    const type = SKILL_TYPES[key];
    // Unknown skills (e.g. special path mechanics) retain their real level.
    const definition = type ? skillDefs.find(entry => entry.type === type) : undefined;
    results[key] = {
      level,
      ...(definition ? {
        name: definition.name,
        descriptionTemplate: definition.desc,
        paramsAtLevel: definition.params?.[level - 1] ?? null,
      } : {}),
    };
  }
  return results;
}

function compactCharacter(owned, tables, lightCones, relics) {
  const ref = tables.characters?.[String(owned.id)];
  const base = {
    id: String(owned.id),
    name: resolveCharacterName(owned, tables),
    level: owned.level,
    ascension: owned.ascension,
    eidolon: owned.eidolon,
    ...(owned.affinitive_eidolons !== undefined ? { affinitiveEidolons: owned.affinitive_eidolons } : {}),
    skills: ref ? compactSkills(owned, ref, tables) : owned.skills ?? {},
    traces: owned.traces ?? {},
    ...(owned.memosprite ? { memosprite: owned.memosprite } : {}),
    lightCones: lightCones.map(x => compactCone(x, tables)),
    relics: relics.map(x => compactRelic(x, tables)),
  };
  if (!ref) return { ...base, gameDataAvailable: false };
  const unlocked = (ref.ranks ?? [])
    .map(id => tables.character_ranks?.[String(id)])
    .filter(e => e && e.rank <= owned.eidolon)
    .map(e => ({ rank: e.rank, name: e.name, description: e.desc }));
  const majorTraces = [1, 2, 3]
    .map(n => {
      const definition = tables.character_skill_trees?.[`${owned.id}10${n}`];
      if (!definition) return null;
      return {
        name: definition.name,
        descriptionTemplate: definition.desc,
        params: definition.params,
        unlocked: owned.traces?.[`ability_${n}`] === true,
      };
    })
    .filter(Boolean);
  const counts = Object.create(null);
  for (const relic of relics) {
    const id = String(relic.set_id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const setBonuses = Object.entries(counts).map(([id, count]) => {
    const set = tables.relic_sets?.[id];
    const planar = Number(id) >= 300;
    return {
      id, name: set?.name ?? id, pieces: count,
      active: set ? (planar
        ? (count >= 2 ? [{ pieces: 2, description: set.desc?.[0] ?? null }] : [])
        : [
          ...(count >= 2 ? [{ pieces: 2, description: set.desc?.[0] ?? null }] : []),
          ...(count >= 4 ? [{ pieces: 4, description: set.desc?.[1] ?? null }] : []),
        ]) : [],
    };
  });
  return { ...base, gameDataAvailable: true, unlockedEidolons: unlocked, majorTraceDefinitions: majorTraces, relicSetBonuses: setBonuses };
}

function selectCandidates(scanner, tables, wanted, options) {
  const mode = options.candidateMode ?? 'none';
  if (!['none', 'equipped-sets', 'all'].includes(mode)) throw new Error('지원하지 않는 후보 범위: ' + mode);
  if (mode === 'none') return { mode, matching: 0, included: 0, relics: [] };
  const setIds = new Set(options.candidateSetIds?.map(String) ?? []);
  if (!setIds.size && mode === 'equipped-sets') {
    const ids = new Set(wanted.map(item => String(item.id)));
    for (const relic of scanner.relics ?? []) {
      if (ids.has(String(relic.location))) setIds.add(String(relic.set_id));
    }
  }
  const minimumRarity = options.minRarity ?? 0;
  const filtered = (scanner.relics ?? []).filter(item =>
    !item.location && item.rarity >= minimumRarity && (
      mode === 'all' && !setIds.size || setIds.has(String(item.set_id))
    )
  );
  const limit = options.candidateLimit ?? filtered.length;
  if (!Number.isInteger(limit) || limit < 0) throw new Error('후보 개수는 0 이상의 정수여야 합니다.');
  return {
    mode, setIds: [...setIds], matching: filtered.length,
    included: Math.min(limit, filtered.length),
    relics: filtered.slice(0, limit).map(item => compactRelic(item, tables)),
  };
}

export function buildAiReport(scanner, tables, manifest, options = {}) {
  if (!scanner || !Array.isArray(scanner.characters)) throw new Error('캐릭터 스캔 목록이 없습니다.');
  const ids = [...new Set((options.characterIds ?? []).map(String))];
  if (!ids.length) throw new Error('내보낼 캐릭터 ID를 한 명 이상 지정하세요.');
  const wanted = ids.map(id => {
    const item = scanner.characters.find(c => String(c.id) === id);
    if (!item) throw new Error('보유 캐릭터 목록에 없는 ID: ' + id);
    return item;
  });
  const selectedCharacters = wanted.map(owned => {
    const id = String(owned.id);
    const cones = (scanner.light_cones ?? []).filter(item => String(item.location) === id);
    const relics = (scanner.relics ?? []).filter(item => String(item.location) === id);
    return compactCharacter(owned, tables, cones, relics);
  });
  const candidates = selectCandidates(scanner, tables, wanted, options);
  const resources = options.includeResources ? {
    gacha: scanner.gacha ?? null,
    materials: (scanner.materials ?? []).map(item => ({
      id: String(item.id),
      name: tables.items?.[String(item.id)]?.name ?? item.name,
      count: item.count,
      ...(tables.items?.[String(item.id)] ? {} : { koreanNameUnavailable: true }),
    })),
  } : undefined;
  return {
    metadata: {
      gameVersion: manifest.version,
      gameSource: manifest.source,
      gameSyncedAt: manifest.syncedAt,
      accountSource: scanner.source,
      accountBuild: scanner.build ?? null,
      importedAt: options.importedAt ?? null,
      uidExcluded: true,
    },
    limitations: {
      characterSheetStatsCollected: false,
      warpPityCollected: false,
      note: '스캔 장비의 실제 수치만 수록하며, 최종 캐릭터 능력치는 임의로 계산하지 않습니다. 스킬 설명의 #1[i] 등 표기는 원문이며 계수 배열은 별도로 제공됩니다.',
    },
    characters: selectedCharacters,
    candidates: candidates.mode === 'none' ? undefined : candidates,
    ...(resources ? { resources } : {}),
  };
}

export function toAiMarkdown(report) {
  const parts = [
    '# 붕괴: 스타레일 — AI 분석용 계정 자료',
    `게임 버전: ${report.metadata.gameVersion}; 출처: ${report.metadata.accountSource}`,
    '## 범위 및 한계',
    '```json\n' + JSON.stringify(report.limitations, null, 2) + '\n```',
  ];
  for (const character of report.characters) {
    parts.push(`## ${character.name} (Lv.${character.level}, 성혼 ${character.eidolon})`);
    parts.push('```json\n' + JSON.stringify(character, null, 2) + '\n```');
  }
  if (report.candidates) {
    parts.push('## 미장착 유물 후보');
    parts.push('```json\n' + JSON.stringify(report.candidates, null, 2) + '\n```');
  }
  if (report.resources) {
    parts.push('## 보유 재화 및 재료');
    parts.push('```json\n' + JSON.stringify(report.resources, null, 2) + '\n```');
  }
  return parts.join('\n\n') + '\n';
}
