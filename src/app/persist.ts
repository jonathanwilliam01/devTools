import { Dados } from './models';

// Cookie viaja em todo request: a Vercel recusa header Cookie > 16KB (erro 431).
// Orçamento fica bem abaixo disso; o que não couber (cards mais antigos) fica só no localStorage/backup.
const ORCAMENTO = 10_000;
const PEDACO = 3_800;
const PREFIXO = 'dt';
const MAX_IDADE = 400 * 86400; // máximo aceito pelo Chrome

export interface StatusCookie {
  ativo: boolean;
  bytes: number;
  cards: number;
  totalCards: number;
  motivo?: string;
}

export const cookiesDisponiveis = () => !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

async function comprimir(txt: string) {
  const stream = new Blob([txt]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return paraB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function descomprimir(b64: string) {
  const bytes = deB64(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

export function paraB64(bytes: Uint8Array) {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

export function deB64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// id dos cards importados da planilha; nos cookies é omitido e refeito na leitura
const idPadrao = (numero: number, data: string) => `c-${numero}-${data}`;

// formato compacto: cards como arrays, mais recentes primeiro
function compactar(d: Dados, qtdCards: number) {
  const cards = [...d.cards]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, qtdCards)
    .map((c) => [c.id === idPadrao(c.numero, c.data) ? 0 : c.id, c.numero, c.descricao, c.sistema, c.area, c.time, c.linguagem, c.data, c.obs]);
  // secreto sem senha mestra não vai para cookie (iria em texto puro em todo request)
  const notas = d.notas.map((n) => ({
    ...n,
    blocos: n.blocos.map((b) => (b.secreto && !b.conteudo.startsWith('enc:') ? { ...b, conteudo: '' } : b)),
  }));
  return JSON.stringify({ ...d, cards, notas, totalCards: d.cards.length });
}

export async function salvarCookies(d: Dados): Promise<StatusCookie> {
  const totalCards = d.cards.length;
  if (!cookiesDisponiveis()) {
    return { ativo: false, bytes: 0, cards: 0, totalCards, motivo: 'Desligado no localhost (cookies seriam enviados aos outros sistemas locais).' };
  }
  let qtd = totalCards;
  let valor = await comprimir(compactar(d, qtd));
  while (valor.length > ORCAMENTO && qtd > 0) {
    qtd = Math.floor(qtd * 0.85);
    valor = await comprimir(compactar(d, qtd));
  }
  if (valor.length > ORCAMENTO) {
    return { ativo: false, bytes: valor.length, cards: 0, totalCards, motivo: 'Notas/tarefas excedem o limite seguro de cookies.' };
  }
  const n = Math.ceil(valor.length / PEDACO);
  const seguro = location.protocol === 'https:' ? '; Secure' : '';
  for (let i = 0; i < n; i++) {
    document.cookie = `${PREFIXO}${i}=${valor.slice(i * PEDACO, (i + 1) * PEDACO)}; path=/; max-age=${MAX_IDADE}; SameSite=Strict${seguro}`;
  }
  document.cookie = `${PREFIXO}n=${n}; path=/; max-age=${MAX_IDADE}; SameSite=Strict${seguro}`;
  for (let i = n; document.cookie.includes(`${PREFIXO}${i}=`); i++) {
    document.cookie = `${PREFIXO}${i}=; path=/; max-age=0`;
  }
  return { ativo: true, bytes: valor.length, cards: qtd, totalCards };
}

export async function lerCookies(): Promise<(Partial<Dados> & { totalCards?: number }) | null> {
  const mapa = Object.fromEntries(document.cookie.split('; ').map((c) => c.split('=') as [string, string]));
  const n = +(mapa[`${PREFIXO}n`] ?? 0);
  if (!n) return null;
  try {
    let valor = '';
    for (let i = 0; i < n; i++) valor += mapa[`${PREFIXO}${i}`] ?? '';
    const d = JSON.parse(await descomprimir(valor));
    d.cards = (d.cards as any[][]).map(([id, numero, descricao, sistema, area, time, linguagem, data, obs]) => ({
      id: id || idPadrao(numero, data), numero, descricao, sistema, area, time, linguagem, data, obs,
    }));
    return d;
  } catch {
    return null;
  }
}

// IndexedDB mínimo, só para guardar o handle da pasta de backup
function idb() {
  return new Promise<IDBDatabase>((ok, erro) => {
    const r = indexedDB.open('devtools', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

export async function idbGet<T>(chave: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((ok) => {
    const r = db.transaction('kv').objectStore('kv').get(chave);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(undefined);
  });
}

export async function idbSet(chave: string, valor: unknown) {
  const db = await idb();
  return new Promise<void>((ok) => {
    const tx = db.transaction('kv', 'readwrite');
    valor === undefined ? tx.objectStore('kv').delete(chave) : tx.objectStore('kv').put(valor, chave);
    tx.oncomplete = () => ok();
  });
}
