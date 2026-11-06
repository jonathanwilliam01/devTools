import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Store } from './store';

// menu escondido em Dados manda para o início
const menuVisivel: CanActivateFn = (r) => {
  const id = r.routeConfig?.path?.split('/')[0];
  return inject(Store).menusVisiveis().some((m) => m.id === id) || inject(Router).createUrlTree(['/inicio']);
};

export const routes: Routes = [
  { path: 'inicio', loadComponent: () => import('./inicio/inicio').then((m) => m.Inicio), title: 'Início · devTools' },
  { path: 'cards', canActivate: [menuVisivel], loadComponent: () => import('./cards/cards').then((m) => m.Cards), title: 'Histórico · devTools' },
  { path: 'notas', canActivate: [menuVisivel], loadComponent: () => import('./notas/notas').then((m) => m.Notas), title: 'Notas · devTools' },
  { path: 'kanban', canActivate: [menuVisivel], loadComponent: () => import('./kanban/kanban').then((m) => m.Kanban), title: 'Kanban · devTools' },
  { path: 'ferramentas/:id', canActivate: [menuVisivel], loadComponent: () => import('./ferramentas/ferramentas').then((m) => m.Ferramentas), title: 'Ferramentas · devTools' },
  { path: 'ferramentas', canActivate: [menuVisivel], loadComponent: () => import('./ferramentas/ferramentas').then((m) => m.Ferramentas), title: 'Ferramentas · devTools' },
  { path: '**', redirectTo: 'inicio' },
];
