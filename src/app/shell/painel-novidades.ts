import { Component, inject, input, output, signal } from '@angular/core';
import { Ui } from '../ui';
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
          @for (v of versoes(); track v.versao; let primeira = $first) {
            <details [open]="primeira">
              <summary>
                v{{ v.versao }} <small>{{ dataBr(v.data) }} · {{ v.itens.length }}</small>
                <button class="btn mini ghost copiar" (click)="$event.preventDefault(); copiar(v)"
                  [title]="qtd(v) ? 'Copiar as linhas marcadas' : 'Copiar todas as notas da versão'">
                  {{ qtd(v) ? 'Copiar ' + qtd(v) : 'Copiar' }}
                </button>
              </summary>
              <ul>
                @for (i of v.itens; track $index) {
                  <li [class.marcada]="marcadas().has(i)" (click)="marcar(i)" title="Clique para marcar e copiar só as linhas escolhidas">
                    <span class="flag" [attr.data-tipo]="i.tipo">{{ ROTULO[i.tipo] }}</span>
                    <span>{{ i.texto }}</span>
                  </li>
                }
              </ul>
            </details>
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
      gap: 10px;
      padding-right: 4px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      font-family: var(--mono);
    }
    details[open] summary {
      margin-bottom: 8px;
    }
    .copiar {
      float: right;
      font-family: inherit;
    }
    li {
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
    }
    li:hover {
      background: var(--bg-2);
    }
    li.marcada {
      background: var(--acento-bg);
    }
    summary small {
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
  private readonly ui = inject(Ui);
  protected readonly marcadas = signal(new Set<Versao['itens'][number]>());

  marcar(i: Versao['itens'][number]) {
    const s = new Set(this.marcadas());
    if (!s.delete(i)) s.add(i);
    this.marcadas.set(s);
  }

  qtd(v: Versao) {
    return v.itens.filter((i) => this.marcadas().has(i)).length;
  }

  // só as marcadas da versão; sem marcação, todas
  copiar(v: Versao) {
    const itens = this.qtd(v) ? v.itens.filter((i) => this.marcadas().has(i)) : v.itens;
    const linhas = itens.map((i) => `- ${this.ROTULO[i.tipo]}: ${i.texto}`);
    this.ui.copiar(`v${v.versao} (${this.dataBr(v.data)})\n${linhas.join('\n')}`);
  }
}
