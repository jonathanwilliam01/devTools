export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const MINUSCULAS = new Set(['a', 'as', 'o', 'os', 'de', 'da', 'das', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por', 'com']);

// quebra camelCase, snake_case, kebab-case e espaços em palavras
function palavras(s: string) {
  return s
    .replace(/([a-z0-9à-ÿ])([A-ZÀ-Þ])/g, '$1 $2')
    .replace(/([A-ZÀ-Þ]+)([A-ZÀ-Þ][a-zà-ÿ])/g, '$1 $2')
    .split(/[^0-9A-Za-zÀ-ɏ]+/)
    .filter(Boolean);
}

const cap = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
const ident = (s: string) => palavras(semAcento(s)).map((p) => p.toLowerCase());

const CASOS: [string, (s: string) => string][] = [
  ['camelCase', (s) => ident(s).map((p, i) => (i ? cap(p) : p)).join('')],
  ['PascalCase', (s) => ident(s).map(cap).join('')],
  ['snake_case', (s) => ident(s).join('_')],
  ['CONSTANTE', (s) => ident(s).join('_').toUpperCase()],
  ['kebab-case', (s) => ident(s).join('-')],
  ['dot.case', (s) => ident(s).join('.')],
  ['Título', (s) => s.toLowerCase().replace(/[^\s]+/g, (p, i) => (i && MINUSCULAS.has(p) ? p : cap(p)))],
  ['Frase', (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\S)/g, (_, a, b) => a + b.toUpperCase())],
  ['MAIÚSCULAS', (s) => s.toUpperCase()],
  ['minúsculas', (s) => s.toLowerCase()],
  ['Sem acentos', semAcento],
];

// aplica linha a linha para converter listas
export const converterCasos = (texto: string) =>
  CASOS.map(([nome, f]) => [nome, texto.split('\n').map((l) => (l.trim() ? f(l.trim()) : '')).join('\n')] as [string, string]);
