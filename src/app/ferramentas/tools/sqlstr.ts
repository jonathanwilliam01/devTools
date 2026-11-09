import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { deString, ESTILOS, Estilo, Ling, nomePadrao, paraString } from '../lib/sqlstr';

const LINGS: { id: Ling; nome: string }[] = [
  { id: 'delphi', nome: 'Delphi' },
  { id: 'php', nome: 'PHP' },
  { id: 'ruby', nome: 'Ruby' },
];

@Component({
  selector: 'ft-sqlstr',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          <button [class.on]="modo() === 'gerar'" (click)="modo.set('gerar')">SQL → código</button>
          <button [class.on]="modo() === 'extrair'" (click)="modo.set('extrair')">Código → SQL</button>
        </div>
        @if (modo() === 'gerar') {
          <div class="ft-seg">
            @for (l of LINGS; track l.id) {
              <button [class.on]="ling() === l.id" (click)="trocarLing(l.id)">{{ l.nome }}</button>
            }
          </div>
          <div class="ft-seg">
            @for (e of estilos(); track e.id) {
              <button [class.on]="estiloAtual() === e.id" (click)="estilo.set(e.id)">{{ e.nome }}</button>
            }
          </div>
          <input [(ngModel)]="nome" [placeholder]="nomePadrao()" style="width: 110px" title="Nome da variável ou da query" />
          @if (estiloAtual() === 'concat') {
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="quebras" /> Manter quebras de linha</label>
          }
        } @else if (extraido(); as r) {
          @if (r.sql) {
            <span class="ft-selo ok">✓ {{ NOMES[r.ling] }}</span>
          } @else {
            <span class="ft-selo erro">✕ Nenhuma string encontrada</span>
          }
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">{{ modo() === 'gerar' ? 'SQL' : 'Código' }}</h4>
          @if (modo() === 'gerar') {
            <textarea class="ft-texto" [(ngModel)]="sql" rows="18" spellcheck="false" placeholder="select *&#10;  from tabela&#10; where campo = 'x'"></textarea>
          } @else {
            <textarea class="ft-texto" [(ngModel)]="codigo" rows="18" spellcheck="false"
              placeholder="Qry.SQL.Add('select * from tabela');&#10;$sql = &quot;select ...&quot; . &quot;where id = &quot; . $id;"></textarea>
          }
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ modo() === 'gerar' ? 'Código' : 'SQL' }}
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="18" spellcheck="false" [value]="saida()"></textarea>
        </div>
      </div>
      <p class="ft-dica">
        Código → SQL reconhece SQL.Add, concatenação com +, . ou \\, #13#10, sLineBreak, PHP_EOL, heredoc e nowdoc. O que é concatenado de fora
        da string (variável, função) aparece como {{ '{' }}expressão{{ '}' }}.
      </p>
    </div>
  `,
})
export class SqlStr {
  protected readonly ui = inject(Ui);
  protected readonly LINGS = LINGS;
  protected readonly NOMES: Record<Ling, string> = { delphi: 'Delphi', php: 'PHP', ruby: 'Ruby' };
  protected readonly modo = lembrado<'gerar' | 'extrair'>('sqlstr.modo', 'gerar');
  protected readonly ling = lembrado<Ling>('sqlstr.ling', 'delphi');
  protected readonly estilo = lembrado<Estilo>('sqlstr.estilo', 'linhas');
  protected readonly nome = lembrado('sqlstr.nome', '');
  protected readonly quebras = lembrado('sqlstr.quebras', true);
  protected readonly sql = lembrado('sqlstr.sql', '');
  protected readonly codigo = lembrado('sqlstr.codigo', '');

  protected readonly estilos = computed(() => ESTILOS[this.ling()]);
  protected readonly estiloAtual = computed(() => (this.estilos().some((e) => e.id === this.estilo()) ? this.estilo() : this.estilos()[0].id));
  protected readonly nomePadrao = computed(() => nomePadrao({ ling: this.ling(), estilo: this.estiloAtual() }));

  protected readonly extraido = computed(() => (this.codigo().trim() ? deString(this.codigo()) : null));

  protected readonly saida = computed(() =>
    this.modo() === 'gerar'
      ? paraString(this.sql(), { ling: this.ling(), estilo: this.estiloAtual(), nome: this.nome(), quebras: this.quebras() })
      : (this.extraido()?.sql ?? ''),
  );

  protected trocarLing(l: Ling) {
    this.ling.set(l);
    this.estilo.set(ESTILOS[l][0].id);
  }
}
