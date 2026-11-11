import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '../store';
import { Ui } from '../ui';
import { Cofre } from '../cofre';
import { Bloco, Nota, chaveNome } from '../models';
import { Preencher, copiarOuPreencher } from '../notas/preencher';

interface Item {
  nota: Nota;
  bloco: Bloco;
  nome: string;
  busca: string;
}

// Ctrl+K: acha um bloco de qualquer nota pelo título/rótulo e copia
@Component({
  selector: 'app-paleta',
  imports: [FormsModule, Preencher],
  template: `
    @if (preencher(); as p) {
      <app-preencher [texto]="p" (fechar)="fechar.emit()" />
    } @else {
      <div class="overlay topo" (click)="fechar.emit()">
        <div class="dialogo paleta" (click)="$event.stopPropagation()">
          <input
            class="busca"
            placeholder="Copiar bloco de nota... (↑↓ escolhe, Enter copia, Shift+Enter abre a nota)"
            [ngModel]="q()"
            (ngModelChange)="q.set($event); sel.set(0)"
            (keydown)="tecla($event)"
            autofocus
          />
          <ul>
            @for (it of itens(); track it.bloco.id; let i = $index) {
              <li [class.on]="i === sel()" (mouseenter)="sel.set(i)" (click)="copiar(it)" [attr.data-i]="i">
                <span class="nome">{{ it.nome }}</span>
                <span class="nota">{{ it.nota.titulo }}</span>
                <span class="previa">{{ previa(it.bloco) }}</span>
              </li>
            } @empty {
              <li class="vazio">Nenhum bloco encontrado.</li>
            }
          </ul>
        </div>
      </div>
    }
  `,
  styles: `
    .overlay.topo {
      place-items: start center;
      padding-top: 12vh;
    }
    .paleta {
      width: min(620px, 100%);
      padding: 10px;
      gap: 8px;
    }
    .busca {
      font-size: 15px;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 55vh;
      overflow: auto;
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0 10px;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
    }
    li.on {
      background: var(--acento-bg);
    }
    .nome {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .nota {
      font-size: 11px;
      color: var(--texto-2);
    }
    .previa {
      grid-column: 1 / -1;
      font-family: var(--mono);
      font-size: 11.5px;
      color: var(--texto-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .vazio {
      color: var(--texto-2);
      cursor: default;
    }
  `,
})
export class Paleta {
  private readonly store = inject(Store);
  private readonly ui = inject(Ui);
  private readonly cofre = inject(Cofre);
  private readonly router = inject(Router);
  readonly fechar = output();
  protected readonly q = signal('');
  protected readonly sel = signal(0);
  protected readonly preencher = signal<string | null>(null);

  private readonly todos = computed<Item[]>(() =>
    this.store.notas().flatMap((nota) =>
      nota.blocos
        .filter((b) => b.conteudo.trim())
        .map((bloco) => {
          const nome = bloco.label || (bloco.secreto ? '(secreto)' : bloco.conteudo.trim().split('\n')[0].slice(0, 80));
          return { nota, bloco, nome, busca: chaveNome(`${nota.titulo} ${bloco.label} ${(nota.tags ?? []).join(' ')} ${bloco.secreto ? '' : bloco.conteudo}`) };
        }),
    ),
  );

  // todas as palavras precisam aparecer; rótulo e título contam antes do conteúdo
  protected readonly itens = computed(() => {
    const termos = chaveNome(this.q()).split(' ').filter(Boolean);
    const l = this.todos().filter((it) => termos.every((t) => it.busca.includes(t)));
    const peso = (it: Item) => termos.filter((t) => chaveNome(`${it.bloco.label} ${it.nota.titulo}`).includes(t)).length;
    return termos.length ? l.sort((a, b) => peso(b) - peso(a)).slice(0, 50) : l.slice(0, 50);
  });

  previa(b: Bloco) {
    if (b.secreto) return '••••••••';
    if (b.tabela) return b.conteudo.split('\n')[0].replace(/\t/g, ' │ ');
    return b.label ? b.conteudo.trim().split('\n')[0] : b.conteudo.trim().split('\n').slice(1, 2).join('');
  }

  tecla(e: KeyboardEvent) {
    const n = this.itens().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.sel.update((i) => (n ? (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n : 0));
      setTimeout(() => document.querySelector(`.paleta [data-i="${this.sel()}"]`)?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = this.itens()[this.sel()];
      if (!it) return;
      if (e.shiftKey) {
        this.fechar.emit();
        this.router.navigate(['/notas'], { queryParams: { nota: it.nota.id } });
      } else this.copiar(it);
    }
  }

  copiar(it: Item) {
    const txt = this.cofre.ler(it.bloco);
    if (txt === null) {
      this.ui.avisar('Desbloqueie o cofre');
      return this.ui.painel.set('cofre');
    }
    if (copiarOuPreencher(this.ui, txt)) this.preencher.set(txt);
    else this.fechar.emit();
  }
}
