const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hsrDesktop', {
  getState: () => ipcRenderer.invoke('hsr:state'),
  exportData: (options) => ipcRenderer.invoke('hsr:export', options),
  importArchive: () => ipcRenderer.invoke('hsr:import'),
  importSavedShowcase: () => ipcRenderer.invoke('hsr:showcase-import'),
  saveManualSheet: (id, values) => ipcRenderer.invoke('hsr:manual-save', { id, values }),
  clearManualSheet: (id) => ipcRenderer.invoke('hsr:manual-clear', id),
  syncGame: () => ipcRenderer.invoke('hsr:sync'),
  copyText: (text) => ipcRenderer.invoke('hsr:copy', text),
  saveText: (options) => ipcRenderer.invoke('hsr:save', options),
  onSyncProgress: (callback) => {
    ipcRenderer.on('hsr:sync-progress', (_event, detail) => callback(detail));
  },
});
