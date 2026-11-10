import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { AcaoSel, selectParaComando } from '../lib/selectupd';

@Component({
  selector: 'ft-selectupd',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="acao() === 'update'" (click)="acao.set('update')">UPDATE</button>
          <button [class.on]="acao() === 'delete'" (click)="acao.set('delete')">DELETE</button>
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="backup" /> Backup em tabela antes</label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="returning" /> RETURNING *</label>
        <input style="width: 200px" [(ngModel)]="chave" placeholder="Chave em join (ctid)" spellcheck="false"
          title="Coluna usada para filtrar a tabela quando o SELECT tem join ou LIMIT. Vazio usa ctid." />
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">SELECT</h4>
          <textarea class="ft-texto" [(ngModel)]="sql" rows="10" spellcheck="false"
            placeholder="select * from cadastro.contribuinte c&#10;where c.situacao = 'I'"></textarea>
          @if (acao() === 'update') {
            <h4 class="ft-titulo">SET <small>uma coluna por linha</small></h4>
            <textarea class="ft-texto" style="min-height: 80px" [(ngModel)]="set" rows="3" spellcheck="false" placeholder="situacao = 'A'&#10;dt_alteracao = now()"></textarea>
          }
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Comando
            <button class="btn mini fim" [disabled]="!saida().sql" (click)="ui.copiar(saida().sql)">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="18" spellcheck="false" [value]="saida().sql"></textarea>
        </div>
      </div>
      @for (a of saida().avisos; track a) {
        <p class="ft-aviso">{{ a }}</p>
      }
      <p class="ft-dica">PostgreSQL. Usa o mesmo FROM e WHERE do SELECT, conta as linhas antes e termina em ROLLBACK: confira o count e o RETURNING e troque por COMMIT.</p>
    </div>
  `,
})
export class SelectUpd {
  protected readonly ui = inject(Ui);
  protected readonly sql = lembrado('selectupd.sql', '');
  protected readonly set = lembrado('selectupd.set', '');
  protected readonly acao = lembrado<AcaoSel>('selectupd.acao', 'update');
  protected readonly chave = lembrado('selectupd.chave', '');
  protected readonly backup = lembrado('selectupd.backup', false);
  protected readonly returning = lembrado('selectupd.returning', true);

  protected readonly saida = computed(() =>
    selectParaComando(this.sql(), {
      acao: this.acao(),
      set: this.set(),
      chave: this.chave(),
      backup: this.backup(),
      returning: this.returning(),
    }),
  );
}
