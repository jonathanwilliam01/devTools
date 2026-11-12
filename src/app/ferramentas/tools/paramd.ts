import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { markdown } from '../../markdown';
import { lembrado } from '../lib/estado';
import { Ajuste, gerar, ler, Linha, TIPOS } from '../lib/paramd';

@Component({
  selector: 'ft-paramd',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-painel">
        <h4 class="ft-titulo">Texto</h4>
        <textarea class="ft-texto" [(ngModel)]="texto" rows="8" spellcheck="false" placeholder="Cole o texto puro aqui"></textarea>
      </div>
      @if (linhas().length) {
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Linhas
            <span class="ft-selo">{{ linhas().length }}</span>
            <span class="ft-linha fim">
              <label class="ft-chk"><input type="checkbox" [checked]="todos('linha')" (change)="emTitulos('linha', $any($event.target).checked)" /> Linha antes dos títulos</label>
              <label class="ft-chk"><input type="checkbox" [checked]="todos('sublinhado')" (change)="emTitulos('sublinhado', $any($event.target).checked)" /> Sublinhar títulos</label>
              <button class="btn mini ghost" [disabled]="!temAjuste()" (click)="ajustes.set({})">Desfazer ajustes</button>
            </span>
          </h4>
          <div class="pm-lista">
            @for (l of linhas(); track l.chave) {
              <div class="pm-linha" [class.titulo]="l.tipo[0] === 'h'">
                <select [ngModel]="l.tipo" (ngModelChange)="ajustar(l, { tipo: $event })">
                  @for (t of TIPOS; track t[0]) {
                    <option [value]="t[0]">{{ t[1] }}</option>
                  }
                </select>
                <span class="pm-bts">
                  <button [class.on]="l.negrito" title="Negrito" (click)="ajustar(l, { negrito: !l.negrito })"><b>B</b></button>
                  <button [class.on]="l.italico" title="Itálico" (click)="ajustar(l, { italico: !l.italico })"><i>I</i></button>
                  <button [class.on]="l.sublinhado" title="Sublinhado" (click)="ajustar(l, { sublinhado: !l.sublinhado })"><u>U</u></button>
                  <button [class.on]="l.linha" title="Linha separadora antes" (click)="ajustar(l, { linha: !l.linha })">―</button>
                </span>
                <span class="pm-txt">{{ l.conteudo }}</span>
              </div>
            }
          </div>
        </div>
      }
      @if (saida()) {
        <div class="ft-duas">
          <div class="ft-painel">
            <h4 class="ft-titulo">
              Markdown
              <button class="btn mini fim" (click)="ui.copiar(saida())">Copiar</button>
            </h4>
            <textarea class="ft-texto ft-mono" readonly rows="14" [value]="saida()"></textarea>
          </div>
          <div class="ft-painel">
            <h4 class="ft-titulo">Prévia</h4>
            <div class="md pm-previa" [innerHTML]="html()"></div>
          </div>
        </div>
      }
      <p class="ft-dica">
        Títulos, listas, citação e código são detectados sozinhos (linha curta isolada, CAIXA ALTA, "1.1 Seção", "-", "•", recuo de 4 espaços). Ajuste o tipo e a formatação
        de cada linha. Sublinhado sai como &lt;u&gt;, que o GitHub/GitLab aceitam.
      </p>
    </div>
  `,
  styles: `
    .pm-previa { min-height: 240px; max-height: 520px; overflow: auto; padding: 8px 12px; border-radius: 8px; background: var(--bg-2); }
    .pm-lista { display: grid; gap: 4px; max-height: 480px; overflow: auto; }
    .pm-linha { display: grid; grid-template-columns: 120px auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 2px 0; font-size: 13px; }
    .pm-linha select { padding: 3px 6px; font-size: 12px; }
    .pm-linha.titulo .pm-txt { font-weight: 600; color: var(--texto); }
    .pm-txt { color: var(--texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pm-bts { display: inline-flex; gap: 2px; }
    .pm-bts button { all: unset; width: 24px; text-align: center; padding: 2px 0; border-radius: 4px; cursor: pointer; color: var(--texto-2); }
    .pm-bts button:hover { background: var(--bg-2); color: var(--texto); }
    .pm-bts button.on { background: var(--acento-bg); color: var(--acento); }
  `,
})
export class ParaMd {
  protected readonly ui = inject(Ui);
  protected readonly TIPOS = TIPOS;
  protected readonly texto = lembrado('paramd.texto', '');
  protected readonly ajustes = lembrado<Record<string, Ajuste>>('paramd.ajustes', {});

  protected readonly linhas = computed(() => ler(this.texto(), this.ajustes()));
  protected readonly saida = computed(() => gerar(this.linhas()));
  protected readonly html = computed(() => markdown(this.saida()).replace(/&lt;(\/?)u&gt;/g, '<$1u>'));
  protected readonly temAjuste = computed(() => Object.keys(this.ajustes()).length > 0);

  ajustar(l: Linha, a: Ajuste) {
    this.ajustes.update((x) => ({ ...x, [l.chave]: { ...x[l.chave], ...a } }));
  }

  // linha antes não vale para a primeira linha do texto
  private titulos(campo: 'linha' | 'sublinhado') {
    return this.linhas().filter((l, i) => l.tipo[0] === 'h' && !(campo === 'linha' && i === 0));
  }

  todos(campo: 'linha' | 'sublinhado') {
    const t = this.titulos(campo);
    return t.length > 0 && t.every((l) => l[campo]);
  }

  emTitulos(campo: 'linha' | 'sublinhado', v: boolean) {
    const t = this.titulos(campo);
    this.ajustes.update((x) => Object.fromEntries([...Object.entries(x), ...t.map((l) => [l.chave, { ...x[l.chave], [campo]: v }])]));
  }
}
