import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { barrasItf, dataDoFator, fatorDaData, ler, Leitura } from '../lib/boleto';
import { deIso, extenso, hojeIso } from '../lib/datas';

@Component({
  selector: 'ft-boleto',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">Linha digitável ou código de barras</h4>
        <input class="ft-mono" [(ngModel)]="entrada" placeholder="Cole aqui (pontos, espaços e traços são ignorados)" autofocus />
        @if (erroEntrada()) {
          <p class="ft-aviso">{{ erroEntrada() }}</p>
        }
      </div>

      @if (leitura(); as l) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ l.tipo }}
            @if (l.erros.length) {
              <span class="fim ft-selo erro">✕ {{ l.erros.length }} erro(s)</span>
            } @else {
              <span class="fim ft-selo ok">✓ Dígitos conferem</span>
            }
          </h4>
          @if (l.erros.length) {
            <p class="ft-aviso">
              @for (e of l.erros; track e) {
                {{ e }}<br />
              }
            </p>
          }
          <dl class="ft-kv">
            <dt>Linha digitável</dt>
            <dd class="ft-copia" (click)="ui.copiar(l.linha.replace(sep, ''))" title="Copia sem pontuação">{{ l.linha }}</dd>
            <dt>Código de barras</dt>
            <dd class="ft-copia" (click)="ui.copiar(l.barras)">{{ l.barras }}</dd>
            @for (c of l.campos; track c[0]) {
              <dt>{{ c[0] }}</dt>
              <dd class="ft-copia" (click)="ui.copiar(c[1])">{{ c[1] }}</dd>
            }
          </dl>
          @if (svg(); as s) {
            <svg class="ft-barras" [attr.viewBox]="'0 0 ' + s.largura + ' 50'" preserveAspectRatio="none">
              @for (b of s.barras; track $index) {
                <rect [attr.x]="b[0]" [attr.width]="b[1]" height="50" />
              }
            </svg>
          }
          <p class="ft-dica">Na linha de boleto os 3 primeiros campos usam módulo 10 e o DV geral, módulo 11. Na guia de arrecadação o módulo vem do 3º dígito (6/7 = 10, 8/9 = 11).</p>
        </div>
      }

      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Data → fator de vencimento</h4>
          <input type="date" [(ngModel)]="data" />
          @if (fator() !== null) {
            <button class="ft-valor" (click)="ui.copiar(fator()!.toString())">{{ fator() }}</button>
          }
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Fator → data</h4>
          <input type="number" min="0" max="9999" [(ngModel)]="fatorEntrada" placeholder="Ex.: 1000" />
          @if (dataFator(); as d) {
            <button class="ft-valor" (click)="ui.copiar(d)">{{ d }}</button>
          }
        </div>
      </div>
      <p class="ft-dica">O fator reiniciou em 1000 no dia 22/02/2025. Na conversão fator → data é usada a data mais próxima de hoje.</p>
    </div>
  `,
  styles: `
    .ft-barras {
      width: 100%;
      height: 60px;
      background: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      fill: #000;
    }
  `,
})
export class Boleto {
  protected readonly ui = inject(Ui);
  protected readonly sep = /\D/g;
  protected readonly entrada = signal('');
  protected readonly data = signal(hojeIso());
  protected readonly fatorEntrada = signal<number | null>(null);

  private readonly resultado = computed(() => ler(this.entrada()));
  protected readonly leitura = computed(() => (typeof this.resultado() === 'string' ? null : (this.resultado() as Leitura)));
  protected readonly erroEntrada = computed(() => (typeof this.resultado() === 'string' ? (this.resultado() as string) : ''));
  protected readonly svg = computed(() => (this.leitura() ? barrasItf(this.leitura()!.barras) : null));

  protected readonly fator = computed(() => {
    const ms = deIso(this.data());
    return isNaN(ms) ? null : fatorDaData(ms);
  });

  protected readonly dataFator = computed(() => {
    const f = this.fatorEntrada();
    if (f === null || f < 0 || f > 9999) return '';
    const ms = dataDoFator(f);
    return ms ? extenso(ms) : 'Sem vencimento';
  });
}
