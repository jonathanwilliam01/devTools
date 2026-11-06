import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { converterCasos } from '../lib/caixa';

@Component({
  selector: 'ft-caixa',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">Texto</h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="4" spellcheck="false" placeholder="Ex.: código do contribuinte, valorTotalParcela, DATA_VENCIMENTO (um por linha para converter vários)" style="min-height: 0"></textarea>
      </div>
      <dl class="ft-kv">
        @for (c of resultado(); track c[0]) {
          <dt>{{ c[0] }}</dt>
          <dd class="ft-copia" style="white-space: pre-wrap" (click)="ui.copiar(c[1])">{{ c[1] || '—' }}</dd>
        }
      </dl>
      <p class="ft-dica">Clique para copiar. Formatos de código (camel, snake etc.) removem acentos; Título deixa de, da, do, e... em minúsculo.</p>
    </div>
  `,
})
export class Caixa {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('caixa.texto', '');
  protected readonly resultado = computed(() => converterCasos(this.texto()));
}
