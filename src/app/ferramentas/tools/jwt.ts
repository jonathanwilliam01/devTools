import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lerJwt } from '../lib/texto';

const CLAIMS_DATA = ['exp', 'iat', 'nbf', 'auth_time'];
const NOMES: Record<string, string> = { exp: 'Expira em', iat: 'Emitido em', nbf: 'Válido a partir de', auth_time: 'Autenticado em' };

@Component({
  selector: 'ft-jwt',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Token
          @if (leitura(); as l) {
            @if (l.expirado === true) {
              <span class="fim ft-selo erro">✕ Expirado</span>
            } @else if (l.expirado === false) {
              <span class="fim ft-selo ok">✓ Dentro da validade</span>
            }
          }
        </h4>
        <textarea class="ft-texto ft-jwt" [(ngModel)]="token" rows="4" spellcheck="false" placeholder="eyJhbGciOi... (aceita com 'Bearer ')"></textarea>
        @if (erro()) {
          <p class="ft-aviso">{{ erro() }}</p>
        }
      </div>
      @if (leitura(); as l) {
        @if (l.datas.length) {
          <dl class="ft-kv">
            @for (d of l.datas; track d[0]) {
              <dt>{{ d[0] }}</dt>
              <dd>{{ d[1] }}</dd>
            }
          </dl>
        }
        <div class="ft-duas">
          <div class="ft-painel">
            <h4 class="ft-titulo">
              Header
              <button class="btn mini fim" (click)="ui.copiar(l.header)">Copiar</button>
            </h4>
            <pre class="ft-json">{{ l.header }}</pre>
          </div>
          <div class="ft-painel">
            <h4 class="ft-titulo">
              Payload
              <button class="btn mini fim" (click)="ui.copiar(l.payload)">Copiar</button>
            </h4>
            <pre class="ft-json">{{ l.payload }}</pre>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .ft-json {
      margin: 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--bg-2);
      font-family: var(--mono);
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .ft-jwt {
      word-break: break-all;
    }
  `,
})
export class JwtTool {
  protected readonly ui = inject(Ui);
  protected readonly token = signal('');

  private readonly resultado = computed(() => {
    if (!this.token().trim()) return null;
    try {
      return lerJwt(this.token());
    } catch (e) {
      return (e as Error).message;
    }
  });

  protected readonly erro = computed(() => (typeof this.resultado() === 'string' ? (this.resultado() as string) : ''));

  protected readonly leitura = computed(() => {
    const r = this.resultado();
    if (!r || typeof r === 'string') return null;
    const p = r.payload;
    const datas = CLAIMS_DATA.filter((c) => typeof p[c] === 'number').map((c) => [NOMES[c], new Date((p[c] as number) * 1000).toLocaleString('pt-BR')]);
    return {
      header: JSON.stringify(r.header, null, 2),
      payload: JSON.stringify(p, null, 2),
      datas,
      expirado: typeof p['exp'] === 'number' ? (p['exp'] as number) * 1000 < Date.now() : null,
    };
  });
}
