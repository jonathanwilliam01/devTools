import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { b64Decode, b64Encode, Charset, decode5t, encode5t } from '../lib/texto';

@Component({
  selector: 'ft-base64',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="!cinco()" (click)="cinco.set(false)">Base64</button>
          <button [class.on]="cinco()" (click)="cinco.set(true)">5x (encode5t)</button>
        </div>
        <div class="ft-seg">
          <button [class.on]="modo() === 'cod'" (click)="modo.set('cod')">Codificar</button>
          <button [class.on]="modo() === 'dec'" (click)="modo.set('dec')">Decodificar</button>
        </div>
        <label class="ft-chk">
          Charset
          <select [(ngModel)]="charset">
            <option value="utf-8">UTF-8</option>
            <option value="iso-8859-1">ISO-8859-1</option>
          </select>
        </label>
        <button class="btn mini ghost fim" (click)="trocar()" title="Usa o resultado como entrada e inverte a operação">⇄ Inverter</button>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">{{ modo() === 'cod' ? 'Texto' : cinco() ? 'Valor encode5t' : 'Base64' }}</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="10" spellcheck="false"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ modo() === 'dec' ? 'Texto' : cinco() ? 'Valor encode5t' : 'Base64' }}
            <button class="btn mini fim" [disabled]="!resultado().saida" (click)="ui.copiar(resultado().saida)">Copiar</button>
          </h4>
          @if (resultado().erro; as e) {
            <p class="ft-aviso">{{ e }}</p>
          }
          <textarea class="ft-texto" readonly rows="10" [value]="resultado().saida"></textarea>
        </div>
      </div>
      @if (cinco()) {
        <p class="ft-dica">encode5t: 5 vezes base64 seguido de inversão da string. Não é criptografia.</p>
      }
    </div>
  `,
})
export class Base64 {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('base64.texto', '');
  protected readonly cinco = lembrado('base64.cinco', false);
  protected readonly modo = lembrado<'cod' | 'dec'>('base64.modo', 'cod');
  protected readonly charset = lembrado<Charset>('base64.charset', 'utf-8');

  protected readonly resultado = computed(() => {
    const t = this.texto();
    if (!t) return { saida: '', erro: '' };
    const cs = this.charset();
    try {
      const saida = this.modo() === 'cod' ? (this.cinco() ? encode5t : b64Encode)(t, cs) : (this.cinco() ? decode5t : b64Decode)(t, cs);
      return { saida, erro: '' };
    } catch {
      return { saida: '', erro: 'Valor não é um base64 válido.' };
    }
  });

  trocar() {
    this.texto.set(this.resultado().saida);
    this.modo.update((m) => (m === 'cod' ? 'dec' : 'cod'));
  }
}
