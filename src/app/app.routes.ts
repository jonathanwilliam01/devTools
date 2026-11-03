import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'cards', loadComponent: () => import('./cards/cards').then((m) => m.Cards), title: 'Cards · devTools' },
  { path: 'notas', loadComponent: () => import('./notas/notas').then((m) => m.Notas), title: 'Notas · devTools' },
  { path: 'kanban', loadComponent: () => import('./kanban/kanban').then((m) => m.Kanban), title: 'Kanban · devTools' },
  { path: '**', redirectTo: 'cards' },
];
