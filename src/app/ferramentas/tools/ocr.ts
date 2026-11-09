import { Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Ui } from '../../ui';
import { lembrado } from '../lib/estado';
import { imagemDe } from '../lib/leitor';
import { lerTexto } from '../lib/ocr';

@Component({
  selector: 'ft-ocr',
  imports: [FormsModule],
  template: `
    <div class="ft">
      <div class="ft-duas">
        <div class="ft-painel">
          <h4 class="ft-titulo">Imagem</h4>
          <label class="ocr-area" data-imagem tabindex="0" [class.sobre]="sobre()"
            (dragover)="$event.preventDefault(); sobre.set(true)" (dragleave)="sobre.set(false)" (drop)="soltar($event)">
            @if (previa()) {
              <img [src]="previa()" alt="Imagem enviada" />
            } @else {
              <span>Cole (Ctrl+V), arraste ou clique para escolher uma imagem</span>
            }
            <input type="file" accept="image/*" hidden (change)="escolher($event)" />
          </label>
        </div>
        <div class="ft-painel">
          <h4 class="ft-titulo">
            Texto
            @if (lendo()) {
              <span class="ft-selo">{{ etapa() }}</span>
            }
            @if (filtro().trim()) {
              <span class="ft-selo">{{ filtrado().length }} linha(s)</span>
            }
            <button class="btn mini fim" [disabled]="!saida()" (click)="ui.copiar(saida())">Copiar</button>
          </h4>
          <input type="search" [(ngModel)]="filtro" placeholder="Filtrar linhas com a palavra (várias separadas por espaço)" spellcheck="false" />
          @if (filtro().trim()) {
            <div class="ocr-filtro">
              @for (l of filtrado(); track $index) {
                <div>
                  @for (p of l; track $index) {
                    @if (p.marca) {
                      <mark>{{ p.t }}</mark>
                    } @else {
                      {{ p.t }}
                    }
                  }
                </div>
              } @empty {
                <span class="ft-dica">Nenhuma linha com esse filtro.</span>
              }
            </div>
          } @else {
            <textarea class="ft-texto" [(ngModel)]="texto" rows="14" spellcheck="false"></textarea>
          }
        </div>
      </div>
      <p class="ft-dica">Lido no navegador, a imagem não sai do computador. O primeiro uso baixa o modelo de português e inglês (~10 MB). Funciona melhor com print de tela e texto impresso; confira números e acentos.</p>
    </div>
  `,
  styles: `
    .ocr-area {
      display: grid;
      place-items: center;
      min-height: 260px;
      padding: 12px;
      border: 2px dashed var(--borda);
      border-radius: 8px;
      color: var(--texto-2);
      text-align: center;
      cursor: pointer;
    }
    .ocr-area:hover, .ocr-area:focus, .ocr-area.sobre {
      border-color: var(--acento);
      background: var(--acento-bg);
    }
    .ocr-area img {
      max-width: 100%;
      max-height: 420px;
    }
    .ocr-filtro {
      min-height: 160px;
      max-height: 420px;
      overflow: auto;
      padding: 8px 10px;
      border: 1px solid var(--borda);
      border-radius: 8px;
      background: var(--bg-2);
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ocr-filtro mark {
      background: var(--acento-bg);
      color: var(--acento);
      font-weight: 600;
      border-radius: 3px;
    }
  `,
})
export class Ocr implements OnDestroy {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('ocr.texto', '');
  protected readonly previa = signal('');
  protected readonly lendo = signal(false);
  protected readonly etapa = signal('');
  protected readonly sobre = signal(false);
  protected readonly filtro = lembrado('ocr.filtro', '');

  // linhas que têm todas as palavras (sem acento e sem caixa), já partidas para destacar
  protected readonly filtrado = computed(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const termos = norm(this.filtro()).split(/\s+/).filter(Boolean);
    if (!termos.length) return [];
    const re = new RegExp(termos.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    return this.texto()
      .split(/\r?\n/)
      .filter((l) => termos.every((t) => norm(l).includes(t)))
      .map((l) => {
        // NFD muda o tamanho; normaliza letra a letra para manter as posições
        const n = [...l].map((c) => norm(c) || c).join('');
        const partes: { t: string; marca: boolean }[] = [];
        const orig = [...l];
        const mapa: number[] = [];
        orig.forEach((c, k) => [...(norm(c) || c)].forEach(() => mapa.push(k)));
        let ult = 0;
        for (const m of n.matchAll(re)) {
          const ini = mapa[m.index!];
          const fim = mapa[m.index! + m[0].length - 1] + 1;
          if (ini > ult) partes.push({ t: orig.slice(ult, ini).join(''), marca: false });
          partes.push({ t: orig.slice(ini, fim).join(''), marca: true });
          ult = fim;
        }
        if (ult < orig.length) partes.push({ t: orig.slice(ult).join(''), marca: false });
        return partes;
      });
  });

  protected readonly saida = computed(() => (this.filtro().trim() ? this.filtrado().map((l) => l.map((p) => p.t).join('')).join('\n') : this.texto()));

  // colar em qualquer lugar da tela, menos no campo de texto
  @HostListener('document:paste', ['$event'])
  colar(e: ClipboardEvent) {
    const img = imagemDe(e.clipboardData);
    if (!img) return;
    e.preventDefault();
    this.ler(img);
  }

  escolher(e: Event) {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (f) this.ler(f);
  }

  soltar(e: DragEvent) {
    e.preventDefault();
    this.sobre.set(false);
    const img = imagemDe(e.dataTransfer);
    if (img) this.ler(img);
  }

  async ler(img: Blob) {
    if (this.lendo()) return;
    URL.revokeObjectURL(this.previa());
    this.previa.set(URL.createObjectURL(img));
    this.lendo.set(true);
    this.etapa.set('Carregando...');
    try {
      const t = await lerTexto(img, (p) => this.etapa.set(`Lendo ${Math.round(p * 100)}%`));
      this.texto.set(t);
      if (!t) this.ui.avisar('Nenhum texto encontrado na imagem');
    } catch (e) {
      console.error(e);
      this.ui.avisar('Falha ao ler a imagem');
    } finally {
      this.lendo.set(false);
    }
  }

  ngOnDestroy() {
    URL.revokeObjectURL(this.previa());
  }
}
