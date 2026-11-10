export type GrupoDiag = 'sessoes' | 'bloqueios' | 'desempenho' | 'tamanho' | 'manutencao' | 'estrutura' | 'config';

export interface Diag {
  grupo: GrupoDiag;
  titulo: string;
  desc: string;
  sql: string;
}

export interface OpcoesDiag {
  versao: number;
  tabela: string;
  minutos: number;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMAS_USUARIO = `n.nspname !~ '^pg_' and n.nspname <> 'information_schema'`;

export function diagnosticos(o: OpcoesDiag): Diag[] {
  const v = o.versao;
  const tab = lit(o.tabela.trim() || 'schema.tabela');
  const min = `interval '${Math.max(0, Math.floor(o.minutos || 0))} minutes'`;
  const espera = v >= 10 ? `\n  wait_event_type || ': ' || wait_event as espera,` : '';
  const [schema, nome] = o.tabela.trim().includes('.') ? o.tabela.trim().split('.', 2) : ['', o.tabela.trim()];
  const filtroSeq = nome ? `\n  and table_name = ${lit(nome)}` + (schema ? ` and table_schema = ${lit(schema)}` : '') : '';
  const [tempo, media] = v >= 13 ? ['total_exec_time', 'mean_exec_time'] : ['total_time', 'mean_time'];

  const bloqueio =
    v >= 10
      ? `select bloqueada.pid as pid_bloqueado, bloqueada.usename as usuario_bloqueado,
  now() - bloqueada.query_start as esperando_ha, bloqueada.query as query_bloqueada,
  bloqueadora.pid as pid_bloqueador, bloqueadora.usename as usuario_bloqueador,
  bloqueadora.state as estado_bloqueador, bloqueadora.query as query_bloqueadora
from pg_stat_activity bloqueada
join pg_stat_activity bloqueadora on bloqueadora.pid = any(pg_blocking_pids(bloqueada.pid))
order by bloqueada.query_start;`
      : `select espera.pid as pid_bloqueado, a1.usename as usuario_bloqueado,
  now() - a1.query_start as esperando_ha, a1.query as query_bloqueada,
  dono.pid as pid_bloqueador, a2.usename as usuario_bloqueador,
  a2.state as estado_bloqueador, a2.query as query_bloqueadora
from pg_locks espera
join pg_stat_activity a1 on a1.pid = espera.pid
join pg_locks dono on dono.locktype = espera.locktype
  and dono.database is not distinct from espera.database
  and dono.relation is not distinct from espera.relation
  and dono.page is not distinct from espera.page
  and dono.tuple is not distinct from espera.tuple
  and dono.virtualxid is not distinct from espera.virtualxid
  and dono.transactionid is not distinct from espera.transactionid
  and dono.classid is not distinct from espera.classid
  and dono.objid is not distinct from espera.objid
  and dono.objsubid is not distinct from espera.objsubid
  and dono.pid <> espera.pid
join pg_stat_activity a2 on a2.pid = dono.pid
where not espera.granted and dono.granted
order by a1.query_start;`;

  return [
    {
      grupo: 'sessoes',
      titulo: 'Sessões ativas',
      desc: 'O que está rodando agora, da query mais antiga para a mais nova.',
      sql: `select pid, usename as usuario, datname as banco, client_addr as ip, application_name as aplicacao,
  state as estado,${espera}
  now() - query_start as tempo_query,
  now() - xact_start as tempo_transacao,
  query
from pg_stat_activity
where state <> 'idle' and pid <> pg_backend_pid()
order by query_start;`,
    },
    {
      grupo: 'sessoes',
      titulo: 'Transações abertas paradas (idle in transaction)',
      desc: 'Sessão que abriu transação e não fechou: segura lock e impede o vacuum.',
      sql: `select pid, usename as usuario, datname as banco, client_addr as ip, application_name as aplicacao,
  now() - xact_start as tempo_transacao,
  now() - state_change as parada_ha,
  query as ultima_query
from pg_stat_activity
where state like 'idle in transaction%'
  and now() - state_change > ${min}
order by xact_start;`,
    },
    {
      grupo: 'sessoes',
      titulo: 'Conexões por banco, usuário e estado',
      desc: 'Quantas conexões abertas e o limite do servidor.',
      sql: `select datname as banco, usename as usuario, state as estado, count(*) as conexoes,
  (select setting::int from pg_settings where name = 'max_connections') as max_connections
from pg_stat_activity
group by 1, 2, 3
order by 4 desc;`,
    },
    {
      grupo: 'sessoes',
      titulo: 'Comandos para cancelar ou encerrar sessões longas',
      desc: 'Só gera os comandos; copie e rode o da sessão escolhida. Cancelar para a query, encerrar derruba a conexão.',
      sql: `select pid, usename as usuario, client_addr as ip, now() - query_start as tempo,
  'select pg_cancel_backend(' || pid || ');' as cancelar_query,
  'select pg_terminate_backend(' || pid || ');' as encerrar_sessao,
  query
from pg_stat_activity
where state <> 'idle' and pid <> pg_backend_pid()
  and now() - query_start > ${min}
order by query_start;`,
    },
    {
      grupo: 'bloqueios',
      titulo: 'Quem bloqueia quem',
      desc: 'Cada sessão esperando lock e a sessão que segura. Encerrar a bloqueadora libera a fila.',
      sql: bloqueio,
    },
    {
      grupo: 'bloqueios',
      titulo: o.tabela.trim() ? `Locks na tabela ${o.tabela.trim()}` : 'Locks por tabela',
      desc: 'Locks em tabelas e índices, com a sessão dona. "concedido = false" está esperando.',
      sql: `select l.relation::regclass as tabela, l.mode as modo, l.granted as concedido, l.pid,
  a.usename as usuario, now() - a.query_start as tempo, a.query
from pg_locks l
join pg_stat_activity a on a.pid = l.pid
where l.relation is not null and l.pid <> pg_backend_pid()
  and ${o.tabela.trim() ? `l.relation = ${tab}::regclass` : `l.relation::regclass::text !~ '^pg_'`}
order by l.relation::regclass::text, l.granted;`,
    },
    {
      grupo: 'desempenho',
      titulo: 'Queries mais pesadas (pg_stat_statements)',
      desc: 'Precisa da extensão pg_stat_statements (shared_preload_libraries + create extension). Ordena pelo tempo total.',
      sql: `select calls as chamadas,
  round(${tempo}::numeric, 1) as total_ms,
  round(${media}::numeric, 1) as media_ms,
  rows as linhas,
  round((100 * ${tempo} / sum(${tempo}) over ())::numeric, 1) as perc_total,
  query
from pg_stat_statements
order by ${tempo} desc
limit 30;`,
    },
    {
      grupo: 'desempenho',
      titulo: 'Tabelas lidas por seq scan',
      desc: 'Muitas linhas lidas sem índice: candidatas a índice no filtro mais usado.',
      sql: `select schemaname as schema, relname as tabela, seq_scan, seq_tup_read as linhas_lidas_seq,
  case when seq_scan > 0 then seq_tup_read / seq_scan end as media_por_seq,
  idx_scan, n_live_tup as linhas
from pg_stat_user_tables
where seq_scan > 0
order by seq_tup_read desc
limit 30;`,
    },
    {
      grupo: 'desempenho',
      titulo: 'Cache, deadlocks e arquivos temporários por banco',
      desc: 'Cache hit abaixo de 99% indica memória curta; temp alto indica work_mem baixo para sort/hash.',
      sql: `select datname as banco,
  round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) as cache_hit_perc,
  xact_commit as commits, xact_rollback as rollbacks, deadlocks,
  temp_files as arquivos_temp, pg_size_pretty(temp_bytes) as temp_usado
from pg_stat_database
where datname is not null
order by blks_hit + blks_read desc;`,
    },
    {
      grupo: 'tamanho',
      titulo: 'Tamanho dos bancos',
      desc: '',
      sql: `select datname as banco, pg_size_pretty(pg_database_size(datname)) as tamanho
from pg_database
where not datistemplate
order by pg_database_size(datname) desc;`,
    },
    {
      grupo: 'tamanho',
      titulo: 'Maiores tabelas',
      desc: 'Total separado em dados, índices e TOAST (textos grandes).',
      sql: `select n.nspname as schema, c.relname as tabela, c.reltuples::bigint as linhas_aprox,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total,
  pg_size_pretty(pg_relation_size(c.oid)) as dados,
  pg_size_pretty(pg_indexes_size(c.oid)) as indices,
  pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid) - pg_indexes_size(c.oid)) as toast
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'm') and ${SCHEMAS_USUARIO}
order by pg_total_relation_size(c.oid) desc
limit 30;`,
    },
    {
      grupo: 'tamanho',
      titulo: 'Índices sem uso',
      desc: 'Nunca usados desde o último reset das estatísticas. Confira também na réplica antes de remover.',
      sql: `select s.schemaname as schema, s.relname as tabela, s.indexrelname as indice, s.idx_scan as usos,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as tamanho,
  pg_get_indexdef(s.indexrelid) as definicao
from pg_stat_user_indexes s
join pg_index i on i.indexrelid = s.indexrelid
where s.idx_scan = 0 and not i.indisunique and not i.indisprimary
order by pg_relation_size(s.indexrelid) desc;`,
    },
    {
      grupo: 'manutencao',
      titulo: 'Linhas mortas, vacuum e analyze',
      desc: 'Muitas linhas mortas ou analyze antigo deixam o plano ruim.',
      sql: `select schemaname as schema, relname as tabela, n_live_tup as vivas, n_dead_tup as mortas,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) as perc_mortas,
  greatest(last_vacuum, last_autovacuum) as ultimo_vacuum,
  greatest(last_analyze, last_autoanalyze) as ultimo_analyze
from pg_stat_user_tables
order by n_dead_tup desc
limit 30;`,
    },
    {
      grupo: 'manutencao',
      titulo: 'Sequences fora de sincronia',
      desc: 'Gera o setval de cada coluna serial para max + 1. Rode o da tabela que dá chave duplicada no insert.',
      sql: `select table_schema as schema, table_name as tabela, column_name as coluna,
  substring(column_default from 'nextval\\(''([^'']+)''') as sequence,
  'select setval(''' || substring(column_default from 'nextval\\(''([^'']+)''') || ''', coalesce((select max('
    || quote_ident(column_name) || ') from ' || quote_ident(table_schema) || '.' || quote_ident(table_name) || '), 0) + 1, false);' as corrigir
from information_schema.columns
where column_default like 'nextval(%'${filtroSeq}
order by 1, 2;`,
    },
    {
      grupo: 'estrutura',
      titulo: 'FKs que apontam para a tabela',
      desc: 'Tabelas filhas que impedem o DELETE ou recebem o cascade.',
      sql: `select conrelid::regclass as tabela_filha, conname as fk, pg_get_constraintdef(oid) as definicao
from pg_constraint
where contype = 'f' and confrelid = ${tab}::regclass
order by 1;`,
    },
    {
      grupo: 'estrutura',
      titulo: 'Views que usam a tabela',
      desc: 'Impedem ALTER/DROP da coluna ou da tabela.',
      sql: `select distinct n.nspname as schema, v.relname as view
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class v on v.oid = r.ev_class
join pg_namespace n on n.oid = v.relnamespace
where d.refobjid = ${tab}::regclass and v.oid <> d.refobjid
order by 1, 2;`,
    },
    {
      grupo: 'estrutura',
      titulo: 'Triggers da tabela',
      desc: 'habilitado: O = sim, D = desabilitado.',
      sql: `select t.tgname as trigger, t.tgenabled as habilitado, p.proname as funcao, pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = ${tab}::regclass and not t.tgisinternal
order by 1;`,
    },
    {
      grupo: 'estrutura',
      titulo: 'Índices da tabela',
      desc: '',
      sql: `select indexrelid::regclass as indice, pg_size_pretty(pg_relation_size(indexrelid)) as tamanho,
  pg_get_indexdef(indexrelid) as definicao
from pg_index
where indrelid = ${tab}::regclass
order by 1;`,
    },
    {
      grupo: 'config',
      titulo: 'Versão e tempo no ar',
      desc: '',
      sql: `select version(), pg_postmaster_start_time() as no_ar_desde, now() - pg_postmaster_start_time() as tempo_no_ar;`,
    },
    {
      grupo: 'config',
      titulo: 'Parâmetros principais',
      desc: 'Memória, timeouts, log de query lenta e encoding.',
      sql: `select name as parametro, setting as valor, unit as unidade, source as origem
from pg_settings
where name in ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem', 'effective_cache_size',
  'statement_timeout', 'lock_timeout', 'idle_in_transaction_session_timeout', 'log_min_duration_statement',
  'autovacuum', 'server_encoding', 'client_encoding', 'TimeZone', 'DateStyle', 'standard_conforming_strings', 'search_path')
order by 1;`,
    },
  ];
}
