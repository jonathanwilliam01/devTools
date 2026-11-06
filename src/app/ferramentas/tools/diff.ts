import { Component, computed } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { diffJson, diffLinhas } from '../lib/diff';

@Component({
  selector: 'ft-diff',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'texto'" (click)="modo.set('texto')">Texto</button>
          <button [class.on]="modo() === 'json'" (click)="modo.set('json')">JSON</button>
        </div>
        @if (modo() === 'texto') {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="espacos" /> Ignorar espaços</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="caixa" /> Ignorar maiúsculas</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="soDif" /> Só diferenças</label>
        } @else {
          <span class="ft-dica">Compara chave a chave; ordem das chaves e formatação não contam. Arrays por posição.</span>
        }
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
      @if (modo() === 'json') {
        @if (resultadoJson(); as r) {
          @if (r.erro) {
            <p class="ft-aviso">{{ r.erro }}</p>
          } @else {
            <div class="ft-painel">
              <h4 class="ft-titulo">
                Diferenças
                @if (r.difs.length) {
                  <span class="ft-selo erro">−{{ r.rem }}</span>
                  <span class="ft-selo ok">+{{ r.inc }}</span>
                  <span class="ft-selo">~{{ r.alt }}</span>
                } @else {
                  <span class="ft-selo ok">✓ JSON equivalentes</span>
                }
              </h4>
              @if (r.difs.length) {
                <table class="ft-tabela">
                  <thead><tr><th></th><th>Caminho</th><th>Antes</th><th>Depois</th></tr></thead>
                  <tbody>
                    @for (d of r.difs; track $index) {
                      <tr>
                        <td [class]="'ft-dj ' + (d.tipo === '-' ? 'rem' : d.tipo === '+' ? 'inc' : 'alt')">{{ d.tipo }}</td>
                        <td class="ft-mono">{{ d.caminho }}</td>
                        <td class="ft-mono">{{ d.antes ?? '' }}</td>
                        <td class="ft-mono">{{ d.depois ?? '' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          }
        }
      } @else if (resultado(); as r) {
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
  styles: `
    .ft-dj {
      width: 1%;
      font-family: var(--mono);
      font-weight: 700;
      text-align: center;
    }
    .ft-dj.rem {
      color: var(--perigo);
    }
    .ft-dj.inc {
      color: var(--p-baixa);
    }
    .ft-dj.alt {
      color: var(--acento);
    }
  `,
})
export class Diff {
  protected readonly antes = lembrado('diff.antes', '');
  protected readonly depois = lembrado('diff.depois', '');
  protected readonly espacos = lembrado('diff.espacos', false);
  protected readonly caixa = lembrado('diff.caixa', false);
  protected readonly soDif = lembrado('diff.soDif', false);

  protected readonly modo = lembrado<'texto' | 'json'>('diff.modo', 'texto');

  protected readonly resultadoJson = computed(() => {
    if (!this.antes().trim() || !this.depois().trim()) return null;
    try {
      const difs = diffJson(this.antes(), this.depois());
      const n = (t: string) => difs.filter((d) => d.tipo === t).length;
      return { erro: '', difs, rem: n('-'), inc: n('+'), alt: n('~') };
    } catch (e) {
      return { erro: (e as Error).message, difs: [], rem: 0, inc: 0, alt: 0 };
    }
  });

  protected readonly resultado = computed(() => {
    if (this.modo() === 'json') return null;
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
