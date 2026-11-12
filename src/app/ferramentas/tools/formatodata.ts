import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { aplicarCaixa, Caixa } from '../lib/extenso';
import { FORMATOS_DATA, formatarData, lerData, OrdemEntrada } from '../lib/formatodata';

@Component({
  selector: 'ft-formatodata',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg" title="Como ler 03/04/2026">
          <button [class.on]="ordem() === 'auto'" (click)="ordem.set('auto')">Auto</button>
          <button [class.on]="ordem() === 'br'" (click)="ordem.set('br')">dd/mm</button>
          <button [class.on]="ordem() === 'us'" (click)="ordem.set('us')">mm/dd</button>
        </div>
        <div class="ft-seg">
          <button [class.on]="caixa() === 'min'" (click)="caixa.set('min')">minúsculas</button>
          <button [class.on]="caixa() === 'pri'" (click)="caixa.set('pri')">Primeira maiúscula</button>
          <button [class.on]="caixa() === 'mai'" (click)="caixa.set('mai')">MAIÚSCULAS</button>
        </div>
        @if (itens().length > 1) {
          <select [(ngModel)]="formato">
            @for (f of FORMATOS; track f[0]) {
              <option [value]="f[0]">{{ f[1] }}</option>
            }
          </select>
        }
      </div>
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Datas <small>uma por linha</small>
          <button class="btn mini fim" (click)="texto.set(hoje())">Hoje</button>
        </h4>
        <textarea class="ft-texto ft-mono" [(ngModel)]="texto" rows="4" spellcheck="false"
          placeholder="12/11/2026&#10;2026-11-12&#10;11/12/2026&#10;12 de novembro de 2026&#10;November 12, 2026"></textarea>
      </div>
      @if (itens().length === 1) {
        @if (itens()[0].data; as d) {
          <div class="ft-painel">
            <dl class="ft-kv">
              @for (f of FORMATOS; track f[0]) {
                <dt>{{ f[1] }}</dt>
                <dd class="ft-copia" (click)="ui.copiar(fmt(d, f[0]))">{{ fmt(d, f[0]) }}</dd>
              }
            </dl>
          </div>
        } @else {
          <p class="ft-aviso">Data não reconhecida.</p>
        }
      } @else if (itens().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ nomeFormato() }}
            <button class="btn mini fim" (click)="ui.copiar(todos())">Copiar tudo</button>
          </h4>
          <table class="ft-tabela">
            <tbody>
              @for (i of itens(); track $index) {
                <tr>
                  <td class="ft-mono" style="white-space: nowrap">{{ i.valor }}</td>
                  @if (i.data; as d) {
                    <td class="ft-copia" (click)="ui.copiar(fmt(d, formato()))">{{ fmt(d, formato()) }}</td>
                  } @else {
                    <td><span class="ft-selo erro">✕ não reconhecida</span></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      <p class="ft-dica">
        Aceita dd/mm/aaaa, aaaa-mm-dd, aaaammdd e datas com o nome do mês em português ou inglês. No Auto, 03/04 é lido como dia/mês;
        só vira mês/dia quando o segundo número passa de 12. Clique no valor para copiar.
      </p>
    </div>
  `,
})
export class FormatoData {
  protected readonly ui = inject(Ui);
  protected readonly FORMATOS = FORMATOS_DATA;
  protected readonly texto = lembrado('formatodata.texto', '');
  protected readonly ordem = lembrado<OrdemEntrada>('formatodata.ordem', 'auto');
  protected readonly caixa = lembrado<Caixa>('formatodata.caixa', 'min');
  protected readonly formato = lembrado('formatodata.formato', 'us');

  protected readonly itens = computed(() =>
    this.texto()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((valor) => ({ valor, data: lerData(valor, this.ordem()) })),
  );

  protected readonly nomeFormato = computed(() => FORMATOS_DATA.find(([id]) => id === this.formato())?.[1] ?? '');

  protected fmt(d: Parameters<typeof formatarData>[0], f: string) {
    return aplicarCaixa(formatarData(d, f), this.caixa());
  }

  protected readonly todos = computed(() => this.itens().map((i) => (i.data ? this.fmt(i.data, this.formato()) : i.valor)).join('\n'));

  protected hoje() {
    const t = new Date();
    return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`;
  }
}
