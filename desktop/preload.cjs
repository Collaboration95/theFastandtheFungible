const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  state: () => ipcRenderer.invoke('desktop:state'),
  save: input => ipcRenderer.invoke('desktop:save', input),
  secret: (account, value) => ipcRenderer.invoke('desktop:secret', account, value),
  wallets: () => ipcRenderer.invoke('desktop:wallets'),
  mcp: () => ipcRenderer.invoke('desktop:mcp'),
}))
