import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { analisar, GrupoLimpeza, limparTexto, previa } from '../lib/limpeza';

const GRUPOS: [GrupoLimpeza, string, string][] = [
  ['espaco', 'Espaços especiais → espaço', 'NBSP e espaços tipográficos'],
  ['invisivel', 'Remover invisíveis', 'Largura zero, BOM, soft hyphen, marcas de direção'],
  ['controle', 'Remover controles', 'Caracteres de controle (exceto quebra de linha e tab)'],
  ['cr', 'CRLF → LF', 'Tira o \\r das quebras do Windows'],
  ['tipografico', 'Aspas e traços → ASCII', '“ ” ‘ ’ → " \' · – — → - · … → ...'],
  ['tab', 'Tab → espaço', ''],
  ['latin1', 'Remover fora do Latin1', 'Emoji e símbolos que não existem em banco LATIN1/WIN1252'],
];

@Component({
  selector: 'ft-limpeza',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        @for (g of GRUPOS; track g[0]) {
          <label class="ft-chk" [title]="g[2]"><input type="checkbox" [checked]="grupos().includes(g[0])" (change)="alternar(g[0])" /> {{ g[1] }}</label>
        }
        <label class="ft-chk" title="Espaços no fim da linha e espaços repetidos"><input type="checkbox" [(ngModel)]="aparar" /> Aparar espaços</label>
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto colado</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="10" spellcheck="false"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Limpo
            @if (texto()) {
              <span class="ft-selo" [class.ok]="saida() !== texto()">{{ saida() === texto() ? 'sem mudança' : 'alterado' }}</span>
            }
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="10" [value]="saida()"></textarea>
        </div>
      </div>
      @if (achados().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">Caracteres suspeitos <span class="ft-selo erro">{{ total() }}</span></h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>Código</th><th>Caractere</th><th>Qtd</th><th>1ª linha</th><th>Ação</th></tr>
            </thead>
            <tbody>
              @for (a of achados(); track a.cod) {
                <tr>
                  <td class="ft-mono">{{ a.cod }}</td>
                  <td>{{ a.nome }}</td>
                  <td>{{ a.qtd }}</td>
                  <td>{{ a.linha }}</td>
                  <td>{{ grupos().includes(a.grupo) ? 'trocado' : 'mantido' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <h4 class="ft-titulo">Onde estão</h4>
          <div class="ft-regex">
            @for (p of marcado(); track $index) {
              @if (p.nome) {
                <mark [title]="p.nome">{{ p.t }}</mark>
              } @else {
                {{ p.t }}
              }
            }
          </div>
        </div>
      } @else if (texto()) {
        <p class="ft-aviso ok">Nenhum caractere invisível ou tipográfico encontrado.</p>
      }
      <p class="ft-dica">Para texto vindo de Word, PDF, Teams ou e-mail que quebra SQL, PHP ou comparação. Passe o mouse na marca para ver o caractere.</p>
    </div>
  `,
})
export class Limpeza {
  protected readonly ui = inject(Ui);
  protected readonly GRUPOS = GRUPOS;
  protected readonly texto = lembrado('limpeza.texto', '');
  protected readonly grupos = lembrado<GrupoLimpeza[]>('limpeza.grupos', ['espaco', 'invisivel', 'controle', 'cr', 'tipografico']);
  protected readonly aparar = lembrado('limpeza.aparar', true);

  protected readonly achados = computed(() => analisar(this.texto()));
  protected readonly total = computed(() => this.achados().reduce((s, a) => s + a.qtd, 0));
  protected readonly marcado = computed(() => previa(this.texto()));
  protected readonly saida = computed(() => limparTexto(this.texto(), { grupos: this.grupos(), aparar: this.aparar() }));

  alternar(g: GrupoLimpeza) {
    this.grupos.update((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]));
  }
}
