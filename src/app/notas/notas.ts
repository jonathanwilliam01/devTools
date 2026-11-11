import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Bloco, CORES, DIAS_LIXEIRA, Nota, Removida, novoId } from '../models';
import { formatarSql } from '../ferramentas/lib/sqlfmt';
import { realcarSql } from './sql';
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
  protected readonly semTitulo = signal(false);
  protected readonly tagsTxt = signal('');
  protected readonly tag = signal<string | null>(null);
  protected readonly verLixeira = signal(false);
  protected readonly lixeira = this.store.lixeira;
  protected readonly DIAS_LIXEIRA = DIAS_LIXEIRA;
  protected readonly realcar = realcarSql;
  protected readonly todasTags = computed(() => [...new Set(this.store.notas().flatMap((n) => n.tags ?? []))].sort((a, b) => a.localeCompare(b)));
  // células das tabelas em edição, por id do bloco
  protected readonly grades = new Map<string, string[][]>();
  protected readonly letra = letraColuna;
  // nota aberta pelo início
  protected readonly destaque = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('nota'));

  private readonly filtradas = computed(() => {
    const t = this.busca().toLowerCase().trim();
    const tag = this.tag();
    return this.store
      .notas()
      .filter((n) => !tag || n.tags?.includes(tag))
      .filter(
        (n) =>
          !t ||
          n.titulo.toLowerCase().includes(t) ||
          n.tags?.some((x) => x.toLowerCase().includes(t)) ||
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
        this.verLixeira.set(false);
      } else if (a === 'novo' && !this.form() && !this.preencher()) this.nova();
    });
  }

  nova() {
    this.grades.clear();
    this.semTitulo.set(false);
    this.tagsTxt.set(this.tag() ?? '');
    this.form.set({ id: novoId(), titulo: '', blocos: [bloco()], fixada: false, cor: '', atualizado: '' });
  }

  editar(n: Nota) {
    if (this.cofre.bloqueado() && n.blocos.some((b) => b.secreto)) return this.pedirCofre();
    const f = this.cofre.abrirNota(n);
    this.grades.clear();
    f.blocos.filter((b) => b.tabela).forEach((b) => this.grades.set(b.id, lerTsv(b.conteudo)));
    this.semTitulo.set(false);
    this.tagsTxt.set((f.tags ?? []).join(', '));
    this.form.set(f);
  }

  // abre o editor com a cópia; só grava ao salvar
  duplicar(n: Nota) {
    this.editar(n);
    this.form.update((f) => f && { ...f, id: novoId(), titulo: `${f.titulo} (cópia)`, fixada: false, blocos: f.blocos.map((b) => this.copiaBloco(b)) });
  }

  duplicarBloco(f: Nota, i: number) {
    f.blocos.splice(i + 1, 0, this.copiaBloco(f.blocos[i]));
  }

  private copiaBloco(b: Bloco) {
    const c = { ...b, id: novoId() };
    if (b.tabela) this.grades.set(c.id, structuredClone(this.grades.get(b.id) ?? gradeVazia()));
    return c;
  }

  formatar(b: Bloco) {
    b.conteudo = formatarSql(b.conteudo, { caixa: 'manter', indent: 2 });
  }

  restaurar(r: Removida) {
    this.store.restaurarNota(r.nota.id);
    this.ui.avisar('Nota restaurada');
  }

  excluirDeVez(r?: Removida) {
    if (confirm(r ? `Excluir "${r.nota.titulo}" de vez?` : 'Esvaziar a lixeira?')) this.store.excluirDaLixeira(r?.nota.id);
  }

  diasRestantes(r: Removida) {
    return Math.max(0, Math.ceil(DIAS_LIXEIRA - (Date.now() - Date.parse(r.removido)) / 86400000));
  }

  async salvar() {
    const f = this.form();
    if (!f) return;
    if (this.cofre.bloqueado() && f.blocos.some((b) => b.secreto)) return this.pedirCofre();
    const blocos = f.blocos
      .map((b) => (b.tabela ? { ...b, conteudo: paraTsv(this.grades.get(b.id) ?? []) } : b))
      .filter((b) => b.label.trim() || b.conteudo.trim());
    if (!f.titulo.trim()) {
      if (!blocos.length) return this.form.set(null);
      this.semTitulo.set(true);
      document.querySelector<HTMLInputElement>('.dialogo .titulo')?.focus();
      return this.ui.avisar('Informe o título da nota');
    }
    this.form.set(null);
    this.selId.set(f.id);
    const tags = [...new Set(this.tagsTxt().split(',').map((t) => t.trim()).filter(Boolean))];
    this.store.salvarNota(await this.cofre.selar({ ...f, blocos, tags, atualizado: new Date().toISOString() }));
  }

  remover(n: Nota) {
    this.form.set(null);
    if (!this.store.notas().some((x) => x.id === n.id)) return;
    this.store.removerNota(n.id);
    this.ui.avisar(`Nota movida para a lixeira (${DIAS_LIXEIRA} dias)`);
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

