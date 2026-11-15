const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hsrDesktop', {
  getState: () => ipcRenderer.invoke('hsr:state'),
  exportData: (options) => ipcRenderer.invoke('hsr:export', options),
  importArchive: () => ipcRenderer.invoke('hsr:import'),
  syncGame: () => ipcRenderer.invoke('hsr:sync'),
  copyText: (text) => ipcRenderer.invoke('hsr:copy', text),
  saveText: (options) => ipcRenderer.invoke('hsr:save', options),
  onSyncProgress: (callback) => {
    ipcRenderer.on('hsr:sync-progress', (_event, detail) => callback(detail));
  },
});
