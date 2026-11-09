export type AlvoPg = 'tabela' | 'campo' | 'proc' | 'codigo' | 'dado';
export type ComparaPg = 'contem' | 'inicia' | 'igual';

export interface OpcoesPg {
  alvo: AlvoPg;
  termo: string;
  compara: ComparaPg;
  versao: number;
  schema: string;
  todasColunas: boolean;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

// LIKE com ! de escape: funciona igual com ou sem standard_conforming_strings (9.0)
function filtro(expr: string, termo: string, compara: ComparaPg) {
  if (compara === 'igual') return `lower(${expr}) = lower(${lit(termo)})`;
  const e = termo.replace(/[!%_]/g, '!$&');
  return `${expr} ilike ${lit(compara === 'inicia' ? e + '%' : '%' + e + '%')} escape '!'`;
}

function schemas(o: OpcoesPg) {
  return o.schema.trim() ? `n.nspname = ${lit(o.schema.trim())}` : `n.nspname !~ '^pg_' and n.nspname <> 'information_schema'`;
}

const nomeTab = `quote_ident(n.nspname) || '.' || quote_ident(c.relname)`;

export function buscaPg(o: OpcoesPg): string {
  const termo = o.termo.trim();
  if (!termo) return '';
  const relkinds = o.versao >= 10 ? `'r', 'v', 'm', 'p', 'f'` : `'r', 'v', 'm', 'f'`;

  if (o.alvo === 'tabela')
    return `select n.nspname as schema, c.relname as tabela,
  case c.relkind when 'r' then 'tabela' when 'v' then 'view' when 'm' then 'view materializada' when 'p' then 'particionada' when 'f' then 'externa' end as tipo,
  c.reltuples::bigint as linhas_aprox,
  'select * from ' || ${nomeTab} || ' limit 100;' as consulta
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in (${relkinds})
  and ${filtro('c.relname', termo, o.compara)}
  and ${schemas(o)}
order by 1, 2;`;

  if (o.alvo === 'campo')
    return `select n.nspname as schema, c.relname as tabela, a.attname as campo,
  format_type(a.atttypid, a.atttypmod) as tipo, a.attnotnull as obrigatorio,
  'select ' || quote_ident(a.attname) || ', * from ' || ${nomeTab} || ' limit 100;' as consulta
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where a.attnum > 0 and not a.attisdropped
  and c.relkind in (${relkinds})
  and ${filtro('a.attname', termo, o.compara)}
  and ${schemas(o)}
order by 1, 2, 3;`;

  if (o.alvo === 'proc' || o.alvo === 'codigo') {
    // prokind só existe a partir do 11
    const tipo =
      o.versao >= 11
        ? `case when p.prokind = 'p' then 'procedure' when p.prokind = 'a' then 'agregada' when p.prokind = 'w' then 'janela'`
        : `case when p.proisagg then 'agregada' when p.proiswindow then 'janela'`;
    const cond = o.alvo === 'proc' ? filtro('p.proname', termo, o.compara) : filtro('p.prosrc', termo, o.compara === 'igual' ? 'contem' : o.compara);
    return `select n.nspname as schema, p.proname as nome,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid) as retorno,
  ${tipo} when p.prorettype = 'trigger'::regtype then 'trigger' else 'função' end as tipo,
  'select pg_get_functiondef(' || quote_literal(p.oid::regprocedure::text) || '::regprocedure);' as consulta
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where ${cond}
  and ${schemas(o)}
order by 1, 2;`;
  }

  // dado: monta um select por coluna e só lista as que têm alguma linha que casa
  const cond = o.compara === 'igual' ? `::text = ${lit(termo)}` : '::text ' + filtro('', termo, o.compara).trim();
  const kinds = o.versao >= 10 ? `c.relkind in ('r', 'p') and not c.relispartition` : `c.relkind = 'r'`;
  const tipos = o.todasColunas ? '' : `\n    and t.typcategory = 'S'`;
  return `select schema, tabela, campo, tipo, consulta || ';' as consulta
from (
  select n.nspname as schema, c.relname as tabela, a.attname as campo,
    format_type(a.atttypid, a.atttypmod) as tipo,
    'select * from ' || ${nomeTab} || ' where ' || quote_ident(a.attname) || ${lit(cond)} as consulta
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where a.attnum > 0 and not a.attisdropped
    and ${kinds}${tipos}
    and ${schemas(o)}
) s
where query_to_xml(consulta || ' limit 1', false, true, '')::text <> ''
order by 1, 2, 3;`;
}
