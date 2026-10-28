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
