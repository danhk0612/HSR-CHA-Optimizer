import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const html = await readFile(join(process.cwd(), 'public', 'index.html'), 'utf8');
const desktop = await readFile(join(process.cwd(), 'src', 'desktop.cjs'), 'utf8');
const preload = await readFile(join(process.cwd(), 'src', 'desktop-preload.cjs'), 'utf8');

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
