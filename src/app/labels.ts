import { CampoCard, chaveNome } from './models';

export type Destino = CampoCard | 'ignorar';

// base versionada; o mapa aprendido no navegador (config.labels) vale por cima.
// "desc:" = descrição da label no GitHub, "pref:" = trecho antes do primeiro "-"
export const LABELS_PADRAO: Record<string, Destino> = {
  'desc:ETIQUETA PARA FILTRAR DEMANDAS POR AREAS': 'area',
  'pref:APP': 'sistema',
  'pref:TOOLS': 'sistema',
  'pref:FACILITA': 'sistema',
  IFACECEBI: 'sistema',
  IFACECIB: 'sistema',
  IFACEWEBISS: 'sistema',
  ARRECADACAO: 'area',
  FINANCAS: 'area',
  SUPRIMENTOS: 'area',
  'ADMINISTRACAO/RH': 'area',
  DESK: 'time',
  WEB: 'time',
  'pref:SP': 'ignorar',
  'pref:RJ': 'ignorar',
  'pref:MG': 'ignorar',
  'pref:RO': 'ignorar',
  'pref:FRANQUIA': 'ignorar',
  'pref:FAST': 'ignorar',
  'FAST/BI': 'ignorar',
  'pref:1': 'ignorar',
  'pref:2': 'ignorar',
  'pref:3': 'ignorar',
  'pref:4': 'ignorar',
  'pref:APROVADO': 'ignorar',
  URGENTE: 'ignorar',
  IMPORTANTE: 'ignorar',
  LEGADO: 'ignorar',
  RETRABALHO: 'ignorar',
  TIFLUX: 'ignorar',
  'PROBLEMA SERVIDOR INFISC': 'ignorar',
};

export const SIGLAS_AREA: Record<string, string> = {
  ARRECADACAO: 'ARR',
  FINANCAS: 'FIN',
  SUPRIMENTOS: 'SUP',
  'ADMINISTRACAO/RH': 'RH',
};

// nome, descrição e prefixo, nessa ordem de prioridade
export function chavesLabel(label: string, desc = '') {
  const k = [chaveNome(label)];
  if (desc) k.push('desc:' + chaveNome(desc));
  if (label.includes('-')) k.push('pref:' + chaveNome(label.split('-')[0]));
  return k;
}

export const destinoLabel = (mapa: Record<string, Destino>, label: string, desc = '') =>
  chavesLabel(label, desc).map((k) => mapa[k]).find(Boolean);

// App-ISSW -> ISSW, App-IFACENOBE -> NOBE, Facilita-Jucesp -> Jucesp
export const semPrefixo = (label: string) => label.replace(/^(app|tools|facilita)-/i, '').replace(/^iface/i, '');

// sistema (chaveNome) -> linguagem, tirado do histórico de cards; sistema fora daqui deixa o card incompleto
export const LINGUAGEM_PADRAO: Record<string, string> = {
  API_PAGAMENTO_ONLINE: 'LARAVEL',
  CADIN: 'RUBY/ANGULAR',
  CEBI: 'PYTHON',
  CONTAS: 'RUBY/ANGULAR',
  FAJUC: 'RUBY/ANGULAR',
  FISW: 'DELPHI',
  GEDA: 'DELPHI',
  GISS: 'PHP',
  INTER_CP: 'PHP',
  IPTU: 'DELPHI',
  ISSON: 'PHP',
  ISSW: 'DELPHI',
  ITBI: 'PHP',
  JUCESP: 'RUBY/ANGULAR',
  NOBE: 'PHP',
  'NOTA CONTROL': 'PHP',
  PESSOAS: 'RUBY/ANGULAR',
  'PORTAL-TRANSP': 'RUBY/ANGULAR',
  SETUP: 'SQL',
  SIAPEGOV: 'PHP',
  'SUP-WEB': 'RUBY/ANGULAR',
};
