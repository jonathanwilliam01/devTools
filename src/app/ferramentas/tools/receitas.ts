import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '../../store';
import { Ui } from '../../ui';
import { novoId, Passo, Receita } from '../../models';
import { lembrado } from '../lib/estado';
import { defPasso, executar, MODELOS, novoPasso, PASSOS } from '../lib/receitas';

@Component({
  selector: 'ft-receitas',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <select [ngModel]="atual()?.id ?? ''" (ngModelChange)="sel.set($event); etapa.set(-1)" style="width: auto; min-width: 220px">
          @for (r of store.receitas(); track r.id) {
            <option [value]="r.id">{{ r.nome }}</option>
          } @empty {
            <option value="">Nenhuma receita</option>
          }
        </select>
        <button class="btn mini" (click)="nova()">+ Nova</button>
        @if (atual(); as r) {
          <button class="btn mini ghost" (click)="duplicar(r)">Duplicar</button>
          <button class="btn mini ghost perigo" (click)="excluir(r)">Excluir</button>
        }
        <select #sm class="fim" style="width: auto" (change)="usarModelo(sm.value); sm.value = ''" title="Adiciona uma receita pronta">
          <option value="">+ Modelo pronto…</option>
          @for (m of MODELOS; track m.nome; let i = $index) {
            <option [value]="i">{{ m.nome }}</option>
          }
        </select>
      </div>

      @if (atual(); as r) {
        <div class="ft-painel">
          <input class="rec-nome" [ngModel]="r.nome" (ngModelChange)="salvar({ nome: $event })" placeholder="Nome da receita" spellcheck="false" />
          <ol class="rec-passos">
            @for (p of r.passos; track $index; let i = $index) {
              @let d = def(p);
              <li [class.erro]="res().etapas[i]?.erro" [class.vista]="etapa() === i">
                <span class="rec-num">{{ i + 1 }}</span>
                <b>{{ d?.nome ?? p.tipo }}</b>
                @for (c of d?.campos ?? []; track c.k) {
                  @if (c.tipo === 'chk') {
                    <label class="ft-chk"><input type="checkbox" [ngModel]="p.p[c.k]" (ngModelChange)="mudar(i, c.k, $event)" /> {{ c.rotulo }}</label>
                  } @else if (c.tipo === 'opcao') {
                    <select style="width: auto" [ngModel]="p.p[c.k]" (ngModelChange)="mudar(i, c.k, $event)" [title]="c.rotulo">
                      @for (o of c.opcoes; track o[0]) {
                        <option [value]="o[0]">{{ o[1] }}</option>
                      }
                    </select>
                  } @else {
                    <input class="rec-campo" [ngModel]="p.p[c.k]" (ngModelChange)="mudar(i, c.k, $event)" [placeholder]="c.rotulo" spellcheck="false" />
                  }
                }
                <span class="rec-acoes">
                  @if (res().etapas[i]; as e) {
                    <button class="ft-selo" [class.erro]="e.erro" (click)="etapa.set(etapa() === i ? -1 : i)" [title]="e.erro || 'Ver a saída desta etapa'">
                      {{ e.erro ? 'erro' : qtdLinhas(e.saida) + ' lin.' }}
                    </button>
                  }
                  <button class="btn mini ghost" [disabled]="!i" (click)="mover(i, -1)" title="Subir">↑</button>
                  <button class="btn mini ghost" [disabled]="i === r.passos.length - 1" (click)="mover(i, 1)" title="Descer">↓</button>
                  <button class="btn mini ghost" (click)="remover(i)" title="Remover passo">✕</button>
                </span>
              </li>
            }
          </ol>
          <select #sp style="width: auto" (change)="adicionar(sp.value); sp.value = ''">
            <option value="">+ Adicionar passo…</option>
            @for (d of PASSOS; track d.id) {
              <option [value]="d.id">{{ d.nome }}</option>
            }
          </select>
        </div>

        <div class="ft-duas">
          <div class="ft-painel">
            <h4 class="ft-titulo">Entrada <span class="ft-selo">{{ qtdLinhas(entrada()) }} lin.</span></h4>
            <textarea class="ft-texto" [(ngModel)]="entrada" rows="12" spellcheck="false" placeholder="Cole o texto"></textarea>
          </div>
          <div class="ft-painel">
            <h4 class="ft-titulo">
              {{ etapa() >= 0 ? 'Saída da etapa ' + (etapa() + 1) : 'Saída' }}
              <span class="ft-selo">{{ qtdLinhas(saida()) }} lin.</span>
              <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
            </h4>
            <textarea class="ft-texto" readonly rows="12" spellcheck="false" [value]="saida()"></textarea>
          </div>
        </div>
        @if (res().erro) {
          <p class="ft-aviso">{{ res().erro }}</p>
        }
      } @else {
        <p class="ft-dica">Receita é uma sequência de passos aplicada ao texto colado (ex.: limpar → extrair CPF → tirar repetidos → IN). Crie uma nova ou comece por um modelo pronto.</p>
      }
      <p class="ft-dica">Ctrl+K e o nome da receita: aplica no texto copiado e já copia o resultado. O git-calm roda pela ponte com receita(nome, texto).</p>
    </div>
  `,
  styles: `
    .rec-nome {
      font-weight: 600;
      font-size: 15px;
    }
    .rec-passos {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .rec-passos li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 6px 8px;
      border: 1px solid var(--borda);
      border-radius: 8px;
      background: var(--bg-2);
    }
    .rec-passos li.vista {
      border-color: var(--acento);
    }
    .rec-passos li.erro {
      border-color: #d64545;
    }
    .rec-num {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--texto-2);
    }
    .rec-campo {
      width: 140px;
    }
    .rec-acoes {
      margin-left: auto;
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .rec-acoes .ft-selo {
      cursor: pointer;
      border: 0;
    }
  `,
})
export class Receitas {
  protected readonly ui = inject(Ui);
  protected readonly store = inject(Store);
  protected readonly PASSOS = PASSOS;
  protected readonly MODELOS = MODELOS;
  protected readonly sel = lembrado('receitas.sel', '');
  protected readonly entrada = lembrado('receitas.entrada', '');
  protected readonly etapa = signal(-1);

  protected readonly atual = computed(() => {
    const l = this.store.receitas();
    return l.find((r) => r.id === this.sel()) ?? l[0] ?? null;
  });
  protected readonly res = computed(() => executar(this.entrada(), this.atual()?.passos ?? []));
  protected readonly saida = computed(() => {
    const e = this.res().etapas[this.etapa()];
    return e ? e.saida : this.res().saida;
  });

  protected def = (p: Passo) => defPasso(p.tipo);
  protected qtdLinhas = (t: string) => (t.trim() ? t.trim().split('\n').length : 0);

  private criar(r: Omit<Receita, 'id'>) {
    const nova = { ...structuredClone(r), id: novoId() };
    this.store.salvarReceita(nova);
    this.sel.set(nova.id);
    this.etapa.set(-1);
  }

  nova() {
    this.criar({ nome: 'Nova receita', passos: [novoPasso('limpar')] });
  }

  duplicar(r: Receita) {
    this.criar({ nome: r.nome + ' (cópia)', passos: r.passos });
  }

  excluir(r: Receita) {
    if (!confirm(`Excluir a receita "${r.nome}"?`)) return;
    this.store.removerReceita(r.id);
    this.sel.set('');
  }

  usarModelo(i: string) {
    if (i === '') return;
    this.criar(MODELOS[+i]);
  }

  salvar(m: Partial<Receita>) {
    const r = this.atual();
    if (r) this.store.salvarReceita({ ...r, ...m });
  }

  private passos(f: (l: Passo[]) => Passo[]) {
    this.salvar({ passos: f([...(this.atual()?.passos ?? [])]) });
    this.etapa.set(-1);
  }

  adicionar(id: string) {
    if (id) this.passos((l) => [...l, novoPasso(id)]);
  }

  remover(i: number) {
    this.passos((l) => l.filter((_, j) => j !== i));
  }

  mover(i: number, d: number) {
    this.passos((l) => {
      [l[i], l[i + d]] = [l[i + d], l[i]];
      return l;
    });
  }

  mudar(i: number, k: string, v: string | boolean) {
    this.salvar({ passos: this.atual()!.passos.map((p, j) => (j === i ? { ...p, p: { ...p.p, [k]: v } } : p)) });
  }
}
