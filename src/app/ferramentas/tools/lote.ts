import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { inserirLinhas, Par, substituir } from '../lib/lote';

@Component({
  selector: 'ft-lote',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-seg">
        <button [class.on]="modo() === 'inserir'" (click)="modo.set('inserir')">Inserir nas linhas</button>
        <button [class.on]="modo() === 'trocar'" (click)="modo.set('trocar')">Localizar e substituir</button>
      </div>
      @if (modo() === 'inserir') {
        <div class="ft-painel">
          <div class="ft-linha">
            <label class="ft-chk">Antes <input class="ft-mono" [(ngModel)]="antes" spellcheck="false" placeholder="'" style="width: 140px" /></label>
            <label class="ft-chk">Depois <input class="ft-mono" [(ngModel)]="depois" spellcheck="false" placeholder="'," style="width: 140px" /></label>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="pularVazias" /> Pular linhas vazias</label>
          </div>
          <div class="ft-linha">
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="numerar" /> Numerar</label>
            @if (numerar()) {
              <label class="ft-chk">Início <input type="number" [(ngModel)]="inicio" style="width: 80px" /></label>
              <label class="ft-chk">Passo <input type="number" [(ngModel)]="passo" style="width: 70px" /></label>
              <label class="ft-chk">Dígitos <input type="number" min="1" max="10" [(ngModel)]="digitos" style="width: 70px" /></label>
              <label class="ft-chk">Separador <input class="ft-mono" [(ngModel)]="separador" spellcheck="false" style="width: 80px" /></label>
            }
          </div>
        </div>
      } @else {
        <div class="ft-painel">
          @for (p of pares(); track $index) {
            <div class="ft-linha">
              <input class="ft-mono" style="flex: 1; width: auto" [ngModel]="p.de" (ngModelChange)="mudar($index, 'de', $event)" placeholder="Localizar" spellcheck="false" />
              <span>→</span>
              <input class="ft-mono" style="flex: 1; width: auto" [ngModel]="p.para" (ngModelChange)="mudar($index, 'para', $event)" placeholder="Substituir por (vazio remove)" spellcheck="false" />
              <span class="ft-selo" [class.ok]="trocas().contagem[$index]">{{ trocas().contagem[$index] }}</span>
              <button class="btn mini" [disabled]="pares().length === 1" (click)="remover($index)">✕</button>
            </div>
          }
          <div class="ft-linha">
            <button class="btn mini" (click)="adicionar()">+ Termo</button>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="caixa" /> Diferenciar maiúsculas</label>
            <label class="ft-chk"><input type="checkbox" [(ngModel)]="palavra" /> Palavra inteira</label>
          </div>
        </div>
      }
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="14" spellcheck="false"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            @if (modo() === 'trocar' && texto()) {
              <span class="ft-selo" [class.ok]="trocas().total">{{ trocas().total }} troca(s)</span>
            }
            <button class="btn mini fim" [disabled]="!resultado()" (click)="ui.copiar(resultado())">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="14" [value]="resultado()"></textarea>
        </div>
      </div>
      <p class="ft-dica">Os termos são trocados na ordem da lista, texto puro (sem regex).</p>
    </div>
  `,
})
export class Lote {
  protected readonly ui = inject(Ui);
  protected readonly modo = lembrado<'inserir' | 'trocar'>('lote.modo', 'inserir');
  protected readonly texto = lembrado('lote.texto', '');
  protected readonly antes = lembrado('lote.antes', '');
  protected readonly depois = lembrado('lote.depois', '');
  protected readonly pularVazias = lembrado('lote.pularVazias', true);
  protected readonly numerar = lembrado('lote.numerar', false);
  protected readonly inicio = lembrado('lote.inicio', 1);
  protected readonly passo = lembrado('lote.passo', 1);
  protected readonly digitos = lembrado('lote.digitos', 1);
  protected readonly separador = lembrado('lote.separador', '. ');
  protected readonly pares = lembrado<Par[]>('lote.pares', [{ de: '', para: '' }]);
  protected readonly caixa = lembrado('lote.caixa', false);
  protected readonly palavra = lembrado('lote.palavra', false);

  protected readonly trocas = computed(() => substituir(this.texto(), this.pares(), { caixa: this.caixa(), palavra: this.palavra() }));

  protected readonly resultado = computed(() => {
    if (!this.texto()) return '';
    if (this.modo() === 'trocar') return this.trocas().texto;
    return inserirLinhas(this.texto(), {
      antes: this.antes(),
      depois: this.depois(),
      numerar: this.numerar(),
      inicio: Number(this.inicio()) || 0,
      passo: Number(this.passo()) || 1,
      digitos: Math.min(Math.max(Number(this.digitos()) || 1, 1), 10),
      separador: this.separador(),
      pularVazias: this.pularVazias(),
    });
  });

  mudar(i: number, campo: keyof Par, v: string) {
    this.pares.update((ps) => ps.map((p, j) => (j === i ? { ...p, [campo]: v } : p)));
  }

  adicionar() {
    this.pares.update((ps) => [...ps, { de: '', para: '' }]);
  }

  remover(i: number) {
    this.pares.update((ps) => ps.filter((_, j) => j !== i));
  }
}
