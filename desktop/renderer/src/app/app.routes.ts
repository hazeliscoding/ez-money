import { Routes } from '@angular/router';

/**
 * Route table for the app. Each page is a standalone component lazy-loaded via
 * `loadComponent`, so it ships in its own chunk and is only fetched on first
 * visit. `title` sets the window/document title per page. The app defaults to
 * the dashboard, and any unknown path falls back to it (see the `**` route).
 * Note: hash-based routing is configured in app.config.ts (see withHashLocation).
 */
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
    path: 'trends',
    title: 'Trends - ez-money',
    loadComponent: () =>
      import('./pages/trends.component').then((m) => m.TrendsComponent),
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
  {
    path: 'settings',
    title: 'Settings - ez-money',
    loadComponent: () =>
      import('./pages/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
