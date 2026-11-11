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

  // ligada por padrão: pede a permissão no clique (Firefox e Safari exigem gesto) até o usuário decidir
  constructor() {
    if (this.permissao() === 'indisponivel') return;
    const pedir = async () => {
      if (this.ativo() && !this.pai() && Notification.permission === 'default') this.permissao.set(await Notification.requestPermission());
      if (Notification.permission !== 'default') removeEventListener('click', pedir, true);
    };
    addEventListener('click', pedir, true);
    // permissão trocada no cadeado da barra de endereço
    addEventListener('focus', () => this.permissao.set(Notification.permission));
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
    if (this.permissao() === 'indisponivel' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(titulo, { body: corpo, icon: '/favicon.svg' });
      n.onclick = () => {
        window.focus();
        this.abrir(rota);
        n.close();
      };
    } catch {}
  }

  async testar() {
    await this.ativar(true);
    this.enviar('Teste do devTools', 'Notificações funcionando', '/kanban');
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
