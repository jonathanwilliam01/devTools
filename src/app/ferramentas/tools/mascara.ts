import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { identificar, limpar, mascarar } from '../lib/docs';

@Component({
  selector: 'ft-mascara',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'por'" (click)="modo.set('por')">Pôr máscara</button>
          <button [class.on]="modo() === 'tirar'" (click)="modo.set('tirar')">Tirar máscara</button>
        </div>
        @if (modo() === 'tirar') {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="aspas" /> Entre aspas, separado por vírgula</label>
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Entrada</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="10" placeholder="Um valor por linha"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            @if (desconhecidos()) {
              <span class="ft-selo erro">{{ desconhecidos() }} não reconhecido(s)</span>
            }
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="10" [value]="saida()"></textarea>
        </div>
      </div>
      <p class="ft-dica">Detecta pelo tamanho: 11 = CPF, 14 = CNPJ (aceita alfanumérico), 9 = RG, 8 = CEP. Não reconhecidos passam sem alteração.</p>
    </div>
  `,
})
export class Mascara {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('mascara.texto', '');
  protected readonly modo = lembrado<'por' | 'tirar'>('mascara.modo', 'por');
  protected readonly aspas = lembrado('mascara.aspas', false);

  private readonly itens = computed(() =>
    this.texto()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );

  protected readonly desconhecidos = computed(() => this.itens().filter((l) => !identificar(l)).length);

  protected readonly saida = computed(() => {
    if (this.modo() === 'por') return this.itens().map((l) => { const t = identificar(l); return t ? mascarar(t, l) : l; }).join('\n');
    const l = this.itens().map((v) => (identificar(v) ? limpar(v) : v));
    return this.aspas() ? l.map((v) => `'${v}'`).join(', ') : l.join('\n');
  });
}
