import { Component, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
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
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Em lote
          <button class="btn mini fim" [disabled]="!lote()" (click)="ui.copiar(lote(), 'Lote copiado!')">Copiar</button>
        </h4>
        <div class="ft-linha">
          <select [(ngModel)]="loteTipo">
            @for (g of itens; track g.nome) {
              <option [ngValue]="$index">{{ g.nome }}</option>
            }
          </select>
          <input type="number" min="1" max="5000" [(ngModel)]="loteQtd" style="width: 100px" />
          <button class="btn" (click)="gerarLote()">Gerar</button>
        </div>
        <textarea class="ft-texto" readonly rows="8" [value]="lote()"></textarea>
      </div>
    </div>
  `,
})
export class Gerador {
  protected readonly ui = inject(Ui);
  protected readonly comMascara = signal(lerMascara());
  protected readonly itens = [
    this.item('CPF', 'CPF', cpf),
    this.item('CNPJ', 'CNPJ', cnpj),
    this.item('CNPJ alfanumérico', 'CNPJ', cnpjAlfa, 'novo'),
    this.item('RG', 'RG', rg, 'padrão SP'),
  ];

  protected readonly loteTipo = lembrado('gerador.loteTipo', 0);
  protected readonly loteQtd = lembrado('gerador.loteQtd', 10);
  protected readonly lote = signal('');

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

  // sem repetidos; com máscara conforme a opção acima
  gerarLote() {
    const g = this.itens[this.loteTipo()];
    const qtd = Math.min(Math.max(Math.floor(this.loteQtd()) || 1, 1), 5000);
    const l = new Set<string>();
    while (l.size < qtd) l.add(g.gerar());
    this.lote.set([...l].map((v) => (this.comMascara() ? mascarar(g.tipo, v) : v)).join('\n'));
  }

  alternarMascara() {
    this.comMascara.update((v) => !v);
    try {
      localStorage.setItem('devtools:mascara', String(this.comMascara()));
    } catch {}
  }
}
