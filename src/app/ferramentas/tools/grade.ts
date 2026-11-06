import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { FormatoGrade, gerarTabela, lerGrade } from '../lib/grade';

@Component({
  selector: 'ft-grade',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (f of FORMATOS; track f[0]) {
            <button [class.on]="formato() === f[0]" (click)="formato.set(f[0])">{{ f[1] }}</button>
          }
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="cabecalho" /> 1ª linha é cabeçalho</label>
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Grid
          @if (linhas().length) {
            <span class="ft-selo">{{ linhas().length - (cabecalho() ? 1 : 0) }} linha(s) · {{ colunas() }} coluna(s)</span>
          }
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="8" spellcheck="false" placeholder="Cole o resultado da consulta (DBeaver, pgAdmin, psql, IBExpert) ou um trecho do Excel"></textarea>
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Tabela
          <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
        </h4>
        <textarea class="ft-texto" readonly rows="12" [value]="saida()" wrap="off"></textarea>
      </div>
      <p class="ft-dica">Separador detectado sozinho: TAB, ponto e vírgula, vírgula ou | (psql). Colunas só com números ficam alinhadas à direita.</p>
    </div>
  `,
})
export class Grade {
  protected readonly ui = inject(Ui);
  protected readonly FORMATOS: [FormatoGrade, string][] = [
    ['markdown', 'Markdown'],
    ['ascii', 'Caixa ASCII'],
    ['alinhado', 'Texto alinhado'],
    ['html', 'HTML'],
  ];
  protected readonly texto = lembrado('grade.texto', '');
  protected readonly formato = lembrado<FormatoGrade>('grade.formato', 'markdown');
  protected readonly cabecalho = lembrado('grade.cabecalho', true);

  protected readonly linhas = computed(() => lerGrade(this.texto()));
  protected readonly colunas = computed(() => Math.max(0, ...this.linhas().map((l) => l.length)));
  protected readonly saida = computed(() => gerarTabela(this.linhas(), this.formato(), this.cabecalho()));
}
