import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Bloco, COLUNAS, MESES, Nota, PRIORIDADES, Tarefa, hoje, prazoTarefa } from '../models';
import { FERRAMENTAS, prepararColado } from '../ferramentas/lista';
import { imagemDe, lerImagem } from '../ferramentas/lib/leitor';
import { Preencher, copiarOuPreencher } from '../notas/preencher';
import { ItemResumo, diaBr, resumoDaily } from '../resumo';

const ORDEM_PRIO = PRIORIDADES.map((p) => p.valor);

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, Preencher],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  host: { '(document:paste)': 'colarFora($event)' },
})
export class Inicio {
  protected readonly store = inject(Store);
  private readonly ui = inject(Ui);
  private readonly cofre = inject(Cofre);
  private readonly router = inject(Router);
  protected readonly prazo = prazoTarefa;
  protected readonly diaBr = diaBr;
  protected readonly MESES = MESES;

  protected visivel(id: string) {
    return this.store.menusVisiveis().some((m) => m.id === id);
  }

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
    return {
      hoje: qtd((x) => x === h),
      semana: qtd((x) => x >= semana && x <= h),
      mes: qtd((x) => x.startsWith(mes)),
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
    };
  });

  protected readonly incompletos = computed(() => this.store.cards().filter((c) => c.incompleto).length);

  protected readonly daily = computed(() => resumoDaily(this.store.cards(), this.store.tarefas()));
  protected readonly diasDaily = computed(() => {
    const m = new Map<string, ItemResumo[]>();
    this.daily().itens.forEach((i) => m.set(i.data, [...(m.get(i.data) ?? []), i]));
    return [...m].map(([dia, itens]) => ({ dia, itens }));
  });

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

  protected readonly favoritas = computed(() =>
    (this.store.config().favoritas ?? []).map((id) => FERRAMENTAS.find((f) => f.id === id)).filter((f) => !!f),
  );

  protected readonly notas = computed(() =>
    this.store
      .notas()
      .filter((n) => n.fixada)
      .sort((a, b) => b.atualizado.localeCompare(a.atualizado)),
  );
  protected readonly notaAberta = signal<Nota | null>(null);
  protected readonly preencher = signal<string | null>(null);

  constructor() {
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => a === 'esc' && (this.preencher() ? this.preencher.set(null) : this.notaAberta.set(null)));
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
