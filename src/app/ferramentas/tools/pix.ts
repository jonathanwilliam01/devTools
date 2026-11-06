import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import qrcode from 'qrcode-generator';
import { CampoPix, gerarPix, lerPix } from '../lib/pix';

@Component({
  selector: 'ft-pix',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-seg">
        <button [class.on]="modo() === 'ler'" (click)="modo.set('ler')">Ler código</button>
        <button [class.on]="modo() === 'gerar'" (click)="modo.set('gerar')">Gerar código</button>
      </div>

      @if (modo() === 'ler') {
        <div class="ft-painel">
          <h4 class="ft-titulo">Pix copia e cola</h4>
          <textarea class="ft-texto" [(ngModel)]="codigo" rows="4" spellcheck="false" placeholder="00020126..." style="min-height: 0"></textarea>
        </div>
        @if (leitura(); as l) {
          @if (l.erro) {
            <p class="ft-aviso">{{ l.erro }}</p>
          } @else {
            <div class="ft-painel">
              <h4 class="ft-titulo">
                Campos
                @if (l.crcOk) {
                  <span class="fim ft-selo ok">✓ CRC confere</span>
                } @else {
                  <span class="fim ft-selo erro">✕ CRC {{ l.crc || 'ausente' }}, esperado {{ l.esperado }}</span>
                }
              </h4>
              <dl class="ft-kv">
                @for (c of l.lista; track $index) {
                  <dt [style.padding-left.px]="c.filho ? 28 : 12">{{ c.id }} · {{ c.nome }}</dt>
                  <dd class="ft-copia" (click)="ui.copiar(c.valor)">{{ c.valor }}</dd>
                }
              </dl>
            </div>
          }
        }
      } @else {
        <div class="ft-painel">
          <div class="ft-duas">
            <label class="ft-rotulo">Chave * <input [(ngModel)]="chave" placeholder="CPF, CNPJ, e-mail, telefone (+55...) ou aleatória" /></label>
            <label class="ft-rotulo">Valor <input [(ngModel)]="valor" placeholder="Em branco = pagador informa" /></label>
            <label class="ft-rotulo">Recebedor <input [(ngModel)]="nome" maxlength="25" /></label>
            <label class="ft-rotulo">Cidade <input [(ngModel)]="cidade" maxlength="15" /></label>
            <label class="ft-rotulo">TXID <input [(ngModel)]="txid" maxlength="25" placeholder="*** (sem identificador)" /></label>
            <label class="ft-rotulo">Descrição <input [(ngModel)]="descricao" /></label>
          </div>
        </div>
        @if (gerado().erro; as e) {
          <p class="ft-aviso">{{ e }}</p>
        } @else if (gerado().codigo; as c) {
          <button class="ft-valor" (click)="ui.copiar(c)" style="font-size: 13px">{{ c }}</button>
        }
        <p class="ft-dica">Pix estático. Nome e cidade perdem os acentos e são cortados em 25 e 15 caracteres, como pede o padrão.</p>
      }

      @if (qr(); as q) {
        <div class="ft-painel ft-qr">
          <h4 class="ft-titulo">
            QR Code
            <button class="btn mini ghost fim" (click)="baixar(q)">Baixar SVG</button>
          </h4>
          <svg [attr.viewBox]="'0 0 ' + q.tam + ' ' + q.tam" shape-rendering="crispEdges">
            <rect [attr.width]="q.tam" [attr.height]="q.tam" fill="#fff" />
            <path [attr.d]="q.d" fill="#000" />
          </svg>
        </div>
      }
    </div>
  `,
  styles: `
    .ft-qr svg {
      width: 240px;
      height: 240px;
      justify-self: start;
      border-radius: 6px;
    }
  `,
})
export class Pix {
  protected readonly ui = inject(Ui);
  protected readonly modo = signal<'ler' | 'gerar'>('ler');
  protected readonly codigo = signal('');
  protected readonly chave = signal('');
  protected readonly nome = signal('');
  protected readonly cidade = signal('');
  protected readonly valor = signal('');
  protected readonly txid = signal('');
  protected readonly descricao = signal('');

  protected readonly leitura = computed(() => {
    const c = this.codigo().trim();
    if (!c) return null;
    try {
      const l = lerPix(c);
      const lista = l.campos.flatMap((x: CampoPix) =>
        x.filhos ? [{ ...x, filho: false }, ...x.filhos.map((f) => ({ ...f, filho: true }))] : [{ ...x, filho: false }],
      );
      return { ...l, lista, erro: '' };
    } catch (e) {
      return { erro: (e as Error).message, lista: [], crc: '', esperado: '', crcOk: false };
    }
  });

  protected readonly gerado = computed(() => {
    if (!this.chave().trim()) return { codigo: '', erro: '' };
    try {
      const d = { chave: this.chave(), nome: this.nome(), cidade: this.cidade(), valor: this.valor(), txid: this.txid(), descricao: this.descricao() };
      return { codigo: gerarPix(d), erro: '' };
    } catch (e) {
      return { codigo: '', erro: (e as Error).message };
    }
  });

  // margem de 4 módulos, como pede o padrão
  protected readonly qr = computed(() => {
    const l = this.leitura();
    const c = this.modo() === 'ler' ? (l && !l.erro ? this.codigo().trim() : '') : this.gerado().codigo;
    if (!c) return null;
    const q = qrcode(0, 'M');
    q.addData(c, 'Byte');
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) d += `M${k + 4},${r + 4}h1v1h-1z`;
    return { d, tam: n + 8 };
  });

  baixar(q: { d: string; tam: number }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${q.tam} ${q.tam}" width="${q.tam * 8}" height="${q.tam * 8}" shape-rendering="crispEdges"><rect width="${q.tam}" height="${q.tam}" fill="#fff"/><path d="${q.d}" fill="#000"/></svg>`;
    this.ui.baixar('pix.svg', svg, 'image/svg+xml');
  }
}
