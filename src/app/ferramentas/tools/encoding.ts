import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { caracteres, corrigir, simularMojibake } from '../lib/encoding';

@Component({
  selector: 'ft-encoding',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-seg">
        <button [class.on]="modo() === 'corrigir'" (click)="modo.set('corrigir')">Corrigir (Ã§ → ç)</button>
        <button [class.on]="modo() === 'simular'" (click)="modo.set('simular')">Simular (ç → Ã§)</button>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="8" spellcheck="false" [placeholder]="modo() === 'corrigir' ? 'Ex.: ConfiguraÃ§Ã£o' : 'Ex.: Configuração'"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            @if (resultado().selo; as s) {
              <span class="ft-selo" [class.ok]="resultado().ok" [class.erro]="!resultado().ok">{{ s }}</span>
            }
            <button class="btn mini fim" [disabled]="!resultado().texto" (click)="ui.copiar(resultado().texto)">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="8" [value]="resultado().texto"></textarea>
        </div>
      </div>
      @if (chars().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">Caracteres especiais do texto</h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>Caractere</th><th>Código</th><th>UTF-8</th><th>Latin1 / 1252</th><th>Qtd</th></tr>
            </thead>
            <tbody>
              @for (c of chars(); track c.cp) {
                <tr>
                  <td class="ft-mono">{{ c.c }}</td>
                  <td class="ft-mono">{{ c.cp }}</td>
                  <td class="ft-mono">{{ c.utf8 }}</td>
                  <td class="ft-mono">{{ c.latin1 }}</td>
                  <td>{{ c.n }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">Corrige texto gravado em UTF-8 e lido como Latin1/Windows-1252 (comum entre Delphi, PHP e banco), inclusive quando convertido mais de uma vez. Texto com � já perdeu o caractere e não tem volta.</p>
    </div>
  `,
})
export class Encoding {
  protected readonly ui = inject(Ui);
  protected readonly texto = signal('');
  protected readonly modo = signal<'corrigir' | 'simular'>('corrigir');

  protected readonly resultado = computed(() => {
    const t = this.texto();
    if (!t) return { texto: '', selo: '', ok: true };
    if (this.modo() === 'simular') return { texto: simularMojibake(t), selo: '', ok: true };
    const r = corrigir(t);
    return r.vezes
      ? { texto: r.texto, selo: r.vezes > 1 ? `corrigido ${r.vezes}x` : 'corrigido', ok: true }
      : { texto: t, selo: 'nada a corrigir', ok: false };
  });

  protected readonly chars = computed(() => caracteres(this.texto()));
}
