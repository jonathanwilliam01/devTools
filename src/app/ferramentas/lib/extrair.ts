import { mascarar, TipoDoc, valido } from './docs';

export type TipoExtrair = 'cpf' | 'cnpj' | 'email' | 'url' | 'telefone' | 'cep' | 'data' | 'ip' | 'numero';

// sem dígito/letra colado antes e depois
const iso = (re: string) => new RegExp(`(?<![0-9A-Za-z])(?:${re})(?![0-9A-Za-z])`, 'g');

export const PADROES: Record<TipoExtrair, { nome: string; re: RegExp; doc?: TipoDoc }> = {
  cpf: { nome: 'CPF', re: iso(String.raw`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`), doc: 'CPF' },
  cnpj: { nome: 'CNPJ', re: iso(String.raw`[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}/[0-9A-Z]{4}-\d{2}|\d{14}`), doc: 'CNPJ' },
  email: { nome: 'E-mail', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  url: { nome: 'URL', re: /\bhttps?:\/\/[^\s<>"'`)\]]+/g },
  telefone: { nome: 'Telefone', re: iso(String.raw`\(\d{2}\)\s?9?\d{4}-?\d{4}|\d{4,5}-\d{4}`) },
  cep: { nome: 'CEP', re: iso(String.raw`\d{5}-\d{3}|\d{2}\.\d{3}-\d{3}`), doc: 'CEP' },
  data: { nome: 'Data', re: iso(String.raw`\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2}`) },
  ip: { nome: 'IP', re: iso(String.raw`(?:\d{1,3}\.){3}\d{1,3}`) },
  numero: { nome: 'Número', re: /-?\d+(?:[.,]\d+)*/g },
};

export interface OpcoesExtrair {
  validos: boolean;
  distintos: boolean;
  mascara: 'manter' | 'tirar' | 'por';
}

export function extrair(texto: string, tipo: TipoExtrair, o: OpcoesExtrair) {
  const p = PADROES[tipo];
  let l = [...texto.matchAll(p.re)].map((m) => m[0].replace(/[.,;:]+$/, ''));
  if (p.doc) {
    if (o.validos) l = l.filter((v) => valido(p.doc!, v));
    if (o.mascara === 'tirar') l = l.map((v) => v.replace(/[^0-9A-Z]/gi, ''));
    else if (o.mascara === 'por') l = l.map((v) => mascarar(p.doc!, v));
  }
  return o.distintos ? [...new Set(l)] : l;
}

export const contar = (texto: string) =>
  Object.fromEntries(Object.entries(PADROES).map(([k, p]) => [k, texto.match(p.re)?.length ?? 0])) as Record<TipoExtrair, number>;
