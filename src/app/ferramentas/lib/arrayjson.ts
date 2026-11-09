// array do PHP (literal, print_r, var_dump, var_export), hash do Ruby ou objeto JS → valor JSON

type Par = [string | number | null, unknown];

// objeto com ordem das chaves preservada (JS põe chaves numéricas primeiro)
class Obj {
  pares: [string, unknown][];
  constructor(p: [string, unknown][]) {
    this.pares = p;
  }
}

export function paraJson(v: unknown, indent = 2, nivel = 0): string {
  const esp = indent ? '\n' + ' '.repeat(indent * (nivel + 1)) : '';
  const fim = indent ? '\n' + ' '.repeat(indent * nivel) : '';
  const sep = indent ? ': ' : ':';
  if (v instanceof Obj)
    return v.pares.length ? '{' + v.pares.map(([k, x]) => esp + JSON.stringify(k) + sep + paraJson(x, indent, nivel + 1)).join(',') + fim + '}' : '{}';
  if (Array.isArray(v)) return v.length ? '[' + v.map((x) => esp + paraJson(x, indent, nivel + 1)).join(',') + fim + ']' : '[]';
  return JSON.stringify(v) ?? 'null';
}

// PHP: chaves 0..n-1 em ordem viram lista, senão objeto
function montar(pares: Par[]): unknown {
  let prox = 0;
  const comChave = pares.map(([k, v]): [string | number, unknown] => {
    if (k === null) k = prox;
    if (typeof k === 'number' || /^-?\d+$/.test(k)) {
      const n = Number(k);
      if (Number.isSafeInteger(n)) {
        prox = Math.max(prox, n + 1);
        k = n;
      }
    }
    return [k, v];
  });
  if (comChave.every(([k], i) => k === i)) return comChave.map(([, v]) => v);
  return new Obj(comChave.map(([k, v]) => [String(k), v]));
}

export function arrayParaJson(texto: string): unknown {
  const t = texto.trim();
  if (!t) return undefined;
  if (/^(Array|[\w\\]+ Object)\s*\(/.test(t)) return printR(t);
  if (/^(array\(\d+\)|object\([\w\\]+\)#\d+ \(\d+\)) \{/.test(t)) return varDump(t);
  return literal(t);
}

function printR(t: string): unknown {
  const linhas = t.split(/\r?\n/);
  let i = 0;
  const bloco = (): unknown => {
    while (i < linhas.length && linhas[i].trim() !== '(') i++;
    i++;
    const pares: Par[] = [];
    let ultimo: Par | null = null;
    for (; i < linhas.length; i++) {
      const l = linhas[i];
      if (l.trim() === ')') {
        i++;
        break;
      }
      const m = /^\s*\[(.*?)(:[\w\\]+)*(:protected|:private)?\] => ?(.*)$/.exec(l);
      if (m) {
        const v = m[4];
        if (/^(Array|[\w\\]+ Object)\s*$/.test(v)) {
          i++;
          pares.push((ultimo = [m[1], bloco()]));
          i--;
          ultimo = null;
        } else pares.push((ultimo = [m[1], v]));
      } else if (ultimo && typeof ultimo[1] === 'string') ultimo[1] += '\n' + l;
    }
    // print_r deixa linha em branco antes do ")"
    for (const p of pares) if (typeof p[1] === 'string') p[1] = (p[1] as string).replace(/\n\s*$/, '');
    return montar(pares);
  };
  return bloco();
}

function varDump(t: string): unknown {
  const bytes = new TextEncoder().encode(t);
  const dec = new TextDecoder();
  // trabalha em bytes por causa do tamanho de string(n), que conta bytes
  let p = 0;
  const resto = () => dec.decode(bytes.subarray(p, p + 200));
  const pular = () => {
    while (p < bytes.length && /\s/.test(String.fromCharCode(bytes[p]))) p++;
  };
  const casar = (re: RegExp) => {
    pular();
    const m = re.exec(resto());
    if (!m) throw new Error(`var_dump inesperado perto de: ${resto().slice(0, 40)}`);
    p += new TextEncoder().encode(m[0]).length;
    return m;
  };
  const valor = (): unknown => {
    pular();
    const r = resto();
    if (r.startsWith('NULL')) return (p += 4), null;
    let m: RegExpExecArray | null;
    if ((m = /^bool\((true|false)\)/.exec(r))) return (p += m[0].length), m[1] === 'true';
    if ((m = /^(int|float)\(([^)]*)\)/.exec(r))) return (p += m[0].length), Number(m[2]);
    if ((m = /^string\((\d+)\) "/.exec(r))) {
      p += m[0].length;
      const s = dec.decode(bytes.subarray(p, p + Number(m[1])));
      p += Number(m[1]) + 1;
      return s;
    }
    if ((m = /^(array\(\d+\)|object\([^)]*\)#\d+ \(\d+\)) \{/.exec(r))) {
      p += m[0].length;
      const pares: Par[] = [];
      for (;;) {
        pular();
        if (bytes[p] === 0x7d) {
          p++;
          break;
        }
        const k = casar(/^\[(?:"((?:[^"\\]|\\.)*)"(?::"[^"]*")?(?::(?:protected|private))?|(-?\d+))\]=>/);
        pares.push([k[1] ?? k[2], valor()]);
      }
      return m[1].startsWith('object') ? new Obj(pares.map(([k, v]) => [String(k), v])) : montar(pares);
    }
    if ((m = /^(enum|resource)\(([^)]*)\)[^\n]*/.exec(r))) return (p += new TextEncoder().encode(m[0]).length), m[2];
    throw new Error(`var_dump inesperado perto de: ${r.slice(0, 40)}`);
  };
  return valor();
}

interface Tk {
  t: 'str' | 'num' | 'id' | 'sim' | 'op';
  v: string;
}

function tokens(s: string): Tk[] {
  const out: Tk[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if ((c === '/' && s[i + 1] === '/') || c === '#') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      const f = s.indexOf('*/', i + 2);
      i = f < 0 ? s.length : f + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      let v = '';
      while (j < s.length && s[j] !== c) {
        if (s[j] === '\\' && j + 1 < s.length) {
          const e = s[++j];
          const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };
          if (c === "'") v += e === "'" || e === '\\' ? e : '\\' + e;
          else if (e === 'u' && s[j + 1] === '{') {
            const f = s.indexOf('}', j);
            v += String.fromCodePoint(parseInt(s.slice(j + 2, f), 16));
            j = f;
          } else if (e === 'u') {
            v += String.fromCharCode(parseInt(s.slice(j + 1, j + 5), 16));
            j += 4;
          } else v += mapa[e] ?? e;
        } else v += s[j];
        j++;
      }
      if (j >= s.length) throw new Error('String sem fechar');
      out.push({ t: 'str', v });
      i = j + 1;
      continue;
    }
    const num = /^-?(0x[\da-f]+|\d[\d_]*(\.\d+)?(e[+-]?\d+)?|\.\d+)/i.exec(s.slice(i));
    if (num && (c !== '-' || !/[\w)\]]/.test(out.length ? out[out.length - 1].v.slice(-1) : ''))) {
      out.push({ t: 'num', v: num[0].replace(/_/g, '') });
      i += num[0].length;
      continue;
    }
    // :simbolo do Ruby (não confunde com a: 1 nem "a":1)
    if (c === ':' && /[A-Za-z_]/.test(s[i + 1] ?? '') && !/[\w"']/.test(s[i - 1] ?? '')) {
      const m = /^:\w+[?!]?/.exec(s.slice(i))!;
      out.push({ t: 'sim', v: m[0].slice(1) });
      i += m[0].length;
      continue;
    }
    const id = /^(\$|@)?[A-Za-z_\\][\w\\]*/.exec(s.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = /^(=>|::|->)/.exec(s.slice(i));
    out.push({ t: 'op', v: op ? op[0] : c });
    i += op ? op[0].length : 1;
  }
  return out;
}

const CONST: Record<string, unknown> = { true: true, false: false, null: null, nil: null, undefined: null, none: null, True: true, False: false, None: null };

function literal(t: string): unknown {
  const s = t.replace(/^<\?php\s*/, '').replace(/^\s*(return\s+|\$\w+\s*=\s*|(var|let|const)\s+\w+\s*=\s*|\w+\s*=\s*)/, '').replace(/;\s*$/, '');
  const tk = tokens(s);
  let i = 0;
  const ver = (v: string) => tk[i]?.t === 'op' && tk[i].v === v;
  const pegar = (v: string) => {
    if (!ver(v)) throw new Error(`Esperado "${v}" perto de "${tk[i]?.v ?? 'fim'}"`);
    i++;
  };
  const lista = (fecha: string): unknown => {
    const pares: Par[] = [];
    while (!ver(fecha)) {
      if (i >= tk.length) throw new Error(`Faltou "${fecha}"`);
      // chave: identificador seguido de ":" (JS/Ruby/Python)
      let k: unknown = null;
      let v: unknown;
      if (tk[i].t === 'id' && tk[i + 1]?.t === 'op' && tk[i + 1].v === ':') {
        k = tk[i].v;
        i += 2;
        v = valor();
      } else {
        v = valor();
        if (ver('=>') || ver(':')) {
          i++;
          k = v;
          v = valor();
        }
      }
      pares.push([k === null ? null : typeof k === 'number' ? k : String(k), v]);
      if (!ver(fecha)) pegar(',');
    }
    i++;
    if (fecha === '}' && !pares.length) return new Obj([]);
    return montar(pares);
  };
  const valor = (): unknown => {
    const x = tk[i++];
    if (!x) throw new Error('Fim inesperado');
    if (x.t === 'str' || x.t === 'sim') return x.v;
    if (x.t === 'num') return Number(x.v);
    if (x.t === 'op') {
      if (x.v === '[') return lista(']');
      if (x.v === '{') return lista('}');
      // (object) [...] e (array) $x
      if (x.v === '(' && tk[i]?.t === 'id' && tk[i + 1]?.v === ')') return (i += 2), valor();
      if (x.v === '(') return lista(')');
      if (x.v === '-' || x.v === '+') return valor();
      throw new Error(`Inesperado "${x.v}"`);
    }
    if (/^array$/i.test(x.v) && ver('(')) return i++, lista(')');
    // var_export de objeto: \Classe::__set_state(array(...))
    if (ver('::') && tk[i + 1]?.v === '__set_state') {
      i += 2;
      pegar('(');
      const v = valor();
      pegar(')');
      return v;
    }
    if (/^new$/i.test(x.v)) {
      i++;
      if (ver('(')) i++, lista(')');
      return new Obj([]);
    }
    if (x.v in CONST) return CONST[x.v];
    if (/^(TRUE|FALSE|NULL)$/.test(x.v)) return CONST[x.v.toLowerCase()];
    // qualquer outra coisa (variável, constante, chamada) vira o texto dela
    let v = x.v;
    while (ver('::') || ver('->') || ver('.')) v += tk[i++].v + (tk[i++]?.v ?? '');
    if (ver('(')) {
      let n = 0;
      do {
        if (ver('(')) n++;
        if (ver(')')) n--;
        v += tk[i].t === 'str' ? JSON.stringify(tk[i].v) : tk[i].v;
        i++;
      } while (n > 0 && i < tk.length);
    }
    return v;
  };
  const v = valor();
  if (i < tk.length) throw new Error(`Sobrou "${tk[i].v}" depois do fim`);
  return v;
}
