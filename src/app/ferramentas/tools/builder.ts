import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { arelParaSql } from '../lib/arel';
import { lembrado } from '../lib/estado';
import { formatarSql } from '../lib/sqlfmt';
import { zendParaSql } from '../lib/zend';

type Modo = 'auto' | 'zend' | 'arel';

// PHP tem $variável e ->; Ruby não
export const pareceZend = (t: string) => /\$\w|->\s*(select|from|where|join\w*)\s*\(/.test(t);

@Component({
  selector: 'ft-builder',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'auto'" (click)="modo.set('auto')">Automático</button>
          <button [class.on]="modo() === 'zend'" (click)="modo.set('zend')">Zend (PHP)</button>
          <button [class.on]="modo() === 'arel'" (click)="modo.set('arel')">Arel (Ruby)</button>
        </div>
        @if (modo() === 'auto' && texto().trim()) {
          <span class="ft-selo">{{ efetivo() === 'zend' ? 'Zend' : 'Arel' }}</span>
        }
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="formatar" /> Formatar</label>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Código</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="20" spellcheck="false"
            placeholder="$db->select()->from(array('P' => 'TABELA'))->where('P.ID = ?', $id)&#10;&#10;ou&#10;&#10;tabela.project(tabela[:id]).where(tabela[:ativo].eq('S'))"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            SQL
            <button class="btn mini fim" [disabled]="!resultado()?.sql" (click)="ui.copiar(resultado()!.sql)">Copiar</button>
          </h4>
          @if (resultado()?.erro; as e) {
            <p class="ft-aviso">{{ e }}</p>
          }
          @for (a of resultado()?.avisos ?? []; track a) {
            <p class="ft-aviso">{{ a }}</p>
          }
          <textarea class="ft-texto" readonly rows="20" spellcheck="false" [value]="resultado()?.sql ?? ''"></textarea>
        </div>
      </div>
      <p class="ft-dica">Interpreta o encadeamento sem executar nada. Variáveis e valores de fora viram parâmetros (:nome); condições (if) contam como verdadeiras. Zend: Zend_Db_Select do ZF1. Arel: helpers do BaseQuery (casewhen, coalesce, left_join...) e matches com UNACCENT do initializer; com a classe inteira colada, gera uma consulta por método.</p>
    </div>
  `,
})
export class Builder {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('builder.texto', '');
  protected readonly modo = lembrado<Modo>('builder.modo', 'auto');
  protected readonly formatar = lembrado('builder.formatar', true);

  protected readonly efetivo = computed(() => (this.modo() !== 'auto' ? this.modo() : pareceZend(this.texto()) ? 'zend' : 'arel'));

  protected readonly resultado = computed(() => {
    const t = this.texto();
    if (!t.trim()) return null;
    try {
      const r = this.efetivo() === 'zend' ? zendParaSql(t) : arelParaSql(t);
      const sql = this.formatar() ? formatarSql(r.sql, { caixa: 'maiuscula', indent: 2 }) : r.sql;
      return { sql: sql + ';', avisos: r.avisos, erro: '' };
    } catch (e) {
      return { sql: '', avisos: [], erro: (e as Error).message };
    }
  });
}
