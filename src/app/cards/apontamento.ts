import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';
import { MESES, TIPOS, Tarefa, dataBr, partes, pessoaTarefa } from '../models';

interface Linha {
  data: string;
  numero: number | null;
  titulo: string;
  tipo: string;
  sistema: string;
  pessoa: string;
  andamento: boolean;
  ms: number;
}

interface Total {
  nome: string;
  qtd: number;
  ms: number;
}

const msDe = (t: Tarefa) => (t.tempo ?? 0) + (t.inicio ? Date.now() - Date.parse(t.inicio) : 0);
export const horas = (ms: number) => {
  const min = Math.round(ms / 60000);
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
};
const NOME_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.label]));

// tempo em "Fazendo" das tarefas do mês + cards do histórico sem tarefa
@Component({
  selector: 'app-apontamento',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="fechar.emit()">
      <div class="dialogo apontamento" (click)="$event.stopPropagation()">
        <h2>Apontamento de {{ nomeMes() }}</h2>
        <div class="ap-linha">
          <input type="month" [ngModel]="mes()" (ngModelChange)="$event && mes.set($event)" style="width: auto" />
          <span class="tag">{{ linhas().length }} itens</span>
          <span class="tag">{{ horas(total()) }} registradas</span>
          @if (semTempo()) {
            <span class="tag aviso" title="Cards concluídos sem tarefa ou tarefas que nunca passaram por Fazendo">{{ semTempo() }} sem tempo</span>
          }
        </div>

        @if (linhas().length) {
          <div class="ap-totais">
            @for (g of [{ t: 'Por tipo', l: porTipo() }, { t: 'Por sistema', l: porSistema() }, { t: 'Ajudas por pessoa', l: porPessoa() }]; track g.t) {
              @if (g.l.length) {
                <div>
                  <h3>{{ g.t }}</h3>
                  @for (x of g.l; track x.nome) {
                    <div class="ap-total">
                      <span>{{ x.nome }}</span>
                      <small>{{ x.qtd }}</small>
                      <b>{{ x.ms ? horas(x.ms) : "—" }}</b>
                    </div>
                  }
                </div>
              }
            }
          </div>
          <div class="ap-tabela">
            <table>
              <thead>
                <tr><th>Data</th><th>Nº</th><th>Título</th><th>Tipo</th><th>Sistema</th><th>Tempo</th></tr>
              </thead>
              <tbody>
                @for (l of linhas(); track $index) {
                  <tr [class.fraco]="!l.ms">
                    <td>{{ dataBr(l.data).slice(0, 5) }}</td>
                    <td>{{ l.numero ?? '' }}</td>
                    <td>
                      {{ l.titulo }}
                      @if (l.andamento) {
                        <span class="tag">em andamento</span>
                      }
                      @if (l.pessoa) {
                        <small> · {{ l.pessoa }}</small>
                      }
                    </td>
                    <td>{{ l.tipo }}</td>
                    <td>{{ l.sistema }}</td>
                    <td class="num">{{ l.ms ? horas(l.ms) : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="vazio">Nada concluído ou em andamento neste mês.</p>
        }
        <small class="dica">O tempo conta enquanto a tarefa fica em Fazendo; tarefa concluída em outro mês entra no mês da conclusão. Em andamento: tarefas abertas com tempo.</small>
        <div class="rodape">
          <button class="btn" (click)="fechar.emit()">Fechar</button>
          <button class="btn" [disabled]="!linhas().length" (click)="copiar()" title="Copia em colunas para colar na planilha">Copiar p/ planilha</button>
          <button class="btn primario" [disabled]="!linhas().length" (click)="baixar()">Baixar CSV</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .apontamento {
      width: min(900px, 100%);
    }
    .ap-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .ap-totais {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .ap-totais h3 {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--texto-2);
      font-weight: 600;
    }
    .ap-total {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      font-size: 13px;
      padding: 2px 0;
    }
    .ap-total span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ap-total small {
      color: var(--texto-2);
    }
    .ap-tabela {
      max-height: 45vh;
      overflow: auto;
      border: 1px solid var(--borda);
      border-radius: 8px;
    }
    .ap-tabela table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .ap-tabela th,
    .ap-tabela td {
      text-align: left;
      padding: 5px 8px;
      border-bottom: 1px solid var(--borda);
    }
    .ap-tabela th {
      position: sticky;
      top: 0;
      background: var(--bg-elev);
    }
    .ap-tabela .num {
      text-align: right;
      font-family: var(--mono);
      white-space: nowrap;
    }
    .ap-tabela tr.fraco td {
      color: var(--texto-2);
    }
    .dica {
      color: var(--texto-2);
    }
  `,
})
export class Apontamento {
  private readonly store = inject(Store);
  private readonly ui = inject(Ui);
  readonly inicial = input.required<string>();
  readonly fechar = output();
  protected readonly horas = horas;
  protected readonly dataBr = dataBr;

  protected readonly mes = linkedSignal(() => this.inicial());
  protected readonly nomeMes = computed(() => `${MESES[+this.mes().slice(5, 7) - 1]} ${this.mes().slice(0, 4)}`);

  protected readonly linhas = computed<Linha[]>(() => {
    const m = this.mes();
    const cards = new Map(this.store.cards().map((c) => [c.numero, c]));
    const tarefas = this.store.tarefas().filter((t) =>
      t.status === 'done' ? t.concluido?.startsWith(m) : msDe(t) > 0 && t.criado.slice(0, 7) <= m && m <= new Date().toLocaleDateString('sv-SE').slice(0, 7),
    );
    const comTarefa = new Set(tarefas.map((t) => t.numeroCard).filter(Boolean));
    const l: Linha[] = tarefas.map((t) => {
      const c = t.numeroCard ? cards.get(t.numeroCard) : undefined;
      return {
        data: t.concluido ?? t.criado,
        numero: t.numeroCard ?? null,
        titulo: t.titulo,
        tipo: NOME_TIPO[t.tipo] ?? t.tipo,
        sistema: c?.sistema ?? '',
        pessoa: t.tipo === 'ajuda' ? pessoaTarefa(t) : '',
        andamento: t.status !== 'done',
        ms: msDe(t),
      };
    });
    for (const c of this.store.cards())
      if (c.data.startsWith(m) && !comTarefa.has(c.numero))
        l.push({ data: c.data, numero: c.numero, titulo: c.descricao, tipo: 'Card', sistema: c.sistema, pessoa: '', andamento: false, ms: 0 });
    return l.sort((a, b) => a.data.localeCompare(b.data) || (a.numero ?? 0) - (b.numero ?? 0));
  });

  protected readonly total = computed(() => this.linhas().reduce((s, l) => s + l.ms, 0));
  protected readonly semTempo = computed(() => this.linhas().filter((l) => !l.ms).length);
  protected readonly porTipo = computed(() => totais(this.linhas(), (l) => [l.tipo]));
  // card com vários sistemas conta o tempo em cada um
  protected readonly porSistema = computed(() => totais(this.linhas(), (l) => (partes(l.sistema).length ? partes(l.sistema) : ['(sem sistema)'])));
  protected readonly porPessoa = computed(() => totais(this.linhas().filter((l) => l.pessoa), (l) => [l.pessoa]));

  private tabela() {
    return [
      ['Data', 'Nº', 'Título', 'Tipo', 'Sistema', 'Pessoa', 'Situação', 'Minutos', 'Horas'],
      ...this.linhas().map((l) => [
        dataBr(l.data),
        String(l.numero ?? ''),
        l.titulo,
        l.tipo,
        l.sistema,
        l.pessoa,
        l.andamento ? 'Em andamento' : 'Concluído',
        String(Math.round(l.ms / 60000)),
        l.ms ? horas(l.ms) : '',
      ]),
    ];
  }

  copiar() {
    const t = this.tabela();
    this.ui.copiar(t.map((l) => l.map((v) => v.replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n'), `${t.length - 1} linhas copiadas`);
  }

  baixar() {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    this.ui.baixar(`apontamento-${this.mes()}.csv`, '﻿' + this.tabela().map((l) => l.map(esc).join(';')).join('\r\n'), 'text/csv');
  }
}

function totais(l: Linha[], chaves: (l: Linha) => string[]): Total[] {
  const m = new Map<string, Total>();
  for (const x of l)
    for (const k of chaves(x)) {
      const t = m.get(k) ?? { nome: k, qtd: 0, ms: 0 };
      t.qtd++;
      t.ms += x.ms;
      m.set(k, t);
    }
  return [...m.values()].sort((a, b) => b.ms - a.ms || b.qtd - a.qtd);
}
