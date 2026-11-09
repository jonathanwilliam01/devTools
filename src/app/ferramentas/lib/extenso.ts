const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ESCALAS: [string, string][] = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões'], ['trilhão', 'trilhões'], ['quatrilhão', 'quatrilhões']];

function ate999(n: number) {
  if (n === 100) return 'cem';
  const p: string[] = [];
  if (n >= 100) p.push(CEM[Math.floor(n / 100)]);
  const r = n % 100;
  if (r >= 20) p.push(DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UNI[r % 10] : ''));
  else if (r) p.push(UNI[r]);
  return p.join(' e ');
}

export function inteiroPorExtenso(n: bigint): string {
  if (n === 0n) return 'zero';
  const grupos: number[] = [];
  for (let x = n; x > 0n; x /= 1000n) grupos.push(Number(x % 1000n));
  if (grupos.length > ESCALAS.length) throw new Error('Número grande demais');
  const partes: { txt: string; g: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    const [sing, plur] = ESCALAS[i];
    const txt = i === 1 && g === 1 ? 'mil' : ate999(g) + (sing ? ' ' + (g === 1 ? sing : plur) : '');
    partes.push({ txt, g });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda: mil e cem, dois milhões e trezentos mil
  return partes
    .map((p, i) => (i === 0 ? '' : i === partes.length - 1 && (p.g < 100 || p.g % 100 === 0) ? ' e ' : ', ') + p.txt)
    .join('');
}

// aceita 1.234,56 / 1234.56 / R$ 1 234,56; devolve parte inteira e decimais em texto
export function lerNumero(bruto: string): { neg: boolean; int: string; dec: string } | null {
  let s = bruto.replace(/R\$|\s/gi, '');
  const neg = s.startsWith('-');
  s = s.replace(/^[-+]/, '');
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const v = s.lastIndexOf(',');
  const p = s.lastIndexOf('.');
  let dec = '';
  if (v >= 0 && p >= 0) {
    const sep = v > p ? ',' : '.';
    [s, dec] = [s.slice(0, Math.max(v, p)), s.slice(Math.max(v, p) + 1)];
    s = s.split(sep === ',' ? '.' : ',').join('');
  } else if (v >= 0) {
    if (s.indexOf(',') !== v) return null;
    [s, dec] = [s.slice(0, v), s.slice(v + 1)];
  } else if (p >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(s)) {
    if (s.indexOf('.') !== p) return null;
    [s, dec] = [s.slice(0, p), s.slice(p + 1)];
  } else s = s.replace(/\./g, '');
  if (!/^\d*$/.test(s) || !/^\d*$/.test(dec)) return null;
  return { neg, int: s.replace(/^0+(?=\d)/, '') || '0', dec };
}

function centavos(bruto: string) {
  const n = lerNumero(bruto);
  if (!n) throw new Error('Valor inválido');
  let cent = BigInt(n.int) * 100n + BigInt((n.dec + '00').slice(0, 2));
  if (+(n.dec[2] ?? 0) >= 5) cent++;
  return { neg: n.neg && cent > 0n, cent };
}

export function formatarMoeda(bruto: string) {
  const { neg, cent } = centavos(bruto);
  const int = (cent / 100n).toString().replace(/\B(?=(\d{3})+$)/g, '.');
  return `${neg ? '-' : ''}R$ ${int},${(cent % 100n).toString().padStart(2, '0')}`;
}

export function moedaPorExtenso(bruto: string): string {
  const { neg, cent } = centavos(bruto);
  const reais = cent / 100n;
  const c = Number(cent % 100n);
  const p: string[] = [];
  if (reais || !c) {
    // milhão/bilhão redondo pede "de": um milhão de reais
    const de = reais >= 1_000_000n && reais % 1_000_000n === 0n ? ' de' : '';
    p.push(inteiroPorExtenso(reais) + de + (reais === 1n ? ' real' : ' reais'));
  }
  if (c) p.push(inteiroPorExtenso(BigInt(c)) + (c === 1 ? ' centavo' : ' centavos'));
  return (neg ? 'menos ' : '') + p.join(' e ');
}

export function numeroPorExtenso(bruto: string): string {
  const n = lerNumero(bruto);
  if (!n) throw new Error('Número inválido');
  let t = inteiroPorExtenso(BigInt(n.int));
  const dec = n.dec.replace(/0+$/, '');
  if (dec) {
    // zeros à esquerda lidos um a um: 3,05 = três vírgula zero cinco
    const zeros = dec.match(/^0*/)![0].length;
    t += ' vírgula ' + [...Array(zeros).fill('zero'), ...(dec.length > zeros ? [inteiroPorExtenso(BigInt(dec))] : [])].join(' ');
  }
  return (n.neg && /[1-9]/.test(n.int + n.dec) ? 'menos ' : '') + t;
}

export type Caixa = 'min' | 'mai' | 'pri';

export function aplicarCaixa(t: string, c: Caixa) {
  if (c === 'mai') return t.toLocaleUpperCase('pt-BR');
  if (c === 'pri') return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
  return t;
}
