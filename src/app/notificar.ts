import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

const CHAVE = 'devtools:notificar';

// Notificação do navegador para o que o devTools faz sozinho (issue no kanban, card no histórico).
// Dentro do git-calm (iframe de outra origem) o navegador bloqueia Notification: vai para o pai
// (devtools:notificar) quando ele avisou que exibe (gitcalm:notificacoes); senão tenta a nativa.
@Injectable({ providedIn: 'root' })
export class Notificar {
  private readonly router = inject(Router);
  readonly ativo = signal(ler() !== '0');
  readonly permissao = signal<NotificationPermission | 'indisponivel'>(typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission);
  // origem do git-calm que exibe as notificações por nós
  readonly pai = signal('');

  // ligada por padrão: pede a permissão no primeiro clique (Firefox e Safari exigem gesto)
  constructor() {
    if (this.permissao() === 'default')
      addEventListener('click', async () => {
        if (this.ativo() && !this.pai()) this.permissao.set(await Notification.requestPermission());
      }, { once: true, capture: true });
  }

  async ativar(v: boolean) {
    if (v && !this.pai() && this.permissao() === 'default') this.permissao.set(await Notification.requestPermission());
    this.ativo.set(v);
    try {
      localStorage.setItem(CHAVE, v ? '1' : '0');
    } catch {}
  }

  enviar(titulo: string, corpo: string, rota: string) {
    if (!this.ativo()) return;
    if (this.pai()) return window.parent.postMessage({ tipo: 'devtools:notificar', titulo, corpo, rota }, this.pai());
    if (this.permissao() !== 'granted') return;
    try {
      const n = new Notification(titulo, { body: corpo, tag: rota + corpo, icon: '/favicon.svg' });
      n.onclick = () => {
        window.focus();
        this.abrir(rota);
        n.close();
      };
    } catch {}
  }

  abrir(rota: string) {
    if (rota.startsWith('/')) this.router.navigateByUrl(rota);
  }
}

function ler() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}
