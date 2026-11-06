import { Component, computed } from '@angular/core';
import { lembrado } from '../lib/estado';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'ft-contador',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">
          Texto
          <label class="ft-chk fim">
            Limite por linha
            <input type="number" min="0" [(ngModel)]="limite" placeholder="varchar" style="width: 90px" />
          </label>
        </h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="10" spellcheck="false"></textarea>
      </div>
      <div class="ft-cards">
        @for (c of numeros(); track c[0]) {
          <div class="ft-painel">
            <h4 class="ft-titulo">{{ c[0] }}</h4>
            <span class="ft-grande">{{ c[1] }}</span>
          </div>
        }
      </div>
      @if (excedidas().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Linhas acima de {{ limite() }}
            <span class="ft-selo erro">{{ excedidas().length }}</span>
          </h4>
          <table class="ft-tabela">
            <thead>
              <tr><th>Linha</th><th>Tamanho</th><th>Texto</th></tr>
            </thead>
            <tbody>
              @for (l of excedidas().slice(0, 200); track l.n) {
                <tr>
                  <td>{{ l.n }}</td>
                  <td>{{ l.tam }}</td>
                  <td class="ft-mono">{{ l.texto }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (limite() && texto()) {
        <p class="ft-aviso ok">Todas as linhas cabem em {{ limite() }} caracteres.</p>
      }
      <p class="ft-dica">Caracteres contam emoji como 1. Bytes UTF-8 é o que conta em campo varchar de banco UTF-8 com limite em bytes; Latin1 usa 1 byte por caractere.</p>
    </div>
  `,
})
export class Contador {
  protected readonly texto = lembrado('contador.texto', '');
  protected readonly limite = lembrado<number | null>('contador.limite', null);

  private readonly linhas = computed(() => this.texto().split(/\r?\n/));

  protected readonly numeros = computed(() => {
    const t = this.texto();
    const chars = [...t];
    const maior = this.linhas().reduce((m, l, i) => ([...l].length > m.tam ? { tam: [...l].length, n: i + 1 } : m), { tam: 0, n: 0 });
    const fmt = (n: number) => n.toLocaleString('pt-BR');
    return [
      ['Caracteres', fmt(chars.length)],
      ['Sem espaços', fmt(chars.filter((c) => !/\s/.test(c)).length)],
      ['Bytes UTF-8', fmt(new TextEncoder().encode(t).length)],
      ['Palavras', fmt(t.trim() ? t.trim().split(/\s+/).length : 0)],
      ['Linhas', fmt(t ? this.linhas().length : 0)],
      ['Maior linha', t ? `${fmt(maior.tam)} (L${maior.n})` : '0'],
    ];
  });

  protected readonly excedidas = computed(() => {
    const lim = this.limite();
    if (!lim) return [];
    return this.linhas()
      .map((l, i) => ({ n: i + 1, tam: [...l].length, texto: l }))
      .filter((l) => l.tam > lim);
  });
}
