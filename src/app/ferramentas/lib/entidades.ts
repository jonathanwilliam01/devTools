// nomes do Latin-1 (160 a 255), na ordem do código
const LATIN1 = (
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml ' +
  'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ');

const NOMES = new Map<number, string>([
  ...LATIN1.map((n, i) => [160 + i, n] as [number, string]),
  [38, 'amp'], [60, 'lt'], [62, 'gt'], [34, 'quot'],
  [338, 'OElig'], [339, 'oelig'], [352, 'Scaron'], [353, 'scaron'], [376, 'Yuml'], [402, 'fnof'],
  [8211, 'ndash'], [8212, 'mdash'], [8216, 'lsquo'], [8217, 'rsquo'], [8218, 'sbquo'],
  [8220, 'ldquo'], [8221, 'rdquo'], [8222, 'bdquo'], [8226, 'bull'], [8230, 'hellip'],
  [8240, 'permil'], [8364, 'euro'], [8482, 'trade'], [8592, 'larr'], [8594, 'rarr'],
]);
const CODIGOS = new Map([...NOMES].map(([c, n]) => [n, c]));
CODIGOS.set('apos', 39);

export type FormatoEntidade = 'nome' | 'decimal' | 'hex';

export interface OpcoesEntidade {
  formato: FormatoEntidade;
  // < > & " ' também viram entidade
  especiais: boolean;
}

const ESPECIAIS = new Set([38, 60, 62, 34, 39]);

export function codificar(texto: string, o: OpcoesEntidade) {
  let s = '';
  for (const ch of texto) {
    const c = ch.codePointAt(0)!;
    if (c < 128 && !(o.especiais && ESPECIAIS.has(c))) s += ch;
    else if (o.formato === 'nome' && NOMES.has(c)) s += `&${NOMES.get(c)};`;
    else if (o.formato === 'hex') s += `&#x${c.toString(16).toUpperCase()};`;
    else s += `&#${c};`;
  }
  return s;
}

export function decodificar(texto: string) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
    }
    const c = CODIGOS.get(e);
    return c ? String.fromCodePoint(c) : outraEntidade(m);
  });
}

// nomes fora do mapa: o navegador resolve (textarea não executa nada)
function outraEntidade(m: string) {
  if (typeof document === 'undefined') return m;
  const t = document.createElement('textarea');
  t.innerHTML = m;
  return t.value;
}
