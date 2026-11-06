import { Component, effect, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { hashes } from '../lib/hash';
import { Charset, paraBin } from '../lib/texto';

@Component({
  selector: 'ft-hash',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Texto
          <label class="ft-chk fim">
            Charset
            <select [(ngModel)]="charset">
              <option value="utf-8">UTF-8</option>
              <option value="iso-8859-1">ISO-8859-1</option>
            </select>
          </label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="maiusculo" /> Maiúsculas</label>
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="6" spellcheck="false"></textarea>
      </div>
      <dl class="ft-kv">
        @for (h of resultado(); track h[0]) {
          <dt>{{ h[0] }}</dt>
          <dd class="ft-copia" (click)="ui.copiar(fmt(h[1]))">{{ fmt(h[1]) }}</dd>
        }
      </dl>
      <p class="ft-dica">Clique no hash para copiar. Texto vazio também gera hash (de string vazia).</p>
    </div>
  `,
})
export class Hash {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('hash.texto', '');
  protected readonly charset = lembrado<Charset>('hash.charset', 'utf-8');
  protected readonly maiusculo = lembrado('hash.maiusculo', false);
  protected readonly resultado = signal<[string, string][]>([]);

  constructor() {
    effect(() => {
      const bytes = Uint8Array.from(paraBin(this.texto(), this.charset()), (c) => c.charCodeAt(0));
      hashes(bytes).then((h) => this.resultado.set(h));
    });
  }

  fmt(h: string) {
    return this.maiusculo() ? h.toUpperCase() : h;
  }
}
