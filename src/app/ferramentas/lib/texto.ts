export type Charset = 'utf-8' | 'iso-8859-1';

// string binária: cada caractere é um byte
export function paraBin(texto: string, cs: Charset) {
  if (cs === 'iso-8859-1') return [...texto].map((c) => String.fromCharCode(c.charCodeAt(0) & 255)).join('');
  return Array.from(new TextEncoder().encode(texto), (b) => String.fromCharCode(b)).join('');
}

export function deBin(bin: string, cs: Charset) {
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder(cs === 'utf-8' ? 'utf-8' : 'windows-1252').decode(bytes);
}

const limparB64 = (s: string) => {
  const t = s.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  return t + '='.repeat((4 - (t.length % 4)) % 4);
};
const inverter = (s: string) => [...s].reverse().join('');

export const b64Encode = (texto: string, cs: Charset) => btoa(paraBin(texto, cs));
export const b64Decode = (b64: string, cs: Charset) => deBin(atob(limparB64(b64)), cs);

// 5x base64 + inversão da string
export function encode5t(texto: string, cs: Charset) {
  let s = paraBin(texto, cs);
  for (let i = 0; i < 5; i++) s = inverter(btoa(s));
  return s;
}

export function decode5t(valor: string, cs: Charset) {
  let s = valor.trim();
  for (let i = 0; i < 5; i++) s = atob(limparB64(inverter(s)));
  return deBin(s, cs);
}

export interface Jwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  assinatura: string;
}

export function lerJwt(token: string): Jwt {
  const partes = token.trim().replace(/^Bearer\s+/i, '').split('.');
  if (partes.length < 2) throw new Error('Token precisa ter ao menos 2 partes separadas por ponto.');
  const json = (p: string, nome: string) => {
    try {
      return JSON.parse(b64Decode(p, 'utf-8'));
    } catch {
      throw new Error(`${nome} não é um JSON em base64url válido.`);
    }
  };
  return { header: json(partes[0], 'Header'), payload: json(partes[1], 'Payload'), assinatura: partes[2] ?? '' };
}

export type FormatoSql = 'in' | 'virgula' | 'values' | 'union';

export interface OpcoesSql {
  formato: FormatoSql;
  aspas: 'auto' | 'sim' | 'nao';
  distintos: boolean;
}

export function listaSql(texto: string, o: OpcoesSql) {
  let linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const total = linhas.length;
  if (o.distintos) linhas = [...new Set(linhas)];
  const tabela = linhas.map((l) => (l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : [l]).map((c) => c.trim()));
  const valores = tabela.flat();
  const comAspas = o.aspas === 'sim' || (o.aspas === 'auto' && !valores.every((v) => /^-?\d+(\.\d+)?$/.test(v)));
  const fmt = (v: string) => (v.toUpperCase() === 'NULL' ? 'NULL' : comAspas ? `'${v.replace(/'/g, "''")}'` : v);
  const linhaSql = (cols: string[]) => cols.map(fmt).join(', ');

  let sql = '';
  if (o.formato === 'in') sql = `IN (${quebrar(valores.map(fmt))})`;
  else if (o.formato === 'virgula') sql = quebrar(valores.map(fmt));
  else if (o.formato === 'values') sql = 'VALUES\n' + tabela.map((c) => `  (${linhaSql(c)})`).join(',\n');
  else sql = tabela.map((c) => `SELECT ${c.map((v, i) => `${fmt(v)} AS C${i + 1}`).join(', ')}`).join('\nUNION ALL\n');
  return { sql, itens: linhas.length, removidos: total - linhas.length };
}

const quebrar = (v: string[]) =>
  v
    .map((x, i) => (i && i % 10 === 0 ? '\n  ' : '') + x)
    .join(', ')
    .replace(/, \n/g, ',\n');

export function formatarXml(xml: string, minificar = false) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const erro = doc.querySelector('parsererror');
  if (erro) throw new Error(erro.textContent?.split('\n')[0] || 'XML inválido');
  const compacto = xml.trim().replace(/>\s+</g, '><');
  if (minificar) return compacto;
  let nivel = 0;
  return compacto
    .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
    .split('\n')
    .map((l) => {
      if (/^<\/[\w:]/.test(l)) nivel = Math.max(nivel - 1, 0);
      const saida = '  '.repeat(nivel) + l;
      if (/^<[\w:][^>]*[^/]>/.test(l) && !/<\/[\w:][^>]*>$/.test(l)) nivel++;
      return saida;
    })
    .join('\n');
}
