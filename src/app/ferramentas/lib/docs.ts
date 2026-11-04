export type TipoDoc = 'CPF' | 'CNPJ' | 'RG' | 'CEP';

const DIG = '0123456789';
const ALFA = DIG + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const P_CPF = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const P_CNPJ = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const sortear = (chars: string, n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

// módulo 11 com resto < 2 = 0; pesos alinhados à direita
const dv11 = (vals: number[], pesos: number[]) => {
  const p = pesos.slice(pesos.length - vals.length);
  const r = vals.reduce((s, v, i) => s + v * p[i], 0) % 11;
  return r < 2 ? 0 : 11 - r;
};

// CNPJ alfanumérico: valor do caractere = código ASCII - 48 (dígitos ficam iguais)
const dvDuplo = (base: string, pesos: number[]) => {
  const n = [...base].map((c) => c.charCodeAt(0) - 48);
  const d1 = dv11(n, pesos);
  return `${d1}${dv11([...n, d1], pesos)}`;
};

export const dvCpf = (base9: string) => dvDuplo(base9, P_CPF);
export const dvCnpj = (base12: string) => dvDuplo(base12, P_CNPJ);

// RG padrão SP: pesos 2..9, 10 vira X
export function dvRg(base8: string) {
  const r = 11 - ([...base8].reduce((s, d, i) => s + +d * (i + 2), 0) % 11);
  return r === 10 ? 'X' : r === 11 ? '0' : String(r);
}

export function cpf() {
  const b = sortear(DIG, 9);
  return b + dvCpf(b);
}

export function cnpj() {
  const b = sortear(DIG, 8) + '0001';
  return b + dvCnpj(b);
}

export function cnpjAlfa() {
  let b = '';
  while (!/[A-Z]/.test(b)) b = sortear(ALFA, 8) + '0001';
  return b + dvCnpj(b);
}

export function rg() {
  const b = sortear(DIG, 8);
  return b + dvRg(b);
}

export const limpar = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, '');

export function identificar(v: string): TipoDoc | null {
  const s = limpar(v);
  if (/^\d{11}$/.test(s)) return 'CPF';
  if (/^[0-9A-Z]{12}\d{2}$/.test(s)) return 'CNPJ';
  if (/^\d{8}[\dX]$/.test(s)) return 'RG';
  if (/^\d{8}$/.test(s)) return 'CEP';
  return null;
}

export function valido(tipo: TipoDoc, v: string) {
  const s = limpar(v);
  if (tipo === 'CPF') return !/^(\d)\1+$/.test(s) && dvCpf(s.slice(0, 9)) === s.slice(9);
  if (tipo === 'CNPJ') return !/^(\d)\1+$/.test(s) && dvCnpj(s.slice(0, 12)) === s.slice(12);
  if (tipo === 'RG') return dvRg(s.slice(0, 8)) === s[8];
  return true;
}

const MASCARAS: Record<TipoDoc, [RegExp, string]> = {
  CPF: [/^(\w{3})(\w{3})(\w{3})(\w{2})$/, '$1.$2.$3-$4'],
  CNPJ: [/^(\w{2})(\w{3})(\w{3})(\w{4})(\w{2})$/, '$1.$2.$3/$4-$5'],
  RG: [/^(\w{2})(\w{3})(\w{3})(\w)$/, '$1.$2.$3-$4'],
  CEP: [/^(\w{5})(\w{3})$/, '$1-$2'],
};

export const mascarar = (tipo: TipoDoc, v: string) => limpar(v).replace(...MASCARAS[tipo]);
