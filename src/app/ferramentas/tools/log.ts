import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { assinatura, lerLog, Nivel } from '../lib/log';

const NIVEIS: [Nivel, string][] = [
  ['fatal', 'Fatal'],
  ['erro', 'Erro'],
  ['aviso', 'Aviso'],
  ['info', 'Info'],
  ['debug', 'Debug'],
  ['outro', 'Outro'],
];
const MAX = 500;

@Component({
  selector: 'ft-log',
  imports: [FormsModule],
  styles: `
    .ft-log { display: grid; gap: 4px; max-height: 520px; overflow: auto; }
    .ft-log details { border: 1px solid var(--borda); border-radius: 6px; padding: 4px 8px; }
    .ft-log summary { display: flex; gap: 8px; align-items: baseline; cursor: pointer; font-size: 13px; }
    .ft-log summary .ft-mono { white-space: nowrap; color: var(--texto-2); }
    .ft-log summary span:last-child { overflow-wrap: anywhere; }
    .ft-log pre { margin: 6px 0 2px; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .ft-log .sem-corpo summary { list-style: none; cursor: default; }
    .ft-selo.fatal, .ft-selo.erro { background: color-mix(in srgb, var(--perigo) 14%, transparent); color: var(--perigo); }
    .ft-selo.aviso { background: color-mix(in srgb, orange 18%, transparent); color: orange; }
  `,
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Log
          @if (entradas().length) {
            <span class="ft-selo">{{ entradas().length }} entradas</span>
          }
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="8" spellcheck="false" placeholder="error_log do PHP, log do Apache, PostgreSQL, Monolog, Rails, Zend..."></textarea>
      </div>
      @if (entradas().length) {
        <div class="ft-linha">
          @for (n of NIVEIS; track n[0]) {
            @if (contagem()[n[0]]) {
              <label class="ft-chk"><input type="checkbox" [checked]="!ocultos().includes(n[0])" (change)="alternar(n[0])" />
                <span class="ft-selo" [class]="n[0]">{{ n[1] }} {{ contagem()[n[0]] }}</span></label>
            }
          }
        </div>
        <div class="ft-linha">
          <input type="search" [(ngModel)]="busca" placeholder="Contém... (vários com |)" style="flex: 1; min-width: 180px" />
          @if (temData()) {
            <label class="ft-chk">De <input type="datetime-local" step="1" [(ngModel)]="de" /></label>
            <label class="ft-chk">Até <input type="datetime-local" step="1" [(ngModel)]="ate" /></label>
          }
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="agrupar" /> Agrupar iguais</label>
          <button class="btn mini fim" [disabled]="!filtradas().length" (click)="copiar()">Copiar filtradas</button>
        </div>
        @if (agrupar()) {
          <div class="ft-painel">
            <table class="ft-tabela">
              <thead>
                <tr><th>Qtd</th><th>Nível</th><th>Primeira</th><th>Última</th><th>Mensagem</th></tr>
              </thead>
              <tbody>
                @for (g of grupos().slice(0, MAX); track g.chave) {
                  <tr>
                    <td>{{ g.qtd }}</td>
                    <td><span class="ft-selo" [class]="g.nivel">{{ g.nivel }}</span></td>
                    <td class="ft-mono">{{ g.primeira }}</td>
                    <td class="ft-mono">{{ g.ultima }}</td>
                    <td class="ft-mono">{{ g.msg }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="ft-log">
            @for (e of filtradas().slice(0, MAX); track e.n) {
              <details [class.sem-corpo]="!e.corpo">
                <summary>
                  <span class="ft-selo" [class]="e.nivel">{{ e.nivel }}</span>
                  <span class="ft-mono">L{{ e.n }}</span>
                  <span class="ft-mono">{{ e.msg }}</span>
                </summary>
                @if (e.corpo) {
                  <pre class="ft-mono">{{ e.corpo }}</pre>
                }
              </details>
            } @empty {
              <p class="ft-dica">Nada com esses filtros.</p>
            }
          </div>
        }
        @if (filtradas().length > MAX) {
          <p class="ft-dica">Mostrando {{ MAX }} de {{ filtradas().length }}. Refine o filtro ou use "Copiar filtradas".</p>
        }
      }
      <p class="ft-dica">Cada entrada começa na linha com data/hora; stack trace e DETAIL/STATEMENT do PostgreSQL ficam dentro dela (clique para abrir). Agrupar junta mensagens que só mudam números e textos entre aspas.</p>
    </div>
  `,
})
export class Log {
  protected readonly ui = inject(Ui);
  protected readonly NIVEIS = NIVEIS;
  protected readonly MAX = MAX;
  protected readonly texto = lembrado('log.texto', '');
  protected readonly ocultos = lembrado<Nivel[]>('log.ocultos', []);
  protected readonly busca = lembrado('log.busca', '');
  protected readonly de = lembrado('log.de', '');
  protected readonly ate = lembrado('log.ate', '');
  protected readonly agrupar = lembrado('log.agrupar', false);

  protected readonly entradas = computed(() => lerLog(this.texto()));
  protected readonly temData = computed(() => this.entradas().some((e) => e.data));
  protected readonly contagem = computed(() => {
    const c: Partial<Record<Nivel, number>> = {};
    for (const e of this.entradas()) c[e.nivel] = (c[e.nivel] ?? 0) + 1;
    return c;
  });

  protected readonly filtradas = computed(() => {
    const termos = this.busca().toLowerCase().split('|').map((t) => t.trim()).filter(Boolean);
    const de = this.de().replace('T', ' ');
    const ate = this.ate().replace('T', ' ');
    const oc = this.ocultos();
    return this.entradas().filter(
      (e) =>
        !oc.includes(e.nivel) &&
        (!de || !e.data || e.data >= de) &&
        // até sem segundos inclui o minuto inteiro
        (!ate || !e.data || e.data <= (ate.length === 16 ? ate + ':59' : ate)) &&
        (!termos.length || termos.some((t) => (e.msg + '\n' + e.corpo).toLowerCase().includes(t))),
    );
  });

  protected readonly grupos = computed(() => {
    const m = new Map<string, { chave: string; qtd: number; nivel: Nivel; primeira: string; ultima: string; msg: string }>();
    for (const e of this.filtradas()) {
      const chave = e.nivel + assinatura(e.msg);
      const quando = e.data || `L${e.n}`;
      const g = m.get(chave);
      if (g) {
        g.qtd++;
        g.ultima = quando;
      } else m.set(chave, { chave, qtd: 1, nivel: e.nivel, primeira: quando, ultima: quando, msg: e.msg });
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  });

  alternar(n: Nivel) {
    this.ocultos.update((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]));
  }

  copiar() {
    this.ui.copiar(this.filtradas().map((e) => e.msg + (e.corpo ? '\n' + e.corpo : '')).join('\n'));
  }
}
