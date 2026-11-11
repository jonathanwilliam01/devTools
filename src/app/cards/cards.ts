import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Store } from '../store';
import { Ui } from '../ui';
import { Card, CampoCard, ISSUE_URL, MESES, Sistema, chaveNome, dataBr, hoje, novoId, partes } from '../models';
import { Multi } from '../multi';
import { Github } from '../github';
import { lerPref, prefSignal, salvarPref } from '../pref';
import { LISTAS, Vistas } from '../vistas';
import { Destino, chavesLabel, destinoLabel } from '../labels';
import { SEMANA, diaBr, itensResumo, lerDiasDaily, lerObsDaily, outraDaily, textoResumo } from '../resumo';

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
  imports: [FormsModule, Multi, Vistas],
  templateUrl: './cards.html',
  styleUrl: './cards.css',
  host: { '(document:mousedown)': 'fecharMenu($event)', '(document:keydown)': 'teclas($event)', '(window:scroll)': 'menu.set(null)', '(window:resize)': 'menu.set(null)' },
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
  protected readonly soIncompletos = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('incompletos'));

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
  protected readonly areas = this.store.areas;
  protected readonly times = this.store.times;
  protected readonly linguagens = this.store.linguagens;

  // busca, sistema e incompletos (sem ano/mês)
  private readonly casaFiltro = computed(() => {
    const termo = normalizar(this.busca());
    return (c: Card) =>
      (!this.sistema() || partes(c.sistema).includes(this.sistema())) &&
      (!this.soIncompletos() || c.incompleto) &&
      (!termo || normalizar(`${c.numero} ${c.descricao} ${c.sistema} ${c.linguagem} ${c.obs}`).includes(termo));
  });

  protected readonly filtrados = computed(() => {
    const casa = this.casaFiltro();
    return this.doAno().filter((c) => (!this.mes() || mesDe(c) === this.mes()) && casa(c));
  });

  // meses com cards (yyyy-mm) para navegar na lista, pulando os vazios
  private readonly mesesComCards = computed(() =>
    [...new Set(this.store.cards().filter(this.casaFiltro()).map((c) => c.data.slice(0, 7)))].sort(),
  );
  private vizinho(passo: 1 | -1) {
    const atual = `${this.ano()}-${String(this.mes()).padStart(2, '0')}`;
    const l = this.mesesComCards();
    const k = passo < 0 ? [...l].reverse().find((m) => m < atual) : l.find((m) => m > atual);
    return k ? { ano: +k.slice(0, 4), mes: +k.slice(5, 7), nome: `${MESES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` } : null;
  }
  protected readonly anterior = computed(() => this.vizinho(-1));
  protected readonly proximo = computed(() => this.vizinho(1));

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

  protected readonly VISTAS = [{ v: 'tabela', i: '▤', t: 'Tabela' }, ...LISTAS] as const;
  protected readonly vista = prefSignal('devtools:cards-vista', 'tabela' as 'tabela' | 'baixo' | 'lado', ['tabela', 'baixo', 'lado']);
  protected readonly selId = signal<string | null>(null);
  protected readonly selecionado = computed(() => {
    const l = this.grupos().flatMap((g) => g.cards);
    return l.find((c) => c.id === this.selId()) ?? l[0] ?? null;
  });

  protected readonly form = signal<Card | null>(null);
  protected readonly CAMPOS = CAMPOS;
  protected readonly labelsIssue = signal<string[] | null>(null);
  private readonly descLabels = signal<Record<string, string>>({});
  protected readonly menu = signal<{ card?: Card; label?: string; exportar?: boolean; direita?: number; esquerda?: number; topo?: number; base?: number } | null>(null);

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

  // resumo para a daily: período (navegando entre dias de daily) ou datas avulsas
  protected readonly SEMANA = SEMANA;
  protected readonly diaBr = diaBr;
  protected readonly painelResumo = signal(false);
  protected readonly modoResumo = signal<'periodo' | 'datas'>('periodo');
  protected readonly resumoDe = signal('');
  protected readonly resumoAte = signal('');
  protected readonly resumoDatas = signal<string[]>([]);
  protected readonly resumoTarefas = signal(true);
  protected readonly resumoObs = signal(lerObsDaily());
  protected readonly diasDaily = signal(lerDiasDaily());

  protected readonly itensResumo = computed(() => {
    const datas = this.resumoDatas();
    const [de, ate] = [this.resumoDe(), this.resumoAte()];
    const dentro = this.modoResumo() === 'datas' ? (d: string) => datas.includes(d) : (d: string) => d >= de && d <= ate;
    return itensResumo(this.store.cards(), this.store.tarefas(), dentro, this.resumoTarefas());
  });

  protected readonly textoResumo = computed(() => {
    const titulo =
      this.modoResumo() === 'datas'
        ? `Concluídos em ${this.resumoDatas().map(diaBr).join(', ') || '—'}`
        : `Concluídos de ${diaBr(this.resumoDe())} a ${diaBr(this.resumoAte())}`;
    return textoResumo(this.itensResumo(), titulo, this.resumoObs());
  });

  private readonly registrados = computed(() => new Set(this.store.cards().map((c) => c.numero)));

  constructor() {
    // na lista sempre há um mês aberto: o mais recente com cards no ano
    effect(() => {
      if (this.vista() === 'tabela') return;
      const casa = this.casaFiltro();
      const meses = this.doAno().filter(casa).map(mesDe);
      if (meses.length && !meses.includes(this.mes())) this.mes.set(Math.max(...meses));
    });
    const inc = this.store.cards().filter((c) => c.incompleto).map((c) => +c.data.slice(0, 4));
    if (this.soIncompletos() && inc.length) this.ano.set(Math.max(...inc));
    const r = this.store.rascunhoCard();
    if (r) {
      this.store.rascunhoCard.set(null);
      this.novo(r);
    }
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') {
        this.form.set(null);
        this.painelSistemas.set(false);
        this.painelResumo.set(false);
        this.menu.set(null);
      } else if (a === 'novo' && !this.form() && !this.painelSistemas() && !this.painelResumo()) this.novo();
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
    const l = this.store.camposDaIssue(i);
    this.labelsIssue.set(i.labels);
    this.descLabels.set(i.descLabels);
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

  campoDaLabel(label: string) {
    const c = destinoLabel(this.store.mapaLabels(), label, this.descLabels()[label]);
    return c === 'ignorar' ? 'ignorada' : CAMPOS.find((x) => x.valor === c)?.label;
  }

  // lembra o campo da label e da família dela (descrição e prefixo) e já aplica no formulário
  definirLabel(label: string, campo: Destino) {
    const familia = Object.fromEntries(chavesLabel(label, this.descLabels()[label]).map((k) => [k, campo]));
    this.store.config.update((c) => ({ ...c, labels: { ...c.labels, ...familia } }));
    const valor = this.store.valorLabel(label, campo);
    const antigos = [label, valor, this.store.valorLabel(label, 'sistema'), this.store.valorLabel(label, 'area')];
    this.form.update((x) => {
      if (!x) return x;
      const f = { ...x };
      for (const { valor: c } of CAMPOS) f[c] = partes(f[c]).filter((v) => !antigos.includes(v)).join(', ');
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

  abrirMenuExportar(ev: MouseEvent) {
    this.posicionarMenu({ exportar: true }, ev);
  }

  // menu fixo na tela para não ser cortado pela rolagem; abre para cima perto do rodapé
  private posicionarMenu(alvo: { card?: Card; label?: string; exportar?: boolean }, ev: MouseEvent) {
    const m = this.menu();
    if (m && m.card === alvo.card && m.label === alvo.label && m.exportar === alvo.exportar) return this.menu.set(null);
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const cima = r.bottom + 180 > innerHeight;
    this.menu.set({
      ...alvo,
      // ações e exportar alinham à direita do botão; labels, à esquerda
      direita: alvo.label ? undefined : innerWidth - r.right,
      esquerda: alvo.label ? r.left : undefined,
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
    this.store.salvarCard({ ...f, id, numero: +f.numero, descricao: f.descricao.trim(), incompleto: undefined });
    this.ano.set(+f.data.slice(0, 4));
    this.selId.set(id);
    this.form.set(null);
    this.ui.avisar('Card salvo');
  }

  remover(c: Card) {
    if (confirm(`Remover o card #${c.numero}?`)) this.store.removerCard(c.id);
  }

  filtrarMes(m: number) {
    this.mes.update((atual) => (atual === m && this.vista() === 'tabela' ? 0 : m));
  }

  irMes(v: { ano: number; mes: number } | null) {
    if (!v) return;
    this.ano.set(v.ano);
    this.mes.set(v.mes);
  }

  // na lista: ←/→ troca o mês, ↑/↓ troca o card
  teclas(e: KeyboardEvent) {
    if (this.vista() === 'tabela' || this.form() || this.painelSistemas() || this.painelResumo()) return;
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') this.irMes(this.anterior());
    else if (e.key === 'ArrowRight') this.irMes(this.proximo());
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const l = this.grupos().flatMap((g) => g.cards);
      const i = l.findIndex((c) => c.id === this.selecionado()?.id) + (e.key === 'ArrowUp' ? -1 : 1);
      if (i < 0 || i >= l.length) return;
      this.selId.set(l[i].id);
      setTimeout(() => document.querySelector('.lp-lista li.on')?.scrollIntoView({ block: 'nearest' }));
    } else return;
    e.preventDefault();
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

  abrirResumo() {
    this.desdeUltimaDaily();
    this.painelResumo.set(true);
  }

  desdeUltimaDaily() {
    this.resumoAte.set(hoje());
    this.resumoDe.set(outraDaily(hoje(), this.diasDaily(), -1));
  }

  // anda um intervalo entre dailies para trás ou para frente
  navegarDaily(passo: 1 | -1) {
    if (passo < 0) {
      this.resumoAte.set(this.resumoDe());
      this.resumoDe.set(outraDaily(this.resumoDe(), this.diasDaily(), -1));
    } else {
      this.resumoDe.set(this.resumoAte());
      this.resumoAte.set(outraDaily(this.resumoAte(), this.diasDaily(), 1));
    }
  }

  alternarDiaDaily(d: number) {
    this.diasDaily.update((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d].sort()));
    salvarPref('devtools:daily', this.diasDaily().join(','));
  }

  alternarObsResumo(v: boolean) {
    this.resumoObs.set(v);
    salvarPref('devtools:daily-obs', v ? '1' : '0');
  }

  adicionarDataResumo(d: string) {
    if (d && !this.resumoDatas().includes(d)) this.resumoDatas.update((l) => [...l, d].sort());
  }

  removerDataResumo(d: string) {
    this.resumoDatas.update((l) => l.filter((x) => x !== d));
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

