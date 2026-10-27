import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Card, ISSUE_URL, MESES, Sistema, chaveNome, dataBr, hoje, novoId } from '../models';

interface Grupo {
  mes: number;
  cards: Card[];
  total: number;
  anteriores: number;
  semanas: { n: number; qtd: number }[];
}

interface Barra {
  nome: string;
  qtd: number;
  pct: number;
}

const NOVO = '__novo';
const COLUNAS_PLANILHA = ['Número do Card', 'Descrição', 'Sistema', 'Área Tecnica', 'Time', 'Linguagem', 'Data conclusão', 'O que foi feito'];

@Component({
  selector: 'app-cards',
  imports: [FormsModule],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
})
export class Cards {
  protected readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  protected readonly MESES = MESES;
  protected readonly NOVO = NOVO;
  protected readonly dataBr = dataBr;
  protected readonly url = (c: Card) => ISSUE_URL + c.numero;

  protected readonly busca = signal('');
  protected readonly sistema = signal('');
  protected readonly mes = signal(0);
  protected readonly graficos = signal(lerPref('devtools:graficos', '1') === '1');
  protected readonly anos = computed(() => {
    const s = new Set(this.store.cards().map((c) => +c.data.slice(0, 4)));
    s.add(new Date().getFullYear());
    return [...s].sort((a, b) => b - a);
  });
  protected readonly ano = signal(new Date().getFullYear());

  protected readonly doAno = computed(() => this.store.cards().filter((c) => +c.data.slice(0, 4) === this.ano()));
  protected readonly porMes = computed(() => {
    const qtd = Array(12).fill(0) as number[];
    this.doAno().forEach((c) => qtd[mesDe(c) - 1]++);
    return qtd;
  });
  protected readonly maxMes = computed(() => Math.max(1, ...this.porMes()));

  protected readonly resumo = computed(() => {
    const qtd = this.porMes();
    const total = qtd.reduce((a, b) => a + b, 0);
    const atual = this.ano() === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    const comCards = qtd.filter((q) => q > 0).length || 1;
    return {
      total,
      mesAtual: qtd[atual - 1],
      nomeMes: MESES[atual - 1],
      anteriores: qtd.slice(0, atual - 1).reduce((a, b) => a + b, 0),
      media: Math.round((total / comCards) * 10) / 10,
    };
  });

  // base dos gráficos: ano + mês selecionado
  private readonly baseGraficos = computed(() => this.doAno().filter((c) => !this.mes() || mesDe(c) === this.mes()));
  protected readonly graficoSistemas = computed(() => barras(this.baseGraficos().map((c) => c.sistema)));
  protected readonly graficoLinguagens = computed(() => barras(this.baseGraficos().map((c) => c.linguagem)));

  protected readonly sistemas = computed(() => [...this.store.sistemas()].sort((a, b) => a.nome.localeCompare(b.nome)));
  protected readonly areas = computed(() => unicos(this.store.cards().map((c) => c.area)));
  protected readonly times = computed(() => unicos(this.store.cards().map((c) => c.time)));
  protected readonly linguagens = computed(() => unicos(this.store.cards().map((c) => c.linguagem)));

  protected readonly filtrados = computed(() => {
    const termo = normalizar(this.busca());
    return this.doAno().filter(
      (c) =>
        (!this.mes() || mesDe(c) === this.mes()) &&
        (!this.sistema() || c.sistema === this.sistema()) &&
        (!termo || normalizar(`${c.numero} ${c.descricao} ${c.sistema} ${c.linguagem} ${c.obs}`).includes(termo)),
    );
  });

  protected readonly grupos = computed<Grupo[]>(() => {
    const qtd = this.porMes();
    const mapa = new Map<number, Card[]>();
    this.filtrados().forEach((c) => mapa.set(mesDe(c), [...(mapa.get(mesDe(c)) ?? []), c]));
    return [...mapa.entries()]
      .sort(([a], [b]) => b - a)
      .map(([mes, cards]) => ({
        mes,
        cards: cards.sort((a, b) => b.data.localeCompare(a.data) || b.numero - a.numero),
        total: qtd[mes - 1],
        anteriores: qtd.slice(0, mes - 1).reduce((a, b) => a + b, 0),
        semanas: semanas(this.ano(), mes, this.doAno().filter((c) => mesDe(c) === mes)),
      }));
  });

  protected readonly form = signal<Card | null>(null);
  protected readonly novoSistema = signal(false);
  protected nomeNovoSistema = '';

  protected readonly painelSistemas = signal(false);
  protected nomeAdicionar = '';
  protected readonly contagemSistemas = computed(() => {
    const m = new Map<string, number>();
    this.store.cards().forEach((c) => m.set(c.sistema, (m.get(c.sistema) ?? 0) + 1));
    return m;
  });
  // nomes parecidos: iguais sem pontuação ou um começa com o outro
  protected readonly sugestoes = computed(() => {
    const l = this.sistemas();
    const k = (s: Sistema) => chaveNome(s.nome).replace(/[^A-Z0-9]/g, '');
    const qtd = this.contagemSistemas();
    const r: { origem: Sistema; destino: Sistema }[] = [];
    for (let i = 0; i < l.length; i++)
      for (let j = i + 1; j < l.length; j++) {
        const [a, b] = [k(l[i]), k(l[j])];
        if (a.length < 4 || b.length < 4 || !(a === b || a.startsWith(b) || b.startsWith(a))) continue;
        const [destino, origem] = (qtd.get(l[i].nome) ?? 0) >= (qtd.get(l[j].nome) ?? 0) ? [l[i], l[j]] : [l[j], l[i]];
        r.push({ origem, destino });
      }
    return r;
  });

  constructor() {
    const r = this.store.rascunhoCard();
    if (r) {
      this.store.rascunhoCard.set(null);
      this.novo(r);
    }
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') {
        this.form.set(null);
        this.painelSistemas.set(false);
      } else if (a === 'novo' && !this.form() && !this.painelSistemas()) this.novo();
    });
  }

  novo(base: Partial<Card> = {}) {
    this.novoSistema.set(false);
    this.form.set({
      id: novoId(),
      numero: 0,
      descricao: '',
      sistema: '',
      area: '',
      time: '',
      linguagem: '',
      data: hoje(),
      obs: '',
      ...base,
    });
  }

  editar(c: Card) {
    this.novoSistema.set(false);
    this.form.set({ ...c });
  }

  escolherSistema(f: Card, valor: string) {
    if (valor === NOVO) {
      this.novoSistema.set(true);
      this.nomeNovoSistema = '';
    } else {
      this.novoSistema.set(false);
      f.sistema = valor;
    }
  }

  // form é mutado pelo ngModel, por isso método e não computed
  duplicado(f: Card) {
    return !!f.numero && this.store.cards().some((c) => c.numero === +f.numero && c.id !== f.id);
  }

  salvar() {
    const f = this.form();
    if (!f || !f.numero || !f.data) return;
    const sistema = this.novoSistema() ? this.nomeNovoSistema : f.sistema;
    // id previsível comprime melhor nos cookies
    const ids = new Set(this.store.cards().map((c) => c.id));
    const padrao = `c-${+f.numero}-${f.data}`;
    const id = ids.has(f.id) || ids.has(padrao) ? f.id : padrao;
    this.store.salvarCard({ ...f, id, sistema, numero: +f.numero, descricao: f.descricao.trim() });
    this.ano.set(+f.data.slice(0, 4));
    this.form.set(null);
    this.ui.avisar('Card salvo');
  }

  remover(c: Card) {
    if (confirm(`Remover o card #${c.numero}?`)) this.store.removerCard(c.id);
  }

  filtrarMes(m: number) {
    this.mes.update((atual) => (atual === m ? 0 : m));
  }

  filtrarSistema(nome: string) {
    if (nome === 'Outros' || nome === 'Não informado') return;
    this.sistema.update((s) => (s === nome ? '' : nome));
  }

  alternarGraficos() {
    this.graficos.update((g) => !g);
    salvarPref('devtools:graficos', this.graficos() ? '1' : '0');
  }

  copiarMes(g: Grupo) {
    const txt = g.cards.map((c) => `#${c.numero} - ${c.descricao} - ${this.url(c)}`).join('\n');
    this.ui.copiar(txt, `${g.cards.length} cards copiados`);
  }

  private linhasPlanilha() {
    return [...this.filtrados()]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((c) => [String(c.numero), c.descricao, c.sistema, c.area, c.time, c.linguagem, dataBr(c.data), c.obs]);
  }

  exportarCsv() {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [COLUNAS_PLANILHA, ...this.linhasPlanilha()].map((l) => l.map(esc).join(',')).join('\r\n');
    const sufixo = this.mes() ? `-${String(this.mes()).padStart(2, '0')}` : '';
    this.ui.baixar(`cards-${this.ano()}${sufixo}.csv`, '﻿' + csv, 'text/csv');
  }

  // TSV cola direto nas colunas do Google Sheets/Excel
  copiarPlanilha() {
    const linhas = this.linhasPlanilha();
    const tsv = linhas.map((l) => l.map((v) => v.replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n');
    this.ui.copiar(tsv, `${linhas.length} linhas copiadas`);
  }

  adicionarSistema() {
    const n = this.nomeAdicionar.trim();
    if (!n) return;
    const nome = this.store.normalizarSistema(n);
    const existe = this.store.sistemas().some((s) => s.nome === nome);
    this.store.garantirSistema(n);
    this.nomeAdicionar = '';
    this.ui.avisar(existe ? `Já existe: ${nome}` : 'Sistema adicionado');
  }

  mesclarSelecionado(origem: Sistema, ev: Event) {
    const sel = ev.target as HTMLSelectElement;
    const destino = sel.value;
    sel.value = '';
    this.mesclar(origem, destino);
  }

  mesclar(origem: Sistema, destinoId: string) {
    const destino = this.store.sistemas().find((s) => s.id === destinoId);
    if (!destino) return;
    const qtd = this.contagemSistemas().get(origem.nome) ?? 0;
    if (confirm(`Mesclar "${origem.nome}" em "${destino.nome}"? ${qtd} card(s) serão movidos e "${origem.nome}" vira apelido.`)) {
      this.store.mesclarSistemas(origem.id, destino.id);
      if (this.sistema() === origem.nome) this.sistema.set(destino.nome);
    }
  }
}

const mesDe = (c: Card) => +c.data.slice(5, 7);
const unicos = (l: string[]) => [...new Set(l.filter(Boolean))].sort();
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function barras(valores: string[], max = 8): Barra[] {
  const m = new Map<string, number>();
  valores.forEach((v) => m.set(v || 'Não informado', (m.get(v || 'Não informado') ?? 0) + 1));
  const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const topo = ord.slice(0, max);
  const resto = ord.slice(max).reduce((a, [, q]) => a + q, 0);
  if (resto) topo.push(['Outros', resto]);
  const total = valores.length || 1;
  return topo.map(([nome, qtd]) => ({ nome, qtd, pct: Math.round((qtd / total) * 100) }));
}

// semanas do mês começando na segunda-feira
function semanas(ano: number, mes: number, cards: Card[]) {
  const offset = (new Date(ano, mes - 1, 1).getDay() + 6) % 7;
  const qtd = new Map<number, number>();
  cards.forEach((c) => {
    const n = Math.floor((+c.data.slice(8, 10) - 1 + offset) / 7) + 1;
    qtd.set(n, (qtd.get(n) ?? 0) + 1);
  });
  return [...qtd.entries()].sort(([a], [b]) => a - b).map(([n, q]) => ({ n, qtd: q }));
}

function lerPref(chave: string, padrao: string) {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}

function salvarPref(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {}
}
