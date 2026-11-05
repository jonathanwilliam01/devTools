import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { Sep, csvParaObjetos, detectarSep, jsonParaObjetos, objetosParaCsv, objetosParaInsert } from '../lib/csv';

type Saida = 'json' | 'csv' | 'insert';

@Component({
  selector: 'ft-conversor',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-linha">
        <div class="ft-seg">
          @for (s of SAIDAS; track s[0]) {
            <button [class.on]="saida() === s[0]" (click)="saida.set(s[0])">{{ s[1] }}</button>
          }
        </div>
        <label class="ft-chk">
          Separador
          <select [(ngModel)]="sep">
            <option value="auto">automático</option>
            <option [ngValue]="'\t'">TAB</option>
            <option value=";">;</option>
            <option value=",">,</option>
          </select>
        </label>
        @if (saida() === 'insert') {
          <input class="ft-mono" [(ngModel)]="tabela" placeholder="TABELA" style="width: 180px" />
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Entrada
            @if (resultado(); as r) {
              <span class="ft-selo">{{ r.tipo }} · {{ r.linhas }} linha(s)</span>
            }
          </h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="16" spellcheck="false" placeholder="CSV com cabeçalho na 1ª linha (pode colar do Excel) ou JSON"></textarea>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Resultado
            <button class="btn mini fim" [disabled]="!resultado()?.saida" (click)="ui.copiar(resultado()!.saida)">Copiar</button>
          </h4>
          @if (resultado()?.erro; as e) {
            <p class="ft-aviso">{{ e }}</p>
          }
          <textarea class="ft-texto" readonly rows="16" spellcheck="false" [value]="resultado()?.saida ?? ''"></textarea>
        </div>
      </div>
      <p class="ft-dica">Entrada começando com [ ou {{ '{' }} é lida como JSON. No INSERT, números sem zero à esquerda ficam sem aspas e vazio vira NULL.</p>
    </div>
  `,
})
export class Conversor {
  protected readonly ui = inject(Ui);
  protected readonly SAIDAS: [Saida, string][] = [
    ['json', 'JSON'],
    ['csv', 'CSV'],
    ['insert', 'INSERT'],
  ];
  protected readonly texto = signal('');
  protected readonly saida = signal<Saida>('json');
  protected readonly sep = signal<Sep | 'auto'>('auto');
  protected readonly tabela = signal('');

  protected readonly resultado = computed(() => {
    const t = this.texto().trim();
    if (!t) return null;
    const json = /^[[{]/.test(t);
    const tipo = json ? 'JSON' : 'CSV';
    try {
      const sep = this.sep() === 'auto' ? (json ? ';' : detectarSep(t.split('\n')[0])) : (this.sep() as Sep);
      const l = json ? jsonParaObjetos(t) : csvParaObjetos(t, sep);
      const saida =
        this.saida() === 'json' ? JSON.stringify(l, null, 2) : this.saida() === 'csv' ? objetosParaCsv(l, sep) : objetosParaInsert(l, this.tabela().trim());
      return { tipo, linhas: l.length, saida, erro: '' };
    } catch (e) {
      return { tipo, linhas: 0, saida: '', erro: (e as Error).message };
    }
  });
}
