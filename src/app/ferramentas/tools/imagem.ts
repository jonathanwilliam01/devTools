import { Component, inject, input, output, signal } from '@angular/core';
import { Ui } from '../../ui';
import { imagemDe, lerImagem } from '../lib/leitor';

// botão/área para ler QR Code ou código de barras de uma imagem (arquivo, arrastar ou colar)
@Component({
  selector: 'ft-imagem',
  template: `
    <label class="btn mini ghost" data-imagem tabindex="0" title="Escolha, arraste ou cole (Ctrl+V) uma imagem"
      (dragover)="$event.preventDefault()" (drop)="soltar($event)" (paste)="colar($event)">
      {{ lendo() ? 'Lendo...' : '▣ Ler de imagem' }}
      <input type="file" accept="image/*" hidden (change)="escolher($event)" />
    </label>
  `,
})
export class Imagem {
  private readonly ui = inject(Ui);
  readonly aceita = input<(t: string) => boolean>(() => true);
  readonly lido = output<string>();
  protected readonly lendo = signal(false);

  escolher(e: Event) {
    const el = e.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (f) this.ler(f);
  }

  soltar(e: DragEvent) {
    e.preventDefault();
    const img = imagemDe(e.dataTransfer);
    if (img) this.ler(img);
  }

  colar(e: ClipboardEvent) {
    const img = imagemDe(e.clipboardData);
    if (!img) return;
    e.preventDefault();
    this.ler(img);
  }

  async ler(img: Blob) {
    this.lendo.set(true);
    try {
      const lidos = await lerImagem(img);
      const t = lidos.find(this.aceita()) ?? lidos[0];
      if (t) this.lido.emit(t);
      else this.ui.avisar('Nenhum código encontrado na imagem');
    } catch {
      this.ui.avisar('Falha ao ler a imagem');
    } finally {
      this.lendo.set(false);
    }
  }
}
