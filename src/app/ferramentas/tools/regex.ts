import { Component, computed, inject } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';

const FLAGS = [
  ['g', 'todas'],
  ['i', 'ignorar caixa'],
  ['m', 'multilinha'],
  ['s', '. pega \\n'],
  ['u', 'unicode'],
] as const;

@Component({
  selector: 'ft-regex',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Expressão
          @if (resultado().erro) {
            <span class="ft-selo erro">✕ inválida</span>
          } @else if (padrao()) {
            <span class="ft-selo" [class.ok]="resultado().matches.length">{{ resultado().matches.length }} ocorrência(s)</span>
          }
        </h4>
        <div class="ft-linha">
          <span class="ft-mono">/</span>
          <input class="ft-mono" style="flex: 1; width: auto" [ngModel]="padrao()" (ngModelChange)="mudarPadrao($event)" placeholder="(\\d{3})\\.(\\d{3})" spellcheck="false" />
          <span class="ft-mono">/{{ flags() }}</span>
        </div>
        <div class="ft-linha">
          @for (f of FLAGS; track f[0]) {
            <label class="ft-chk"><input type="checkbox" [checked]="flags().includes(f[0])" (change)="alternar(f[0])" /> <b class="ft-mono">{{ f[0] }}</b> {{ f[1] }}</label>
          }
        </div>
        @if (resultado().erro; as e) {
          <p class="ft-aviso">{{ e }}</p>
        }
      </div>
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Texto</h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="10" spellcheck="false"></textarea>
          <div class="ft-regex">
            @for (p of resultado().pedacos; track $index) {
              @if (p.m) {
                <mark>{{ p.t }}</mark>
              } @else {
                {{ p.t }}
              }
            }
          </div>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">Substituir por</h4>
          <input class="ft-mono" [(ngModel)]="troca" placeholder="$1-$2 ou $<nome>" spellcheck="false" />
          <h4 class="ft-titulo">
            Resultado
            <button class="btn mini fim" [disabled]="!resultado().substituido" (click)="ui.copiar(resultado().substituido)">Copiar</button>
          </h4>
          <textarea class="ft-texto" readonly rows="6" [value]="resultado().substituido"></textarea>
        </div>
      </div>
      @if (resultado().matches.length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">Ocorrências</h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>#</th><th>Posição</th><th>Valor</th><th>Grupos</th></tr>
            </thead>
            <tbody>
              @for (m of resultado().matches.slice(0, 200); track $index) {
                <tr>
                  <td>{{ $index + 1 }}</td>
                  <td>{{ m.index }}</td>
                  <td class="ft-mono ft-copia" (click)="ui.copiar(m[0])">{{ m[0] }}</td>
                  <td class="ft-mono">{{ grupos(m) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class Regex {
  protected readonly ui = inject(Ui);
  protected readonly FLAGS = FLAGS;
  protected readonly padrao = lembrado('regex.padrao', '');
  protected readonly flags = lembrado('regex.flags', 'g');
  protected readonly texto = lembrado('regex.texto', '');
  protected readonly troca = lembrado('regex.troca', '');

  protected readonly resultado = computed(() => {
    const vazio = { erro: '', matches: [] as RegExpExecArray[], pedacos: [{ t: this.texto(), m: false }], substituido: '' };
    if (!this.padrao()) return vazio;
    let re: RegExp;
    try {
      re = new RegExp(this.padrao(), this.flags().includes('g') ? this.flags() : this.flags() + 'g');
    } catch (e) {
      return { ...vazio, erro: (e as Error).message };
    }
    const t = this.texto();
    let matches = [...t.matchAll(re)];
    if (!this.flags().includes('g')) matches = matches.slice(0, 1);
    const pedacos: { t: string; m: boolean }[] = [];
    let pos = 0;
    for (const m of matches) {
      if (!m[0]) continue;
      pedacos.push({ t: t.slice(pos, m.index), m: false }, { t: m[0], m: true });
      pos = m.index + m[0].length;
    }
    pedacos.push({ t: t.slice(pos), m: false });
    return { erro: '', matches, pedacos, substituido: t.replace(new RegExp(this.padrao(), this.flags()), this.troca()) };
  });

  // colar "/abc/gi" separa padrão e flags
  mudarPadrao(v: string) {
    const m = v.match(/^\/(.+)\/([gimsuy]*)$/);
    this.padrao.set(m ? m[1] : v);
    if (m) this.flags.set(m[2]);
  }

  alternar(f: string) {
    this.flags.update((s) => (s.includes(f) ? s.replace(f, '') : s + f));
  }

  grupos(m: RegExpExecArray) {
    const nomes = m.groups ? Object.entries(m.groups).map(([k, v]) => `${k}=${v ?? '∅'}`) : [];
    return nomes.length ? nomes.join('  ') : m.slice(1).map((g, i) => `$${i + 1}=${g ?? '∅'}`).join('  ');
  }
}
