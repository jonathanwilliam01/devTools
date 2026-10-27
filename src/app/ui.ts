import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export type Atalho = 'novo' | 'esc';
export type Painel = 'dados' | 'cofre' | 'atalhos' | null;

@Injectable({ providedIn: 'root' })
export class Ui {
  readonly toast = signal('');
  readonly atalhos = new Subject<Atalho>();
  readonly painel = signal<Painel>(null);
  private timer?: ReturnType<typeof setTimeout>;

  avisar(msg: string) {
    this.toast.set(msg);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.toast.set(''), 1800);
  }

  async copiar(texto: string, msg = 'Copiado!') {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    this.avisar(msg);
  }

  baixar(nome: string, conteudo: string, tipo = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
