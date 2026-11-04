import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { FormatoSql, listaSql } from '../lib/texto';

@Component({
  selector: 'ft-sql',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (f of FORMATOS; track f[0]) {
            <button [class.on]="formato() === f[0]" (click)="formato.set(f[0])">{{ f[1] }}</button>
          }
        </div>
        <label class="ft-chk">
          Aspas
          <select [(ngModel)]="aspas">
            <option value="auto">automático</option>
            <option value="sim">sempre</option>
            <option value="nao">nunca</option>
          </select>
        </label>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="distintos" /> Remover duplicados</label>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Valores</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="14" placeholder="Um valor por linha. Colunas separadas por TAB (Excel) ou ;"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            SQL
            @if (resultado().itens) {
              <span class="ft-selo">{{ resultado().itens }} item(ns)</span>
            }
            @if (resultado().removidos) {
              <span class="ft-selo">{{ resultado().removidos }} duplicado(s) removido(s)</span>
            }
            <button class="btn mini fim" [disabled]="!resultado().itens" (click)="ui.copiar(resultado().sql)">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="14" [value]="resultado().itens ? resultado().sql : ''"></textarea>
        </div>
      </div>
      <p class="ft-dica">Aspas automáticas: se todos os valores forem números, ficam sem aspas. Aspas simples são escapadas e NULL é mantido.</p>
    </div>
  `,
})
export class Sql {
  protected readonly ui = inject(Ui);
  protected readonly FORMATOS: [FormatoSql, string][] = [
    ['in', 'IN (...)'],
    ['virgula', 'a, b, c'],
    ['values', 'VALUES'],
    ['union', 'UNION ALL'],
  ];
  protected readonly texto = signal('');
  protected readonly formato = signal<FormatoSql>('in');
  protected readonly aspas = signal<'auto' | 'sim' | 'nao'>('auto');
  protected readonly distintos = signal(true);

  protected readonly resultado = computed(() =>
    listaSql(this.texto(), { formato: this.formato(), aspas: this.aspas(), distintos: this.distintos() }),
  );
}
