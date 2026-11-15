// The scanner and StarRailRes character index do not provide a gender field.
// This deliberately limited character-ID classification is supplemental metadata,
// never inferred from a name or used as evidence about the player.
// An unknown ID/ambiguous identity MUST remain 'unknown'.
const FEMALE = new Set(`
1001 1003 1005 1006 1009 1013 1014
1101 1102 1103 1105 1106 1107 1109 1110
1201 1202 1206 1207 1208 1210 1211 1212 1214 1215 1217
1220 1221 1222 1224 1225
1303 1306 1307 1308 1309 1310 1321
1401 1402 1403 1406 1407 1409 1410 1413 1415
1501 1502 1503 1506 1508 1510 1512
`.trim().split(/\s+/));
const MALE = new Set(`
1002 1004 1008 1015 1104 1108 1111 1203 1209 1223
1301 1305 1312 1414 1509
`.trim().split(/\s+/));
export function characterGender(id) {
  const key = String(id);
  if (FEMALE.has(key)) return 'female';
  if (MALE.has(key)) return 'male';
  return 'unknown';
}
