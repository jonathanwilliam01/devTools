import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { diffLinhas } from '../lib/diff';

@Component({
  selector: 'ft-diff',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="espacos" /> Ignorar espaços</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="caixa" /> Ignorar maiúsculas</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="soDif" /> Só diferenças</label>
        <button class="btn mini ghost fim" (click)="trocar()">⇄ Trocar lados</button>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Antes</h4>
          <textarea class="ft-texto" [(ngModel)]="antes" rows="10" spellcheck="false"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Depois</h4>
          <textarea class="ft-texto" [(ngModel)]="depois" rows="10" spellcheck="false"></textarea>
        </div>
      </div>
      @if (resultado(); as r) {
        @if (r.erro) {
          <p class="ft-aviso">{{ r.erro }}</p>
        } @else {
          <div class="ft-painel">
            <h4 class="ft-titulo">
              Diferenças
              @if (r.removidas || r.incluidas) {
                <span class="ft-selo erro">−{{ r.removidas }}</span>
                <span class="ft-selo ok">+{{ r.incluidas }}</span>
              } @else {
                <span class="ft-selo ok">✓ Textos iguais</span>
              }
            </h4>
            <div class="ft-diff">
              @for (l of r.linhas; track $index) {
                <span class="n">{{ l.a ?? '' }}</span><span class="n">{{ l.b ?? '' }}</span>
                <span [class]="'l ' + (l.tipo === '-' ? 'rem' : l.tipo === '+' ? 'inc' : '')">{{ l.tipo === '=' ? ' ' : l.tipo }} {{ l.texto }}</span>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class Diff {
  protected readonly antes = signal('');
  protected readonly depois = signal('');
  protected readonly espacos = signal(false);
  protected readonly caixa = signal(false);
  protected readonly soDif = signal(false);

  protected readonly resultado = computed(() => {
    if (!this.antes() && !this.depois()) return null;
    try {
      const l = diffLinhas(this.antes(), this.depois(), { espacos: this.espacos(), caixa: this.caixa() });
      return {
        erro: '',
        linhas: this.soDif() ? l.filter((x) => x.tipo !== '=') : l,
        removidas: l.filter((x) => x.tipo === '-').length,
        incluidas: l.filter((x) => x.tipo === '+').length,
      };
    } catch (e) {
      return { erro: (e as Error).message, linhas: [], removidas: 0, incluidas: 0 };
    }
  });

  trocar() {
    const a = this.antes();
    this.antes.set(this.depois());
    this.depois.set(a);
  }
}
