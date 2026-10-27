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
  host: { '(document:keydown)': 'tecla($event)', '(document:click)': 'menuTema.set(false)' },
})
export class App {
  protected readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  protected readonly backup = inject(Backup);
  protected readonly cofre = inject(Cofre);
  private readonly router = inject(Router);
  protected readonly versao = VERSAO;
  protected readonly versaoData = new Date(VERSAO.data).toLocaleString('pt-BR');
  protected readonly MODOS = MODOS;
  protected readonly CORES_TEMA = CORES_TEMA;
  protected readonly tema = signal(lerTema());
  protected readonly cor = signal(lerPref('devtools:cor') ?? 'azul');
  protected readonly menuTema = signal(false);
  protected readonly atrasadas = computed(
    () => this.store.tarefas().filter((t) => t.status !== 'done' && t.prazo && t.prazo < hoje()).length,
  );

  constructor() {
    this.aplicarTema();
    navigator.storage?.persist?.();
  }

  escolherTema(tema: Modo, cor: string) {
    this.tema.set(tema);
    this.cor.set(cor);
    this.menuTema.set(false);
    this.aplicarTema();
  }

  private aplicarTema() {
    document.documentElement.dataset['theme'] = this.tema();
    document.documentElement.dataset['cor'] = this.cor();
    try {
      localStorage.setItem('devtools:tema', this.tema());
      localStorage.setItem('devtools:cor', this.cor());
    } catch {}
  }

  tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.ui.painel.set(null);
      this.menuTema.set(false);
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

type Modo = 'dark' | 'light';

const MODOS: { valor: Modo; label: string }[] = [
  { valor: 'dark', label: 'Escuro' },
  { valor: 'light', label: 'Claro' },
];

// mesmos tons de --acento do styles.css
const CORES_TEMA = [
  { valor: 'azul', dark: '#6fa3ff', light: '#2f6fde' },
  { valor: 'vermelho', dark: '#ff7b84', light: '#c9363e' },
  { valor: 'verde', dark: '#5ccf7f', light: '#2b8a47' },
];

function lerPref(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function lerTema(): Modo {
  const t = lerPref('devtools:tema');
  if (t === 'dark' || t === 'light') return t;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
