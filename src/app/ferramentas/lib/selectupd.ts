export type AcaoSel = 'update' | 'delete';

export interface OpcoesSel {
  acao: AcaoSel;
  set: string;
  // vazia usa ctid
  chave: string;
  backup: boolean;
  returning: boolean;
}

export interface ResultadoSel {
  sql: string;
  avisos: string[];
}

interface Pal {
  v: string;
  i: number;
  f: number;
}

// palavras fora de parênteses, strings, comentários e identificadores entre aspas
function palavrasTopo(sql: string): Pal[] {
  const re = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'?|"(?:[^"]|"")*"?|\$(\w*)\$[\s\S]*?\$\2\$)|([()])|([A-Za-z_][\w$]*)/g;
  const l: Pal[] = [];
  let nivel = 0;
  for (let m; (m = re.exec(sql)); ) {
    if (m[1]) continue;
    if (m[3]) nivel += m[3] === '(' ? 1 : -1;
    else if (m[4] && nivel === 0) l.push({ v: m[4].toUpperCase(), i: m.index, f: re.lastIndex });
  }
  return l;
}

const FIM_FROM = ['WHERE', 'GROUP', 'HAVING', 'WINDOW', 'ORDER', 'LIMIT', 'OFFSET', 'FETCH', 'FOR'];
const EXTRAS = ['ORDER', 'LIMIT', 'OFFSET', 'FETCH'];
const NAO_ALIAS = new Set(['JOIN', 'LEFT', 'RIGHT', 'INNER', 'FULL', 'CROSS', 'NATURAL', 'ON', 'USING', 'LATERAL', 'ONLY', ...FIM_FROM]);
const IDENT = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;

export function selectParaComando(sqlBruto: string, o: OpcoesSel): ResultadoSel {
  const sql = sqlBruto.trim().replace(/;\s*$/, '');
  if (!sql) return { sql: '', avisos: [] };
  const pal = palavrasTopo(sql);
  const acha = (v: string[], depois = -1) => pal.find((p) => p.i > depois && v.includes(p.v));
  const erro = (m: string) => ({ sql: '', avisos: [m] });

  const sel = acha(['SELECT']);
  if (!sel) return erro('Não achei o SELECT.');
  if (acha(['UNION', 'EXCEPT', 'INTERSECT'])) return erro('SELECT com UNION/EXCEPT/INTERSECT não vira UPDATE/DELETE direto.');
  const from = acha(['FROM'], sel.i);
  if (!from) return erro('Não achei o FROM.');
  const cte = sel.i > 0 && pal[0].v === 'WITH' ? sql.slice(0, sel.i).trim() + '\n' : '';
  const fimFrom = acha(FIM_FROM, from.i);
  const fromTxt = sql.slice(from.f, fimFrom?.i ?? sql.length).trim();
  if (acha(['GROUP', 'HAVING', 'WINDOW'], from.i)) return erro('SELECT com GROUP BY/HAVING não vira UPDATE/DELETE direto.');

  const where = acha(['WHERE'], from.i);
  const fimWhere = where && acha(['ORDER', 'LIMIT', 'OFFSET', 'FETCH', 'FOR'], where.i);
  const whereTxt = where ? sql.slice(where.f, fimWhere?.i ?? sql.length).trim() : '';
  // ORDER BY só importa junto de LIMIT/OFFSET/FETCH
  const ini = acha(['LIMIT', 'OFFSET', 'FETCH'], from.i) && acha(EXTRAS, from.i);
  const fimExtras = ini && acha(['FOR'], ini.i);
  const extras = ini ? sql.slice(ini.i, fimExtras?.i ?? sql.length).trim().replace(/\s+/g, ' ') : '';

  const m = new RegExp(String.raw`^(${IDENT}(?:\s*\.\s*${IDENT})*)(?:\s+(?:AS\s+)?(${IDENT}))?`, 'i').exec(fromTxt);
  if (!m || /^ONLY$/i.test(m[1])) return erro('O primeiro item do FROM precisa ser uma tabela.');
  const tabela = m[1].replace(/\s+/g, '');
  const alias = m[2] && !NAO_ALIAS.has(m[2].toUpperCase()) ? m[2] : '';
  const resto = fromTxt.slice(alias ? m[0].length : m[1].length).trim();
  const ref = alias || tabela.split('.').pop()!;
  const alvo = alias ? `${tabela} ${alias}` : tabela;

  const avisos: string[] = [];
  let cond: string;
  if (!resto && !extras) cond = whereTxt;
  else {
    // join, vírgula ou limit: filtra a tabela pela chave da consulta original
    const k = o.chave.trim() || 'ctid';
    cond = `${ref}.${k} in (\n  select ${ref}.${k}\n  from ${fromTxt}${whereTxt ? `\n  where ${whereTxt}` : ''}${extras ? `\n  ${extras}` : ''}\n)`;
    avisos.push(`FROM com ${resto ? 'join ou mais de uma tabela' : 'LIMIT/OFFSET'}: filtra ${tabela} por ${k} da consulta original.`);
  }
  if (!cond) avisos.push(`Sem WHERE: o comando afeta a tabela ${tabela} inteira.`);
  const w = cond ? `\nwhere ${cond}` : '';

  const set = o.set
    .split(/\r?\n|,(?=\s*[\w"]+(?:\.[\w"]+)?\s*=)/)
    .map((s) => s.trim().replace(/,$/, ''))
    .filter(Boolean)
    // SET não aceita alias na coluna
    .map((s) => s.replace(new RegExp(String.raw`^${ref.replace(/[$"]/g, '\\$&')}\s*\.\s*`, 'i'), ''));
  if (o.acao === 'update' && !set.length) avisos.push('Preencha as colunas do SET.');

  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nomeBkp = `bkp_${tabela.split('.').pop()!.replace(/"/g, '').toLowerCase()}_${hoje}`;
  const partes = ['begin;'];
  if (o.backup) partes.push(`create table ${nomeBkp} as\n${cte}select ${ref}.* from ${alvo}${w};`);
  partes.push(`${cte}select count(*) from ${alvo}${w};`);
  const ret = o.returning ? '\nreturning *' : '';
  partes.push(
    o.acao === 'update'
      ? `${cte}update ${alvo}\nset ${(set.length ? set : ['coluna = valor']).join(',\n    ')}${w}${ret};`
      : `${cte}delete from ${alvo}${w}${ret};`,
  );
  partes.push('rollback; -- commit; depois de conferir');
  return { sql: partes.join('\n\n'), avisos };
}
