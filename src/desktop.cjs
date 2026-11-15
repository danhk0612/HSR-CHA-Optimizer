const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join } = require('node:path');
const { writeFile, readFile } = require('node:fs/promises');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');

const smokeTest = process.argv.includes('--smoke-test');
const smokeRoot = smokeTest ? mkdtempSync(join(tmpdir(), 'hsr-cha-smoke-')) : null;
if (smokeRoot) {
  app.setPath('userData', smokeRoot);
  app.on('quit', () => {
    try { rmSync(smokeRoot, { recursive: true, force: true }); } catch {}
  });
}

if (!smokeTest && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  app.whenReady().then(async () => {
    // Development reuses existing local CLI files; packaged EXE uses private user storage.
    const userRoot = smokeRoot ?? (app.isPackaged ? app.getPath('userData') : process.cwd());
    const [{ getDesktopState, getInventoryCatalog, exportSelectedInventory, saveAccountAnalysisPreferences }, { importAccountArchive }, { syncGameData }] =
      await Promise.all([
        import('./desktop-service.mjs'),
        import('./account-import.mjs'),
        import('./sync-core.mjs'),
      ]);

    const win = new BrowserWindow({
      title: 'HSR-CHA-Optimizer',
      show: !smokeTest,
      width: 1280,
      height: 850,
      minWidth: 900,
      minHeight: 650,
      backgroundColor: '#101827',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'desktop-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());

    let syncing = false;
    ipcMain.handle('hsr:state', () => getDesktopState(userRoot));
    ipcMain.handle('hsr:inventory-catalog', () => getInventoryCatalog(userRoot));
    ipcMain.handle('hsr:inventory-export', (_, request) => exportSelectedInventory(userRoot, request));
    ipcMain.handle('hsr:inventory-save', async (_, request) => {
      const extension = request?.format === 'html' ? 'html'
        : request?.format === 'markdown' ? 'md' : 'json';
      const chosen = await dialog.showSaveDialog(win, {
        title: '선택한 계정 자료 저장',
        defaultPath: join(app.getPath('documents'), 'hsr-account-selected.' + extension),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });
      if (chosen.canceled || !chosen.filePath) return null;
      const result = await exportSelectedInventory(userRoot, request);
      await writeFile(chosen.filePath, result.text, 'utf8');
      return { path: chosen.filePath, extension };
    });
    ipcMain.handle('hsr:analysis-preferences-save', (_, text) =>
      saveAccountAnalysisPreferences(userRoot, text));
    ipcMain.handle('hsr:import', async () => {
      const choice = await dialog.showOpenDialog(win, {
        title: 'Reliquary Archiver / HSR-Scanner JSON 선택',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (choice.canceled || !choice.filePaths.length) return null;
      return importAccountArchive(choice.filePaths[0], userRoot);
    });
    ipcMain.handle('hsr:sync', async (event) => {
      if (syncing) throw new Error('동기화가 이미 진행 중입니다.');
      syncing = true;
      try {
        const data = await syncGameData(userRoot, (progress) => {
          if (!event.sender.isDestroyed()) event.sender.send('hsr:sync-progress', progress);
        });
        return { version: data.version, syncedAt: data.syncedAt };
      } finally {
        syncing = false;
      }
    });
    await win.loadFile(join(__dirname, '..', 'public', 'index.html'));
    if (smokeTest) {
      try {
        // Step 1: the actual packaged renderer must open without any personal account.
        const initial = await win.webContents.executeJavaScript(`(async () => {
          const api = window.hsrDesktop;
          const state = await api.getState();
          return {
            preload: !!api,
            emptyAccount: state.ready === false,
            groups: document.querySelectorAll('#groupCheckboxes input[type=checkbox]').length === 5,
            import: !!document.getElementById('importArchive'),
            noLegacyPanels: !document.getElementById('legacyOptions') &&
              !document.getElementById('fullAccountPanel'),
          };
        })()`);
        if (!Object.values(initial).every(Boolean)) {
          throw new Error('빈 계정 Electron 화면 검증 실패: ' + JSON.stringify(initial));
        }

        // Step 2: a disposable IPC fixture exercises the real rendered controls
        // without downloading data or reading/writing the user's actual account.
        const mockRows = [
          { key: 'character:0', group: 'characters', id: '1308', name: '아케론',
            rarity: 5, level: 80, eidolon: 2, element: 'Thunder', elementName: '번개',
            path: 'Warlock', pathName: '공허' },
          { key: 'character:1', group: 'characters', id: '1401', name: '테스트 캐릭터',
            rarity: 4, level: 50, eidolon: 0, element: 'Wind', elementName: '바람',
            path: 'Shaman', pathName: '화합' },
          { key: 'lightCone:0', group: 'lightCones', id: '21015', name: '광추 A',
            rarity: 5, level: 80, superimposition: 2, path: 'Warlock',
            equipped: 'owned', equippedName: '아케론' },
          { key: 'lightCone:1', group: 'lightCones', id: '21016', name: '광추 B',
            rarity: 4, level: 1, superimposition: 5, path: 'Warlock',
            equipped: 'unequipped' },
          { key: 'relic:0', group: 'relics', id: '101', name: '사수 세트',
            rarity: 5, level: 15, setId: '101', setName: '사수 세트',
            slot: 'Head', mainstat: 'HP', mainstatName: 'HP',
            substats: [{ key: 'SPD', name: '속도', value: 4, count: 2 }],
            equipped: 'owned', equippedName: '아케론' },
          { key: 'relic:1', group: 'ornaments', id: '201', name: '투영 장신구',
            rarity: 5, level: 0, setId: '201', setName: '투영 장신구',
            slot: 'Planar Sphere', mainstat: 'ATK', mainstatName: '공격력',
            substats: [{ key: 'SPD', name: '속도', value: 2, count: 1 }],
            equipped: 'unequipped' },
          ...Array.from({ length: 55 }, (_, index) => ({
            key: 'material:' + index, group: 'materials', id: String(10000 + index),
            name: '시험 재료 ' + (index + 1), count: index + 1,
          })),
        ];
        const mockCatalog = {
          metadata: { gameVersion: '4.7.0' },
          groups: {
            characters: '캐릭터', lightCones: '광추', relics: '유물',
            ornaments: '차원 장신구', materials: '재료·티켓',
          },
          counts: { characters: 2, lightCones: 2, relics: 1, ornaments: 1, materials: 55 },
          rows: mockRows,
        };
        const mockState = {
          ready: true, version: '4.7.0',
          analysisPreferences: { text: '스모크 테스트 개인 조건' },
        };
        ipcMain.removeHandler('hsr:state');
        ipcMain.handle('hsr:state', () => mockState);
        ipcMain.removeHandler('hsr:inventory-catalog');
        ipcMain.handle('hsr:inventory-catalog', () => mockCatalog);
        let previewRequest = null;
        ipcMain.removeHandler('hsr:inventory-export');
        ipcMain.handle('hsr:inventory-export', (_, request) => {
          previewRequest = request;
          return { text: JSON.stringify(request), extension: 'json' };
        });
        const savedFile = join(smokeRoot, 'selected-items.json');
        let savedRequest = null;
        ipcMain.removeHandler('hsr:inventory-save');
        ipcMain.handle('hsr:inventory-save', async (_, request) => {
          savedRequest = request;
          await writeFile(savedFile, JSON.stringify(request), 'utf8');
          return { path: savedFile, extension: 'json' };
        });
        await new Promise(resolve => {
          win.webContents.once('did-finish-load', resolve);
          win.webContents.reloadIgnoringCache();
        });

        const interaction = await win.webContents.executeJavaScript(`(async () => {
          const ensure = (test, label) => { if (!test) throw new Error(label); };
          const waitFor = async (check, label) => {
            for (let i = 0; i < 80; i++) {
              if (check()) return;
              await new Promise(resolve => setTimeout(resolve, 40));
            }
            throw new Error('화면 데이터 로드 지연: ' + label);
          };
          const panel = name => document.getElementById('panel-' + name);
          const field = (name, kind) => panel(name).querySelector('[data-field="' + kind + '"]');
          const act = (name, action) => panel(name).querySelector('[data-action="' + action + '"]');
          const switchTab = name => document.querySelector('#tabBar [data-group="' + name + '"]').click();
          const fill = (input, text) => {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          };
          const change = (input, text) => {
            input.value = text;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          };
          await waitFor(() => panel('characters') &&
            panel('materials')?.querySelectorAll('tbody tr').length === 50, '모든 탭/50개 페이지');
          ensure(document.querySelectorAll('#groupCheckboxes input[type=checkbox]').length === 5,
            '자료 종류 5개 체크박스 누락');
          const originalCones = panel('lightCones').querySelector('.count').textContent;
          fill(field('characters', 'query'), '아케론');
          ensure(panel('characters').querySelector('.count').textContent.includes('검색 1개'),
            '캐릭터 검색 실패');
          ensure(panel('lightCones').querySelector('.count').textContent === originalCones,
            '캐릭터 검색이 광추 목록에 영향을 줌');
          switchTab('lightCones');
          ensure(panel('characters').hidden && !panel('lightCones').hidden,
            '종류별 독립 탭 전환 실패');
          fill(field('lightCones', 'query'), '광추 B');
          ensure(panel('lightCones').querySelector('.count').textContent.includes('검색 1개'),
            '광추 검색 실패');
          act('lightCones', 'selectFiltered').click();
          ensure(panel('lightCones').querySelector('.count').textContent.includes('선택 1개'),
            '광추 검색 결과 일괄 선택 실패');
          switchTab('characters');
          ensure(field('characters', 'query').value === '아케론',
            '다른 탭 방문 후 캐릭터 검색 상태 소실');
          fill(field('characters', 'query'), '');
          change(field('characters', 'sortBy'), 'level');
          change(field('characters', 'direction'), 'desc');
          act('characters', 'selectFiltered').click();
          switchTab('materials');
          ensure(panel('materials').querySelectorAll('tbody tr').length === 50,
            '첫 페이지는 50건이어야 함');
          act('materials', 'selectFiltered').click();
          ensure(panel('materials').querySelector('.count').textContent.includes('선택 55개'),
            '페이지 밖의 5건이 일괄 선택되지 않음');
          act('materials', 'next').click();
          ensure(panel('materials').querySelectorAll('tbody tr').length === 5,
            '두 번째 페이지 건수 오류');
          const toggle = document.querySelector('#groupCheckboxes [data-group="materials"]');
          toggle.click();
          ensure(!document.querySelector('#tabBar [data-group="materials"]'),
            '종류 체크 해제 후 탭이 남아 있음');
          ensure(document.getElementById('exportStatus').textContent.includes('3개 선택'),
            '종류 체크 해제 후 출력 후보에서 재료를 제외하지 않음');
          toggle.click();
          ensure(document.querySelector('#tabBar [data-group="materials"]'),
            '종류 재체크 후 탭 복원 실패');
          ensure(panel('materials').querySelector('.count').textContent.includes('선택 55개'),
            '종류 체크 해제/재활성화로 선택 상태가 사라짐');
          switchTab('characters');
          ensure(panel('characters').querySelector('.count').textContent.includes('선택 2개'),
            '탭 이동으로 캐릭터 선택이 사라짐');
          document.getElementById('previewExport').click();
          await waitFor(() => document.getElementById('previewText').value.includes('"orderKeys"'),
            'IPC 미리보기');
          document.getElementById('saveExport').click();
          await waitFor(() => document.getElementById('exportStatus').textContent.includes('저장 완료'),
            'IPC 선택 파일 저장');
          return {
            categories: 5, uniqueSearches: true, persistentSort: true,
            retainedSelections: true, pagination: true, pageWideBulkSelect: true,
            hiddenGroupExclusion: true, preview: true, save: true,
          };
        })()`);
        if (!Object.values(interaction).every(value => value === true || value === 5)) {
          throw new Error('실제 UI 상호작용 검증 실패: ' + JSON.stringify(interaction));
        }
        const onDisk = JSON.parse(await readFile(savedFile, 'utf8'));
        if (!previewRequest || !savedRequest ||
            JSON.stringify(onDisk) !== JSON.stringify(savedRequest) ||
            savedRequest.keys.length !== 58 ||
            savedRequest.keys.filter(key => key.startsWith('material:')).length !== 55 ||
            savedRequest.orderKeys.slice(0, 2).join(',') !== 'character:0,character:1' ||
            savedRequest.orderKeys[2] !== 'lightCone:1' ||
            previewRequest.keys.length !== savedRequest.keys.length) {
          throw new Error('IPC 선택 출력/파일 저장 검증 실패: ' +
            JSON.stringify({ preview: previewRequest?.keys?.length,
              saved: savedRequest?.keys?.length,
              firstKeys: savedRequest?.orderKeys?.slice(0, 4) }));
        }
        console.log('Electron GUI smoke PASS: 독립 탭 검색/정렬, 필터/선택 유지, 55개 페이지 일괄 선택, 미리보기 및 파일 저장');
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    }
  });

  app.on('window-all-closed', () => app.quit());
}
