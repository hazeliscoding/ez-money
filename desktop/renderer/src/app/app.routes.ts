import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard - ez-money',
    loadComponent: () =>
      import('./pages/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'transactions',
    title: 'Transactions - ez-money',
    loadComponent: () =>
      import('./pages/transactions.component').then((m) => m.TransactionsComponent),
  },
  {
    path: 'budgets',
    title: 'Budgets - ez-money',
    loadComponent: () =>
      import('./pages/budgets.component').then((m) => m.BudgetsComponent),
  },
  {
    path: 'import',
    title: 'Import - ez-money',
    loadComponent: () =>
      import('./pages/import.component').then((m) => m.ImportComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
