import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Card, CampoCard, ISSUE_URL, MESES, Sistema, chaveNome, dataBr, hoje, novoId, partes } from '../models';
import { Multi } from '../multi';
import { Github, Issue } from '../github';

interface Semana {
  n: number;
  inicio: number;
  fim: number;
  total: number;
  cards: Card[];
}

interface Grupo {
  mes: number;
  cards: Card[];
  total: number;
  anteriores: number;
  semanas: Semana[];
}

interface Barra {
  nome: string;
  qtd: number;
  pct: number;
}

const COLUNAS_PLANILHA = ['Número do Card', 'Descrição', 'Sistema', 'Área Tecnica', 'Time', 'Linguagem', 'Data conclusão', 'O que foi feito'];

@Component({
  selector: 'app-cards',
  imports: [FormsModule, Multi],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  host: { '(document:mousedown)': 'fecharMenu($event)', '(window:scroll)': 'menu.set(null)', '(window:resize)': 'menu.set(null)' },
})
export class Cards {
  protected readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  private readonly github = inject(Github);
  protected readonly MESES = MESES;
  protected readonly dataBr = dataBr;
  protected readonly partes = partes;
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
  protected readonly nomesSistemas = computed(() => this.sistemas().map((s) => s.nome));
  protected readonly areas = computed(() => unicos(this.store.cards().flatMap((c) => partes(c.area))));
  protected readonly times = computed(() => unicos(this.store.cards().map((c) => c.time)));
  protected readonly linguagens = computed(() => unicos(this.store.cards().flatMap((c) => partes(c.linguagem))));

  protected readonly filtrados = computed(() => {
    const termo = normalizar(this.busca());
    return this.doAno().filter(
      (c) =>
        (!this.mes() || mesDe(c) === this.mes()) &&
        (!this.sistema() || partes(c.sistema).includes(this.sistema())) &&
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
        semanas: semanas(this.ano(), mes, cards, this.doAno().filter((c) => mesDe(c) === mes)),
      }));
  });

  protected readonly form = signal<Card | null>(null);
  protected readonly CAMPOS = CAMPOS;
  protected readonly labelsIssue = signal<string[] | null>(null);
  protected readonly mapaLabels = computed(() => this.store.config().labels ?? {});
  protected readonly menu = signal<{ card?: Card; label?: string; direita?: number; esquerda?: number; topo?: number; base?: number } | null>(null);

  protected readonly painelSistemas = signal(false);
  protected nomeAdicionar = '';
  protected readonly contagemSistemas = computed(() => {
    const m = new Map<string, number>();
    this.store.cards().forEach((c) => partes(c.sistema).forEach((n) => m.set(n, (m.get(n) ?? 0) + 1)));
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
        this.menu.set(null);
      } else if (a === 'novo' && !this.form() && !this.painelSistemas()) this.novo();
    });
  }

  novo(base: Partial<Card> = {}) {
    this.labelsIssue.set(null);
    this.form.set({
      id: novoId(),
      numero: null as unknown as number,
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
    this.labelsIssue.set(null);
    this.form.set({ ...c });
  }

  // card novo: descrição e campos vindos da issue; só preenche o que está vazio
  async buscarIssue(f: Card) {
    const n = +f.numero;
    if (!n || this.store.cards().some((c) => c.id === f.id)) return;
    const i = await this.github.issue(n);
    if (!i) return;
    const l = this.camposDaIssue(i);
    this.labelsIssue.set(i.labels);
    this.form.update((x) =>
      x?.id === f.id
        ? {
            ...x,
            descricao: x.descricao || i.titulo,
            sistema: x.sistema || l.sistema,
            area: x.area || l.area,
            time: x.time || l.time,
            linguagem: x.linguagem || l.linguagem,
          }
        : x,
    );
  }

  // "Campo: valor" (label, quadro ou corpo) vai direto; label solta usa o mapa aprendido ou os valores já usados
  private camposDaIssue(i: Issue) {
    const campos = { sistema: [] as string[], area: [] as string[], time: [] as string[], linguagem: [] as string[] };
    const campoDe = (k: string): keyof typeof campos | undefined => {
      const c = chaveNome(k);
      if (c.startsWith('SISTEMA')) return 'sistema';
      if (c.startsWith('AREA')) return 'area';
      if (c === 'TIME' || c === 'EQUIPE') return 'time';
      if (c.startsWith('LINGUAGEM') || c === 'LANG') return 'linguagem';
      return undefined;
    };
    const conhecidos: [keyof typeof campos, string[]][] = [
      ['sistema', this.store.sistemas().flatMap((s) => [s.nome, ...s.aliases])],
      ['area', this.areas()],
      ['time', this.times()],
      ['linguagem', this.linguagens()],
    ];
    const pares = [...i.campos];
    for (const label of i.labels) {
      const mapa = this.mapaLabels()[chaveNome(label)];
      if (mapa) {
        if (mapa !== 'ignorar') pares.push([mapa, label]);
        continue;
      }
      const m = label.match(/^([^:/]+)[:/](.+)$/);
      if (m && campoDe(m[1])) {
        pares.push([m[1], m[2].trim()]);
        continue;
      }
      const achado = conhecidos.find(([, lista]) => lista.some((x) => chaveNome(x) === chaveNome(label)));
      if (achado) pares.push([achado[0], label]);
    }
    for (const [k, v] of pares) {
      const c = campoDe(k);
      if (c) campos[c].push(c === 'sistema' ? this.store.normalizarSistema(v) : v);
    }
    return {
      sistema: partes(campos.sistema.join(',')).join(', '),
      area: partes(campos.area.join(',')).join(', '),
      time: campos.time[0] ?? '',
      linguagem: partes(campos.linguagem.join(',')).join(', '),
    };
  }

  campoDaLabel(label: string) {
    const c = this.mapaLabels()[chaveNome(label)];
    return c === 'ignorar' ? 'ignorada' : CAMPOS.find((x) => x.valor === c)?.label;
  }

  // lembra o campo da label e já aplica no formulário (sai dos outros campos)
  definirLabel(label: string, campo: CampoCard | 'ignorar') {
    this.store.config.update((c) => ({ ...c, labels: { ...c.labels, [chaveNome(label)]: campo } }));
    const valor = campo === 'sistema' ? this.store.normalizarSistema(label) : label;
    this.form.update((x) => {
      if (!x) return x;
      const f = { ...x };
      for (const { valor: c } of CAMPOS) f[c] = partes(f[c]).filter((v) => v !== label && v !== valor).join(', ');
      if (campo === 'time') f.time = valor;
      else if (campo !== 'ignorar') f[campo] = partes(`${f[campo]},${valor}`).join(', ');
      return f;
    });
    this.menu.set(null);
  }

  fecharMenu(ev: MouseEvent) {
    if (!(ev.target as Element).closest?.('.menu, [data-abre-menu]')) this.menu.set(null);
  }

  abrirMenu(c: Card, ev: MouseEvent) {
    this.posicionarMenu({ card: c }, ev);
  }

  abrirMenuLabel(label: string, ev: MouseEvent) {
    this.posicionarMenu({ label }, ev);
  }

  // menu fixo na tela para não ser cortado pela rolagem; abre para cima perto do rodapé
  private posicionarMenu(alvo: { card?: Card; label?: string }, ev: MouseEvent) {
    const m = this.menu();
    if (m && m.card === alvo.card && m.label === alvo.label) return this.menu.set(null);
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const cima = r.bottom + 180 > innerHeight;
    this.menu.set({
      ...alvo,
      // ações alinham à direita do botão; labels, à esquerda
      direita: alvo.card ? innerWidth - r.right : undefined,
      esquerda: alvo.card ? undefined : r.left,
      topo: cima ? undefined : r.bottom + 4,
      base: cima ? innerHeight - r.top + 4 : undefined,
    });
  }

  // form é mutado pelo ngModel, por isso método e não computed
  duplicado(f: Card) {
    return !!f.numero && this.store.cards().some((c) => c.numero === +f.numero && c.id !== f.id);
  }

  salvar() {
    const f = this.form();
    if (!f || !f.numero || !f.data) return;
    // id previsível comprime melhor nos cookies
    const ids = new Set(this.store.cards().map((c) => c.id));
    const padrao = `c-${+f.numero}-${f.data}`;
    const id = ids.has(f.id) || ids.has(padrao) ? f.id : padrao;
    this.store.salvarCard({ ...f, id, numero: +f.numero, descricao: f.descricao.trim() });
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

const CAMPOS: { valor: CampoCard; label: string }[] = [
  { valor: 'sistema', label: 'Sistema' },
  { valor: 'area', label: 'Área técnica' },
  { valor: 'time', label: 'Time' },
  { valor: 'linguagem', label: 'Linguagem' },
];

const mesDe = (c: Card) => +c.data.slice(5, 7);
const unicos = (l: string[]) => [...new Set(l.filter(Boolean))].sort();
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// card com vários valores conta em cada um; % sobre o total de cards
function barras(valores: string[], max = 8): Barra[] {
  const m = new Map<string, number>();
  valores
    .flatMap((v) => (partes(v).length ? partes(v) : ['Não informado']))
    .forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const topo = ord.slice(0, max);
  const resto = ord.slice(max).reduce((a, [, q]) => a + q, 0);
  if (resto) topo.push(['Outros', resto]);
  const total = valores.length || 1;
  return topo.map(([nome, qtd]) => ({ nome, qtd, pct: Math.round((qtd / total) * 100) }));
}

// semanas do mês começando na segunda-feira, mais recente primeiro
function semanas(ano: number, mes: number, visiveis: Card[], doMes: Card[]): Semana[] {
  const offset = (new Date(ano, mes - 1, 1).getDay() + 6) % 7;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const semana = (c: Card) => Math.floor((+c.data.slice(8, 10) - 1 + offset) / 7) + 1;
  const mapa = new Map<number, Semana>();
  visiveis.forEach((c) => {
    const n = semana(c);
    if (!mapa.has(n)) {
      const inicio = (n - 1) * 7 - offset + 1;
      mapa.set(n, {
        n,
        inicio: Math.max(1, inicio),
        fim: Math.min(ultimoDia, inicio + 6),
        total: doMes.filter((x) => semana(x) === n).length,
        cards: [],
      });
    }
    mapa.get(n)!.cards.push(c);
  });
  return [...mapa.values()].sort((a, b) => b.n - a.n);
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
