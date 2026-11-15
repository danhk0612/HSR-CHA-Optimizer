const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { join } = require('node:path');
const { writeFile, mkdtemp } = require('node:fs/promises');
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
    const [{ getDesktopState, exportDesktopReport, saveManualSheet, clearManualSheet, importSavedShowcase, exportPublicInfo, saveWarpPool, clearWarpPool, prepareEnemyInfo, buildFullAccountForDesktop, buildFullAccountFolder, saveAccountAnalysisPreferences, getInventoryCatalog, exportSelectedInventory }, { importAccountArchive }, { syncGameData }] =
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
    let syncingEnemies = false;
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
    ipcMain.handle('hsr:export', (_, args) => exportDesktopReport(userRoot, args));
    ipcMain.handle('hsr:analysis-preferences-save', (_, text) =>
      saveAccountAnalysisPreferences(userRoot, text));
    ipcMain.handle('hsr:full-account-export', async (_, request) => {
      const mode = request?.mode;
      if (mode !== 'single' && mode !== 'folder')
        throw new Error('지원하지 않는 전체 계정 저장 형식입니다.');
      if (mode === 'single') {
        const selected = await dialog.showSaveDialog(win, {
          title: 'AI 전달용 전체 계정 JSON 저장',
          defaultPath: join(app.getPath('documents'), 'hsr-account-complete.json'),
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (selected.canceled || !selected.filePath) return null;
        const report = await buildFullAccountForDesktop(userRoot);
        await writeFile(selected.filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
        return { kind: mode, path: selected.filePath, counts: report.counts, fileCount: 1 };
      }
      const selected = await dialog.showOpenDialog(win, {
        title: '분할 계정 자료를 저장할 상위 폴더 선택',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (selected.canceled || !selected.filePaths.length) return null;
      const bundle = await buildFullAccountFolder(userRoot);
      const directory = await mkdtemp(join(selected.filePaths[0], 'HSR-AI-Account-'));
      for (const [name, contents] of Object.entries(bundle.files)) {
        await writeFile(join(directory, name), contents, 'utf8');
      }
      return {
        kind: mode, path: directory,
        counts: bundle.manifest.counts,
        fileCount: Object.keys(bundle.files).length,
      };
    });
    ipcMain.handle('hsr:public-export', (_, request) => exportPublicInfo(userRoot, request));
    ipcMain.handle('hsr:enemy-sync', async (event) => {
      if (syncingEnemies) throw new Error('적·보스 자료 준비가 이미 진행 중입니다.');
      syncingEnemies = true;
      try {
        return await prepareEnemyInfo(userRoot, progress => {
          if (!event.sender.isDestroyed()) event.sender.send('hsr:enemy-progress', progress);
        });
      } finally { syncingEnemies = false; }
    });
    ipcMain.handle('hsr:warp-save', (_, { name, input }) => saveWarpPool(userRoot, name, input));
    ipcMain.handle('hsr:warp-clear', (_, name) => clearWarpPool(userRoot, name));
    ipcMain.handle('hsr:manual-save', (_, { id, values }) => saveManualSheet(userRoot, id, values));
    ipcMain.handle('hsr:manual-clear', (_, id) => clearManualSheet(userRoot, id));
    ipcMain.handle('hsr:showcase-import', async () => {
      const choice = await dialog.showOpenDialog(win, {
        title: '저장된 MiHoMo Parsed API JSON 파일 선택 (외부 전송 없음)',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (choice.canceled || !choice.filePaths.length) return null;
      return importSavedShowcase(userRoot, choice.filePaths[0]);
    });
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
    ipcMain.handle('hsr:copy', (_, text) => clipboard.writeText(text));
    ipcMain.handle('hsr:save', async (_, { text, format }) => {
      const extension = format === 'markdown' ? 'md' : 'json';
      const result = await dialog.showSaveDialog(win, {
        title: 'AI 분석용 자료 저장',
        defaultPath: join(app.getPath('documents'), 'hsr-ai-export.' + extension),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, text, 'utf8');
      return true;
    });
    await win.loadFile(join(__dirname, '..', 'public', 'index.html'));
    if (smokeTest) {
      try {
        const result = await win.webContents.executeJavaScript(`(async () => {
          const api = window.hsrDesktop;
          const state = api && await api.getState();
          return {
            bridge: !!api,
            emptyState: state && state.ready === false,
            toolbar: document.getElementById('desktopToolbar').hidden === false,
            importButton: !!document.getElementById('importArchive'),
            warpControls: ['warpPanel','warpType','warpPity','warpGuarantee','warpSave','warpClear']
              .every(id => !!document.getElementById(id)),
            manualSheetControls: ['manualStatCharacter','manualSheetSave','manualSheetClear',
              'importShowcase'].every(id => !!document.getElementById(id)),
            enemyControls: ['prepareEnemies', 'enemyDataStatus'].every(id => !!document.getElementById(id)),
            publicControls: ['publicType','publicSearch','publicGenerate','publicResult']
              .every(id => !!document.getElementById(id)),
            syncHistoryControls: ['syncHistory','syncHistorySummary','syncHistoryRows']
              .every(id => !!document.getElementById(id)),
            exportButton: !!document.getElementById('generate'),
            inventoryControls: ['inventoryExplorer','inventoryGroup','inventorySearch',
              'inventoryRows','inventorySelectFiltered','inventoryClearFiltered',
              'inventoryOutputFormat','inventoryExport','inventoryPreview']
              .every(id => !!document.getElementById(id)),
            fullAccountControls: ['fullAccountPanel', 'fullSaveSingle', 'fullSaveFolder',
              'analysisPreferences', 'analysisPreferencesSave', 'fullExportStatus']
              .every(id => !!document.getElementById(id)),
            candidateFilterControls: ['candidateFilterArea', 'candidateSetChoices',
              'candidateSlotChoices', 'candidateMainChoices', 'candidateSubChoices']
              .every(id => !!document.getElementById(id)),
          };
        })()`);
        if (!Object.values(result).every(Boolean)) {
          throw new Error('Electron GUI 검사 실패: ' + JSON.stringify(result));
        }
        console.log('Electron GUI smoke PASS: IPC bridge, empty state, import/export controls');
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    }
  });

  app.on('window-all-closed', () => app.quit());
}
