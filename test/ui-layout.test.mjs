import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8');
const desktop = await readFile(join(process.cwd(), 'src', 'desktop.cjs'), 'utf8');
const preload = await readFile(join(process.cwd(), 'src', 'desktop-preload.cjs'), 'utf8');
const realSmoke = await readFile(join(process.cwd(), 'src', 'real-account-smoke.cjs'), 'utf8');
const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8'));
const realSmokeRunner = await readFile(join(process.cwd(), 'scripts', 'smoke-real-windows.mjs'), 'utf8');


test('the five data kinds are independent checkbox-enabled tabs, not one shared dropdown or search', () => {
  for (const name of ['characters', 'lightCones', 'relics', 'ornaments', 'materials']) {
    assert.match(html, new RegExp("id:'" + name + "'"));
  }
  assert.match(html, /checkbox\.type='checkbox';checkbox\.checked=enabled\.has\(group\.id\)/);
  assert.match(html, /views\.set\(group\.id,view\)/);
  assert.match(html, /const view=createView\(group,rows\)/);
  assert.match(html, /const search=make\('input'\);search\.type='search'/);
  assert.match(html, /view\.filtered=filterRows\(view\.rows,f\)/);
  assert.match(html, /view\.selected=new Set|selected:new Set\(\)/);
  assert.doesNotMatch(html, /id="inventoryGroup"/);
});

test('legacy stacked panels and obsolete IPC controls are absent from the active interface', () => {
  for (const oldId of ['legacyOptions', 'publicEditor', 'fullAccountPanel', 'candidateMode',
    'sheetEditor', 'warpPanel', 'inventoryExplorer', 'inventorySearch', 'inventoryRows']) {
    assert.ok(!html.includes('id="' + oldId + '"'), 'legacy panel still visible: ' + oldId);
  }
  for (const oldHandler of ['hsr:enemy-sync', 'hsr:public-export', 'hsr:full-account-export',
    'hsr:manual-save', 'hsr:warp-save', 'hsr:export']) {
    assert.ok(!desktop.includes(oldHandler), 'obsolete IPC handler still exposed: ' + oldHandler);
    assert.ok(!preload.includes(oldHandler), 'obsolete IPC bridge still exposed: ' + oldHandler);
  }
  assert.doesNotMatch(html, /gender|성별/);
});

test('only checked category selections are collected for output with per-tab ordering', () => {
  assert.match(html, /if\(!enabled\.has\(group\.id\)\)continue;/);
  assert.match(html, /const view=views\.get\(group\.id\)/);
  assert.match(html, /const rows=filterRows\(view\.rows,readFilter\(view,true\)\)/);
  assert.match(html, /if\(view\.selected\.has\(row\.key\)\)/);
  assert.match(html, /return \{keys,orderKeys\}/);
  for (const required of ['groupCheckboxes','tabBar','tabPanels','exportCounts','exportFormat',
    'previewExport','saveExport','analysisPreferences','importArchive','syncGame']) {
    assert.ok(html.includes('id="' + required + '"'), required + ' is missing');
  }
});

test('packaged Electron smoke verifies actual tab interactions, not only presence of controls', () => {
  const inlineScripts = [...desktop.matchAll(/executeJavaScript\(`([\s\S]*?)`\)/g)]
    .map(match => match[1]);
  assert.equal(inlineScripts.length, 2);
  for (const script of inlineScripts) {
    assert.doesNotThrow(() => new Function('return ' + script));
  }
  const interaction = inlineScripts[1];
  for (const expected of [
    "field('characters', 'query')",
    "field('lightCones', 'query')",
    "switchTab('lightCones')",
    "field('relics', 'statKey')",
    "field('ornaments', 'statKey')",
    "act('materials', 'selectFiltered')",
    "act('materials', 'next')",
    "document.getElementById('previewExport').click()",
    "document.getElementById('saveExport').click()",
  ]) {
    assert.ok(interaction.includes(expected), 'GUI action is missing from smoke: ' + expected);
  }
  assert.match(desktop, /ipcMain\.handle\('hsr:inventory-catalog'/);
  assert.match(desktop, /const savedFile = join\(smokeRoot, 'selected-items.json'\)/);
  assert.match(desktop, /savedRequest\.keys\.length !== 60/);
});

test('real account smoke keeps account read-only and verifies three user-facing formats', () => {
  assert.doesNotThrow(() => new Function(realSmoke));
  assert.match(desktop, /realAccountSmoke \? process\.cwd\(\)/);
  assert.match(desktop, /filePath: join\(smokeRoot, 'real-selected\.' \+ extension\)/);
  assert.match(desktop, /require\('\.\/real-account-smoke\.cjs'\)/);
  for (const category of ['characters','lightCones','relics','ornaments','materials']) {
    assert.ok(realSmoke.includes(category), 'missing real account category: ' + category);
  }
  for (const extension of ['json','md','html']) {
    assert.ok(realSmoke.includes("'real-selected." + extension + "'"),
      'real account format not verified: ' + extension);
  }
  assert.match(realSmoke, /new DOMParser\(\)/);
  assert.match(realSmoke, /htmlCheck\.rows !== 10/);
  assert.match(realSmoke, /temporaryOutputOnly: true/);
  assert.match(realSmokeRunner, /await rm\(tempRoot, \{ recursive: true, force: true/);
  assert.match(realSmokeRunner, /--smoke-temp-dir=/);
  assert.match(desktop, /suppliedSmokeDir/);
  assert.match(pkg.scripts['verify:local-win'], /npm run smoke:real-win/);
  assert.doesNotMatch(pkg.scripts['verify:win'], /smoke:real-win/);
});
