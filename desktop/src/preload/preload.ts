import { contextBridge, ipcRenderer } from 'electron';
import type { EzApi } from '../shared/types';

const api: EzApi = {
  health: () => ipcRenderer.invoke('health'),
  categories: () => ipcRenderer.invoke('categories'),
  periods: () => ipcRenderer.invoke('periods'),
  listTransactions: (query) => ipcRenderer.invoke('transactions:list', query),
  updateTransaction: (id, patch) => ipcRenderer.invoke('transactions:update', id, patch),
  removeTransaction: (id) => ipcRenderer.invoke('transactions:remove', id),
  summary: (period) => ipcRenderer.invoke('summary:get', period),
  budgets: () => ipcRenderer.invoke('budgets:list'),
  updateBudgets: (list) => ipcRenderer.invoke('budgets:update', list),
  importDialog: () => ipcRenderer.invoke('import:dialog'),
  importBytes: (bytes) => ipcRenderer.invoke('import:bytes', bytes),
};

contextBridge.exposeInMainWorld('api', api);
