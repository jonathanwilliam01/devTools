import { Component, computed, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { barrasItf, centavos, dataDoFator, fatorDaData, gerarArrecadacao, gerarBancario, ler, Leitura, novaSemente } from '../lib/boleto';
import { Imagem } from './imagem';
import { deIso, extenso, hojeIso } from '../lib/datas';

@Component({
  selector: 'ft-boleto',
  imports: [FormsModule, Imagem],
  template: `
    <div class="ft">
      <div class="ft-seg">
        <button [class.on]="modo() === 'ler'" (click)="modo.set('ler')">Ler</button>
        <button [class.on]="modo() === 'gerar'" (click)="modo.set('gerar')">Gerar para teste</button>
      </div>

      @if (modo() === 'ler') {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Linha digitável ou código de barras
            <span class="fim"><ft-imagem #img [aceita]="ehBoleto" (lido)="entrada.set($event)" /></span>
          </h4>
          <input class="ft-mono" [(ngModel)]="entrada" (paste)="img.colar($event)" placeholder="Cole aqui o código ou uma imagem (pontos, espaços e traços são ignorados)" autofocus />
          @if (erroEntrada()) {
            <p class="ft-aviso">{{ erroEntrada() }}</p>
          }
        </div>
      } @else {
        <div class="ft-painel">
          <div class="ft-linha">
            <div class="ft-seg">
              <button [class.on]="gTipo() === 'banco'" (click)="gTipo.set('banco')">Boleto bancário</button>
              <button [class.on]="gTipo() === 'arrec'" (click)="gTipo.set('arrec')">Guia de arrecadação</button>
            </div>
            <button class="btn mini fim" (click)="semente.set(novaSemente())" title="Sorteia outro campo livre">↻ Novo código</button>
          </div>
          <div class="ft-linha">
            @if (gTipo() === 'banco') {
              <label class="ft-rotulo">Banco
                <input class="ft-mono" list="ft-bancos" [(ngModel)]="gBanco" maxlength="3" size="6" />
              </label>
              <datalist id="ft-bancos">
                @for (b of bancos; track b[0]) {
                  <option [value]="b[0]">{{ b[1] }}</option>
                }
              </datalist>
              <label class="ft-rotulo">Vencimento (vazio = sem)
                <input type="date" [(ngModel)]="gVenc" />
              </label>
            } @else {
              <label class="ft-rotulo">Segmento
                <select [(ngModel)]="gSegmento">
                  @for (s of segmentos; track s[0]) {
                    <option [value]="s[0]">{{ s[0] }} - {{ s[1] }}</option>
                  }
                </select>
              </label>
              <label class="ft-rotulo">Identificador de valor
                <select [(ngModel)]="gRef">
                  <option value="6">6 - reais, módulo 10</option>
                  <option value="7">7 - referência, módulo 10</option>
                  <option value="8">8 - reais, módulo 11</option>
                  <option value="9">9 - referência, módulo 11</option>
                </select>
              </label>
              <label class="ft-rotulo">{{ gSegmento() === '6' ? 'CNPJ (8 dígitos)' : 'Empresa / órgão (4 dígitos)' }}
                <input class="ft-mono" [(ngModel)]="gEmpresa" [maxlength]="gSegmento() === '6' ? 8 : 4" size="10" />
              </label>
            }
            <label class="ft-rotulo">Valor
              <input class="ft-mono" [(ngModel)]="gValor" placeholder="0,00" size="12" />
            </label>
          </div>
          @if (erroGerar()) {
            <p class="ft-aviso">{{ erroGerar() }}</p>
          }
          <p class="ft-dica">Campo livre sorteado: os dígitos verificadores ficam certos, mas o código não existe em nenhum banco.</p>
        </div>
      }

      @if (leitura(); as l) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            {{ l.tipo }}
            @if (l.erros.length) {
              <span class="fim ft-selo erro">✕ {{ l.erros.length }} erro(s)</span>
            } @else {
              <span class="fim ft-selo ok">✓ Dígitos conferem</span>
            }
          </h4>
          @if (l.erros.length) {
            <p class="ft-aviso">
              @for (e of l.erros; track e) {
                {{ e }}<br />
              }
            </p>
          }
          <dl class="ft-kv">
            <dt>Linha digitável</dt>
            <dd class="ft-copia" (click)="ui.copiar(l.linha.replace(sep, ''))" title="Copia sem pontuação">{{ l.linha }}</dd>
            <dt>Código de barras</dt>
            <dd class="ft-copia" (click)="ui.copiar(l.barras)">{{ l.barras }}</dd>
            @for (c of l.campos; track c[0]) {
              <dt>{{ c[0] }}</dt>
              <dd class="ft-copia" (click)="ui.copiar(c[1])">{{ c[1] }}</dd>
            }
          </dl>
          @if (svg(); as s) {
            <svg class="ft-barras" [attr.viewBox]="'0 0 ' + s.largura + ' 50'" preserveAspectRatio="none">
              @for (b of s.barras; track $index) {
                <rect [attr.x]="b[0]" [attr.width]="b[1]" height="50" />
              }
            </svg>
          }
          <p class="ft-dica">Na linha de boleto os 3 primeiros campos usam módulo 10 e o DV geral, módulo 11. Na guia de arrecadação o módulo vem do 3º dígito (6/7 = 10, 8/9 = 11).</p>
        </div>
      }

      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Data → fator de vencimento</h4>
          <input type="date" [(ngModel)]="data" />
          @if (fator() !== null) {
            <button class="ft-valor" (click)="ui.copiar(fator()!.toString())">{{ fator() }}</button>
          }
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Fator → data</h4>
          <input type="number" min="0" max="9999" [(ngModel)]="fatorEntrada" placeholder="Ex.: 1000" />
          @if (dataFator(); as d) {
            <button class="ft-valor" (click)="ui.copiar(d)">{{ d }}</button>
          }
        </div>
      </div>
      <p class="ft-dica">O fator reiniciou em 1000 no dia 22/02/2025. Na conversão fator → data é usada a data mais próxima de hoje.</p>
    </div>
  `,
  styles: `
    .ft-barras {
      width: 100%;
      height: 60px;
      background: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      fill: #000;
    }
  `,
})
export class Boleto {
  protected readonly ui = inject(Ui);
  protected readonly sep = /\D/g;
  protected readonly entrada = lembrado('boleto.entrada', '');
  protected readonly data = lembrado('boleto.data', hojeIso());
  protected readonly fatorEntrada = lembrado<number | null>('boleto.fatorEntrada', null);

  protected readonly modo = lembrado<'ler' | 'gerar'>('boleto.modo', 'ler');
  protected readonly gTipo = lembrado<'banco' | 'arrec'>('boleto.gTipo', 'banco');
  protected readonly gBanco = lembrado('boleto.gBanco', '001');
  protected readonly gVenc = lembrado('boleto.gVenc', hojeIso());
  protected readonly gValor = lembrado('boleto.gValor', '100,00');
  protected readonly gSegmento = lembrado('boleto.gSegmento', '1');
  protected readonly gRef = lembrado('boleto.gRef', '6');
  protected readonly gEmpresa = lembrado('boleto.gEmpresa', '0001');
  protected readonly semente = signal(novaSemente());
  protected readonly novaSemente = novaSemente;
  protected readonly ehBoleto = (t: string) => /^\d{44}$/.test(t);
  protected readonly bancos = [
    ['001', 'Banco do Brasil'],
    ['033', 'Santander'],
    ['104', 'Caixa'],
    ['237', 'Bradesco'],
    ['341', 'Itaú'],
    ['748', 'Sicredi'],
    ['756', 'Sicoob'],
  ];
  protected readonly segmentos = [
    ['1', 'Prefeituras'],
    ['2', 'Saneamento'],
    ['3', 'Energia elétrica e gás'],
    ['4', 'Telecomunicações'],
    ['5', 'Órgãos governamentais'],
    ['6', 'Carnês e assemelhados'],
    ['7', 'Multas de trânsito'],
    ['9', 'Uso exclusivo do banco'],
  ];

  private readonly gerado = computed(() => {
    try {
      const valor = centavos(this.gValor());
      const codigo =
        this.gTipo() === 'banco'
          ? gerarBancario(this.gBanco(), valor, this.gVenc() ? deIso(this.gVenc()) : null, this.semente())
          : gerarArrecadacao(this.gSegmento(), this.gRef(), valor, this.gEmpresa(), this.semente());
      return { codigo, erro: '' };
    } catch (e) {
      return { codigo: '', erro: (e as Error).message };
    }
  });
  protected readonly erroGerar = computed(() => (this.modo() === 'gerar' ? this.gerado().erro : ''));

  private readonly resultado = computed(() => ler(this.modo() === 'ler' ? this.entrada() : this.gerado().codigo));
  protected readonly leitura = computed(() => (typeof this.resultado() === 'string' ? null : (this.resultado() as Leitura)));
  protected readonly erroEntrada = computed(() => (typeof this.resultado() === 'string' ? (this.resultado() as string) : ''));
  protected readonly svg = computed(() => (this.leitura() ? barrasItf(this.leitura()!.barras) : null));

  protected readonly fator = computed(() => {
    const ms = deIso(this.data());
    return isNaN(ms) ? null : fatorDaData(ms);
  });

  protected readonly dataFator = computed(() => {
    const f = this.fatorEntrada();
    if (f === null || f < 0 || f > 9999) return '';
    const ms = dataDoFator(f);
    return ms ? extenso(ms) : 'Sem vencimento';
  });
}
