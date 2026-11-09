import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { AlvoPg, buscaPg, ComparaPg } from '../lib/pgbusca';

@Component({
  selector: 'ft-pgbusca',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (a of ALVOS; track a[0]) {
            <button [class.on]="alvo() === a[0]" (click)="alvo.set(a[0])">{{ a[1] }}</button>
          }
        </div>
        <label class="ft-chk">
          PostgreSQL
          <select [(ngModel)]="versao">
            @for (v of VERSOES; track v) {
              <option [ngValue]="v">{{ v }}</option>
            }
          </select>
        </label>
      </div>
      <div class="ft-linha">
        <input style="flex: 1 1 260px" [(ngModel)]="termo" placeholder="Nome ou valor a buscar" spellcheck="false" />
        <div class="ft-seg">
          @for (c of COMPARA; track c[0]) {
            <button [class.on]="compara() === c[0]" (click)="compara.set(c[0])">{{ c[1] }}</button>
          }
        </div>
        <input style="width: 160px" [(ngModel)]="schema" placeholder="Schema (todos)" spellcheck="false" />
        @if (alvo() === 'dado') {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="todasColunas" /> Incluir colunas não texto</label>
        }
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">
          SQL
          <button class="btn mini fim" [disabled]="!sql()" (click)="ui.copiar(sql())">Copiar</button>
        </h4>
        <textarea class="ft-texto" readonly rows="18" spellcheck="false" [value]="sql()"></textarea>
      </div>
      <p class="ft-dica">{{ DICAS[alvo()] }} Sem diferença de maiúsculas (ILIKE). A coluna "consulta" traz o select pronto para abrir o resultado.</p>
    </div>
  `,
})
export class PgBusca {
  protected readonly ui = inject(Ui);
  protected readonly ALVOS: [AlvoPg, string][] = [
    ['tabela', 'Tabela/view'],
    ['campo', 'Campo'],
    ['proc', 'Proc/função'],
    ['codigo', 'Texto na proc'],
    ['dado', 'Dado'],
  ];
  protected readonly COMPARA: [ComparaPg, string][] = [
    ['contem', 'Contém'],
    ['inicia', 'Começa com'],
    ['igual', 'Igual'],
  ];
  protected readonly VERSOES = [9, 10, 11, 12, 13, 14, 15, 16, 17];
  protected readonly DICAS: Record<AlvoPg, string> = {
    tabela: 'Tabelas, views e views materializadas pelo nome.',
    campo: 'Colunas pelo nome, com tabela e tipo.',
    proc: 'Funções e procedures pelo nome, com argumentos e retorno.',
    codigo: 'Funções e procedures que têm o texto no corpo.',
    dado: 'Varre cada coluna de cada tabela e lista onde o valor aparece. Pode demorar em banco grande; filtre pelo schema.',
  };
  protected readonly alvo = lembrado<AlvoPg>('pgbusca.alvo', 'tabela');
  protected readonly termo = lembrado('pgbusca.termo', '');
  protected readonly compara = lembrado<ComparaPg>('pgbusca.compara', 'contem');
  protected readonly versao = lembrado('pgbusca.versao', 9);
  protected readonly schema = lembrado('pgbusca.schema', '');
  protected readonly todasColunas = lembrado('pgbusca.todasColunas', false);

  protected readonly sql = computed(() =>
    buscaPg({
      alvo: this.alvo(),
      termo: this.termo(),
      compara: this.compara(),
      versao: this.versao(),
      schema: this.schema(),
      todasColunas: this.todasColunas(),
    }),
  );
}
