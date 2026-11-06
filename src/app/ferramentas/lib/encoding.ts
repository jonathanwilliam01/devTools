// byte de cada caractere no windows-1252 (o que o Delphi/Latin1 mostra)
const CP1252 = new Map<string, number>();
const dec1252 = new TextDecoder('windows-1252');
for (let b = 0; b < 256; b++) CP1252.set(dec1252.decode(new Uint8Array([b])), b);

// "Ã§" -> "ç": texto UTF-8 que foi lido como Latin1; null se não for o caso
export function corrigirMojibake(s: string) {
  const bytes: number[] = [];
  for (const c of s) {
    const b = CP1252.get(c);
    if (b === undefined) return null;
    bytes.push(b);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

// repete enquanto mudar (texto convertido 2x ou mais)
export function corrigir(s: string) {
  let atual = s;
  let vezes = 0;
  for (let r = corrigirMojibake(atual); r !== null && r !== atual && vezes < 5; r = corrigirMojibake(atual)) {
    atual = r;
    vezes++;
  }
  return { texto: atual, vezes };
}

// "ç" -> "Ã§": como o texto UTF-8 aparece se lido como Latin1
export const simularMojibake = (s: string) => dec1252.decode(new TextEncoder().encode(s));

const hex = (b: Iterable<number>) => Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

export function caracteres(s: string, limite = 200) {
  const vistos = new Map<string, number>();
  for (const c of s) if (c.codePointAt(0)! > 126 || c.codePointAt(0)! < 32) vistos.set(c, (vistos.get(c) ?? 0) + 1);
  return [...vistos].slice(0, limite).map(([c, n]) => ({
    c: c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : c,
    cp: 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'),
    utf8: hex(new TextEncoder().encode(c)),
    latin1: CP1252.has(c) ? hex([CP1252.get(c)!]) : '—',
    n,
  }));
}
