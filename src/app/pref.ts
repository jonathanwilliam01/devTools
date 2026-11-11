import { effect, signal } from '@angular/core';

export function lerPref(chave: string, padrao: string) {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}

export function salvarPref(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {}
}

// signal que lembra o valor no navegador; usar em contexto de injeção
export function prefSignal<T extends string>(chave: string, padrao: T, validos?: readonly T[]) {
  const v = lerPref(chave, padrao) as T;
  const s = signal<T>(!validos || validos.includes(v) ? v : padrao);
  effect(() => salvarPref(chave, s()));
  return s;
}
