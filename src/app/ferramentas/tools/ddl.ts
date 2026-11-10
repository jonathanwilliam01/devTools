import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { analisarColunas, gerarDdl } from '../lib/ddl';
import { lembrado } from '../lib/estado';
import { lerGrade } from '../lib/grade';

@Component({
  selector: 'ft-ddl',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <input style="width: 240px" [(ngModel)]="tabela" placeholder="Nome da tabela" spellcheck="false" />
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="temp" /> Temporária</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="usarText" /> text no lugar de varchar</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="notNull" /> NOT NULL onde não tem vazio</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="insert" /> Gerar INSERT</label>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Dados <small>1ª linha é o cabeçalho</small></h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="12" spellcheck="false"
            placeholder="Cole do Excel, CSV (; ou ,) ou grid do banco"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            SQL
            <button class="btn mini fim" [disabled]="!sql()" (click)="ui.copiar(sql())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="12" spellcheck="false" [value]="sql()"></textarea>
        </div>
      </div>
      @if (colunas().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">Colunas <span class="ft-selo">{{ linhas().length - 1 }} linha(s)</span></h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>Cabeçalho</th><th>Coluna</th><th>Tipo</th><th>Vazios</th></tr>
            </thead>
            <tbody>
              @for (c of colunas(); track $index) {
                <tr>
                  <td>{{ c.original }}</td>
                  <td class="ft-mono">{{ c.nome }}</td>
                  <td class="ft-mono">{{ c.ddl }}</td>
                  <td>{{ c.nulos }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">
        PostgreSQL. Tipo pelo conteúdo: zero à esquerda fica texto (CPF, CEP), 1.234,56 vira numeric, dd/mm/aaaa vira date. Vazio e NULL viram null. INSERT em lotes de 1000 linhas.
      </p>
    </div>
  `,
})
export class Ddl {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('ddl.texto', '');
  protected readonly tabela = lembrado('ddl.tabela', '');
  protected readonly temp = lembrado('ddl.temp', true);
  protected readonly usarText = lembrado('ddl.usarText', false);
  protected readonly notNull = lembrado('ddl.notNull', false);
  protected readonly insert = lembrado('ddl.insert', true);

  protected readonly linhas = computed(() => lerGrade(this.texto()));
  protected readonly colunas = computed(() => analisarColunas(this.linhas(), this.usarText()));
  protected readonly sql = computed(() =>
    gerarDdl(this.linhas(), {
      tabela: this.tabela(),
      temp: this.temp(),
      usarText: this.usarText(),
      notNull: this.notNull(),
      insert: this.insert(),
    }),
  );
}
