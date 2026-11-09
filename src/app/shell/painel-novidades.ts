import { Component, input, output } from '@angular/core';
import { dataBr } from '../models';
import { TipoNovidade, Versao } from '../novidades';

@Component({
  selector: 'app-painel-novidades',
  template: `
    <div class="overlay" (click)="fechar.emit()">
      <div
        class="dialogo novidades"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tit-novidades"
        (click)="$event.stopPropagation()"
      >
        <header>
          <h2 id="tit-novidades">Novidades</h2>
          <button class="btn mini ghost" (click)="fechar.emit()" title="Fechar (Esc)">✕</button>
        </header>
        <div class="lista">
          @for (v of versoes(); track v.versao) {
            <section>
              <h3>
                v{{ v.versao }} <small>{{ dataBr(v.data) }}</small>
              </h3>
              <ul>
                @for (i of v.itens; track $index) {
                  <li>
                    <span class="flag" [attr.data-tipo]="i.tipo">{{ ROTULO[i.tipo] }}</span>
                    <span>{{ i.texto }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
        <div class="rodape">
          <button class="btn primario" (click)="fechar.emit()" autofocus>Entendi</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .overlay {
      z-index: 70;
    }
    .novidades {
      width: min(560px, 100%);
      max-height: min(80vh, 640px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .lista {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: grid;
      align-content: start;
      gap: 16px;
      padding-right: 4px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 14px;
      font-family: var(--mono);
    }
    h3 small {
      color: var(--texto-2);
      font-weight: 400;
      margin-left: 6px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    li {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .flag {
      flex: none;
      min-width: 76px;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      padding: 1px 8px;
      border-radius: 999px;
      color: #fff;
    }
    .flag[data-tipo='novidade'] {
      background: var(--acento);
    }
    .flag[data-tipo='melhoria'] {
      background: var(--p-baixa);
    }
    .flag[data-tipo='correcao'] {
      background: var(--p-alta);
    }
    :host-context([data-theme='dark']) .flag {
      color: #0b1220;
    }
  `,
})
export class PainelNovidades {
  readonly versoes = input.required<Versao[]>();
  readonly fechar = output<void>();
  protected readonly dataBr = dataBr;
  protected readonly ROTULO: Record<TipoNovidade, string> = {
    novidade: 'Novidade',
    melhoria: 'Melhoria',
    correcao: 'Correção',
  };
}
