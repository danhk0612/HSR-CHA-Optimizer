// Join only source data. Do not calculate recommendations or invent absent values.
export function buildCharacterReport(character, tables, metadata) {
  const take = (table, ids = []) => ids
    .map((id) => table?.[String(id)])
    .filter((entry) => entry !== undefined);

  return {
    metadata,
    character,
    eidolons: take(tables.character_ranks, character.ranks),
    skills: take(tables.character_skills, character.skills),
    traces: take(tables.character_skill_trees, character.skill_trees),
    promotions: tables.character_promotions?.[character.id] ?? null,
  };
}
