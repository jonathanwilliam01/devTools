import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { comparar, contar, formatarLista, itens, Ordem, ordenar, SaidaLista, unicos } from '../lib/listas';

type Modo = 'comparar' | 'unicos' | 'contar';

@Component({
  selector: 'ft-listas',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (m of MODOS; track m[0]) {
            <button [class.on]="modo() === m[0]" (click)="modo.set(m[0])">{{ m[1] }}</button>
          }
        </div>
        <label class="ft-chk"><input type="checkbox" [(ngModel)]="caixa" /> Ignorar maiúsculas</label>
        @if (modo() !== 'contar') {
          <select [(ngModel)]="ordem">
            <option value="nao">Ordem original</option>
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
          <div class="ft-seg fim">
            @for (s of SAIDAS; track s[0]) {
              <button [class.on]="saida() === s[0]" (click)="saida.set(s[0])">{{ s[1] }}</button>
            }
          </div>
        } @else {
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="soRepetidos" /> Só repetidos</label>
        }
      </div>

      @if (modo() === 'comparar') {
        <div class="ft-duas">
          <div class="ft-painel">
            <h4 class="ft-titulo">Lista A <span class="ft-selo">{{ a().length }}</span></h4>
            <textarea class="ft-texto" [(ngModel)]="textoA" rows="8" spellcheck="false" placeholder="Um por linha, ou separados por vírgula"></textarea>
          </div>
          <div class="ft-painel">
            <h4 class="ft-titulo">Lista B <span class="ft-selo">{{ b().length }}</span></h4>
            <textarea class="ft-texto" [(ngModel)]="textoB" rows="8" spellcheck="false" placeholder="Um por linha, ou separados por vírgula"></textarea>
          </div>
        </div>
        <div class="ft-cards3">
          @for (r of resultado(); track r.nome) {
            <div class="ft-painel">
              <h4 class="ft-titulo">
                {{ r.nome }} <span class="ft-selo" [class.ok]="r.itens.length">{{ r.itens.length }}</span>
                <button class="btn mini fim" [disabled]="!r.texto" (click)="ui.copiar(r.texto)">Copiar</button>
              </h4>
              <textarea class="ft-texto" readonly rows="8" [value]="r.texto"></textarea>
            </div>
          }
        </div>
      } @else {
        <div class="ft-duas">
          <div class="ft-painel">
            <h4 class="ft-titulo">Lista <span class="ft-selo">{{ lista().length }}</span></h4>
            <textarea class="ft-texto" [(ngModel)]="texto" rows="12" spellcheck="false" placeholder="Um por linha, ou separados por vírgula"></textarea>
          </div>
          @if (modo() === 'unicos') {
            <div class="ft-painel">
              <h4 class="ft-titulo">
                Únicos <span class="ft-selo ok">{{ unicosL().length }}</span>
                @if (lista().length - unicosL().length; as rep) {
                  <span class="ft-selo erro">{{ rep }} repetido(s) removido(s)</span>
                }
                <button class="btn mini fim" [disabled]="!saidaUnicos()" (click)="ui.copiar(saidaUnicos())">Copiar</button>
              </h4>
              <textarea class="ft-texto" readonly rows="12" [value]="saidaUnicos()"></textarea>
            </div>
          } @else {
            <div class="ft-painel">
              <h4 class="ft-titulo">
                {{ contagem().length }} valor(es)
                <button class="btn mini fim" [disabled]="!contagem().length" (click)="ui.copiar(textoContagem())">Copiar</button>
              </h4>
              <table class="ft-tabela">
                <thead><tr><th>Valor</th><th class="dir">Qtd</th><th class="dir">%</th></tr></thead>
                <tbody>
                  @for (c of contagem(); track c[0]) {
                    <tr>
                      <td class="ft-mono">{{ c[0] }}</td>
                      <td class="ft-mono dir">{{ c[1] }}</td>
                      <td class="ft-mono dir">{{ ((c[1] / lista().length) * 100).toFixed(1) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
      <p class="ft-dica">Espaços nas pontas e aspas em volta são tirados; linhas vazias ignoradas. IN põe aspas só quando algum valor não é número.</p>
    </div>
  `,
  styles: `
    .ft-cards3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .ft-tabela .dir {
      text-align: right;
      width: 1%;
      white-space: nowrap;
    }
  `,
})
export class Listas {
  protected readonly ui = inject(Ui);
  protected readonly MODOS: [Modo, string][] = [
    ['comparar', 'Comparar A × B'],
    ['unicos', 'Únicos'],
    ['contar', 'Contar repetidos'],
  ];
  protected readonly SAIDAS: [SaidaLista, string][] = [
    ['linhas', 'Linhas'],
    ['virgula', 'Vírgula'],
    ['in', 'IN (...)'],
  ];
  protected readonly modo = lembrado<Modo>('listas.modo', 'comparar');
  protected readonly textoA = lembrado('listas.a', '');
  protected readonly textoB = lembrado('listas.b', '');
  protected readonly texto = lembrado('listas.texto', '');
  protected readonly caixa = lembrado('listas.caixa', false);
  protected readonly ordem = lembrado<Ordem>('listas.ordem', 'nao');
  protected readonly saida = lembrado<SaidaLista>('listas.saida', 'linhas');
  protected readonly soRepetidos = lembrado('listas.soRepetidos', false);

  protected readonly a = computed(() => itens(this.textoA()));
  protected readonly b = computed(() => itens(this.textoB()));
  protected readonly lista = computed(() => itens(this.texto()));

  private fmt(l: string[]) {
    return formatarLista(ordenar(l, this.ordem()), this.saida());
  }

  protected readonly resultado = computed(() => {
    const r = comparar(this.a(), this.b(), this.caixa());
    return [
      { nome: 'Só em A', itens: r.soA },
      { nome: 'Só em B', itens: r.soB },
      { nome: 'Nas duas', itens: r.ambos },
    ].map((x) => ({ ...x, texto: this.fmt(x.itens) }));
  });

  protected readonly unicosL = computed(() => unicos(this.lista(), this.caixa()));
  protected readonly saidaUnicos = computed(() => this.fmt(this.unicosL()));

  protected readonly contagem = computed(() => contar(this.lista(), this.caixa()).filter((c) => !this.soRepetidos() || c[1] > 1));
  protected readonly textoContagem = computed(() => this.contagem().map((c) => `${c[0]}\t${c[1]}`).join('\n'));
}
