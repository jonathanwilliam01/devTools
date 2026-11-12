export type Tipo = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'cit' | 'cod';

export interface Ajuste {
  tipo?: Tipo;
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  linha?: boolean;
}

export interface Linha extends Required<Ajuste> {
  chave: string;
  original: string;
  conteudo: string;
}

export const TIPOS: [Tipo, string][] = [
  ['p', 'Parágrafo'],
  ['h1', 'Título 1'],
  ['h2', 'Título 2'],
  ['h3', 'Título 3'],
  ['ul', '• Lista'],
  ['ol', '1. Lista'],
  ['cit', 'Citação'],
  ['cod', 'Código'],
];

const BULLET = /^[-•*–▪◦●+]\s+/;
const NUMERO = /^\d+[.)]\s+/;
const SECAO = /^(\d+)((?:\.\d+)+)\.?\s+\S/;

function adivinhar(l: string, i: number, linhas: string[]): Tipo {
  const t = l.trim();
  const isolada = !linhas[i - 1]?.trim() && (!linhas[i + 1]?.trim() || linhas[i + 1].trim().length > t.length);
  const curta = t.length <= 70 && t.split(/\s+/).length <= 9 && !/[.,;!?]$/.test(t);
  let m: RegExpMatchArray | null;
  if (/^(\t| {4})/.test(l)) return 'cod';
  if ((m = t.match(/^(#{1,6})\s/))) return (['h1', 'h2', 'h3'] as Tipo[])[Math.min(m[1].length, 3) - 1];
  if (t.startsWith('>')) return 'cit';
  if (BULLET.test(t)) return 'ul';
  if ((m = t.match(SECAO))) return m[2].split('.').length > 2 ? 'h3' : 'h2';
  if (NUMERO.test(t)) return curta && isolada ? 'h2' : 'ol';
  if (!curta) return 'p';
  if (i === linhas.findIndex((x) => x.trim()) && isolada) return 'h1';
  if (/\p{L}/u.test(t) && t === t.toUpperCase()) return 'h2';
  if (t.endsWith(':') || isolada) return 'h3';
  return 'p';
}

function limpar(l: string, tipo: Tipo) {
  if (tipo === 'cod') return l.replace(/^(\t| {4})/, '');
  let t = l.trim().replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(BULLET, '');
  if (tipo === 'ol') t = t.replace(NUMERO, '');
  return t;
}

export function ler(texto: string, ajustes: Record<string, Ajuste>): Linha[] {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const vistos: Record<string, number> = {};
  const res: Linha[] = [];
  linhas.forEach((original, i) => {
    if (!original.trim()) return;
    const n = (vistos[original] = (vistos[original] ?? 0) + 1);
    const chave = `${n}|${original}`;
    const a = ajustes[chave] ?? {};
    const tipo = a.tipo ?? adivinhar(original, i, linhas);
    res.push({
      chave,
      original,
      tipo,
      negrito: a.negrito ?? false,
      italico: a.italico ?? false,
      sublinhado: a.sublinhado ?? false,
      linha: a.linha ?? false,
      conteudo: limpar(original, tipo),
    });
  });
  return res;
}

function enfeitar(l: Linha) {
  let t = l.conteudo;
  if (!t || l.tipo === 'cod') return t;
  if (l.sublinhado) t = `<u>${t}</u>`;
  if (l.italico) t = `*${t}*`;
  if (l.negrito) t = `**${t}**`;
  return t;
}

export function gerar(linhas: Linha[]): string {
  const out: string[] = [];
  let ant: Tipo | null = null;
  let num = 0;
  for (const l of linhas) {
    const junto = !l.linha && ant === l.tipo && (l.tipo === 'ul' || l.tipo === 'ol' || l.tipo === 'cod' || l.tipo === 'cit');
    if (ant === 'cod' && !junto) out.push('```');
    if (ant !== null && !junto) out.push('');
    if (l.linha) out.push('---', '');
    num = l.tipo === 'ol' ? (junto ? num + 1 : 1) : 0;
    const t = enfeitar(l);
    switch (l.tipo) {
      case 'h1': out.push(`# ${t}`); break;
      case 'h2': out.push(`## ${t}`); break;
      case 'h3': out.push(`### ${t}`); break;
      case 'ul': out.push(`- ${t}`); break;
      case 'ol': out.push(`${num}. ${t}`); break;
      case 'cit': out.push(`> ${t}`); break;
      case 'cod': out.push(...(junto ? [] : ['```']), t); break;
      default: out.push(t);
    }
    ant = l.tipo;
  }
  if (ant === 'cod') out.push('```');
  return out.join('\n');
}
