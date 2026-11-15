const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const { join } = require('node:path');
const { writeFile } = require('node:fs/promises');

if (!app.requestSingleInstanceLock()) {
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
    const userRoot = app.isPackaged ? app.getPath('userData') : process.cwd();
    const [{ getDesktopState, exportDesktopReport }, { importAccountArchive }, { syncGameData }] =
      await Promise.all([
        import('./desktop-service.mjs'),
        import('./account-import.mjs'),
        import('./sync-core.mjs'),
      ]);

    const win = new BrowserWindow({
      title: 'HSR-CHA-Optimizer',
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
    ipcMain.handle('hsr:export', (_, args) => exportDesktopReport(userRoot, args));
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
  });

  app.on('window-all-closed', () => app.quit());
}
