import { Injectable, computed, effect, signal } from '@angular/core';
import { Card, Config, Dados, Nota, Sistema, Tarefa, chaveNome, novoId, partes } from './models';
import { StatusCookie, lerCookies, salvarCookies } from './persist';

const CHAVE = 'devtools:dados';

@Injectable({ providedIn: 'root' })
export class Store {
  readonly cards = signal<Card[]>([]);
  readonly sistemas = signal<Sistema[]>([]);
  readonly notas = signal<Nota[]>([]);
  readonly tarefas = signal<Tarefa[]>([]);
  readonly vars = signal<Record<string, string>>({});
  readonly config = signal<Config>({});
  // card vindo do kanban para abrir pré-preenchido na tela de cards
  readonly rascunhoCard = signal<Partial<Card> | null>(null);
  readonly statusCookie = signal<StatusCookie | null>(null);
  readonly restaurado = signal('');

  readonly snapshot = computed<Dados>(() => ({
    versao: 2,
    cards: this.cards(),
    sistemas: this.sistemas(),
    notas: this.notas(),
    tarefas: this.tarefas(),
    vars: this.vars(),
    config: this.config(),
  }));

  private timerCookie?: ReturnType<typeof setTimeout>;

  constructor() {
    const local = this.ler();
    if (local) this.carregar(local);
    else this.restaurarCookies();

    effect(() => {
      const d = this.snapshot();
      try {
        localStorage.setItem(CHAVE, JSON.stringify(d));
      } catch {}
      clearTimeout(this.timerCookie);
      this.timerCookie = setTimeout(async () => this.statusCookie.set(await salvarCookies(d)), 1500);
    });
  }

  private ler(): Partial<Dados> | null {
    try {
      const s = localStorage.getItem(CHAVE);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  private async restaurarCookies() {
    const d = await lerCookies();
    if (!d) return;
    this.carregar(d);
    const parcial = d.totalCards && d.cards!.length < d.totalCards;
    this.restaurado.set(
      `Dados restaurados dos cookies` +
        (parcial ? ` (${d.cards!.length} de ${d.totalCards} cards; importe um backup para o restante)` : ''),
    );
  }

  private carregar(d: Partial<Dados>) {
    this.sistemas.set(d.sistemas ?? []);
    this.cards.set((d.cards ?? []).map((c) => ({ ...c, sistema: this.normalizarSistemas(c.sistema) })));
    this.notas.set(d.notas ?? []);
    this.tarefas.set(d.tarefas ?? []);
    this.vars.set(d.vars ?? {});
    this.config.set(d.config ?? {});
    this.sincronizarSistemas();
  }

  // mescla por id: o importado sobrescreve o existente. Retorna aviso se a senha mestra difere.
  importar(d: Partial<Dados>, substituir: boolean): string {
    if (substituir) {
      this.carregar(d);
      return '';
    }
    const mesclar = <T extends { id: string }>(atual: T[], novos: T[] = []) => {
      const m = new Map(atual.map((x) => [x.id, x]));
      novos.forEach((x) => m.set(x.id, x));
      return [...m.values()];
    };
    this.sistemas.update((a) => mesclarSistemasPorNome(a, d.sistemas ?? []));
    this.cards.update((a) => mesclar(a, d.cards).map((c) => ({ ...c, sistema: this.normalizarSistemas(c.sistema) })));
    this.notas.update((a) => mesclar(a, d.notas));
    this.tarefas.update((a) => mesclar(a, d.tarefas));
    this.vars.update((v) => ({ ...d.vars, ...v }));
    this.sincronizarSistemas();
    const senhaArq = d.config?.senha;
    if (!senhaArq) return '';
    if (!this.config().senha) {
      this.config.update((c) => ({ ...c, senha: senhaArq }));
      return '';
    }
    return senhaArq.salt !== this.config().senha!.salt
      ? 'Atenção: o arquivo usa outra senha mestra; blocos secretos dele não poderão ser lidos.'
      : '';
  }

  salvarCard(c: Card) {
    this.cards.update((l) => upsert(l, { ...c, sistema: this.garantirSistemas(c.sistema) }));
  }
  removerCard(id: string) {
    this.cards.update((l) => l.filter((x) => x.id !== id));
  }

  // nome canônico pelo nome ou alias; desconhecido volta como veio
  normalizarSistema(nome: string) {
    const k = chaveNome(nome);
    if (!k) return '';
    const s = this.sistemas().find((s) => chaveNome(s.nome) === k || s.aliases.some((a) => chaveNome(a) === k));
    return s?.nome ?? nome.trim();
  }

  normalizarSistemas(lista: string) {
    return unicos(partes(lista).map((n) => this.normalizarSistema(n))).join(', ');
  }

  garantirSistemas(lista: string) {
    return unicos(partes(lista).map((n) => this.garantirSistema(n))).join(', ');
  }

  garantirSistema(nome: string) {
    const n = this.normalizarSistema(nome);
    if (n && !this.sistemas().some((s) => s.nome === n)) {
      this.sistemas.update((l) => [...l, { id: novoId(), nome: n, aliases: [] }]);
    }
    return n;
  }

  // sistemas antigos com vírgula viraram listas nos cards
  private sincronizarSistemas() {
    this.sistemas.update((l) => l.filter((s) => !s.nome.includes(',')));
    new Set(this.cards().flatMap((c) => partes(c.sistema))).forEach((n) => this.garantirSistema(n));
  }

  renomearSistema(id: string, novo: string) {
    const s = this.sistemas().find((x) => x.id === id);
    novo = novo.trim();
    if (!s || !novo || novo === s.nome) return;
    const outro = this.sistemas().find((x) => x.id !== id && chaveNome(x.nome) === chaveNome(novo));
    if (outro) return this.mesclarSistemas(id, outro.id);
    this.sistemas.update((l) =>
      l.map((x) => (x.id === id ? { ...x, nome: novo, aliases: unicos([...x.aliases, s.nome]) } : x)),
    );
    this.cards.update((l) => trocarSistema(l, s.nome, novo));
  }

  // origem vira alias do destino e os cards passam para o destino
  mesclarSistemas(origemId: string, destinoId: string) {
    const o = this.sistemas().find((x) => x.id === origemId);
    const d = this.sistemas().find((x) => x.id === destinoId);
    if (!o || !d || o === d) return;
    this.sistemas.update((l) =>
      l
        .filter((x) => x.id !== o.id)
        .map((x) => (x.id === d.id ? { ...x, aliases: unicos([...x.aliases, o.nome, ...o.aliases]) } : x)),
    );
    this.cards.update((l) => trocarSistema(l, o.nome, d.nome));
  }

  removerAlias(id: string, alias: string) {
    this.sistemas.update((l) => l.map((x) => (x.id === id ? { ...x, aliases: x.aliases.filter((a) => a !== alias) } : x)));
  }

  removerSistema(id: string) {
    this.sistemas.update((l) => l.filter((x) => x.id !== id));
  }

  salvarNota(n: Nota) {
    this.notas.update((l) => upsert(l, n));
  }
  removerNota(id: string) {
    this.notas.update((l) => l.filter((x) => x.id !== id));
  }

  salvarTarefa(t: Tarefa) {
    this.tarefas.update((l) => upsert(l, t));
  }
  removerTarefa(id: string) {
    this.tarefas.update((l) => l.filter((x) => x.id !== id));
  }
  setTarefas(l: Tarefa[]) {
    this.tarefas.set(l);
  }
}

function upsert<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  return i < 0 ? [...lista, item] : lista.map((x, j) => (j === i ? item : x));
}

const unicos = (l: string[]) => [...new Set(l)];

function trocarSistema(cards: Card[], de: string, para: string) {
  return cards.map((c) =>
    partes(c.sistema).includes(de)
      ? { ...c, sistema: unicos(partes(c.sistema).map((x) => (x === de ? para : x))).join(', ') }
      : c,
  );
}

function mesclarSistemasPorNome(atual: Sistema[], novos: Sistema[]) {
  const l = [...atual];
  novos.forEach((n) => {
    const i = l.findIndex((x) => chaveNome(x.nome) === chaveNome(n.nome));
    if (i < 0) l.push(n);
    else l[i] = { ...l[i], aliases: unicos([...l[i].aliases, ...n.aliases]) };
  });
  return l;
}
