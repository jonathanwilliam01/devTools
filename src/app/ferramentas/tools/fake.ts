import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Ui } from '../../ui';
import { empresa, pessoa } from '../lib/fake';
import { mascarar } from '../lib/docs';
import { objetosParaCsv, objetosParaInsert } from '../lib/csv';

type Tipo = 'pessoa' | 'empresa';
type Registro = Record<string, string>;

@Component({
  selector: 'ft-fake',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="tipo() === 'pessoa'" (click)="trocar('pessoa')">Pessoa</button>
          <button [class.on]="tipo() === 'empresa'" (click)="trocar('empresa')">Empresa</button>
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="comMascara" (ngModelChange)="gerar()" /> CPF/CNPJ com máscara</label>
        <span class="ft-dica"><kbd>n</kbd> gera de novo</span>
        <button class="btn mini ghost fim" (click)="ui.copiar(json(atual()))">Copiar JSON</button>
        <button class="btn primario" (click)="gerar()">↻ Gerar</button>
      </div>

      <dl class="ft-kv">
        @for (c of chaves(atual()); track c) {
          <dt>{{ c }}</dt>
          <dd class="ft-copia" (click)="ui.copiar(atual()[c])">{{ atual()[c] || '—' }}</dd>
        }
      </dl>

      <div class="ft-painel">
        <h4 class="ft-titulo">
          Em lote
          <button class="btn mini fim" [disabled]="!lote()" (click)="ui.copiar(lote(), 'Lote copiado!')">Copiar</button>
        </h4>
        <div class="ft-linha">
          <input type="number" min="1" max="1000" [(ngModel)]="qtd" style="width: 90px" />
          <div class="ft-seg">
            <button [class.on]="formato() === 'json'" (click)="formato.set('json')">JSON</button>
            <button [class.on]="formato() === 'csv'" (click)="formato.set('csv')">CSV</button>
            <button [class.on]="formato() === 'insert'" (click)="formato.set('insert')">INSERT</button>
          </div>
          @if (formato() === 'insert') {
            <input [(ngModel)]="tabela" placeholder="tabela" style="width: 160px" />
          }
          <button class="btn" (click)="gerarLote()">Gerar</button>
        </div>
        <textarea class="ft-texto" readonly rows="10" [value]="lote()"></textarea>
      </div>
      <p class="ft-dica">CPF, CNPJ e RG têm dígitos válidos. Nomes, ruas e e-mails são inventados; CEP fica na faixa da cidade, mas pode não existir. Código IBGE é o real do município.</p>
    </div>
  `,
})
export class Fake {
  protected readonly ui = inject(Ui);
  protected readonly tipo = signal<Tipo>('pessoa');
  protected readonly comMascara = signal(true);
  protected readonly atual = signal<Registro>({});
  protected readonly qtd = signal(10);
  protected readonly formato = signal<'json' | 'csv' | 'insert'>('json');
  protected readonly tabela = signal('');
  protected readonly lote = signal('');

  constructor() {
    this.gerar();
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => a === 'novo' && this.gerar());
  }

  private novo(): Registro {
    const r: Registro = this.tipo() === 'pessoa' ? pessoa() : empresa();
    if (this.comMascara()) {
      if (r['cpf']) r['cpf'] = mascarar('CPF', r['cpf']);
      if (r['cnpj']) r['cnpj'] = mascarar('CNPJ', r['cnpj']);
    }
    return r;
  }

  chaves = (r: Registro) => Object.keys(r);
  json = (r: unknown) => JSON.stringify(r, null, 2);

  gerar() {
    this.atual.set(this.novo());
  }

  trocar(t: Tipo) {
    this.tipo.set(t);
    this.gerar();
    this.lote.set('');
  }

  gerarLote() {
    const n = Math.min(Math.max(Math.floor(this.qtd()) || 1, 1), 1000);
    const l = Array.from({ length: n }, () => this.novo());
    const f = this.formato();
    this.lote.set(
      f === 'json' ? this.json(l) : f === 'csv' ? objetosParaCsv(l, ';') : objetosParaInsert(l, this.tabela().trim() || this.tipo()),
    );
  }
}
