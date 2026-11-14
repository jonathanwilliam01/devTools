import { signal } from '@angular/core';

// imagem recebida pelo compartilhar/abrir arquivo, entregue à ferramenta de OCR
export const imagemPendente = signal<Blob | null>(null);

// UTF-8; se não for válido, Latin1 (arquivo salvo pelo Delphi/Excel)
export async function textoDoArquivo(f: Blob) {
  const b = await f.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1252').decode(b);
  }
}

// o que o service worker guardou do compartilhar (sw.js); lê uma vez e apaga
export async function lerCompartilhado(): Promise<{ texto: string; arquivo: Blob | null; nome: string } | null> {
  if (!('caches' in window)) return null;
  const cache = await caches.open('devtools-compartilhado');
  const [t, a] = await Promise.all([cache.match('/__compartilhado/texto'), cache.match('/__compartilhado/arquivo')]);
  if (!t && !a) return null;
  const r = { texto: (await t?.text()) ?? '', arquivo: (await a?.blob()) ?? null, nome: decodeURIComponent(a?.headers.get('x-nome') ?? '') };
  await caches.delete('devtools-compartilhado');
  return r;
}
