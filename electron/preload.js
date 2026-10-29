'use strict';
// The only things the page can ask the desktop app to do directly
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('roundtableApp', {
  /** Download the parts of a claude.ai export (signing in to claude.ai if needed) and import them. */
  importClaudeExport: files => ipcRenderer.invoke('claude-export', files),
  onImportProgress: cb => ipcRenderer.on('claude-export-progress', (_, msg) => cb(msg)),
});
