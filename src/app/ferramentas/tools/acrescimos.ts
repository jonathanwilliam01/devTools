import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { calcular, ModoJuros, ModoMulta, moeda } from '../lib/acrescimos';
import { DIA, deIso, extenso, hojeIso, paraIso } from '../lib/datas';
import { lembrado } from '../lib/estado';

@Component({
  selector: 'ft-acrescimos',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Débito</h4>
          <div class="ft-linha">
            <label class="ft-rotulo">Valor original <input [(ngModel)]="valor" placeholder="1.234,56" style="width: 140px" /></label>
            <label class="ft-rotulo">Vencimento <input type="date" [(ngModel)]="vencimento" /></label>
            <label class="ft-rotulo">Pagamento <input type="date" [(ngModel)]="pagamento" /></label>
          </div>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="prorrogar" /> Vencimento em fim de semana ou feriado nacional vai para o próximo dia útil</label>
          <div class="ft-linha">
            <label class="ft-rotulo">Correção (% acumulada) <input [(ngModel)]="correcao" placeholder="0" style="width: 120px" /></label>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="sobreCorrigido" /> Multa e juros sobre o valor corrigido</label>
          </div>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Multa</h4>
          <div class="ft-seg">
            <button [class.on]="multaModo() === 'fixa'" (click)="multaModo.set('fixa')">Fixa</button>
            <button [class.on]="multaModo() === 'diaria'" (click)="multaModo.set('diaria')">Por dia com teto</button>
          </div>
          <div class="ft-linha">
            <label class="ft-rotulo">{{ multaModo() === 'fixa' ? '% da multa' : '% ao dia' }} <input [(ngModel)]="multa" style="width: 100px" /></label>
            @if (multaModo() === 'diaria') {
              <label class="ft-rotulo">Teto % <input [(ngModel)]="multaTeto" style="width: 100px" /></label>
            }
          </div>
          <h4 class="ft-titulo">Juros</h4>
          <div class="ft-seg">
            @for (m of MODOS; track m[0]) {
              <button [class.on]="jurosModo() === m[0]" (click)="jurosModo.set(m[0])" [title]="m[2]">{{ m[1] }}</button>
            }
          </div>
          <label class="ft-rotulo">{{ jurosModo() === 'taxa' ? '% acumulada no período (ex.: Selic)' : '% ao mês' }} <input [(ngModel)]="juros" style="width: 100px" /></label>
        </div>
      </div>

      @if (resultado(); as r) {
        @if (typeof r === 'string') {
          <p class="ft-aviso">{{ r }}</p>
        } @else {
          <div class="ft-painel">
            <h4 class="ft-titulo">
              Cálculo
              <span class="ft-selo" [class.ok]="!r.emAtraso" [class.erro]="r.emAtraso">{{ r.emAtraso ? r.dias + ' dia(s) de atraso' : 'em dia' }}</span>
              <button class="btn mini fim" (click)="ui.copiar(resumo())">Copiar resumo</button>
            </h4>
            <dl class="ft-kv">
              @if (r.vencEfetivo !== vencMs()) {
                <dt>Vencimento prorrogado</dt>
                <dd>{{ extenso(r.vencEfetivo) }}</dd>
              }
              @if (r.emAtraso) {
                <dt>Atraso</dt>
                <dd>{{ r.meses }}</dd>
              }
            </dl>
            <table class="ft-tabela">
              <tbody>
                @for (l of r.linhas; track l.nome) {
                  <tr>
                    <td>{{ l.nome }}</td>
                    <td class="ft-mono" style="color: var(--texto-2)">{{ l.regra }}</td>
                    <td class="ft-mono ft-copia" style="text-align: right" (click)="ui.copiar(fmt(l.valor))">{{ moeda(l.valor) }}</td>
                  </tr>
                }
                <tr>
                  <td><b>Total</b></td>
                  <td></td>
                  <td class="ft-mono ft-copia" style="text-align: right" (click)="ui.copiar(fmt(r.total))"><b>{{ moeda(r.total) }}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        }
      }
      <p class="ft-dica">
        Cada parcela é arredondada para centavos antes de somar. O atraso conta do vencimento original; a prorrogação só decide se está em atraso. Clique no valor para copiar.
      </p>
    </div>
  `,
})
export class Acrescimos {
  protected readonly ui = inject(Ui);
  protected readonly moeda = moeda;
  protected readonly extenso = extenso;
  protected readonly MODOS: [ModoJuros, string, string][] = [
    ['fracao', 'Mês ou fração', 'Mês iniciado conta como mês inteiro'],
    ['completo', 'Meses cheios', 'Só meses completos'],
    ['dia', 'Pro rata dia', 'Taxa mensal ÷ 30 por dia de atraso'],
    ['taxa', 'Taxa acumulada', 'Percentual total do período, como a Selic acumulada'],
  ];
  protected readonly valor = lembrado('acrescimos.valor', '');
  protected readonly vencimento = lembrado('acrescimos.vencimento', paraIso(deIso(hojeIso()) - 45 * DIA));
  protected readonly pagamento = lembrado('acrescimos.pagamento', hojeIso());
  protected readonly prorrogar = lembrado('acrescimos.prorrogar', true);
  protected readonly correcao = lembrado('acrescimos.correcao', '0');
  protected readonly sobreCorrigido = lembrado('acrescimos.sobreCorrigido', true);
  protected readonly multaModo = lembrado<ModoMulta>('acrescimos.multaModo', 'fixa');
  protected readonly multa = lembrado('acrescimos.multa', '2');
  protected readonly multaTeto = lembrado('acrescimos.multaTeto', '20');
  protected readonly jurosModo = lembrado<ModoJuros>('acrescimos.jurosModo', 'fracao');
  protected readonly juros = lembrado('acrescimos.juros', '1');

  protected readonly vencMs = computed(() => deIso(this.vencimento()));
  protected readonly resultado = computed(() =>
    calcular({
      valor: this.valor(),
      vencimento: this.vencimento(),
      pagamento: this.pagamento(),
      prorrogar: this.prorrogar(),
      correcao: this.correcao(),
      sobreCorrigido: this.sobreCorrigido(),
      multaModo: this.multaModo(),
      multa: this.multa(),
      multaTeto: this.multaTeto(),
      jurosModo: this.jurosModo(),
      juros: this.juros(),
    }),
  );

  protected fmt(x: number) {
    return x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  protected readonly resumo = computed(() => {
    const r = this.resultado();
    if (!r || typeof r === 'string') return '';
    const [v, p] = [this.vencMs(), deIso(this.pagamento())].map((d) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
    return [
      `Vencimento ${v} · pagamento ${p} · ${r.dias} dia(s) de atraso`,
      ...r.linhas.map((l) => `${l.nome}: ${moeda(l.valor)}${l.regra && l.nome !== 'Valor original' ? ` (${l.regra})` : ''}`),
      `Total: ${moeda(r.total)}`,
    ].join('\n');
  });
}
