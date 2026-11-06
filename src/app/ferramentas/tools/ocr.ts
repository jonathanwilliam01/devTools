import { Component, HostListener, inject, OnDestroy, signal } from '@angular/core';
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
            <button class="btn mini fim" [disabled]="!texto()" (click)="ui.copiar(texto())">Copiar</button>
          </h4>
          <textarea class="ft-texto" [(ngModel)]="texto" rows="14" spellcheck="false"></textarea>
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
  `,
})
export class Ocr implements OnDestroy {
  protected readonly ui = inject(Ui);
  protected readonly texto = lembrado('ocr.texto', '');
  protected readonly previa = signal('');
  protected readonly lendo = signal(false);
  protected readonly etapa = signal('');
  protected readonly sobre = signal(false);

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
