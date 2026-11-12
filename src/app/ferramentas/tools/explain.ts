import { Component, computed, inject, signal } from '@angular/core';
import { Ui } from '../../ui';
import { FormsModule } from '@angular/forms';
import { lembrado } from '../lib/estado';
import { lerExplain, No } from '../lib/explain';

@Component({
  selector: 'ft-explain',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <details class="ft-painel" [open]="!texto().trim()">
        <summary class="ft-titulo ex-sum">1. Gerar o comando a partir do SELECT</summary>
        <textarea class="ft-texto" [(ngModel)]="sql" rows="5" spellcheck="false" placeholder="select ... from ... where ..."></textarea>
        <div class="ft-linha">
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="analyze" /> ANALYZE (executa a consulta)</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="buffers" [disabled]="!analyze()" /> BUFFERS</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="json" /> FORMAT JSON</label>
        </div>
        @if (comando(); as c) {
          <button class="ft-valor ft-mono" style="white-space: pre-wrap" (click)="ui.copiar(c.sql)">{{ c.sql }}</button>
          @if (c.dml) {
            <p class="ft-aviso">ANALYZE executa de verdade: o comando vai entre BEGIN e ROLLBACK para não gravar nada.</p>
          }
        }
        <ol class="ex-passos">
          <li>Copie o comando acima e rode no banco (psql, DBeaver, pgAdmin).</li>
          <li>Copie <b>todas</b> as linhas da coluna QUERY PLAN (no DBeaver/pgAdmin: selecionar a coluna inteira e copiar).</li>
          <li>Cole no campo Plano abaixo.</li>
        </ol>
      </details>

      <div class="ft-painel">
        <h4 class="ft-titulo">
          2. Plano
          @if (plano(); as p) {
            @if (p.erro) {
              <span class="ft-selo erro">✕ Não reconhecido</span>
            } @else {
              <span class="ft-selo ok">✓ {{ p.plano!.nos.length }} nós{{ p.plano!.analyze ? '' : ' · sem ANALYZE' }}</span>
            }
          }
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="8" spellcheck="false"
          placeholder="Saída de EXPLAIN (ANALYZE, BUFFERS) select ... em texto ou EXPLAIN (ANALYZE, FORMAT JSON)"></textarea>
      </div>

      @if (plano()?.erro; as e) {
        <p class="ft-aviso">{{ e }}</p>
      }
      @if (plano()?.plano; as p) {
        <div class="ft-cards">
          @if (p.analyze) {
            <div class="ft-painel">
              <h4 class="ft-titulo">Execução</h4>
              <span class="ft-grande">{{ ms(p.execucao ?? p.nos[0].total) }}</span>
            </div>
            @if (p.planejamento !== undefined) {
              <div class="ft-painel">
                <h4 class="ft-titulo">Planejamento</h4>
                <span class="ft-grande">{{ ms(p.planejamento) }}</span>
              </div>
            }
          } @else {
            <div class="ft-painel">
              <h4 class="ft-titulo">Custo total</h4>
              <span class="ft-grande">{{ n0(p.nos[0].custo) }}</span>
            </div>
          }
          @if (maisCaro(); as m) {
            <div class="ft-painel">
              <h4 class="ft-titulo">Nó mais pesado · {{ n0(m.pct) }}%</h4>
              <button class="ex-link" (click)="focar(m)">{{ m.rotulo }}</button>
            </div>
          }
        </div>

        @if (p.alertas.length) {
          <div class="ft-painel">
            <h4 class="ft-titulo">Pontos de atenção <span class="ft-selo">{{ p.alertas.length }}</span></h4>
            <ul class="ex-alertas">
              @for (a of p.alertas; track $index) {
                <li [class.alto]="a.alto">
                  @if (a.no) {
                    <button class="ex-link" (click)="focar(a.no)">#{{ a.no.id + 1 }} {{ a.no.rotulo }}</button>
                  }
                  <span>{{ a.msg }}</span>
                </li>
              }
            </ul>
          </div>
        }

        <div class="ft-painel">
          <h4 class="ft-titulo">
            Árvore
            <label class="ft-chk fim"><input type="checkbox" [(ngModel)]="detalhes" /> Detalhes</label>
          </h4>
          <div class="ex-arvore">
            <div class="ex-cab">
              <span>Nó</span>
              <span>{{ p.analyze ? 'Tempo próprio' : 'Custo próprio' }}</span>
              <span>Linhas est. → reais</span>
              <span>Loops</span>
            </div>
            @for (n of p.nos; track n.id) {
              <div class="ex-no" [id]="'ex-no-' + n.id" [class.foco]="foco() === n.id" [class.parado]="n.nuncaExec">
                <div class="ex-rot" [style.padding-left.px]="n.nivel * 18">
                  <span class="ex-num">#{{ n.id + 1 }}</span>
                  <span>
                    {{ n.rotulo }}
                    @if (n.nuncaExec) {
                      <em>(não executado)</em>
                    }
                    @if (detalhes() && n.detalhes.length) {
                      <small class="ex-det">
                        @for (d of n.detalhes; track $index) {
                          <span>{{ d }}</span>
                        }
                      </small>
                    }
                  </span>
                </div>
                <div class="ex-tempo">
                  <span class="ex-barra" [style.width.%]="n.pct" [class.quente]="n.pct >= 20"></span>
                  <span>{{ p.analyze ? ms(n.proprio) : n0(n.proprio) }}</span>
                  <small>{{ n0(n.pct) }}%</small>
                </div>
                <div class="ft-mono">
                  {{ n0(n.linhasEst) }}
                  @if (n.linhasReais !== undefined) {
                    → {{ n0(n.linhasReais) }}
                    @if (n.erro) {
                      <span class="ft-selo erro" [title]="n.erro === 'sub' ? 'Vieram mais linhas que o estimado' : 'Vieram menos linhas que o estimado'">
                        {{ n.erro === 'sub' ? '↑' : '↓' }}{{ n0(n.fator) }}x
                      </span>
                    }
                  }
                </div>
                <div class="ft-mono">{{ n.loops ?? '' }}</div>
              </div>
            }
          </div>
        </div>
      }
      <p class="ft-dica">
        Tempo próprio = tempo do nó menos o dos filhos, já multiplicado pelos loops. ↑/↓ marcam estimativa de linhas errada em 10x ou mais.
        Em nó paralelo o tempo é a média por worker.
      </p>
    </div>
  `,
  styles: `
    .ex-sum { cursor: pointer; }
    .ex-passos { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 13px; color: var(--texto-2); }
    .ex-link { all: unset; cursor: pointer; color: var(--acento); font-family: var(--mono); font-size: 13px; overflow-wrap: anywhere; }
    .ex-link:hover { text-decoration: underline; }
    .ex-alertas { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
    .ex-alertas li { display: grid; gap: 2px; padding: 8px 12px; border-radius: 8px; border-left: 3px solid var(--borda); background: var(--bg-2); font-size: 13px; }
    .ex-alertas li.alto { border-left-color: var(--perigo); }
    .ex-arvore { display: grid; grid-template-columns: minmax(0, 1fr) 170px 190px 60px; overflow-x: auto; font-size: 13px; }
    .ex-cab, .ex-no { display: contents; }
    .ex-cab > span { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--texto-2); padding: 6px 8px; border-bottom: 1px solid var(--borda); }
    .ex-no > div { padding: 6px 8px; border-bottom: 1px solid var(--borda); min-width: 0; }
    .ex-no.foco > div { background: var(--acento-bg); }
    .ex-no.parado > div { opacity: 0.5; }
    .ex-rot { display: flex; gap: 8px; font-family: var(--mono); overflow-wrap: anywhere; }
    .ex-num { color: var(--texto-2); flex: none; }
    .ex-det { display: grid; margin-top: 4px; color: var(--texto-2); font-size: 12px; }
    .ex-tempo { position: relative; display: flex; align-items: baseline; gap: 6px; font-family: var(--mono); }
    .ex-tempo > * { position: relative; }
    .ex-tempo small { color: var(--texto-2); }
    .ex-barra { position: absolute; left: 0; top: 4px; bottom: 4px; max-width: 100%; border-radius: 4px; background: color-mix(in srgb, var(--acento) 18%, transparent); }
    .ex-barra.quente { background: color-mix(in srgb, var(--perigo) 22%, transparent); }
  `,
})
export class Explain {
  protected readonly texto = lembrado('explain.texto', '');
  protected readonly detalhes = lembrado('explain.detalhes', false);
  protected readonly ui = inject(Ui);
  protected readonly sql = lembrado('explain.sql', '');
  protected readonly analyze = lembrado('explain.analyze', true);
  protected readonly buffers = lembrado('explain.buffers', true);
  protected readonly json = lembrado('explain.json', false);

  protected readonly comando = computed(() => {
    const q = this.sql().trim().replace(/;\s*$/, '').replace(/^explain\s*(\([^)]*\)|(\s+(analyze|verbose))*)\s*/i, '');
    if (!q) return null;
    const ops = [this.analyze() && 'ANALYZE', this.analyze() && this.buffers() && 'BUFFERS', this.json() && 'FORMAT JSON'].filter(Boolean);
    const cmd = `EXPLAIN${ops.length ? ` (${ops.join(', ')})` : ''}\n${q};`;
    const dml = this.analyze() && /^\s*(with\b[\s\S]*\b)?(insert|update|delete|merge)\b/i.test(q);
    return { sql: dml ? `BEGIN;\n${cmd}\nROLLBACK;` : cmd, dml };
  });
  protected readonly foco = signal<number | null>(null);

  protected readonly plano = computed(() => {
    if (!this.texto().trim()) return null;
    try {
      return { plano: lerExplain(this.texto()), erro: '' };
    } catch (e) {
      return { plano: null, erro: (e as Error).message };
    }
  });

  protected readonly maisCaro = computed(() => {
    const nos = this.plano()?.plano?.nos ?? [];
    return nos.length > 1 ? nos.reduce((a, b) => (b.proprio > a.proprio ? b : a)) : null;
  });

  protected n0(v: number) {
    return Math.round(v).toLocaleString('pt-BR');
  }

  protected ms(v: number) {
    return v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' s' : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ms';
  }

  protected focar(n: No) {
    this.foco.set(n.id);
    document.getElementById('ex-no-' + n.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
