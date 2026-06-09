const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("heroLinkAPI", {
  selectProjectFolder: () => ipcRenderer.invoke("select-project-folder"),
  getConfig: () => ipcRenderer.invoke("get-config"),
  setConfig: (partial) => ipcRenderer.invoke("set-config", partial),
  startServer: () => ipcRenderer.invoke("start-server"),
  stopServer: () => ipcRenderer.invoke("stop-server"),
  restartServer: () => ipcRenderer.invoke("restart-server"),
  getServerStatus: () => ipcRenderer.invoke("get-server-status"),
  onServerLog: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("server-log", handler);
    return () => ipcRenderer.removeListener("server-log", handler);
  },
  onServerStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("server-status-changed", handler);
    return () => ipcRenderer.removeListener("server-status-changed", handler);
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
