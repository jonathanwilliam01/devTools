import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { codificar, decodificar, FormatoEntidade } from '../lib/entidades';

@Component({
  selector: 'ft-entidades',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'cod'" (click)="modo.set('cod')">Texto → HTML</button>
          <button [class.on]="modo() === 'dec'" (click)="modo.set('dec')">HTML → texto</button>
        </div>
        @if (modo() === 'cod') {
          <div class="ft-seg">
            <button [class.on]="formato() === 'nome'" (click)="formato.set('nome')" title="&amp;atilde; (número quando não há nome)">Nome</button>
            <button [class.on]="formato() === 'decimal'" (click)="formato.set('decimal')" title="&amp;#227;">Decimal</button>
            <button [class.on]="formato() === 'hex'" (click)="formato.set('hex')" title="&amp;#xE3;">Hex</button>
          </div>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="especiais" /> Escapar &lt; &gt; &amp; " '</label>
        }
        <button class="btn mini ghost fim" (click)="trocar()" title="Usa o resultado como entrada e inverte a operação">⇄ Inverter</button>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">{{ modo() === 'cod' ? 'Texto' : 'HTML com entidades' }}</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="10" spellcheck="false"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ modo() === 'cod' ? 'HTML com entidades' : 'Texto' }}
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="10" [value]="saida()"></textarea>
        </div>
      </div>
      <p class="ft-dica">Acentos e símbolos viram entidade (ã → &amp;atilde;); o resto do texto fica como está.</p>
    </div>
  `,
})
export class Entidades {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('entidades.texto', '');
  protected readonly modo = lembrado<'cod' | 'dec'>('entidades.modo', 'cod');
  protected readonly formato = lembrado<FormatoEntidade>('entidades.formato', 'nome');
  protected readonly especiais = lembrado('entidades.especiais', false);

  protected readonly saida = computed(() =>
    this.modo() === 'cod'
      ? codificar(this.texto(), { formato: this.formato(), especiais: this.especiais() })
      : decodificar(this.texto()),
  );

  trocar() {
    this.texto.set(this.saida());
    this.modo.update((m) => (m === 'cod' ? 'dec' : 'cod'));
  }
}
