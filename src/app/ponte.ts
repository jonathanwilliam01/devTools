import { effect, inject } from '@angular/core';
import { Nota } from './models';
import { Store } from './store';
import { Github } from './github';
import { Notificar } from './notificar';
import { VERSAO } from './versao';

// Ponte com o sistema que embute o devTools em iframe (gitcalm), via postMessage:
// - envia as notas ao carregar e a cada mudança (devtools:notas)
// - executa funções das ferramentas sem abrir tela (devtools:chamar → devtools:resposta)
// - recebe o token do GitHub (devtools:ready → gitcalm:token, reenviado quando muda)
// - notificação do navegador: com gitcalm:notificacoes o pai passa a exibir (devtools:notificar {titulo, corpo, rota});
//   clique na notificação volta como gitcalm:abrir {rota}
const ORIGENS = [/^https:\/\/gitcalm\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];
const permitida = (o: string) => ORIGENS.some((r) => r.test(o));

// bloco secreto nunca sai
const item = (n: Nota) => ({
  id: n.id,
  titulo: n.titulo,
  atualizado: n.atualizado,
  fixada: n.fixada,
  blocos: n.blocos.filter((b) => !b.secreto).map((b) => ({ label: b.label, conteudo: b.conteudo })),
});

function origemPai() {
  try {
    return location.ancestorOrigins?.[0] ?? new URL(document.referrer).origin;
  } catch {
    return '';
  }
}

export function iniciarPonte() {
  if (window.parent === window) return;
  const store = inject(Store);
  const github = inject(Github);
  const notificar = inject(Notificar);
  const origens = new Set<string>();
  const api = import('./ferramentas/lib/api').then((m) => m.API as Record<string, (...a: unknown[]) => unknown>);
  const enviar = (msg: object, o: string) => window.parent.postMessage(msg, o);
  const notas = (o: string) => enviar({ tipo: 'devtools:notas', notas: store.notas().map(item) }, o);
  const pronto = async (o: string) => enviar({ tipo: 'devtools:pronto', versao: VERSAO.numero, funcoes: Object.keys(await api) }, o);

  addEventListener('message', async (e) => {
    if (e.source !== window.parent || !permitida(e.origin)) return;
    const d = e.data;
    if (d?.type === 'gitcalm:token' && typeof d.token === 'string') {
      github.definirGitcalm(d.token);
    } else if (d?.type === 'gitcalm:notificacoes') {
      notificar.pai.set(d.ativo === false ? '' : e.origin);
    } else if (d?.type === 'gitcalm:abrir' && typeof d.rota === 'string') {
      notificar.abrir(d.rota);
    } else if (d?.tipo === 'devtools:assinar') {
      origens.add(e.origin);
      pronto(e.origin);
      notas(e.origin);
    } else if (d?.tipo === 'devtools:chamar') {
      try {
        const API = await api;
        if (!Object.hasOwn(API, d.fn)) throw new Error(`Função desconhecida: ${d.fn}`);
        const valor = await API[d.fn](...(Array.isArray(d.args) ? d.args : []));
        enviar({ tipo: 'devtools:resposta', id: d.id, ok: true, valor }, e.origin);
      } catch (err) {
        enviar({ tipo: 'devtools:resposta', id: d.id, ok: false, erro: err instanceof Error ? err.message : String(err) }, e.origin);
      }
    }
  });

  // depois do listener, senão a resposta pode chegar antes; sem dados, então '*'
  window.parent.postMessage({ type: 'devtools:ready' }, '*');
  const pai = origemPai();
  if (permitida(pai)) {
    origens.add(pai);
    pronto(pai);
  }

  effect(() => {
    store.notas();
    origens.forEach(notas);
  });
}
