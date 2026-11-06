import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Store } from './store';

// menu escondido em Dados manda para o primeiro visível
const menuVisivel: CanActivateFn = (r) => {
  const visiveis = inject(Store).menusVisiveis();
  const id = r.routeConfig?.path?.split('/')[0];
  return visiveis.some((m) => m.id === id) || inject(Router).createUrlTree(['/', visiveis[0].id]);
};

export const routes: Routes = [
  { path: 'cards', canActivate: [menuVisivel], loadComponent: () => import('./cards/cards').then((m) => m.Cards), title: 'Cards · devTools' },
  { path: 'notas', canActivate: [menuVisivel], loadComponent: () => import('./notas/notas').then((m) => m.Notas), title: 'Notas · devTools' },
  { path: 'kanban', canActivate: [menuVisivel], loadComponent: () => import('./kanban/kanban').then((m) => m.Kanban), title: 'Kanban · devTools' },
  { path: 'ferramentas/:id', canActivate: [menuVisivel], loadComponent: () => import('./ferramentas/ferramentas').then((m) => m.Ferramentas), title: 'Ferramentas · devTools' },
  { path: 'ferramentas', canActivate: [menuVisivel], loadComponent: () => import('./ferramentas/ferramentas').then((m) => m.Ferramentas), title: 'Ferramentas · devTools' },
  { path: '**', redirectTo: 'cards' },
];
