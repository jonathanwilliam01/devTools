import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Bloco, CORES, Nota, novoId } from '../models';
import { Preencher, copiarOuPreencher, partesVars } from './preencher';
import { gradeVazia, letraColuna, lerTsv, paraTsv } from './tabela';
import { markdown } from '../markdown';
import { prefSignal } from '../pref';
import { LISTAS, Texto, Vistas } from '../vistas';

@Component({
  selector: 'app-notas',
  imports: [FormsModule, NgTemplateOutlet, Preencher, Vistas],
  templateUrl: './notas.html',
  styleUrl: './notas.css',
})
export class Notas {
  private readonly store = inject(Store);
  protected readonly ui = inject(Ui);
  protected readonly cofre = inject(Cofre);
  protected readonly CORES = CORES;
  protected readonly EXEMPLO = '{{variavel}}';

  protected readonly busca = signal('');
  protected readonly visiveis = signal(new Set<string>());
  protected readonly form = signal<Nota | null>(null);
  protected readonly preencher = signal<string | null>(null);
  // células das tabelas em edição, por id do bloco
  protected readonly grades = new Map<string, string[][]>();
  protected readonly letra = letraColuna;
  // nota aberta pelo início
  protected readonly destaque = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('nota'));

  private readonly filtradas = computed(() => {
    const t = this.busca().toLowerCase().trim();
    return this.store
      .notas()
      .filter(
        (n) =>
          !t ||
          n.titulo.toLowerCase().includes(t) ||
          n.blocos.some((b) => b.label.toLowerCase().includes(t) || (!b.secreto && b.conteudo.toLowerCase().includes(t))),
      )
      .sort((a, b) => b.atualizado.localeCompare(a.atualizado));
  });
  protected readonly fixadas = computed(() => this.filtradas().filter((n) => n.fixada));
  protected readonly outras = computed(() => this.filtradas().filter((n) => !n.fixada));
  protected readonly ordenadas = computed(() => [...this.fixadas(), ...this.outras()]);

  protected readonly VISTAS = [{ v: 'mural', i: '▦', t: 'Mural' }, ...LISTAS] as const;
  protected readonly vista = prefSignal('devtools:notas-vista', 'mural' as Vista, ['mural', 'baixo', 'lado']);
  protected readonly texto = prefSignal<Texto>('devtools:notas-texto', 'texto', ['texto', 'md']);
  protected readonly selId = signal<string | null>(null);
  protected readonly selecionada = computed(() => {
    const l = this.ordenadas();
    return l.find((n) => n.id === this.selId()) ?? l[0] ?? null;
  });
  protected readonly markdown = markdown;

  constructor() {
    afterNextRender(() => {
      const id = this.destaque();
      if (!id) return;
      this.selId.set(id);
      document.getElementById('nota-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => this.destaque.set(null), 2000);
    });
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') {
        this.form.set(null);
        this.preencher.set(null);
      } else if (a === 'novo' && !this.form() && !this.preencher()) this.nova();
    });
  }

  nova() {
    this.grades.clear();
    this.form.set({ id: novoId(), titulo: '', blocos: [bloco()], fixada: false, cor: '', atualizado: '' });
  }

  editar(n: Nota) {
    if (this.cofre.bloqueado() && n.blocos.some((b) => b.secreto)) return this.pedirCofre();
    const f = this.cofre.abrirNota(n);
    this.grades.clear();
    f.blocos.filter((b) => b.tabela).forEach((b) => this.grades.set(b.id, lerTsv(b.conteudo)));
    this.form.set(f);
  }

  async salvar() {
    const f = this.form();
    if (!f) return;
    if (this.cofre.bloqueado() && f.blocos.some((b) => b.secreto)) return this.pedirCofre();
    const blocos = f.blocos
      .map((b) => (b.tabela ? { ...b, conteudo: paraTsv(this.grades.get(b.id) ?? []) } : b))
      .filter((b) => b.label.trim() || b.conteudo.trim());
    this.form.set(null);
    if (!f.titulo.trim() && !blocos.length) return;
    this.selId.set(f.id);
    this.store.salvarNota(await this.cofre.selar({ ...f, blocos, atualizado: new Date().toISOString() }));
  }

  remover(n: Nota) {
    if (confirm(`Remover a nota "${n.titulo || 'sem título'}"?`)) {
      this.store.removerNota(n.id);
      this.form.set(null);
    }
  }

  fixar(n: Nota) {
    this.store.salvarNota({ ...n, fixada: !n.fixada });
  }

  alternarVisivel(b: Bloco) {
    if (this.cofre.ler(b) === null) return this.pedirCofre();
    this.visiveis.update((s) => {
      const novo = new Set(s);
      novo.has(b.id) ? novo.delete(b.id) : novo.add(b.id);
      return novo;
    });
  }

  // primeira linha não secreta, para a lista
  resumo(n: Nota) {
    const b = n.blocos.find((b) => !b.secreto && !b.tabela && b.conteudo.trim());
    return b?.conteudo.trim().split('\n')[0] ?? '';
  }

  // no markdown, clicar num link abre sem copiar
  clicarBloco(e: MouseEvent, b: Bloco) {
    if (!(e.target as HTMLElement).closest('a')) this.copiarBloco(b);
  }

  copiarBloco(b: Bloco) {
    const txt = this.cofre.ler(b);
    if (txt === null) return this.pedirCofre();
    this.copiarComVars(txt);
  }

  copiarTudo(n: Nota) {
    const partes = n.blocos.map((b) => this.cofre.ler(b));
    if (partes.includes(null)) return this.pedirCofre();
    this.copiarComVars(n.blocos.map((b, i) => (b.label ? `${b.label}\n${partes[i]}` : partes[i])).join('\n\n'));
  }

  // texto com {{variavel}} abre o formulário para preencher antes de copiar
  private copiarComVars(texto: string) {
    if (copiarOuPreencher(this.ui, texto)) this.preencher.set(texto);
  }

  protected readonly partes = partesVars;

  // null quando a tabela está oculta ou bloqueada (mostra os pontos)
  celulas(b: Bloco) {
    if (!b.tabela || (b.secreto && !this.visiveis().has(b.id))) return null;
    const t = this.cofre.ler(b);
    return t === null ? null : lerTsv(t);
  }

  copiarCelula(txt: string) {
    if (txt) this.copiarComVars(txt);
  }

  exibir(b: Bloco) {
    if (!b.secreto) return b.conteudo;
    if (!this.visiveis().has(b.id)) return '•'.repeat(12);
    return this.cofre.ler(b) ?? '🔒 bloqueado';
  }

  private pedirCofre() {
    this.ui.avisar('Desbloqueie o cofre');
    this.ui.painel.set('cofre');
  }

  addBloco(f: Nota) {
    f.blocos.push(bloco());
  }

  addTabela(f: Nota) {
    const b = { ...bloco(), tabela: true };
    this.grades.set(b.id, gradeVazia());
    f.blocos.push(b);
  }

  addLinha(g: string[][], i = g.length) {
    g.splice(i, 0, Array(g[0]?.length || 1).fill(''));
  }

  addColuna(g: string[][]) {
    g.forEach((l) => l.push(''));
  }

  removerLinha(g: string[][], i: number) {
    if (g.length > 1) g.splice(i, 1);
  }

  removerColuna(g: string[][], j: number) {
    if (g[0].length > 1) g.forEach((l) => l.splice(j, 1));
  }

  // Enter desce para a célula de baixo, criando linha no fim
  descer(e: Event, id: string, g: string[][], i: number, j: number) {
    e.preventDefault();
    if (i === g.length - 1) this.addLinha(g);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-cel="${id}-${i + 1}-${j}"]`)?.focus());
  }

  // colar várias células (do Excel) espalha a partir da célula atual
  colar(e: ClipboardEvent, g: string[][], i: number, j: number) {
    const txt = e.clipboardData?.getData('text/plain').replace(/\r?\n$/, '') ?? '';
    if (!/[\t\n]/.test(txt)) return;
    e.preventDefault();
    lerTsv(txt).forEach((linha, di) => {
      while (g.length <= i + di) this.addLinha(g);
      linha.forEach((v, dj) => {
        while (g[0].length <= j + dj) this.addColuna(g);
        g[i + di][j + dj] = v;
      });
    });
  }

  moverBloco(f: Nota, i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= f.blocos.length) return;
    [f.blocos[i], f.blocos[j]] = [f.blocos[j], f.blocos[i]];
  }
}

const bloco = (): Bloco => ({ id: novoId(), label: '', conteudo: '' });

type Vista = 'mural' | 'baixo' | 'lado';

