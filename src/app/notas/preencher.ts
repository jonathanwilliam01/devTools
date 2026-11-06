import { Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store } from '../store';
import { Ui } from '../ui';

const VAR = /\{\{\s*([\w.-]+)\s*\}\}/g;

export const partesVars = (texto: string) => texto.split(/(\{\{\s*[\w.-]+\s*\}\})/).map((t) => ({ t, v: /^\{\{/.test(t) }));
const nomesVars = (texto: string) => [...new Set([...texto.matchAll(VAR)].map((m) => m[1]))];

// texto sem {{variavel}} copia direto; com variável devolve true para abrir o formulário
export function copiarOuPreencher(ui: Ui, texto: string) {
  if (nomesVars(texto).length) return true;
  ui.copiar(texto);
  return false;
}

@Component({
  selector: 'app-preencher',
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="fechar.emit()">
      <form class="dialogo vars" (click)="$event.stopPropagation()" (ngSubmit)="confirmar()">
        <h2>Preencher e copiar</h2>
        @for (c of campos; track c.nome; let primeiro = $first) {
          <label class="campo">
            {{ c.nome }}
            <input [name]="c.nome" [(ngModel)]="c.valor" [attr.autofocus]="primeiro ? '' : null" />
          </label>
        }
        <pre class="previa">@for (x of partes; track $index) {@if (x.v) {<mark>{{ valorDe(x.t) }}</mark>} @else {<ng-container>{{ x.t }}</ng-container>}}</pre>
        <div class="rodape">
          <button type="button" class="btn" (click)="fechar.emit()">Cancelar</button>
          <button type="submit" class="btn primario">Copiar</button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .dialogo.vars {
      width: min(520px, 100%);
    }
    .previa {
      margin: 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--bg-2);
      font-family: var(--mono);
      font-size: 12.5px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow: auto;
    }
    mark {
      background: var(--acento-bg);
      color: var(--acento);
      border-radius: 3px;
      padding: 0 2px;
    }
  `,
})
export class Preencher implements OnInit {
  private readonly store = inject(Store);
  private readonly ui = inject(Ui);
  readonly texto = input.required<string>();
  readonly fechar = output();
  protected campos: { nome: string; valor: string }[] = [];
  protected partes: { t: string; v: boolean }[] = [];

  ngOnInit() {
    const vars = this.store.vars();
    this.campos = nomesVars(this.texto()).map((nome) => ({ nome, valor: vars[nome] ?? '' }));
    this.partes = partesVars(this.texto());
  }

  protected valorDe(token: string) {
    const nome = token.replace(/[{}\s]/g, '');
    return this.campos.find((c) => c.nome === nome)?.valor || token;
  }

  protected confirmar() {
    const valores = Object.fromEntries(this.campos.map((c) => [c.nome, c.valor]));
    this.store.vars.update((v) => ({ ...v, ...valores }));
    this.ui.copiar(this.texto().replace(VAR, (_, nome) => valores[nome] ?? ''));
    this.fechar.emit();
  }
}
