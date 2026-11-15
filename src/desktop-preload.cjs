const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hsrDesktop', {
  getState: () => ipcRenderer.invoke('hsr:state'),
  exportData: (options) => ipcRenderer.invoke('hsr:export', options),
  exportPublicData: (options) => ipcRenderer.invoke('hsr:public-export', options),
  prepareEnemies: () => ipcRenderer.invoke('hsr:enemy-sync'),
  onEnemyProgress: (callback) => {
    ipcRenderer.on('hsr:enemy-progress', (_event, detail) => callback(detail));
  },
  importArchive: () => ipcRenderer.invoke('hsr:import'),
  importSavedShowcase: () => ipcRenderer.invoke('hsr:showcase-import'),
  saveManualSheet: (id, values) => ipcRenderer.invoke('hsr:manual-save', { id, values }),
  saveWarpPool: (name, input) => ipcRenderer.invoke('hsr:warp-save', { name, input }),
  clearWarpPool: (name) => ipcRenderer.invoke('hsr:warp-clear', name),
  clearManualSheet: (id) => ipcRenderer.invoke('hsr:manual-clear', id),
  syncGame: () => ipcRenderer.invoke('hsr:sync'),
  copyText: (text) => ipcRenderer.invoke('hsr:copy', text),
  saveText: (options) => ipcRenderer.invoke('hsr:save', options),
  onSyncProgress: (callback) => {
    ipcRenderer.on('hsr:sync-progress', (_event, detail) => callback(detail));
  },
});
