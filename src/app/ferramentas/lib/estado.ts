import { effect, signal, WritableSignal } from '@angular/core';

// última entrada de cada ferramenta: devtools:ft:<id>.<campo>
const PREFIXO = 'devtools:ft:';

export function lembrado<T>(chave: string, inicial: T): WritableSignal<T> {
  const k = PREFIXO + chave;
  let v = inicial;
  try {
    const s = localStorage.getItem(k);
    if (s !== null) v = JSON.parse(s);
  } catch {}
  const sinal = signal<T>(v);
  effect(() => {
    const x = sinal();
    try {
      if (x === inicial) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(x));
    } catch {}
  });
  return sinal;
}

export function preencher(id: string, campos: Record<string, unknown>) {
  try {
    for (const [c, v] of Object.entries(campos)) localStorage.setItem(`${PREFIXO}${id}.${c}`, JSON.stringify(v));
  } catch {}
}

export function limpar(id: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${PREFIXO}${id}.`))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}
