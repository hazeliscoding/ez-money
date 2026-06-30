import { contextBridge, ipcRenderer } from 'electron';
import type { EzApi } from '../shared/types';

const api: EzApi = {
  health: () => ipcRenderer.invoke('health'),
  categories: () => ipcRenderer.invoke('categories'),
  periods: () => ipcRenderer.invoke('periods'),
  listTransactions: (query) => ipcRenderer.invoke('transactions:list', query),
  createTransaction: (input) => ipcRenderer.invoke('transactions:create', input),
  updateTransaction: (id, patch) => ipcRenderer.invoke('transactions:update', id, patch),
  removeTransaction: (id) => ipcRenderer.invoke('transactions:remove', id),
  deletePeriod: (period) => ipcRenderer.invoke('periods:delete', period),
  renamePeriod: (oldPeriod, newPeriod) => ipcRenderer.invoke('periods:rename', oldPeriod, newPeriod),
  summary: (period) => ipcRenderer.invoke('summary:get', period),
  budgets: () => ipcRenderer.invoke('budgets:list'),
  updateBudgets: (list) => ipcRenderer.invoke('budgets:update', list),
  getRules: () => ipcRenderer.invoke('rules:get'),
  saveRules: (rules) => ipcRenderer.invoke('rules:save', rules),
  recategorize: () => ipcRenderer.invoke('transactions:recategorize'),
  importDialog: () => ipcRenderer.invoke('import:dialog'),
  importBytes: (bytes) => ipcRenderer.invoke('import:bytes', bytes),
};

contextBridge.exposeInMainWorld('api', api);
