const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hsrDesktop', {
  getState: () => ipcRenderer.invoke('hsr:state'),
  getInventoryCatalog: () => ipcRenderer.invoke('hsr:inventory-catalog'),
  exportSelectedInventory: (request) => ipcRenderer.invoke('hsr:inventory-export', request),
  saveSelectedInventory: (request) => ipcRenderer.invoke('hsr:inventory-save', request),
  saveAnalysisPreferences: (text) => ipcRenderer.invoke('hsr:analysis-preferences-save', text),
  importArchive: () => ipcRenderer.invoke('hsr:import'),
  syncGame: () => ipcRenderer.invoke('hsr:sync'),
  onSyncProgress: (callback) => {
    ipcRenderer.on('hsr:sync-progress', (_event, detail) => callback(detail));
  },
});
