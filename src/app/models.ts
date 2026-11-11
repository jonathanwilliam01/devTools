export interface Card {
  id: string;
  numero: number;
  descricao: string;
  sistema: string;
  area: string;
  time: string;
  linguagem: string;
  data: string; // yyyy-mm-dd
  obs: string;
  // registrado sozinho ao ir para Validar sem linguagem ou "o que foi feito"
  incompleto?: boolean;
}

export interface Sistema {
  id: string;
  nome: string;
  aliases: string[];
}

export interface Bloco {
  id: string;
  label: string;
  conteudo: string; // secreto com senha mestra: "enc:<iv>:<dados>"
  secreto?: boolean;
  tabela?: boolean; // conteudo em TSV
  sql?: boolean; // destaque de sintaxe e botão formatar
}

export interface Nota {
  id: string;
  titulo: string;
  blocos: Bloco[];
  fixada: boolean;
  cor: string;
  atualizado: string;
  tags?: string[];
}

// nota removida fica DIAS_LIXEIRA dias antes de sumir
export interface Removida {
  nota: Nota;
  removido: string; // ISO
}
export const DIAS_LIXEIRA = 7;

export type Status = 'todo' | 'doing' | 'blocked' | 'done';
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export type Tipo = 'card' | 'tarefa' | 'ajuda' | 'verificacao';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string;
  status: Status;
  prioridade: Prioridade;
  tipo: Tipo;
  numeroCard?: number | null;
  prazo?: string | null;
  criado: string;
  concluido?: string | null;
  checklist?: ItemChecklist[];
  // "trabalho executado" pedido ao concluir; vira o obs do card
  trabalho?: string;
  // tipo ajuda: quem foi ajudado
  pessoa?: string;
  // tempo em "Fazendo": acumulado (ms) e início da rodada atual (ISO)
  tempo?: number;
  inicio?: string | null;
}

export interface ItemChecklist {
  id: string;
  texto: string;
  feito: boolean;
}

export type CampoCard = 'sistema' | 'area' | 'time' | 'linguagem';

export interface Config {
  senha?: { salt: string; verificador: string } | null;
  // label do GitHub (chaveNome) -> campo do card
  labels?: Record<string, CampoCard | 'ignorar'>;
  // issues atribuídas já levadas ao kanban, para não recriar tarefa removida
  issuesVistas?: number[];
  // ids de MENUS escondidos na barra do topo
  menusOcultos?: string[];
  // ids das ferramentas favoritas, na ordem em que foram marcadas
  favoritas?: string[];
  // ferramentas novas já abertas, para tirar o selo "novo"
  vistas?: string[];
}

export interface Dados {
  versao: number;
  cards: Card[];
  sistemas: Sistema[];
  notas: Nota[];
  tarefas: Tarefa[];
  vars: Record<string, string>;
  config: Config;
  lixeira?: Removida[];
}

export const MENUS = [
  { id: 'cards', nome: 'Histórico', tecla: '1' },
  { id: 'notas', nome: 'Notas', tecla: '2' },
  { id: 'kanban', nome: 'Kanban', tecla: '3' },
  { id: 'ferramentas', nome: 'Ferramentas', tecla: '4' },
];

export const ISSUE_URL = 'https://github.com/geosiap/tiflux/issues/';

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const COLUNAS: { status: Status; titulo: string }[] = [
  { status: 'todo', titulo: 'A fazer' },
  { status: 'doing', titulo: 'Fazendo' },
  { status: 'blocked', titulo: 'Impedido' },
  { status: 'done', titulo: 'Concluído' },
];

export const PRIORIDADES: { valor: Prioridade; label: string }[] = [
  { valor: 'urgente', label: 'Urgente' },
  { valor: 'alta', label: 'Alta' },
  { valor: 'media', label: 'Média' },
  { valor: 'baixa', label: 'Baixa' },
];

export const TIPOS: { valor: Tipo; label: string }[] = [
  { valor: 'card', label: 'Card' },
  { valor: 'tarefa', label: 'Tarefa' },
  { valor: 'ajuda', label: 'Ajuda' },
  { valor: 'verificacao', label: 'Verificação' },
];

export const CORES = ['', 'amarelo', 'verde', 'azul', 'roxo', 'vermelho'];

export const novoId = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
export const hoje = () => new Date().toLocaleDateString('sv-SE');
export const dataBr = (d: string) => d.split('-').reverse().join('/');
// lista separada por vírgula (sistema, área, linguagem)
export const partes = (s: string) => [...new Set((s ?? '').split(',').map((x) => x.trim()).filter(Boolean))];
export const chaveNome = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// diferença em dias entre duas datas yyyy-mm-dd (b - a)
export const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00') - Date.parse(a + 'T00:00')) / 86400000);

// selo de prazo da tarefa (kanban e início)
export function prazoTarefa(t: Tarefa): { texto: string; nivel: string } | null {
  if (!t.prazo) return null;
  if (t.status === 'done') return { texto: dataBr(t.prazo).slice(0, 5), nivel: 'ok' };
  const d = diasEntre(hoje(), t.prazo);
  if (d < 0) return { texto: `atrasada ${-d}d`, nivel: 'atrasada' };
  if (d === 0) return { texto: 'vence hoje', nivel: 'hoje' };
  if (d <= 2) return { texto: d === 1 ? 'amanhã' : `em ${d}d`, nivel: 'proxima' };
  return { texto: dataBr(t.prazo).slice(0, 5), nivel: 'ok' };
}

// troca de status cuidando da data de conclusão e do tempo em "Fazendo"
export function mudarStatus(t: Tarefa, status: Status): Tarefa {
  if (t.status === status) return t;
  const agora = new Date();
  const tempo = (t.tempo ?? 0) + (t.inicio ? agora.getTime() - Date.parse(t.inicio) : 0);
  return {
    ...t,
    status,
    concluido: status === 'done' ? (t.concluido ?? hoje()) : null,
    tempo,
    inicio: status === 'doing' ? agora.toISOString() : null,
  };
}

export function tempoTarefa(t: Tarefa) {
  const ms = (t.tempo ?? 0) + (t.inicio ? Date.now() - Date.parse(t.inicio) : 0);
  const min = Math.round(ms / 60000);
  if (!min && !t.inicio) return '';
  return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

// "Ajudar Diniz com..." sem pessoa informada
export const pessoaTarefa = (t: Tarefa) => t.pessoa?.trim() || t.titulo.match(/^ajudar\s+(?:o\s+|a\s+)?([\p{L}]+)/iu)?.[1] || '';
