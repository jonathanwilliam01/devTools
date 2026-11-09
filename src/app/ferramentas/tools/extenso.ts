import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { aplicarCaixa, Caixa, formatarMoeda, moedaPorExtenso, numeroPorExtenso } from '../lib/extenso';

@Component({
  selector: 'ft-extenso',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="tipo() === 'moeda'" (click)="tipo.set('moeda')">Reais</button>
          <button [class.on]="tipo() === 'numero'" (click)="tipo.set('numero')">Número</button>
        </div>
        <div class="ft-seg">
          <button [class.on]="caixa() === 'min'" (click)="caixa.set('min')">minúsculas</button>
          <button [class.on]="caixa() === 'pri'" (click)="caixa.set('pri')">Primeira maiúscula</button>
          <button [class.on]="caixa() === 'mai'" (click)="caixa.set('mai')">MAIÚSCULAS</button>
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="parenteses" /> Valor (extenso)</label>
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">Valores <small>um por linha</small></h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="5" spellcheck="false" placeholder="1.234,56&#10;R$ 1000000&#10;0,5"></textarea>
      </div>
      @if (itens().length === 1 && !itens()[0].erro) {
        <button class="ft-valor" style="font-size: 18px" (click)="ui.copiar(itens()[0].saida)">{{ itens()[0].saida }}</button>
      } @else if (itens().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Por extenso
            <button class="btn mini fim" (click)="ui.copiar(todos())">Copiar tudo</button>
          </h4>
          <table class="ft-tabela">
            <tbody>
              @for (i of itens(); track $index) {
                <tr>
                  <td class="ft-mono" style="white-space: nowrap">{{ i.valor }}</td>
                  @if (i.erro) {
                    <td><span class="ft-selo erro">✕ {{ i.erro }}</span></td>
                  } @else {
                    <td class="ft-copia" (click)="ui.copiar(i.saida)">{{ i.saida }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">Aceita 1.234,56, 1234.56 e R$. Em reais, arredonda para centavos. Clique no texto para copiar.</p>
    </div>
  `,
})
export class Extenso {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('extenso.texto', '');
  protected readonly tipo = lembrado<'moeda' | 'numero'>('extenso.tipo', 'moeda');
  protected readonly caixa = lembrado<Caixa>('extenso.caixa', 'min');
  protected readonly parenteses = lembrado('extenso.parenteses', false);

  protected readonly itens = computed(() =>
    this.texto()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((valor) => {
        try {
          const moeda = this.tipo() === 'moeda';
          const t = aplicarCaixa(moeda ? moedaPorExtenso(valor) : numeroPorExtenso(valor), this.caixa());
          return { valor, saida: this.parenteses() ? `${moeda ? formatarMoeda(valor) : valor} (${t})` : t, erro: '' };
        } catch (e) {
          return { valor, saida: '', erro: (e as Error).message };
        }
      }),
  );

  protected readonly todos = computed(() => this.itens().map((i) => i.saida || i.valor).join('\n'));
}
