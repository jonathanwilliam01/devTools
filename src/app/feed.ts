import { effect, inject } from '@angular/core';
import { Nota } from './models';
import { Store } from './store';

// "RSS" das notas para o sistema que embute o devTools em iframe (gitcalm), via postMessage
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

export function iniciarFeed() {
  if (window.parent === window) return;
  const store = inject(Store);
  const origens = new Set<string>();
  const enviar = (o: string) => window.parent.postMessage({ tipo: 'devtools:notas', notas: store.notas().map(item) }, o);

  const pai = origemPai();
  if (permitida(pai)) origens.add(pai);

  addEventListener('message', (e) => {
    if (e.source !== window.parent || !permitida(e.origin) || e.data?.tipo !== 'devtools:assinar') return;
    origens.add(e.origin);
    enviar(e.origin);
  });

  effect(() => {
    store.notas();
    origens.forEach(enviar);
  });
}
