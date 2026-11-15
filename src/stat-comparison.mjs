import { MANUAL_STAT_FIELDS } from './character-stats.mjs';

// MiHoMo parsed API describes base character attributes and independent additions.
// Totals derived here are comparison aids only, not in-game directly observed stats.
const ROUND_DIGITS = 4;
const round = number => Math.round((number + Number.EPSILON) * 10 ** ROUND_DIGITS) / 10 ** ROUND_DIGITS;

function summarize(items, field, percent) {
  const matches = (items ?? []).filter(item => item.field === field);
  if (!matches.length) return { exists: false, value: null };
  if (matches.some(item => item.percent !== percent || !Number.isFinite(item.value)))
    return { exists: false, value: null, invalid: true };
  return { exists: true, value: matches.reduce((sum, item) => sum + item.value, 0) };
}

export function compareCharacterSheet(entry, scannerCharacter = null) {
  const manual = entry?.manual;
  const showcase = entry?.showcase;
  if (!manual || !showcase) return null;

  const sameLevel = scannerCharacter && Number.isInteger(showcase.levelAtImport)
    ? Number(scannerCharacter.level) === showcase.levelAtImport : null;
  const sameEidolon = scannerCharacter && Number.isInteger(showcase.eidolonAtImport)
    ? Number(scannerCharacter.eidolon) === showcase.eidolonAtImport : null;

  const rows = [];
  for (const [field, spec] of Object.entries(MANUAL_STAT_FIELDS)) {
    const observed = manual.values?.[field];
    if (typeof observed !== 'number' || !Number.isFinite(observed)) continue;

    const percent = spec.unit === '%';
    const base = summarize(showcase.attributes, field, percent);
    const added = summarize(showcase.additions, field, percent);
    // No zero-filling for absent base values: the calculation must be auditable.
    if (!base.exists || base.invalid || added.invalid) {
      rows.push({
        field, name: spec.name, unit: spec.unit, observed,
        publicCalculated: null, difference: null,
        reason: '기초 능력치 원본 없음 또는 단위 불일치',
      });
      continue;
    }
    const sourceTotal = base.value + (added.exists ? added.value : 0);
    const calculated = round(percent ? sourceTotal * 100 : sourceTotal);
    rows.push({
      field, name: spec.name, unit: spec.unit,
      observed, publicCalculated: calculated,
      difference: round(observed - calculated),
    });
  }

  return {
    source: 'local-observation-vs-mihomo-calculated',
    manualRecordedAt: manual.recordedAt ?? null,
    showcaseImportedAt: showcase.importedAt ?? null,
    showcaseOriginalCaptureTimeKnown: showcase.originalCaptureTimeKnown === true,
    sameCharacterLevelAsCurrentScan: sameLevel,
    sameEidolonAsCurrentScan: sameEidolon,
    fieldsCompared: rows.filter(r => r.publicCalculated !== null).length,
    rows,
    note: '공개 전시 숫자는 attributes+additions를 계산한 값입니다. 수동 화면 값과 시점·장비·버프가 다를 수 있습니다. 차이값은 수동값-계산값이며 일치 판정이나 자동 보정은 수행하지 않습니다.',
  };
}
