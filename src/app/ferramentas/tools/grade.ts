import { Component, computed, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { FormatoGrade, gerarTabela, lerGrade } from '../lib/grade';
import { contar } from '../lib/listas';

type Vista = FormatoGrade | 'grid';
const MAX_GRID = 1000;

@Component({
  selector: 'ft-grade',
  imports: [FormsModule],
  styles: `
    .gd-filtro {
      flex: 1;
      max-width: 320px;
    }
    .gd-resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .gd-resumo button {
      cursor: pointer;
      border: 0;
    }
    .gd-rolagem {
      overflow: auto;
      max-height: 60vh;
    }
    .gd th {
      cursor: pointer;
      white-space: nowrap;
      position: sticky;
      top: 0;
      background: var(--bg-elev);
    }
    .gd td {
      white-space: nowrap;
    }
    .gd tbody tr:nth-child(even) td {
      background: color-mix(in srgb, var(--texto) 4%, transparent);
    }
  `,
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (f of FORMATOS; track f[0]) {
            <button [class.on]="formato() === f[0]" (click)="formato.set(f[0])">{{ f[1] }}</button>
          }
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="cabecalho" /> 1ª linha é cabeçalho</label>
        @if (formato() === 'ascii' || formato() === 'alinhado') {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="separar" /> Linha entre registros</label>
        }
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Grid
          @if (linhas().length) {
            <span class="ft-selo">{{ linhas().length - (cabecalho() ? 1 : 0) }} linha(s) · {{ colunas() }} coluna(s)</span>
          }
          <label class="btn mini fim">
            Abrir arquivo
            <input type="file" accept=".txt,.csv,.tsv,text/*" hidden (change)="escolher($event)" />
          </label>
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" (dragover)="$event.preventDefault()" (drop)="soltar($event)" rows="8" spellcheck="false" placeholder="Cole o resultado da consulta (DBeaver, pgAdmin, psql, IBExpert) ou um trecho do Excel, ou arraste um .txt/.csv"></textarea>
      </div>
      @if (formato() === 'grid') {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            <input class="gd-filtro" [(ngModel)]="filtro" placeholder="Filtrar..." />
            @if (filtro()) {
              <span class="ft-selo">{{ filtrados().length }} de {{ tabela().corpo.length }}</span>
            }
            <select class="fim" [ngModel]="colResumo()" (ngModelChange)="colResumo.set(+$event)">
              <option [ngValue]="-1">Contar por coluna...</option>
              @for (c of tabela().cab; track $index) {
                <option [ngValue]="$index">{{ c }}</option>
              }
            </select>
            <button class="btn mini" [disabled]="!filtrados().length" (click)="ui.copiar(tsv())" title="Linhas filtradas, separadas por TAB (cola no Excel)">Copiar</button>
          </h4>
          @if (resumo().length) {
            <div class="gd-resumo">
              @for (r of resumo(); track r[0]) {
                <button class="ft-selo" [class.ok]="filtro() === r[0]" (click)="filtro.set(filtro() === r[0] ? '' : r[0])">{{ r[0] || '(vazio)' }} <b>{{ r[1] }}</b></button>
              }
            </div>
          }
          <div class="gd-rolagem">
            <table class="ft-tabela gd">
              <thead>
                <tr>
                  @for (c of tabela().cab; track $index) {
                    <th (click)="ordenarPor($index)">{{ c }}{{ ordem()[0] === $index ? (ordem()[1] ? ' ▲' : ' ▼') : '' }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of filtrados().slice(0, MAX_GRID); track $index) {
                  <tr>
                    @for (c of l; track $index) {
                      <td>{{ c }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (filtrados().length > MAX_GRID) {
            <p class="ft-dica">Mostrando {{ MAX_GRID }} de {{ filtrados().length }}; filtre para ver o resto (Copiar leva todas).</p>
          }
        </div>
      } @else {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Tabela
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="12" [value]="saida()" wrap="off"></textarea>
        </div>
      }
      <p class="ft-dica">Separador detectado sozinho: TAB, ponto e vírgula, vírgula ou | (psql). Visualizar: clique no cabeçalho para ordenar; "Contar por coluna" mostra quantos registros há de cada valor (clique para filtrar).</p>
    </div>
  `,
})
export class Grade {
  protected readonly ui = inject(Ui);
  protected readonly MAX_GRID = MAX_GRID;
  protected readonly FORMATOS: [Vista, string][] = [
    ['grid', 'Visualizar'],
    ['markdown', 'Markdown'],
    ['ascii', 'Caixa ASCII'],
    ['alinhado', 'Texto alinhado'],
    ['html', 'HTML'],
  ];
  protected readonly texto = lembrado('grade.texto', '');
  protected readonly formato = lembrado<Vista>('grade.formato', 'markdown');
  protected readonly cabecalho = lembrado('grade.cabecalho', true);
  protected readonly separar = lembrado('grade.separar', false);

  protected readonly linhas = computed(() => lerGrade(this.texto()));
  protected readonly colunas = computed(() => Math.max(0, ...this.linhas().map((l) => l.length)));
  protected readonly saida = computed(() => {
    const f = this.formato();
    return f === 'grid' ? '' : gerarTabela(this.linhas(), f, this.cabecalho(), this.separar());
  });

  protected readonly filtro = signal('');
  protected readonly colResumo = signal(-1);
  // [coluna, crescente]
  protected readonly ordem = signal<[number, boolean]>([-1, true]);

  protected readonly tabela = computed(() => {
    const l = this.linhas();
    const n = this.colunas();
    const t = l.map((x) => Array.from({ length: n }, (_, i) => x[i] ?? ''));
    return this.cabecalho() && t.length ? { cab: t[0], corpo: t.slice(1) } : { cab: t[0]?.map((_, i) => `Coluna ${i + 1}`) ?? [], corpo: t };
  });

  protected readonly filtrados = computed(() => {
    const f = this.filtro().toLowerCase();
    const [col, asc] = this.ordem();
    let l = f ? this.tabela().corpo.filter((x) => x.some((c) => c.toLowerCase().includes(f))) : this.tabela().corpo;
    if (col >= 0) {
      const num = l.every((x) => !x[col] || /^-?\d+([.,]\d+)?$/.test(x[col]));
      l = [...l].sort((a, b) => {
        const r = num ? +a[col].replace(',', '.') - +b[col].replace(',', '.') : a[col].localeCompare(b[col], 'pt-BR', { numeric: true });
        return asc ? r : -r;
      });
    }
    return l;
  });

  protected readonly resumo = computed(() => {
    const c = this.colResumo();
    return c < 0 ? [] : contar(this.tabela().corpo.map((x) => x[c]));
  });

  protected readonly tsv = computed(() => [this.tabela().cab, ...this.filtrados()].map((l) => l.join('\t')).join('\n'));

  ordenarPor(i: number) {
    const [c, asc] = this.ordem();
    this.ordem.set(c !== i ? [i, true] : asc ? [i, false] : [-1, true]);
  }

  private async ler(f?: File | null) {
    if (!f) return;
    const b = await f.arrayBuffer();
    // UTF-8 inválido: arquivo veio em Latin1/ANSI
    try {
      this.texto.set(new TextDecoder('utf-8', { fatal: true }).decode(b));
    } catch {
      this.texto.set(new TextDecoder('windows-1252').decode(b));
    }
  }

  escolher(e: Event) {
    const inp = e.target as HTMLInputElement;
    this.ler(inp.files?.[0]);
    inp.value = '';
  }

  soltar(e: DragEvent) {
    const f = e.dataTransfer?.files[0];
    if (!f) return;
    e.preventDefault();
    this.ler(f);
  }
}
