import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { compactarSql, formatarSql, OpcoesSqlFmt } from '../lib/sqlfmt';

@Component({
  selector: 'ft-sqlfmt',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="!compacto()" (click)="compacto.set(false)">Formatar</button>
          <button [class.on]="compacto()" (click)="compacto.set(true)">Compactar</button>
        </div>
        @if (!compacto()) {
          <label class="ft-chk">
            Palavras-chave
            <select [(ngModel)]="caixa">
              <option value="maiuscula">MAIÚSCULAS</option>
              <option value="minuscula">minúsculas</option>
              <option value="manter">manter</option>
            </select>
          </label>
          <label class="ft-chk">
            Indentação
            <select [(ngModel)]="indent">
              <option [ngValue]="2">2 espaços</option>
              <option [ngValue]="4">4 espaços</option>
            </select>
          </label>
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">SQL</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="18" spellcheck="false" placeholder="select a.id, b.nome from a join b on b.id = a.b_id where a.ativo = 'S'"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="18" [value]="saida()"></textarea>
        </div>
      </div>
      <p class="ft-dica">Formatação por regras simples, sem validar a sintaxe. Strings, comentários e parâmetros (:nome, ?, $1) são mantidos.</p>
    </div>
  `,
})
export class SqlFmt {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('sqlfmt.texto', '');
  protected readonly compacto = lembrado('sqlfmt.compacto', false);
  protected readonly caixa = lembrado<OpcoesSqlFmt['caixa']>('sqlfmt.caixa', 'maiuscula');
  protected readonly indent = lembrado('sqlfmt.indent', 2);

  protected readonly saida = computed(() => {
    const t = this.texto();
    if (!t.trim()) return '';
    return this.compacto() ? compactarSql(t) : formatarSql(t, { caixa: this.caixa(), indent: this.indent() });
  });
}
