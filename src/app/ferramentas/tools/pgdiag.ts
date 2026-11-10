import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { diagnosticos, GrupoDiag } from '../lib/pgdiag';

@Component({
  selector: 'ft-pgdiag',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (g of GRUPOS; track g[0]) {
            <button [class.on]="grupo() === g[0]" (click)="grupo.set(g[0])">{{ g[1] }}</button>
          }
        </div>
      </div>
      <div class="ft-linha">
        <label class="ft-chk">
          PostgreSQL
          <select [(ngModel)]="versao">
            @for (v of VERSOES; track v) {
              <option [ngValue]="v">{{ v }}</option>
            }
          </select>
        </label>
        <input style="width: 240px" [(ngModel)]="tabela" placeholder="schema.tabela" spellcheck="false" title="Usada em bloqueios, sequences e estrutura" />
        <label class="ft-chk">Há mais de <input type="number" min="0" [(ngModel)]="minutos" style="width: 70px" /> min</label>
      </div>
      @for (d of lista(); track d.titulo) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ d.titulo }}
            <button class="btn mini fim" (click)="ui.copiar(d.sql)">Copiar</button>
          </h4>
          @if (d.desc) {
            <p class="ft-dica" style="margin: 0">{{ d.desc }}</p>
          }
          <textarea class="ft-texto" style="min-height: 0" readonly spellcheck="false" [rows]="d.sql.split('\n').length" [value]="d.sql"></textarea>
        </div>
      }
      <p class="ft-dica">Só consultas de leitura; os comandos de cancelar, encerrar e setval saem como texto para você rodar. 9 vale para toda a 9.x.</p>
    </div>
  `,
})
export class PgDiag {
  protected readonly ui = inject(Ui);
  protected readonly GRUPOS: [GrupoDiag | 'todos', string][] = [
    ['todos', 'Todos'],
    ['sessoes', 'Sessões'],
    ['bloqueios', 'Bloqueios'],
    ['desempenho', 'Desempenho'],
    ['tamanho', 'Tamanho'],
    ['manutencao', 'Manutenção'],
    ['estrutura', 'Estrutura'],
    ['config', 'Configuração'],
  ];
  protected readonly VERSOES = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  protected readonly grupo = lembrado<GrupoDiag | 'todos'>('pgdiag.grupo', 'sessoes');
  protected readonly versao = lembrado('pgdiag.versao', 9);
  protected readonly tabela = lembrado('pgdiag.tabela', '');
  protected readonly minutos = lembrado('pgdiag.minutos', 5);

  protected readonly lista = computed(() =>
    diagnosticos({ versao: this.versao(), tabela: this.tabela(), minutos: this.minutos() }).filter(
      (d) => this.grupo() === 'todos' || d.grupo === this.grupo(),
    ),
  );
}
