import { Card, Tarefa, dataBr, hoje } from './models';

// resumo de concluídos para a daily (histórico e início)
export interface ItemResumo {
  data: string;
  titulo: string;
  obs: string;
}

export const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const somaDias = (d: string, n: number) => {
  const x = new Date(d + 'T00:00');
  x.setDate(x.getDate() + n);
  return x.toLocaleDateString('sv-SE');
};
const diaSemana = (d: string) => new Date(d + 'T00:00').getDay();
export const diaBr = (d: string) => (d ? `${SEMANA[diaSemana(d)]} ${dataBr(d).slice(0, 5)}` : '—');

// dia de daily mais próximo antes (-1) ou depois (1) de d; sem dias marcados anda uma semana
export function outraDaily(d: string, dias: number[], passo: 1 | -1) {
  for (let i = 1; i <= 7; i++) {
    const x = somaDias(d, i * passo);
    if (dias.includes(diaSemana(x))) return x;
  }
  return somaDias(d, 7 * passo);
}

function pref(chave: string, padrao: string) {
  try {
    return localStorage.getItem(chave) ?? padrao;
  } catch {
    return padrao;
  }
}
export const lerDiasDaily = () => pref('devtools:daily', '1,3').split(',').filter(Boolean).map(Number);
export const lerObsDaily = () => pref('devtools:daily-obs', '1') === '1';

// tarefa concluída só entra se não virou card
export function itensResumo(cards: Card[], tarefas: Tarefa[], dentro: (d: string) => boolean, comTarefas: boolean): ItemResumo[] {
  const registrados = new Set(cards.map((c) => c.numero));
  const doCard = cards
    .filter((c) => dentro(c.data))
    .sort((a, b) => a.numero - b.numero)
    .map((c) => ({ data: c.data, titulo: `#${c.numero} - ${c.descricao}${c.sistema ? ` [${c.sistema}]` : ''}`, obs: c.obs }));
  const daTarefa = !comTarefas
    ? []
    : tarefas
        .filter((t) => t.status === 'done' && t.concluido && dentro(t.concluido) && !(t.numeroCard && registrados.has(t.numeroCard)))
        .map((t) => ({
          data: t.concluido!,
          titulo: t.numeroCard ? `#${t.numeroCard} - ${t.titulo}` : `${t.tipo === 'verificacao' ? 'Verificação' : 'Ajuda'}: ${t.titulo}`,
          obs: '',
        }));
  return [...doCard, ...daTarefa].sort((a, b) => a.data.localeCompare(b.data));
}

export function textoResumo(itens: ItemResumo[], titulo: string, comObs: boolean) {
  if (!itens.length) return `${titulo}\n\nNenhum concluído.`;
  const linhas = [`${titulo} (${itens.length})`];
  let dia = '';
  for (const i of itens) {
    if (i.data !== dia) linhas.push('', diaBr((dia = i.data)));
    else linhas.push('');
    linhas.push(`- ${i.titulo}`);
    if (comObs) linhas.push(...i.obs.split('\n').filter((l) => l.trim()).map((l) => `  ${l.trim()}`));
  }
  return linhas.join('\n');
}

// desde a última daily até hoje
export function resumoDaily(cards: Card[], tarefas: Tarefa[]) {
  const [de, ate] = [outraDaily(hoje(), lerDiasDaily(), -1), hoje()];
  const itens = itensResumo(cards, tarefas, (d) => d >= de && d <= ate, true);
  return { de, ate, itens, texto: textoResumo(itens, `Concluídos de ${diaBr(de)} a ${diaBr(ate)}`, lerObsDaily()) };
}
