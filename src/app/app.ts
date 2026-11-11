import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './store';
import { Ui } from './ui';
import { Backup } from './backup';
import { Cofre } from './cofre';
import { chaveNome, hoje, novoId } from './models';
import { Github } from './github';
import { VERSAO } from './versao';
import { ehNova, FERRAMENTAS } from './ferramentas/catalogo';
import { PainelDados } from './shell/painel-dados';
import { PainelCofre } from './shell/painel-cofre';
import { PainelNovidades } from './shell/painel-novidades';
import { Paleta } from './shell/paleta';
import { NOVIDADES, marcarVisto, pendentes } from './novidades';
import { iniciarPonte } from './ponte';
import { Notificar } from './notificar';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PainelDados, PainelCofre, PainelNovidades, Paleta],
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
  private readonly github = inject(Github);
  private readonly notificar = inject(Notificar);
  protected readonly versao = VERSAO;
  protected readonly versaoData = new Date(VERSAO.data).toLocaleString('pt-BR');
  protected readonly MODOS = MODOS;
  protected readonly CORES_TEMA = CORES_TEMA;
  protected readonly tema = signal(lerTema());
  protected readonly cor = signal(lerPref('devtools:cor') ?? 'azul');
  protected readonly menuTema = signal(false);
  // abre sozinho na primeira carga de uma versão nova, em qualquer tela
  protected readonly novidades = signal(pendentes(VERSAO.numero));
  protected readonly atrasadas = computed(
    () => this.store.tarefas().filter((t) => t.status !== 'done' && t.prazo && t.prazo < hoje()).length,
  );

  protected readonly temNova = computed(() => FERRAMENTAS.some((f) => ehNova(f, this.store.config().vistas)));

  protected visivel(id: string) {
    return this.store.menusVisiveis().some((m) => m.id === id);
  }

  constructor() {
    this.aplicarTema();
    iniciarPonte();
    navigator.storage?.persist?.();
    // no celular nav e lista de ferramentas rolam na horizontal: mantém o item ativo à vista
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd)
        setTimeout(() => document.querySelectorAll('nav a.ativo, .ferr-lista a.ativo').forEach((a) => a.scrollIntoView({ block: 'nearest', inline: 'nearest' })));
    });
    // espera a restauração dos cookies antes da primeira checagem
    setTimeout(() => this.sincronizarIssues(), 3000);
    setInterval(() => this.sincronizarIssues(), 5 * 60_000);
  }

  // issue atribuída nova vira tarefa em "A fazer"
  private async sincronizarIssues() {
    const l = await this.github.atribuidas();
    if (!l) return;
    await this.adicionarAtribuidas(l);
    await this.registrarValidados();
  }

  // tarefa de card que foi para Validar no quadro vira card registrado; card já registrado não repete (demanda que volta)
  private async registrarValidados() {
    const registrados = new Set(this.store.cards().map((c) => c.numero));
    const tarefas = this.store.tarefas().filter((t) => t.tipo === 'card' && t.numeroCard && !registrados.has(t.numeroCard));
    const status = await this.github.statusProjeto([...new Set(tarefas.map((t) => t.numeroCard!))]);
    for (const t of tarefas) {
      const s = status.get(t.numeroCard!);
      if (!s || !chaveNome(s.status).includes('VALIDA') || this.store.cards().some((c) => c.numero === t.numeroCard)) continue;
      const i = await this.github.issue(t.numeroCard!);
      if (!i) continue;
      const obs = (await this.github.trabalhoExecutado(t.numeroCard!, i.descricao)) || t.trabalho || '';
      const campos = this.store.camposDaIssue(i);
      this.store.salvarCard({
        id: `c-${t.numeroCard}-${s.data}`,
        numero: t.numeroCard!,
        descricao: t.titulo,
        ...campos,
        data: s.data,
        obs,
        ...(!campos.linguagem || !obs ? { incompleto: true } : {}),
      });
      const falta = [!campos.linguagem && 'linguagem', !obs && 'o que foi feito'].filter(Boolean).join(' e ');
      this.ui.avisar(`Card #${t.numeroCard} registrado` + (falta ? ` (incompleto: falta ${falta})` : ''));
      this.notificar.enviar(`Card #${t.numeroCard} registrado no histórico`, t.titulo + (falta ? `\nIncompleto: falta ${falta}` : ''), '/cards');
    }
  }

  private async adicionarAtribuidas(l: { numero: number; titulo: string; descricao: string }[]) {
    const vistas = new Set(this.store.config().issuesVistas ?? []);
    const conhecidas = new Set<number | null | undefined>([
      ...this.store.tarefas().map((t) => t.numeroCard),
      ...this.store.cards().map((c) => c.numero),
    ]);
    const novas = l.filter((i) => !vistas.has(i.numero) && !conhecidas.has(i.numero));
    const atuais = l.map((i) => i.numero).sort((a, b) => a - b);
    if (atuais.join() !== [...vistas].sort((a, b) => a - b).join()) {
      this.store.config.update((c) => ({ ...c, issuesVistas: atuais }));
    }
    if (!novas.length) return;
    this.store.setTarefas([
      ...novas.map((i) => ({
        id: novoId(),
        titulo: i.titulo,
        descricao: i.descricao,
        status: 'todo' as const,
        prioridade: 'media' as const,
        tipo: 'card' as const,
        numeroCard: i.numero,
        criado: hoje(),
      })),
      ...this.store.tarefas(),
    ]);
    const msg = novas.length === 1 ? `Issue #${novas[0].numero} adicionada ao kanban` : `${novas.length} issues adicionadas ao kanban`;
    this.ui.avisar(msg);
    this.notificar.enviar(msg, novas.map((i) => `#${i.numero} ${i.titulo}`).join('\n'), '/kanban');
  }

  // issue nova no repo do devTools, já com versão e tela atual
  protected urlBug() {
    const corpo = `**O que aconteceu**\n\n\n**Como reproduzir**\n1. \n\n---\nVersão: v${VERSAO.numero}${VERSAO.commit ? ' · ' + VERSAO.commit : ''}\nTela: ${this.router.url}\nNavegador: ${navigator.userAgent}`;
    return `${REPO_DEVTOOLS}/issues/new?body=${encodeURIComponent(corpo)}`;
  }

  abrirNovidades() {
    this.novidades.set(NOVIDADES);
  }

  fecharNovidades() {
    marcarVisto(VERSAO.numero);
    this.novidades.set([]);
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
      if (this.novidades().length) return this.fecharNovidades();
      this.ui.painel.set(null);
      this.menuTema.set(false);
      this.ui.atalhos.next('esc');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.ui.painel.set(this.ui.painel() === 'paleta' ? null : 'paleta');
      return;
    }
    const alvo = e.target as HTMLElement;
    if (e.ctrlKey || e.metaKey || e.altKey || this.ui.painel() || this.novidades().length || alvo.closest('input, textarea, select, [contenteditable]')) return;
    const menu = this.store.menusVisiveis().find((m) => m.tecla === e.key);
    if (e.key === '/') document.querySelector<HTMLInputElement>('[data-busca]')?.focus();    else if (e.key === 'n') this.ui.atalhos.next('novo');
    else if (e.key === '?') this.ui.painel.set('atalhos');
    else if (e.key === '0') this.router.navigateByUrl('/inicio');
    else if (menu) this.router.navigateByUrl('/' + menu.id);
    else return;
    e.preventDefault();
  }
}

const REPO_DEVTOOLS = 'https://github.com/jonathanwilliam01/devTools';

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
  { valor: 'roxo', dark: '#b293ff', light: '#7c4dcc' },
  { valor: 'laranja', dark: '#ff9e5c', light: '#c4570f' },
  { valor: 'rosa', dark: '#ff7ab8', light: '#c2367a' },
  { valor: 'ciano', dark: '#4fd1de', light: '#0f7f8f' },
  { valor: 'grafite', dark: '#b0b8c4', light: '#4b5563' },
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
