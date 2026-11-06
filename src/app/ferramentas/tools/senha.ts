import { Component, computed, inject, signal } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Ui } from '../../ui';

const GRUPOS = {
  mai: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  min: 'abcdefghijklmnopqrstuvwxyz',
  num: '0123456789',
  sim: '!@#$%&*()-_=+[]{};:,.?/',
};
type Grupo = keyof typeof GRUPOS;
const AMBIGUOS = /[Il1O0o]/g;

// sem viés de módulo: descarta valores acima do maior múltiplo
function aleatorio(max: number) {
  const lim = Math.floor(0x100000000 / max) * max;
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b);
  while (b[0] >= lim);
  return b[0] % max;
}

@Component({
  selector: 'ft-senha',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <div class="ft-linha">
          <label class="ft-chk">
            Tamanho
            <input type="range" min="4" max="64" [(ngModel)]="tamanho" (ngModelChange)="gerar()" style="width: 160px" />
            <b class="ft-mono">{{ tamanho() }}</b>
          </label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="usar.mai" (ngModelChange)="gerar()" /> A-Z</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="usar.min" (ngModelChange)="gerar()" /> a-z</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="usar.num" (ngModelChange)="gerar()" /> 0-9</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="usar.sim" (ngModelChange)="gerar()" /> Símbolos</label>
          <label class="ft-chk"><input type="checkbox" [(ngModel)]="semAmbiguos" (ngModelChange)="gerar()" /> Sem ambíguos (Il1O0)</label>
          <button class="btn primario fim" (click)="gerar()">↻ Gerar</button>
        </div>
      </div>
      @for (s of senhas(); track $index) {
        <button class="ft-valor" (click)="ui.copiar(s, 'Senha copiada!')">{{ s }}</button>
      }
      @if (senhas().length) {
        <p class="ft-dica">
          <span class="ft-selo" [class.ok]="forca().bits >= 80" [class.erro]="forca().bits < 50">{{ forca().nome }}</span>
          ≈ {{ forca().bits }} bits de entropia · <kbd>n</kbd> gera de novo
        </p>
      } @else {
        <p class="ft-aviso">Marque ao menos um tipo de caractere.</p>
      }
      <div class="ft-painel">
        <h4 class="ft-titulo">
          UUID v4
          <button class="btn mini ghost fim" (click)="uuid.set(novoUuid())">↻</button>
        </h4>
        <button class="ft-valor" (click)="ui.copiar(uuid())">{{ uuid() }}</button>
      </div>
      <p class="ft-dica">Gerado no navegador com crypto.getRandomValues; nada é enviado ou guardado. Cada tipo marcado aparece ao menos uma vez.</p>
    </div>
  `,
})
export class Senha {
  protected readonly ui = inject(Ui);
  protected readonly tamanho = lembrado('senha.tamanho', 16);
  protected readonly usar: Record<Grupo, boolean> = { mai: true, min: true, num: true, sim: true };
  protected readonly semAmbiguos = lembrado('senha.semAmbiguos', false);
  protected readonly senhas = signal<string[]>([]);
  protected readonly novoUuid = () => crypto.randomUUID();
  protected readonly uuid = signal(this.novoUuid());

  private conjuntos() {
    return (Object.keys(GRUPOS) as Grupo[])
      .filter((g) => this.usar[g])
      .map((g) => (this.semAmbiguos() ? GRUPOS[g].replace(AMBIGUOS, '') : GRUPOS[g]));
  }

  protected readonly forca = computed(() => {
    this.senhas();
    const n = this.conjuntos().join('').length;
    const bits = Math.round(this.tamanho() * Math.log2(n || 1));
    return { bits, nome: bits >= 100 ? 'muito forte' : bits >= 80 ? 'forte' : bits >= 50 ? 'razoável' : 'fraca' };
  });

  constructor() {
    this.gerar();
    this.ui.atalhos.pipe(takeUntilDestroyed()).subscribe((a) => a === 'novo' && this.gerar());
  }

  gerar() {
    const conj = this.conjuntos();
    if (!conj.length) return this.senhas.set([]);
    const todos = conj.join('');
    const n = Math.max(this.tamanho(), conj.length);
    this.senhas.set(
      Array.from({ length: 5 }, () => {
        const c = [...conj.map((g) => g[aleatorio(g.length)]), ...Array.from({ length: n - conj.length }, () => todos[aleatorio(todos.length)])];
        for (let i = c.length - 1; i > 0; i--) {
          const j = aleatorio(i + 1);
          [c[i], c[j]] = [c[j], c[i]];
        }
        return c.join('');
      }),
    );
  }
}
