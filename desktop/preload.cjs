const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('desktop', Object.freeze({
  agents: () => ipcRenderer.invoke('desktop:agents'),
  agentCreate: (name, max, daily) => ipcRenderer.invoke('desktop:agent-create', name, max, daily),
  agentControl: (id, operation) => ipcRenderer.invoke('desktop:agent-control', id, operation),
  agentCopy: id => ipcRenderer.invoke('desktop:agent-copy', id),
  state: () => ipcRenderer.invoke('desktop:state'),
  save: input => ipcRenderer.invoke('desktop:save', input),
  secret: (account, value) => ipcRenderer.invoke('desktop:secret', account, value),
  wallets: () => ipcRenderer.invoke('desktop:wallets'),
  mcp: () => ipcRenderer.invoke('desktop:mcp'),
}))
