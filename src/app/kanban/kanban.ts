import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Store } from '../store';
import { Ui } from '../ui';
import { COLUNAS, ISSUE_URL, PRIORIDADES, Prioridade, Status, TIPOS, Tarefa, Tipo, dataBr, diasEntre, hoje, novoId } from '../models';

@Component({
  selector: 'app-kanban',
  imports: [FormsModule, CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './kanban.html',
  styleUrl: './kanban.css',
})
export class Kanban {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  protected readonly ui = inject(Ui);
  protected readonly COLUNAS = COLUNAS;
  protected readonly PRIORIDADES = PRIORIDADES;
  protected readonly TIPOS = TIPOS;
  protected readonly ISSUE_URL = ISSUE_URL;

  protected readonly busca = signal('');
  protected readonly tipo = signal<Tipo | ''>('');
  protected readonly prioridade = signal<Prioridade | ''>('');
  protected readonly rapida = signal('');
  protected readonly form = signal<Tarefa | null>(null);

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
  protected readonly atrasadas = computed(
    () => this.store.tarefas().filter((t) => t.status !== 'done' && t.prazo && t.prazo < hoje()).length,
  );

  constructor() {
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') this.form.set(null);
      else if (a === 'novo' && !this.form()) this.nova();
    });
  }

  prazo(t: Tarefa): { texto: string; nivel: string } | null {
    if (!t.prazo) return null;
    if (t.status === 'done') return { texto: dataBr(t.prazo).slice(0, 5), nivel: 'ok' };
    const d = diasEntre(hoje(), t.prazo);
    if (d < 0) return { texto: `atrasada ${-d}d`, nivel: 'atrasada' };
    if (d === 0) return { texto: 'vence hoje', nivel: 'hoje' };
    if (d <= 2) return { texto: d === 1 ? 'amanhã' : `em ${d}d`, nivel: 'proxima' };
    return { texto: dataBr(t.prazo).slice(0, 5), nivel: 'ok' };
  }

  soltar(ev: CdkDragDrop<Tarefa[]>, destino: Status) {
    const cols = Object.fromEntries(COLUNAS.map((c) => [c.status, [...this.colunas()[c.status]]])) as Record<Status, Tarefa[]>;
    const origem = ev.previousContainer.id as Status;
    if (origem === destino) {
      moveItemInArray(cols[destino], ev.previousIndex, ev.currentIndex);
    } else {
      transferArrayItem(cols[origem], cols[destino], ev.previousIndex, ev.currentIndex);
      const t = cols[destino][ev.currentIndex];
      cols[destino][ev.currentIndex] = {
        ...t,
        status: destino,
        concluido: destino === 'done' ? hoje() : null,
      };
    }
    const ocultas = this.store.tarefas().filter((t) => !this.visivel(t));
    this.store.setTarefas([...COLUNAS.flatMap((c) => cols[c.status]), ...ocultas]);
  }

  // "#1234 titulo" ou "1234 titulo" já vira tarefa do tipo card
  adicionarRapida() {
    const txt = this.rapida().trim();
    if (!txt) return;
    const m = txt.match(/^#?(\d{3,})\s*[-–:]?\s*(.*)$/);
    this.store.setTarefas([
      {
        id: novoId(),
        titulo: m ? m[2] || `Card #${m[1]}` : txt,
        descricao: '',
        status: 'todo',
        prioridade: 'media',
        tipo: m ? 'card' : 'ajuda',
        numeroCard: m ? +m[1] : null,
        criado: hoje(),
      },
      ...this.store.tarefas(),
    ]);
    this.rapida.set('');
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
    this.form.set({ ...t });
  }

  salvar() {
    const f = this.form();
    if (!f || !f.titulo.trim()) return;
    const antes = this.store.tarefas().find((t) => t.id === f.id);
    if (f.status === 'done' && antes?.status !== 'done') f.concluido = hoje();
    if (f.status !== 'done') f.concluido = null;
    const t = { ...f, titulo: f.titulo.trim(), numeroCard: f.numeroCard ? +f.numeroCard : null, prazo: f.prazo || null };
    if (antes) this.store.salvarTarefa(t);
    else this.store.setTarefas([t, ...this.store.tarefas()]);
    this.form.set(null);
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
      obs: t.descricao,
      data: t.concluido ?? hoje(),
    });
    this.router.navigate(['/cards']);
  }

  label<T extends { valor: string; label: string }>(lista: T[], valor: string) {
    return lista.find((x) => x.valor === valor)?.label ?? valor;
  }
}
