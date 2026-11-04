import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { formatarXml } from '../lib/texto';

@Component({
  selector: 'ft-formatador',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="!minificar()" (click)="minificar.set(false)">Formatar</button>
          <button [class.on]="minificar()" (click)="minificar.set(true)">Compactar</button>
        </div>
        @if (resultado(); as r) {
          @if (r.erro) {
            <span class="ft-selo erro">✕ {{ r.tipo }} inválido</span>
          } @else {
            <span class="ft-selo ok">✓ {{ r.tipo }} válido</span>
          }
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Entrada</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="18" spellcheck="false" placeholder='{"a": 1} ou <xml>...</xml>'></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            <button class="btn mini fim" [disabled]="!resultado()?.saida" (click)="ui.copiar(resultado()!.saida)">Copiar</button>
          </h4>
          @if (resultado()?.erro; as e) {
            <p class="ft-aviso">{{ e }}</p>
          }
          <textarea class="ft-texto" readonly rows="18" spellcheck="false" [value]="resultado()?.saida ?? ''"></textarea>
        </div>
      </div>
      <p class="ft-dica">O tipo é detectado pelo primeiro caractere: &lt; = XML, senão JSON.</p>
    </div>
  `,
})
export class Formatador {
  protected readonly ui = inject(Ui);
  protected readonly texto = signal('');
  protected readonly minificar = signal(false);

  protected readonly resultado = computed(() => {
    const t = this.texto().trim();
    if (!t) return null;
    const tipo = t.startsWith('<') ? 'XML' : 'JSON';
    try {
      const saida = tipo === 'XML' ? formatarXml(t, this.minificar()) : JSON.stringify(JSON.parse(t), null, this.minificar() ? 0 : 2);
      return { tipo, saida, erro: '' };
    } catch (e) {
      return { tipo, saida: '', erro: (e as Error).message };
    }
  });
}
