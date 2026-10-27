import { Component, computed, input, model, signal } from '@angular/core';
import { chaveNome, partes } from './models';

// valores separados por vírgula editados como chips, com lista de opções ao focar
@Component({
  selector: 'app-multi',
  template: `
    @for (v of itens(); track v) {
      <span class="tag">{{ v }}<span class="x" (mousedown)="$event.preventDefault()" (click)="remover(v)" title="Remover">✕</span></span>
    }
    <input
      [value]="texto()"
      [placeholder]="itens().length ? '' : 'Selecionar ou digitar…'"
      (focus)="aberto.set(true)"
      (input)="digitou($any($event.target).value)"
      (keydown)="tecla($event)"
      (blur)="adicionar(texto()); aberto.set(false)"
    />
    @if (aberto() && (filtradas().length || novo())) {
      <ul class="opcoes">
        @for (o of filtradas(); track o; let i = $index) {
          <li [class.ativa]="i === ativa()" (mousedown)="$event.preventDefault(); adicionar(o)">{{ o }}</li>
        }
        @if (novo()) {
          <li class="novo" [class.ativa]="ativa() === filtradas().length" (mousedown)="$event.preventDefault(); adicionar(texto())">
            + Adicionar "{{ texto().trim() }}"
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      min-height: 36px;
      padding: 4px 24px 4px 6px;
      background: var(--bg-elev);
      border: 1px solid var(--borda);
      border-radius: 8px;
      cursor: text;
    }
    :host::after {
      content: '▾';
      position: absolute;
      right: 8px;
      color: var(--texto-2);
      pointer-events: none;
    }
    :host(:focus-within) {
      outline: 2px solid var(--acento-bg);
      border-color: var(--acento);
    }
    .tag {
      font-size: 12px;
      color: var(--texto);
    }
    .x {
      cursor: pointer;
      opacity: 0.5;
      margin-left: 4px;
    }
    .x:hover {
      opacity: 1;
      color: var(--perigo);
    }
    input {
      flex: 1;
      min-width: 70px;
      width: auto;
      border: 0;
      padding: 2px 4px;
      background: transparent;
      outline: none;
    }
    .opcoes {
      position: absolute;
      z-index: 5;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 220px;
      overflow: auto;
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--bg-elev);
      border: 1px solid var(--borda);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
      color: var(--texto);
      font-weight: 400;
    }
    li {
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
    }
    li.ativa,
    li:hover {
      background: var(--hover);
    }
    li.novo {
      color: var(--acento);
    }
  `,
  host: { '(click)': '$any($event.currentTarget).querySelector("input").focus()' },
})
export class Multi {
  readonly valor = model('');
  readonly opcoes = input<string[]>([]);
  protected readonly texto = signal('');
  protected readonly aberto = signal(false);
  protected readonly ativa = signal(-1);
  protected readonly itens = computed(() => partes(this.valor()));
  protected readonly filtradas = computed(() => {
    const t = chaveNome(this.texto());
    return this.opcoes().filter((o) => !this.itens().includes(o) && chaveNome(o).includes(t));
  });
  protected readonly novo = computed(() => {
    const t = chaveNome(this.texto());
    return !!t && !this.opcoes().some((o) => chaveNome(o) === t) && !this.itens().some((o) => chaveNome(o) === t);
  });

  digitou(v: string) {
    if (v.includes(',')) return this.adicionar(v);
    this.texto.set(v);
    this.ativa.set(-1);
    this.aberto.set(true);
  }

  tecla(e: KeyboardEvent) {
    const total = this.filtradas().length + (this.novo() ? 1 : 0);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.aberto.set(true);
      if (total) this.ativa.update((a) => e.key === 'ArrowDown' ? (a + 1) % total : a <= 0 ? total - 1 : a - 1);
    } else if (e.key === 'Enter' && (this.ativa() >= 0 || this.texto().trim())) {
      e.preventDefault();
      this.adicionar(this.filtradas()[this.ativa()] ?? this.texto());
    } else if (e.key === 'Escape' && this.aberto()) {
      e.stopPropagation();
      this.aberto.set(false);
    } else if (e.key === 'Backspace' && !this.texto() && this.itens().length) this.remover(this.itens().at(-1)!);
  }

  adicionar(v: string) {
    const novos = partes(v).map((n) => this.opcoes().find((o) => chaveNome(o) === chaveNome(n)) ?? n);
    this.texto.set('');
    this.ativa.set(-1);
    if (novos.length) this.valor.set(partes([...this.itens(), ...novos].join(',')).join(', '));
  }

  remover(v: string) {
    this.valor.set(this.itens().filter((x) => x !== v).join(', '));
  }
}
