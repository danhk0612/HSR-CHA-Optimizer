/** Return one unambiguous entry from an already-downloaded StarRailRes table. */
export function findEntry(table, query, label) {
  const all = Object.values(table);
  const normalized = query.toLocaleLowerCase();
  const exact = all.filter((item) =>
    item.id === query || item.name?.toLocaleLowerCase() === normalized
  );
  const matches = exact.length ? exact : all.filter((item) =>
    item.name?.toLocaleLowerCase().includes(normalized)
  );
  if (matches.length !== 1) {
    const names = matches.slice(0, 15).map((item) => `${item.name} (${item.id})`).join(', ');
    throw new Error(matches.length
      ? `${label} 검색 결과가 여러 개입니다: ${names}`
      : `${label}을(를) 찾지 못했습니다: ${query}`);
  }
  return matches[0];
}

export function buildLightConeReport(cone, tables) {
  return {
    lightCone: cone,
    path: tables.paths?.[cone.path] ?? null,
    superimpositions: tables.light_cone_ranks?.[cone.id] ?? null,
    promotions: tables.light_cone_promotions?.[cone.id] ?? null,
  };
}

export function buildRelicSetReport(set, tables) {
  const pieces = Object.values(tables.relics ?? {})
    .filter((relic) => relic.set_id === set.id)
    .map((relic) => ({
      relic,
      mainAffixes: tables.relic_main_affixes?.[relic.main_affix_id] ?? null,
      subAffixes: tables.relic_sub_affixes?.[relic.sub_affix_id] ?? null,
    }));

  const propertyTypes = new Set();
  for (const piece of pieces) {
    for (const affixGroup of [piece.mainAffixes, piece.subAffixes]) {
      for (const affix of Object.values(affixGroup?.affixes ?? {})) {
        propertyTypes.add(affix.property);
      }
    }
  }
  for (const group of set.properties ?? []) {
    for (const property of group) {
      if (property.type) propertyTypes.add(property.type);
    }
  }
  const properties = Object.fromEntries(
    [...propertyTypes].filter((type) => tables.properties?.[type])
      .map((type) => [type, tables.properties[type]])
  );
  return { set, pieces, properties };
}
