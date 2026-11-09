import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { arrayParaJson, paraJson } from '../lib/arrayjson';
import { lembrado } from '../lib/estado';

@Component({
  selector: 'ft-arrayjson',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="!compacto()" (click)="compacto.set(false)">Formatado</button>
          <button [class.on]="compacto()" (click)="compacto.set(true)">Compacto</button>
        </div>
        @if (resultado(); as r) {
          @if (r.erro) {
            <span class="ft-selo erro">✕ Não reconhecido</span>
          } @else {
            <span class="ft-selo ok">✓ Convertido</span>
          }
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Array</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="18" spellcheck="false"
            placeholder="array('id' => 1, 'itens' => [1, 2]), print_r, var_dump ou hash Ruby"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            JSON
            <button class="btn mini fim" [disabled]="!resultado()?.saida" (click)="ui.copiar(resultado()!.saida)">Copiar</button>
          </h4>
          @if (resultado()?.erro; as e) {
            <p class="ft-aviso">{{ e }}</p>
          }
          <textarea class="ft-texto" readonly rows="18" spellcheck="false" [value]="resultado()?.saida ?? ''"></textarea>
        </div>
      </div>
      <p class="ft-dica">Aceita array do PHP (array() ou []), saída de print_r, var_dump e var_export, hash do Ruby e objeto JS. Chaves 0, 1, 2... em ordem viram lista. Variáveis e chamadas viram texto. No print_r os valores ficam como texto.</p>
    </div>
  `,
})
export class ArrayJson {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('arrayjson.texto', '');
  protected readonly compacto = lembrado('arrayjson.compacto', false);

  protected readonly resultado = computed(() => {
    if (!this.texto().trim()) return null;
    try {
      return { saida: paraJson(arrayParaJson(this.texto()), this.compacto() ? 0 : 2), erro: '' };
    } catch (e) {
      return { saida: '', erro: (e as Error).message };
    }
  });
}
