const { contextBridge, ipcRenderer } = require('electron');
const invoke = channel => (...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  minimize: invoke('window:minimize'), maximize: invoke('window:maximize'), close: invoke('window:close'),
  selectFolder: invoke('download:select-folder'), openFolder: invoke('download:open-folder'),
  openFile: invoke('download:open-file'), getInfo: invoke('app:info'),
  retry: invoke('app:retry'), details: invoke('app:details'),
  readClipboard: invoke('clipboard:read'),
  download: invoke('download:start'),
  onStatus(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('app:status', listener);
    return () => ipcRenderer.removeListener('app:status', listener);
  },
  onDownload(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('download:status', listener);
    return () => ipcRenderer.removeListener('download:status', listener);
  }
}));
