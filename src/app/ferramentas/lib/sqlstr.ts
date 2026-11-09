export type Ling = 'delphi' | 'php' | 'ruby';
export type Estilo = 'linhas' | 'concat' | 'heredoc';

export interface OpcoesStr {
  ling: Ling;
  estilo: Estilo;
  nome: string;
  quebras: boolean;
}

export const ESTILOS: Record<Ling, { id: Estilo; nome: string }[]> = {
  delphi: [{ id: 'linhas', nome: 'SQL.Add' }, { id: 'concat', nome: 'Concatenação' }],
  php: [{ id: 'concat', nome: 'Concatenação' }, { id: 'heredoc', nome: 'Nowdoc' }],
  ruby: [{ id: 'concat', nome: 'Concatenação' }, { id: 'heredoc', nome: 'Heredoc' }],
};

export const nomePadrao = (o: Pick<OpcoesStr, 'ling' | 'estilo'>) => (o.ling === 'delphi' && o.estilo === 'linhas' ? 'Qry' : 'sql');

const escDelphi = (l: string) => l.replace(/'/g, "''");
const escPhp = (l: string) => l.replace(/[\\"$]/g, '\\$&');
const escRuby = (l: string) => l.replace(/[\\"]/g, '\\$&').replace(/#\{/g, '\\#{');

export function paraString(sql: string, o: OpcoesStr): string {
  const linhas = sql.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  if (!linhas.length) return '';
  const nome = (o.nome.trim() || nomePadrao(o)).replace(/^\$/, '');
  const ult = linhas.length - 1;
  // sem quebra de linha, um espaço no fim de cada pedaço para as palavras não grudarem
  const fim = (i: number, quebra: string) => (i === ult ? '' : o.quebras ? quebra : ' ');

  if (o.ling === 'delphi') {
    if (o.estilo === 'linhas') return [`${nome}.SQL.Clear;`, ...linhas.map((l) => `${nome}.SQL.Add('${escDelphi(l)}');`)].join('\n');
    const corpo = linhas.map((l, i) => `  '${escDelphi(l)}${o.quebras || i === ult ? '' : ' '}'` + (i === ult ? ';' : o.quebras ? ' + sLineBreak +' : ' +'));
    return `${nome} :=\n${corpo.join('\n')}`;
  }
  if (o.ling === 'php') {
    if (o.estilo === 'heredoc') return `$${nome} = <<<'SQL'\n${linhas.join('\n')}\nSQL;`;
    return `$${nome} = ` + linhas.map((l, i) => `${i ? '    . ' : ''}"${escPhp(l)}${fim(i, '\\n')}"`).join('\n') + ';';
  }
  if (o.estilo === 'heredoc') return `${nome} = <<~SQL\n${linhas.map((l) => '  ' + l.replace(/\\/g, '\\\\').replace(/#\{/g, '\\#{')).join('\n')}\nSQL`;
  const rec = ' '.repeat(nome.length + 3);
  return `${nome} = ` + linhas.map((l, i) => `${i ? rec : ''}"${escRuby(l)}${fim(i, '\\n')}"${i === ult ? '' : ' \\'}`).join('\n');
}

type Peca = { lit: string } | { cru: string };

const ESC: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0' };

// pedaços do código: literais de string (já sem escape) e o texto cru entre eles
function pecas(cod: string, delphi: boolean): Peca[] {
  const l: Peca[] = [];
  let cru = '';
  let colBase: number | null = null;
  const lit = (s: string) => {
    l.push({ cru }, { lit: s });
    cru = '';
  };
  let i = 0;
  while (i < cod.length) {
    const c = cod[i];
    const resto = cod.slice(i);
    const cmt = delphi ? /^(\/\/[^\n]*|\{[^}]*\}|\(\*[\s\S]*?\*\))/.exec(resto) : /^(\/\/[^\n]*|#(?!\{)[^\n]*|\/\*[\s\S]*?\*\/)/.exec(resto);
    if (cmt) {
      i += cmt[0].length;
      continue;
    }
    const quebra = delphi ? /^(sLineBreak\b|(#(13|10|\$0?[DA]))+)/i.exec(resto) : /^PHP_EOL\b/.exec(resto);
    if (quebra) {
      lit('\n');
      i += quebra[0].length;
      continue;
    }
    const cod_ = delphi && /^#(\d+|\$[\da-f]+)/i.exec(resto);
    if (cod_) {
      const v = cod_[1].startsWith('$') ? parseInt(cod_[1].slice(1), 16) : +cod_[1];
      lit(String.fromCharCode(v));
      i += cod_[0].length;
      continue;
    }
    if (c === "'" || (c === '"' && !delphi)) {
      let s = '';
      let j = i + 1;
      // string com quebra real (PHP): tira o recuo até a coluna da aspa da primeira string assim
      const col = j - (cod.lastIndexOf('\n', i) + 1);
      for (; j < cod.length; j++) {
        const d = cod[j];
        if (d === '\n') {
          s += d;
          colBase ??= col;
          let k = 0;
          while (k < colBase && (cod[j + 1] === ' ' || cod[j + 1] === '\t')) j++, k++;
        } else if (delphi && d === "'" && cod[j + 1] === "'") {
          s += "'";
          j++;
        } else if (!delphi && d === '\\' && j + 1 < cod.length) {
          const e = cod[++j];
          s += c === "'" ? (e === "'" || e === '\\' ? e : '\\' + e) : (ESC[e] ?? (/["\\$#{]/.test(e) ? e : '\\' + e));
        } else if (d === c) break;
        else s += d;
      }
      lit(s);
      i = j + 1;
      continue;
    }
    cru += c;
    i++;
  }
  l.push({ cru });
  return l;
}

const INICIO = /(\bAdd\s*\(|\bText\s*:=|:=|\.=|\+=|<<(?![<~-])|(?<![=!<>:.+])=(?![=>]))/g;
const OP_INI = /^\s*(?:[+.&]|\\)\s*/;
const OP_FIM = /\s*(?:[+.&]|\\)\s*$/;

function semParenSobrando(s: string) {
  let x = s.trim();
  while (x.endsWith(')') && (x.match(/\)/g)?.length ?? 0) > (x.match(/\(/g)?.length ?? 0)) x = x.slice(0, -1).trim();
  return x;
}
// expressão concatenada logo depois de um literal, até o fim do comando
function cauda(s: string) {
  const t = s.split(';')[0].split(/\n\s*\n/)[0];
  if (!OP_INI.test(t)) return '';
  return semParenSobrando(t.replace(OP_INI, '').split(/,\s*\[/)[0]);
}
// expressão concatenada logo antes de um literal, desde o início do comando
function cabeca(s: string) {
  const t = s.split(';').pop()!;
  let ini = 0;
  for (const m of t.matchAll(INICIO)) ini = m.index! + m[0].length;
  const r = t.slice(ini);
  return OP_FIM.test(r) ? r.replace(OP_FIM, '').trim() : '';
}
const expr = (e: string) => (e ? `{${e}}` : '');

function arrumar(s: string) {
  const l = s.replace(/\r\n?/g, '\n').split('\n').map((x) => x.trimEnd());
  while (l.length && !l[0].trim()) l.shift();
  while (l.length && !l.at(-1)!.trim()) l.pop();
  const ind = Math.min(...l.filter((x) => x.trim()).map((x) => x.match(/^\s*/)![0].length));
  return l.map((x) => x.slice(ind)).join('\n').replace(/\n{3,}/g, '\n\n');
}

function heredocs(cod: string): string[] {
  const l: string[] = [];
  for (const m of cod.matchAll(/<<<[ \t]*(['"]?)(\w+)\1[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*\2\b/g))
    l.push(m[1] === "'" ? m[3] : m[3].replace(/\\([\\$])/g, '$1'));
  for (const m of cod.matchAll(/(?<!<)<<[~-]?(['"]?)([A-Z_]\w*)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*$/gm))
    l.push(m[1] === "'" ? m[3] : m[3].replace(/\\([\\#])/g, '$1'));
  return l;
}

export function lingDe(cod: string): Ling {
  const fora = cod.replace(/'(?:[^'\\\n]|''|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
  if (/SQL\s*\.\s*(Add|Text)\b|:=|sLineBreak|#1[03]\b/i.test(fora)) return 'delphi';
  if (/(?<!<)<<[~-]/.test(fora)) return 'ruby';
  if (/<<<|\$\w|\bPHP_EOL\b|->/.test(fora)) return 'php';
  if (!cod.includes('"') && cod.includes("'")) return 'delphi';
  return 'ruby';
}

// tira o SQL das strings do código; o que for concatenado de fora vira {expressão}
export function deString(cod: string): { sql: string; ling: Ling } {
  const ling = lingDe(cod);
  const hd = heredocs(cod);
  if (hd.length) return { sql: hd.map(arrumar).join('\n\n'), ling };

  const p = pecas(cod, ling === 'delphi');
  const lits = p.filter((x): x is { lit: string } => 'lit' in x);
  if (!lits.length) return { sql: '', ling };
  const explicita = lits.some((x) => x.lit.includes('\n'));
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const x = p[i];
    if ('lit' in x) {
      out += x.lit;
      continue;
    }
    const primeiro = i === 0;
    const ultimo = i === p.length - 1;
    if (primeiro) out += expr(cabeca(x.cru));
    else if (ultimo) out += expr(cauda(x.cru));
    else if (/;/.test(x.cru) || (x.cru.match(INICIO) ?? []).length) {
      out += expr(cauda(x.cru)) + '\n' + expr(cabeca(x.cru));
    } else {
      out += expr(x.cru.replace(OP_INI, '').replace(OP_FIM, '').trim());
      if (!explicita && x.cru.includes('\n')) out += '\n';
    }
  }
  return { sql: arrumar(out), ling };
}
