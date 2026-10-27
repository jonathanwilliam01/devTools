import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './store';
import { Ui } from './ui';
import { Backup } from './backup';
import { Cofre } from './cofre';
import { hoje } from './models';
import { VERSAO } from './versao';
import { PainelDados } from './shell/painel-dados';
import { PainelCofre } from './shell/painel-cofre';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PainelDados, PainelCofre],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: { '(document:keydown)': 'tecla($event)' },
})
export class App {
  protected readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  protected readonly backup = inject(Backup);
  protected readonly cofre = inject(Cofre);
  private readonly router = inject(Router);
  protected readonly versao = VERSAO;
  protected readonly versaoData = new Date(VERSAO.data).toLocaleString('pt-BR');
  protected readonly tema = signal(lerTema());
  protected readonly atrasadas = computed(
    () => this.store.tarefas().filter((t) => t.status !== 'done' && t.prazo && t.prazo < hoje()).length,
  );

  constructor() {
    this.aplicarTema();
    navigator.storage?.persist?.();
  }

  alternarTema() {
    this.tema.update((t) => (t === 'dark' ? 'light' : 'dark'));
    this.aplicarTema();
  }

  private aplicarTema() {
    document.documentElement.dataset['theme'] = this.tema();
    try {
      localStorage.setItem('devtools:tema', this.tema());
    } catch {}
  }

  tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.ui.painel.set(null);
      this.ui.atalhos.next('esc');
      return;
    }
    const alvo = e.target as HTMLElement;
    if (e.ctrlKey || e.metaKey || e.altKey || this.ui.painel() || alvo.closest('input, textarea, select, [contenteditable]')) return;
    const rotas: Record<string, string> = { '1': '/cards', '2': '/notas', '3': '/kanban' };
    if (e.key === '/') document.querySelector<HTMLInputElement>('[data-busca]')?.focus();
    else if (e.key === 'n') this.ui.atalhos.next('novo');
    else if (e.key === '?') this.ui.painel.set('atalhos');
    else if (rotas[e.key]) this.router.navigateByUrl(rotas[e.key]);
    else return;
    e.preventDefault();
  }
}

function lerTema() {
  try {
    const t = localStorage.getItem('devtools:tema');
    if (t) return t;
  } catch {}
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
