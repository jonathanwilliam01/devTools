import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Bloco, CORES, Nota, novoId } from '../models';

const VAR = /\{\{\s*([\w.-]+)\s*\}\}/g;

interface Preencher {
  texto: string;
  campos: { nome: string; valor: string }[];
}

@Component({
  selector: 'app-notas',
  imports: [FormsModule, NgTemplateOutlet],
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
  protected readonly preencher = signal<Preencher | null>(null);

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

  constructor() {
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => {
      if (a === 'esc') {
        this.form.set(null);
        this.preencher.set(null);
      } else if (a === 'novo' && !this.form() && !this.preencher()) this.nova();
    });
  }

  nova() {
    this.form.set({ id: novoId(), titulo: '', blocos: [bloco()], fixada: false, cor: '', atualizado: '' });
  }

  editar(n: Nota) {
    if (this.cofre.bloqueado() && n.blocos.some((b) => b.secreto)) return this.pedirCofre();
    this.form.set(this.cofre.abrirNota(n));
  }

  async salvar() {
    const f = this.form();
    if (!f) return;
    if (this.cofre.bloqueado() && f.blocos.some((b) => b.secreto)) return this.pedirCofre();
    const blocos = f.blocos.filter((b) => b.label.trim() || b.conteudo.trim());
    this.form.set(null);
    if (!f.titulo.trim() && !blocos.length) return;
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
    const nomes = [...new Set([...texto.matchAll(VAR)].map((m) => m[1]))];
    if (!nomes.length) {
      this.ui.copiar(texto);
      return;
    }
    const vars = this.store.vars();
    this.preencher.set({ texto, campos: nomes.map((nome) => ({ nome, valor: vars[nome] ?? '' })) });
  }

  confirmarPreencher() {
    const p = this.preencher();
    if (!p) return;
    const valores = Object.fromEntries(p.campos.map((c) => [c.nome, c.valor]));
    this.store.vars.update((v) => ({ ...v, ...valores }));
    this.ui.copiar(p.texto.replace(VAR, (_, nome) => valores[nome] ?? ''));
    this.preencher.set(null);
  }

  partes(texto: string) {
    return texto.split(/(\{\{\s*[\w.-]+\s*\}\})/).map((t) => ({ t, v: /^\{\{/.test(t) }));
  }

  valorDe(p: Preencher, token: string) {
    const nome = token.replace(/[{}\s]/g, '');
    return p.campos.find((c) => c.nome === nome)?.valor || token;
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

  moverBloco(f: Nota, i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= f.blocos.length) return;
    [f.blocos[i], f.blocos[j]] = [f.blocos[j], f.blocos[i]];
  }
}

const bloco = (): Bloco => ({ id: novoId(), label: '', conteudo: '' });
