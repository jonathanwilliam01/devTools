import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Store } from '../store';
import { Ui } from '../ui';
import { Github } from '../github';
import { temHtml } from '../markdown';
import { prefSignal } from '../pref';
import { LISTAS, Vistas } from '../vistas';
import { COLUNAS, ISSUE_URL, PRIORIDADES, Prioridade, Status, TIPOS, Tarefa, Tipo, hoje, mudarStatus, novoId, pessoaTarefa, prazoTarefa, tarefaRapida, tempoTarefa } from '../models';
import { CampoTiflux, TICKET_URL, camposTiflux, ticketTarefa } from './tiflux';

@Component({
  selector: 'app-kanban',
  imports: [FormsModule, NgTemplateOutlet, CdkDropListGroup, CdkDropList, CdkDrag, Vistas],
  templateUrl: './kanban.html',
  styleUrl: './kanban.css',
})
export class Kanban {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly ui = inject(Ui);
  private readonly github = inject(Github);
  protected readonly COLUNAS = COLUNAS;
  protected readonly PRIORIDADES = PRIORIDADES;
  protected readonly TIPOS = TIPOS;
  protected readonly ISSUE_URL = ISSUE_URL;

  protected readonly busca = signal('');
  protected readonly tipo = signal<Tipo | ''>('');
  protected readonly prioridade = signal<Prioridade | ''>('');
  protected readonly rapida = signal('');
  protected readonly form = signal<Tarefa | null>(null);
  protected readonly verHtml = signal(true);
  // tarefa de card recém-concluída esperando o "trabalho executado"
  protected readonly concluindo = signal<Tarefa | null>(null);
  protected readonly trabalhoTxt = signal('');
  protected readonly novoItem = signal('');
  // atualiza o tempo das tarefas em "Fazendo"
  private readonly tick = signal(0);
  protected readonly TICKET_URL = TICKET_URL;
  protected readonly ticket = ticketTarefa;
  protected readonly pessoa = pessoaTarefa;
  private readonly cacheCampos = new Map<string, CampoTiflux[]>();

  protected readonly VISTAS = [{ v: 'quadro', i: '▥', t: 'Quadro' }, ...LISTAS] as const;
  protected readonly vista = prefSignal('devtools:kanban-vista', 'quadro' as 'quadro' | 'baixo' | 'lado', ['quadro', 'baixo', 'lado']);
  protected readonly selId = signal<string | null>(null);
  protected readonly selecionada = computed(() => {
    const l = COLUNAS.flatMap((c) => this.colunas()[c.status]);
    return l.find((t) => t.id === this.selId()) ?? l[0] ?? null;
  });

  private readonly visivel = (t: Tarefa) => {
    const b = this.busca().toLowerCase().trim();
    return (
      (!this.tipo() || t.tipo === this.tipo()) &&
      (!this.prioridade() || t.prioridade === this.prioridade()) &&
      (!b || `${t.titulo} ${t.descricao} ${t.numeroCard ?? ''}`.toLowerCase().includes(b))
    );
  };

  protected readonly colunas = computed(() => {
    const visiveis = this.store.tarefas().filter(this.visivel);
    return Object.fromEntries(COLUNAS.map((c) => [c.status, visiveis.filter((t) => t.status === c.status)])) as Record<
      Status,
      Tarefa[]
    >;
  });

  private readonly registrados = computed(() => new Set(this.store.cards().map((c) => c.numero)));
  protected readonly pessoas = computed(() =>
    [...new Set(this.store.tarefas().filter((t) => t.tipo === 'ajuda').map(pessoaTarefa).filter(Boolean))].sort(),
  );

  // ajudas do mês por pessoa (concluídas no mês ou criadas no mês)
  protected readonly ajudasMes = computed(() => {
    const mes = hoje().slice(0, 7);
    const cont = new Map<string, number>();
    for (const t of this.store.tarefas()) {
      if (t.tipo !== 'ajuda' || !(t.concluido ?? t.criado).startsWith(mes)) continue;
      const p = pessoaTarefa(t) || 'sem nome';
      cont.set(p, (cont.get(p) ?? 0) + 1);
    }
    const l = [...cont].sort((a, b) => b[1] - a[1]);
    return { total: l.reduce((s, [, n]) => s + n, 0), texto: l.map(([p, n]) => `${p}: ${n}`).join('\n') };
  });

  protected readonly atrasadas = computed(
    () => this.store.tarefas().filter((t) => t.status !== 'done' && t.prazo && t.prazo < hoje()).length,
  );

  constructor() {
    const timer = setInterval(() => this.tick.update((n) => n + 1), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') {
        this.form.set(null);
        this.concluindo.set(null);
      }
      else if (a === 'novo' && !this.form() && !this.concluindo()) this.nova();
    });
  }

  protected readonly prazo = prazoTarefa;

  soltar(ev: CdkDragDrop<Tarefa[]>, destino: Status) {
    const cols = Object.fromEntries(COLUNAS.map((c) => [c.status, [...this.colunas()[c.status]]])) as Record<Status, Tarefa[]>;
    const origem = ev.previousContainer.id as Status;
    if (origem === destino) {
      moveItemInArray(cols[destino], ev.previousIndex, ev.currentIndex);
    } else {
      transferArrayItem(cols[origem], cols[destino], ev.previousIndex, ev.currentIndex);
      cols[destino][ev.currentIndex] = mudarStatus(cols[destino][ev.currentIndex], destino);
    }
    const ocultas = this.store.tarefas().filter((t) => !this.visivel(t));
    this.store.setTarefas([...COLUNAS.flatMap((c) => cols[c.status]), ...ocultas]);
    if (origem !== destino) this.aoConcluir(cols[destino][ev.currentIndex]);
  }

  // card concluído pede o "trabalho executado", que vira o obs ao registrar
  private aoConcluir(t: Tarefa) {
    if (t.status !== 'done' || t.tipo !== 'card' || !t.numeroCard || this.registrados().has(t.numeroCard)) return;
    this.trabalhoTxt.set(t.trabalho ?? '');
    this.concluindo.set(t);
  }

  salvarTrabalho(registrar: boolean) {
    const c = this.concluindo();
    if (!c) return;
    const t = { ...(this.store.tarefas().find((x) => x.id === c.id) ?? c), trabalho: this.trabalhoTxt().trim() };
    this.store.salvarTarefa(t);
    this.concluindo.set(null);
    if (registrar) this.registrarCard(t);
  }

  campos(t: Tarefa) {
    let c = this.cacheCampos.get(t.descricao);
    if (!c) this.cacheCampos.set(t.descricao, (c = camposTiflux(t.descricao)));
    return c;
  }

  campo(t: Tarefa, rotulo: string) {
    return this.campos(t).find((c) => c.rotulo === rotulo)?.valor ?? '';
  }

  tempo(t: Tarefa) {
    this.tick();
    return tempoTarefa(t);
  }

  progresso(t: Tarefa) {
    const l = t.checklist ?? [];
    return l.length ? `${l.filter((i) => i.feito).length}/${l.length}` : '';
  }

  alternarItem(t: Tarefa, id: string) {
    this.store.salvarTarefa({ ...t, checklist: (t.checklist ?? []).map((i) => (i.id === id ? { ...i, feito: !i.feito } : i)) });
  }

  addItem(f: Tarefa, e?: Event) {
    e?.preventDefault();
    const texto = this.novoItem().trim();
    if (!texto) return;
    f.checklist = [...(f.checklist ?? []), { id: novoId(), texto, feito: false }];
    this.novoItem.set('');
  }

  removerItem(f: Tarefa, i: number) {
    f.checklist = (f.checklist ?? []).filter((_, j) => j !== i);
  }

  // "#1234 titulo" ou "1234 titulo" já vira tarefa do tipo card
  adicionarRapida() {
    const r = tarefaRapida(this.rapida());
    if (!r) return;
    this.store.setTarefas([r.tarefa, ...this.store.tarefas()]);
    this.rapida.set('');
    if (r.buscar) this.preencherDoGithub(r.tarefa.id, r.buscar);
  }

  // só número informado: título e descrição vêm da issue
  private async preencherDoGithub(id: string, n: number) {
    const i = await this.github.issue(n);
    const t = this.store.tarefas().find((x) => x.id === id);
    if (i && t) this.store.salvarTarefa({ ...t, titulo: i.titulo, descricao: t.descricao || i.descricao });
  }

  async buscarIssue(f: Tarefa) {
    const n = +(f.numeroCard ?? 0);
    if (!n || f.titulo.trim()) return;
    const i = await this.github.issue(n);
    if (!i) return;
    this.form.update((x) =>
      x?.id === f.id && !x.titulo.trim() ? { ...x, titulo: i.titulo, descricao: x.descricao || i.descricao } : x,
    );
  }

  nova(status: Status = 'todo') {
    this.form.set({
      id: novoId(),
      titulo: '',
      descricao: '',
      status,
      prioridade: 'media',
      tipo: 'card',
      numeroCard: null,
      prazo: null,
      criado: hoje(),
    });
  }

  editar(t: Tarefa) {
    this.verHtml.set(true);
    this.novoItem.set('');
    this.form.set({ ...t, checklist: (t.checklist ?? []).map((i) => ({ ...i })) });
  }

  protected readonly temHtml = temHtml;

  // primeira linha da descrição, sem html
  resumo(t: Tarefa) {
    const d = temHtml(t.descricao) ? new DOMParser().parseFromString(t.descricao, 'text/html').body.textContent ?? '' : t.descricao;
    return d.trim().split('\n')[0];
  }

  mover(t: Tarefa, status: Status) {
    if (t.status === status) return;
    const novo = mudarStatus(t, status);
    this.store.salvarTarefa(novo);
    this.aoConcluir(novo);
  }

  salvar() {
    const f = this.form();
    if (!f || !f.titulo.trim()) return;
    this.addItem(f);
    const antes = this.store.tarefas().find((t) => t.id === f.id);
    // status trocado no formulário passa pela mesma regra do arrastar
    const base = antes ? { ...f, status: antes.status, concluido: antes.concluido, tempo: antes.tempo, inicio: antes.inicio } : { ...f, status: 'todo' as Status, inicio: null };
    const t = {
      ...mudarStatus(base, f.status),
      titulo: f.titulo.trim(),
      numeroCard: f.numeroCard ? +f.numeroCard : null,
      prazo: f.prazo || null,
      pessoa: f.tipo === 'ajuda' ? f.pessoa?.trim() || undefined : undefined,
      checklist: f.checklist?.length ? f.checklist : undefined,
    };
    this.selId.set(t.id);
    if (antes) this.store.salvarTarefa(t);
    else this.store.setTarefas([t, ...this.store.tarefas()]);
    this.form.set(null);
    if (antes?.status !== 'done' && !t.trabalho) this.aoConcluir(t);
  }

  existe(t: Tarefa) {
    return this.store.tarefas().some((x) => x.id === t.id);
  }

  remover(t: Tarefa) {
    if (confirm(`Remover "${t.titulo}"?`)) {
      this.store.removerTarefa(t.id);
      this.form.set(null);
    }
  }

  limparConcluidos() {
    const n = this.colunas().done.length;
    if (n && confirm(`Remover ${n} tarefa(s) concluída(s)?`)) {
      this.store.setTarefas(this.store.tarefas().filter((t) => t.status !== 'done'));
    }
  }

  podeRegistrar(t: Tarefa) {
    return t.status === 'done' && t.tipo === 'card' && !!t.numeroCard && !this.registrados().has(t.numeroCard);
  }

  registrarCard(t: Tarefa) {
    this.store.rascunhoCard.set({
      numero: t.numeroCard ?? 0,
      descricao: t.titulo,
      obs: t.trabalho ?? '',
      data: t.concluido ?? hoje(),
    });
    this.router.navigate(['/cards']);
  }

  label<T extends { valor: string; label: string }>(lista: T[], valor: string) {
    return lista.find((x) => x.valor === valor)?.label ?? valor;
  }
}
