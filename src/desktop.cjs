const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join } = require('node:path');
const { writeFile } = require('node:fs/promises');
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
        const result = await win.webContents.executeJavaScript(`(async () => {
          const api = window.hsrDesktop;
          const state = api && await api.getState();
          return {
            bridge: !!api,
            emptyState: state && state.ready === false,
            toolbar: document.getElementById('desktopToolbar').hidden === false,
            syncButton: !!document.getElementById('syncGame'),
            importButton: !!document.getElementById('importArchive'),
            categories: document.querySelectorAll('#groupCheckboxes input[type=checkbox]').length === 5,
            independentTabs: !!document.getElementById('tabBar') && !!document.getElementById('tabPanels'),
            exportControls: ['exportCounts','previewExport','saveExport','exportFormat',
              'includeGacha','includeWarp','includeSupplemental','includeReference'].every(id => !!document.getElementById(id)),
            preferences: !!document.getElementById('analysisPreferences'),
            oldPanelsGone: !document.getElementById('legacyOptions') &&
              !document.getElementById('publicEditor') &&
              !document.getElementById('candidateMode') &&
              !document.getElementById('fullAccountPanel'),
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
