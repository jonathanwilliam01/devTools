import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Ui } from '../../ui';
import { cnpj, cnpjAlfa, cpf, mascarar, rg, TipoDoc } from '../lib/docs';

const lerMascara = () => {
  try {
    return localStorage.getItem('devtools:mascara') !== 'false';
  } catch {
    return true;
  }
};

@Component({
  selector: 'ft-gerador',
  template: `
    <div class="ft">
      <div class="ft-linha">
        <label class="ft-chk"><input type="checkbox" [checked]="comMascara()" (change)="alternarMascara()" /> Com máscara</label>
        <span class="ft-dica"><kbd>n</kbd> gera todos de novo</span>
        <button class="btn primario fim" (click)="gerarTodos()">↻ Gerar todos</button>
      </div>
      <div class="ft-cards">
        @for (g of itens; track g.nome) {
          <article class="ft-painel">
            <h4 class="ft-titulo">
              {{ g.nome }}
              @if (g.nota) {
                <span class="ft-selo">{{ g.nota }}</span>
              }
            </h4>
            <button class="ft-valor" (click)="copiar(g)" title="Clique para copiar">{{ texto(g) }}</button>
            <div class="ft-linha">
              <button class="btn mini ghost" (click)="gerar(g)">↻ Gerar</button>
              <button class="btn mini ghost" (click)="gerar(g); copiar(g)">Gerar e copiar</button>
            </div>
          </article>
        }
      </div>
    </div>
  `,
})
export class Gerador {
  private readonly ui = inject(Ui);
  protected readonly comMascara = signal(lerMascara());
  protected readonly itens = [
    this.item('CPF', 'CPF', cpf),
    this.item('CNPJ', 'CNPJ', cnpj),
    this.item('CNPJ alfanumérico', 'CNPJ', cnpjAlfa, 'novo'),
    this.item('RG', 'RG', rg, 'padrão SP'),
  ];

  constructor() {
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => a === 'novo' && this.gerarTodos());
  }

  private item(nome: string, tipo: TipoDoc, gerar: () => string, nota = '') {
    return { nome, tipo, gerar, nota, valor: signal(gerar()) };
  }

  texto(g: (typeof this.itens)[number]) {
    return this.comMascara() ? mascarar(g.tipo, g.valor()) : g.valor();
  }

  gerar(g: (typeof this.itens)[number]) {
    g.valor.set(g.gerar());
  }

  gerarTodos() {
    this.itens.forEach((g) => this.gerar(g));
  }

  copiar(g: (typeof this.itens)[number]) {
    this.ui.copiar(this.texto(g), `${g.nome} copiado!`);
  }

  alternarMascara() {
    this.comMascara.update((v) => !v);
    try {
      localStorage.setItem('devtools:mascara', String(this.comMascara()));
    } catch {}
  }
}
