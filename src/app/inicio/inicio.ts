import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Github } from '../github';
import { VERSAO } from '../versao';
import { lerPref, prefSignal, salvarPref } from '../pref';
import { Bloco, COLUNAS, ISSUE_URL, MESES, Nota, PRIORIDADES, Tarefa, hoje, mudarStatus, novoId, partes, prazoTarefa, tarefaRapida, semKanban } from '../models';
import { FERRAMENTAS, prepararColado } from '../ferramentas/lista';
import { lerRecentes } from '../ferramentas/catalogo';
import { imagemDe, lerImagem } from '../ferramentas/lib/leitor';
import { Preencher, copiarOuPreencher } from '../notas/preencher';
import { ItemResumo, diaBr, lerDiasDaily, resumoDaily, somaDias } from '../resumo';

const ORDEM_PRIO = PRIORIDADES.map((p) => p.valor);
const util = (d: string) => new Date(d + 'T00:00').getDay() % 6 !== 0;
const proximoUtil = (d: string) => {
  do d = somaDias(d, 1);
  while (!util(d));
  return d;
};

type Coluna = 'principal' | 'lateral';
interface Layout {
  principal: string[];
  lateral: string[];
  ocultos: string[];
}
// painel some junto com o menu escondido em Dados
const PAINEIS: { id: string; nome: string; menu: string; col: Coluna }[] = [
  { id: 'agora', nome: 'Fazendo agora', menu: 'tarefas', col: 'principal' },
  { id: 'tarefas', nome: 'Tarefas', menu: 'tarefas', col: 'principal' },
  { id: 'semana', nome: 'Prazos da semana', menu: 'tarefas', col: 'principal' },
  { id: 'daily', nome: 'Daily', menu: 'cards', col: 'principal' },
  { id: 'checklists', nome: 'Checklists', menu: 'tarefas', col: 'principal' },
  { id: 'captura', nome: 'Nova tarefa', menu: 'tarefas', col: 'lateral' },
  { id: 'ferramentas', nome: 'Ferramentas', menu: 'ferramentas', col: 'lateral' },
  { id: 'notas', nome: 'Notas', menu: 'notas', col: 'lateral' },
  { id: 'github', nome: 'Issues fora das tarefas', menu: 'tarefas', col: 'lateral' },
  { id: 'distribuicao', nome: 'Sistemas e linguagens', menu: 'cards', col: 'lateral' },
];
const CHAVE_LAYOUT = 'devtools:inicio-layout';

const layoutPadrao = (): Layout => ({
  principal: PAINEIS.filter((p) => p.col === 'principal').map((p) => p.id),
  lateral: PAINEIS.filter((p) => p.col === 'lateral').map((p) => p.id),
  ocultos: [],
});

function lerLayout(): Layout {
  let l: Partial<Layout> = {};
  try {
    l = JSON.parse(lerPref(CHAVE_LAYOUT, '{}'));
  } catch {}
  const ids = new Set(PAINEIS.map((p) => p.id));
  const r: Layout = {
    principal: semKanban(l.principal).filter((x) => ids.has(x)),
    lateral: semKanban(l.lateral).filter((x) => ids.has(x)),
    ocultos: semKanban(l.ocultos),
  };
  // painel novo entra na coluna padrão
  PAINEIS.filter((p) => !r.principal.includes(p.id) && !r.lateral.includes(p.id)).forEach((p) => r[p.col].push(p.id));
  return r;
}

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, Preencher, NgTemplateOutlet],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  host: { '(document:paste)': 'colarFora($event)' },
})
export class Inicio {
  protected readonly store = inject(Store);
  private readonly ui = inject(Ui);
  private readonly cofre = inject(Cofre);
  private readonly router = inject(Router);
  private readonly github = inject(Github);
  protected readonly prazo = prazoTarefa;
  protected readonly diaBr = diaBr;
  protected readonly MESES = MESES;
  protected readonly ISSUE_URL = ISSUE_URL;
  protected readonly versao = VERSAO.numero;
  protected readonly tick = signal(Date.now());

  protected visivel(id: string) {
    return this.store.menusVisiveis().some((m) => m.id === id);
  }

  // ---- layout
  protected readonly layout = signal(lerLayout());
  protected readonly editando = signal(false);
  protected readonly nomePainel = (id: string) => PAINEIS.find((p) => p.id === id)?.nome ?? 'Números';

  protected mostrar(id: string) {
    const p = PAINEIS.find((x) => x.id === id);
    if (!this.visivel(p?.menu ?? 'cards')) return false;
    if (this.editando()) return true;
    if (this.oculto(id)) return false;
    if (id === 'agora') return this.fazendo().length + this.proximas().length > 0;
    if (id === 'checklists') return this.checklists().length > 0;
    if (id === 'github') return !!this.foraTarefas()?.length;
    return true;
  }

  protected oculto(id: string) {
    return this.layout().ocultos.includes(id);
  }

  protected moverPainel(id: string, passo: number) {
    this.layout.update((l) => {
      const col: Coluna = l.principal.includes(id) ? 'principal' : 'lateral';
      const lista = [...l[col]];
      const i = lista.indexOf(id);
      const j = i + passo;
      if (j < 0 || j >= lista.length) return l;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return { ...l, [col]: lista };
    });
  }

  protected trocarColuna(id: string) {
    this.layout.update((l) =>
      l.principal.includes(id)
        ? { ...l, principal: l.principal.filter((x) => x !== id), lateral: [id, ...l.lateral] }
        : { ...l, lateral: l.lateral.filter((x) => x !== id), principal: [id, ...l.principal] },
    );
  }

  protected alternarOculto(id: string) {
    this.layout.update((l) => ({ ...l, ocultos: l.ocultos.includes(id) ? l.ocultos.filter((x) => x !== id) : [...l.ocultos, id] }));
  }

  protected restaurarLayout() {
    this.layout.set(layoutPadrao());
  }

  // ---- saudação
  protected readonly saudacao = computed(() => {
    const d = new Date(this.tick());
    const h = d.getHours();
    return {
      texto: h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite',
      data: d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    };
  });
  protected readonly diaDaily = lerDiasDaily().includes(new Date().getDay());
  protected readonly atrasadas = computed(() => this.abertas().filter((t) => t.prazo && t.prazo < hoje()).length);

  abrirNovidades() {
    this.ui.novidades.next();
  }

  // ---- números
  protected readonly numeros = computed(() => {
    const h = hoje();
    const d = new Date(h + 'T00:00');
    const segunda = new Date(d);
    segunda.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const anterior = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const [semana, mes, mesAnt, ano] = [
      segunda.toLocaleDateString('sv-SE'),
      h.slice(0, 7),
      anterior.toLocaleDateString('sv-SE').slice(0, 7),
      h.slice(0, 4),
    ];
    const datas = this.store.cards().map((c) => c.data);
    const qtd = (f: (x: string) => boolean) => datas.filter(f).length;
    const porMes = Array(12).fill(0) as number[];
    datas.filter((x) => x.startsWith(ano)).forEach((x) => porMes[+x.slice(5, 7) - 1]++);
    // dias úteis (seg a sex) do mês: até hoje e no total
    const fimMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    let uteisAte = 0;
    let uteisMes = 0;
    for (let i = 1; i <= fimMes; i++) {
      if (!util(`${mes}-${String(i).padStart(2, '0')}`)) continue;
      uteisMes++;
      if (i <= d.getDate()) uteisAte++;
    }
    const noMes = qtd((x) => x.startsWith(mes));
    const media = uteisAte ? noMes / uteisAte : 0;
    return {
      hoje: qtd((x) => x === h),
      semana: qtd((x) => x >= semana && x <= h),
      mes: noMes,
      // mês anterior até o mesmo dia, para comparar com o mês em curso
      mesAnteriorAteHoje: qtd((x) => x.startsWith(mesAnt) && +x.slice(8) <= d.getDate()),
      mesAnterior: qtd((x) => x.startsWith(mesAnt)),
      nomeMes: MESES[d.getMonth()],
      nomeMesAnterior: MESES[anterior.getMonth()],
      dia: d.getDate(),
      ano: porMes.reduce((a, b) => a + b, 0),
      anoNum: ano,
      porMes,
      maxMes: Math.max(1, ...porMes),
      mesAtual: d.getMonth(),
      media: media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
      projecao: Math.round(media * uteisMes),
    };
  });

  // dias úteis seguidos com card; hoje sem card ainda não quebra
  protected readonly sequencia = computed(() => {
    const dias = new Set(this.store.cards().map((c) => c.data));
    const h = hoje();
    let atual = 0;
    let d = dias.has(h) ? h : somaDias(h, -1);
    while (!util(d) || dias.has(d)) {
      if (util(d)) atual++;
      d = somaDias(d, -1);
    }
    let recorde = 0;
    let run = 0;
    let ant = '';
    for (const x of [...dias].filter(util).sort()) {
      run = ant && proximoUtil(ant) === x ? run + 1 : 1;
      recorde = Math.max(recorde, run);
      ant = x;
    }
    return { atual, recorde };
  });

  protected readonly incompletos = computed(() => this.store.cards().filter((c) => c.incompleto).length);

  // ---- daily
  protected readonly daily = computed(() => resumoDaily(this.store.cards(), this.store.tarefas()));
  protected readonly diasDaily = computed(() => {
    const m = new Map<string, ItemResumo[]>();
    this.daily().itens.forEach((i) => m.set(i.data, [...(m.get(i.data) ?? []), i]));
    return [...m].map(([dia, itens]) => ({ dia, itens }));
  });

  // ---- tarefas
  protected readonly colunas = computed(() =>
    COLUNAS.filter((c) => c.status !== 'done').map((c) => ({
      ...c,
      qtd: this.store.tarefas().filter((t) => t.status === c.status).length,
    })),
  );

  // atrasadas primeiro, depois prioridade e prazo
  protected readonly abertas = computed(() => {
    const h = hoje();
    const chave = (t: Tarefa) => [t.prazo && t.prazo < h ? 0 : 1, ORDEM_PRIO.indexOf(t.prioridade), t.prazo || '9999'] as const;
    return this.store
      .tarefas()
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const [x, y] = [chave(a), chave(b)];
        return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]);
      });
  });

  // ---- fazendo agora
  protected readonly fazendo = computed(() => this.store.tarefas().filter((t) => t.status === 'doing'));
  protected readonly proximas = computed(() => this.abertas().filter((t) => t.status === 'todo').slice(0, 3));
  protected readonly concluindo = signal<Tarefa | null>(null);
  protected readonly trabalhoTxt = signal('');

  protected cronometro(t: Tarefa) {
    const ms = (t.tempo ?? 0) + (t.inicio ? this.tick() - Date.parse(t.inicio) : 0);
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  protected mover(t: Tarefa, status: 'todo' | 'doing') {
    this.store.salvarTarefa(mudarStatus(t, status));
  }

  // card ainda não registrado pede o "trabalho executado", que vira o obs ao registrar
  protected concluir(t: Tarefa) {
    if (t.tipo === 'card' && t.numeroCard && !this.store.cards().some((c) => c.numero === t.numeroCard)) {
      this.trabalhoTxt.set(t.trabalho ?? '');
      this.concluindo.set(t);
      return;
    }
    this.store.salvarTarefa(mudarStatus(t, 'done'));
    this.ui.avisar('Tarefa concluída');
  }

  protected salvarConclusao() {
    const c = this.concluindo();
    const t = c && this.store.tarefas().find((x) => x.id === c.id);
    if (t) this.store.salvarTarefa({ ...mudarStatus(t, 'done'), trabalho: this.trabalhoTxt().trim() || t.trabalho });
    this.concluindo.set(null);
    this.ui.avisar('Tarefa concluída');
  }

  // ---- prazos da semana
  protected readonly semana = computed(() => {
    const h = hoje();
    const seg = somaDias(h, -((new Date(h + 'T00:00').getDay() + 6) % 7));
    const dom = somaDias(seg, 6);
    const comPrazo = this.abertas().filter((t) => t.prazo);
    const dias = Array.from({ length: 7 }, (_, i) => somaDias(seg, i))
      .map((d) => ({ dia: d, rotulo: diaBr(d), hoje: d === h, passado: d < h, tarefas: comPrazo.filter((t) => t.prazo === d) }))
      .filter((d, i) => i < 5 || d.tarefas.length);
    const antes = comPrazo.filter((t) => t.prazo! < seg);
    const proxima = comPrazo.filter((t) => t.prazo! > dom && t.prazo! <= somaDias(dom, 7));
    return [
      ...(antes.length ? [{ dia: 'antes', rotulo: 'Antes', hoje: false, passado: true, tarefas: antes }] : []),
      ...dias,
      ...(proxima.length ? [{ dia: 'proxima', rotulo: 'Próx. semana', hoje: false, passado: false, tarefas: proxima }] : []),
    ];
  });

  // ---- checklists
  protected readonly checklists = computed(() =>
    this.abertas()
      .filter((t) => t.checklist?.length)
      .map((t) => ({ t, feitos: t.checklist!.filter((i) => i.feito).length, total: t.checklist!.length })),
  );

  // ---- nova tarefa
  protected readonly rapida = signal('');

  protected adicionar() {
    const r = tarefaRapida(this.rapida());
    if (!r) return;
    this.store.setTarefas([r.tarefa, ...this.store.tarefas()]);
    this.rapida.set('');
    this.ui.avisar('Tarefa adicionada às tarefas');
    if (r.buscar) this.preencherDoGithub(r.tarefa.id, r.buscar);
  }

  private async preencherDoGithub(id: string, n: number) {
    const i = await this.github.issue(n);
    const t = this.store.tarefas().find((x) => x.id === id);
    if (i && t) this.store.salvarTarefa({ ...t, titulo: i.titulo, descricao: t.descricao || i.descricao });
  }

  // ---- github: atribuídas sem tarefa nem card (removidas das tarefas)
  protected readonly foraTarefas = computed(() => {
    const l = this.github.ultimasAtribuidas();
    if (!l) return null;
    const conhecidas = new Set<number | null | undefined>([...this.store.tarefas().map((t) => t.numeroCard), ...this.store.cards().map((c) => c.numero)]);
    return l.filter((i) => !conhecidas.has(i.numero));
  });

  protected importar(i: { numero: number; titulo: string; descricao: string }) {
    this.store.setTarefas([
      { id: novoId(), titulo: i.titulo, descricao: i.descricao, status: 'todo', prioridade: 'media', tipo: 'card', numeroCard: i.numero, criado: hoje() },
      ...this.store.tarefas(),
    ]);
    this.ui.avisar(`Issue #${i.numero} adicionada às tarefas`);
  }

  // ---- sistemas e linguagens
  protected readonly periodo = prefSignal('devtools:inicio-periodo', 'mes' as 'mes' | 'ano', ['mes', 'ano']);
  protected readonly distribuicao = computed(() => {
    const pre = hoje().slice(0, this.periodo() === 'mes' ? 7 : 4);
    const cs = this.store.cards().filter((c) => c.data.startsWith(pre));
    const top = (campo: 'sistema' | 'linguagem') => {
      const m = new Map<string, number>();
      cs.forEach((c) => partes(c[campo]).forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)));
      const l = [...m].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const max = Math.max(1, ...l.map((x) => x[1]));
      return l.map(([nome, qtd]) => ({ nome, qtd, pct: (qtd / max) * 100 }));
    };
    return { total: cs.length, grupos: [{ nome: 'Sistemas', itens: top('sistema') }, { nome: 'Linguagens', itens: top('linguagem') }] };
  });

  // ---- ferramentas e notas
  protected readonly favoritas = computed(() =>
    (this.store.config().favoritas ?? []).map((id) => FERRAMENTAS.find((f) => f.id === id)).filter((f) => !!f),
  );
  protected readonly recentes = computed(() => {
    const fav = this.store.config().favoritas ?? [];
    return lerRecentes()
      .filter((id) => !fav.includes(id))
      .map((id) => FERRAMENTAS.find((f) => f.id === id))
      .filter((f) => !!f)
      .slice(0, 6);
  });

  private readonly porData = computed(() => [...this.store.notas()].sort((a, b) => b.atualizado.localeCompare(a.atualizado)));
  protected readonly notas = computed(() => this.porData().filter((n) => n.fixada));
  protected readonly notasRecentes = computed(() => this.porData().filter((n) => !n.fixada).slice(0, 5));
  protected readonly notaAberta = signal<Nota | null>(null);
  protected readonly preencher = signal<string | null>(null);

  constructor() {
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a !== 'esc') return;
      if (this.preencher()) this.preencher.set(null);
      else if (this.concluindo()) this.concluindo.set(null);
      else if (this.notaAberta()) this.notaAberta.set(null);
      else this.editando.set(false);
    });
    effect(() => salvarPref(CHAVE_LAYOUT, JSON.stringify(this.layout())));
    const timer = setInterval(() => this.tick.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected nomeStatus(s: string) {
    return COLUNAS.find((c) => c.status === s)?.titulo ?? s;
  }

  protected label(valor: string) {
    return PRIORIDADES.find((p) => p.valor === valor)?.label ?? valor;
  }

  copiarDaily() {
    const d = this.daily();
    this.ui.copiar(d.texto, `Resumo copiado (${d.itens.length} itens)`);
  }

  // cole boleto, Pix, JWT, documento, JSON, SQL ou imagem com código e abre a ferramenta certa
  colar(texto: string) {
    const f = prepararColado(texto);
    if (!f) return this.ui.avisar('Conteúdo não reconhecido');
    this.router.navigate(['/ferramentas', f.id]);
    this.ui.avisar(`Aberto em ${f.nome}`);
  }

  colarCampo(e: ClipboardEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.tratarColagem(e.clipboardData);
  }

  colarFora(e: ClipboardEvent) {
    if (!this.visivel('ferramentas') || this.preencher()) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    if (this.tratarColagem(e.clipboardData)) e.preventDefault();
  }

  private tratarColagem(dt: DataTransfer | null) {
    const img = imagemDe(dt);
    const texto = dt?.getData('text') ?? '';
    if (img) this.lerImagem(img);
    else if (texto.trim()) this.colar(texto);
    else return false;
    return true;
  }

  private async lerImagem(img: Blob) {
    this.ui.avisar('Lendo imagem...');
    try {
      const [texto] = await lerImagem(img);
      if (texto) this.colar(texto);
      else this.ui.avisar('Nenhum código encontrado na imagem');
    } catch {
      this.ui.avisar('Falha ao ler a imagem');
    }
  }

  copiarBloco(b: Bloco) {
    const txt = this.cofre.ler(b);
    if (txt === null) return this.pedirCofre();
    this.copiarTexto(txt);
  }

  copiarTudo(n: Nota) {
    const partes = n.blocos.map((b) => this.cofre.ler(b));
    if (partes.includes(null)) return this.pedirCofre();
    this.copiarTexto(n.blocos.map((b, i) => (b.label ? `${b.label}\n${partes[i]}` : partes[i])).join('\n\n'));
  }

  private copiarTexto(txt: string) {
    if (copiarOuPreencher(this.ui, txt)) this.preencher.set(txt);
  }

  private pedirCofre() {
    this.ui.avisar('Desbloqueie o cofre');
    this.ui.painel.set('cofre');
  }
}
