// Patch notes: cada versão nova entra no topo; a janela abre uma vez por versão
export type TipoNovidade = 'novidade' | 'melhoria' | 'correcao';

export interface Versao {
  versao: string;
  data: string; // yyyy-mm-dd
  itens: { tipo: TipoNovidade; texto: string }[];
}

export const NOVIDADES: Versao[] = [
  {
    versao: '1.0.26',
    data: '2026-11-12',
    itens: [
      { tipo: 'novidade', texto: 'git-calm: novas funções de texto pela ponte — paraMarkdown, verificarOrtografia, corrigirOrtografia, traduzir, limparTexto, extrair, anonimizar, entidades, linhas e substituir.' },
      { tipo: 'novidade', texto: 'Corretor ortográfico (Ferramentas › Texto): marca erros de ortografia, gramática e estilo via LanguageTool e aplica as sugestões uma a uma ou todas.' },
      { tipo: 'novidade', texto: 'Tradutor (Ferramentas › Texto): português, inglês, espanhol, francês, italiano e alemão; usa o tradutor local do Chrome quando disponível, senão a MyMemory.' },
      { tipo: 'novidade', texto: 'Texto → Markdown (Ferramentas › Texto): detecta títulos, listas, citação e código no texto puro; ajuste tipo, negrito, itálico, sublinhado e linha separadora por linha, com prévia.' },
      { tipo: 'novidade', texto: 'Leitor de EXPLAIN: cole o SELECT e ele gera o comando EXPLAIN (ANALYZE, BUFFERS) pronto, com passo a passo; UPDATE/DELETE com ANALYZE vão entre BEGIN e ROLLBACK.' },
      { tipo: 'novidade', texto: 'Cron: modo "Montar intervalo" (a cada N segundos, minutos, horas, dias, toda semana ou a cada N meses, com horário e opção seg a sex) que gera a expressão.' },
      { tipo: 'melhoria', texto: 'Cron: aceita expressão com 6 campos (segundo no início).' },
      { tipo: 'melhoria', texto: 'Cálculo de datas: datas digitáveis com máscara dd/mm/aaaa, botão Hoje e calendário.' },
      { tipo: 'novidade', texto: 'Formato de data (Ferramentas › Datas): converte para americano, ISO, por extenso, inglês e outros, uma ou várias datas; também disponível ao git-calm pela função formatarData.' },
      { tipo: 'novidade', texto: 'Novidades: botão Copiar em cada versão. Clique nas linhas para marcar e copiar só as escolhidas.' },
      { tipo: 'melhoria', texto: 'Imagem para texto: clicar na área não abre mais o seletor de arquivo, só prepara para colar (Ctrl+V); escolher arquivo virou botão.' },
      { tipo: 'melhoria', texto: 'Kanban agora se chama Tarefas (menu, tela e textos); links e preferências antigos continuam valendo.' },
      { tipo: 'novidade', texto: 'Compartilhar (⤴ no topo): gera um link do devTools só com os menus escolhidos; quem abrir fica com os outros escondidos (reativa em Dados).' },
      { tipo: 'novidade', texto: 'Notas: compartilhamento. Selecione notas (☑ Selecionar, com marcar/desmarcar todas) e exporte para JSON; ⇪ Importar cria as notas a partir desse arquivo.' },
      { tipo: 'novidade', texto: 'Notas: excluir várias de uma vez pela seleção (vão para a lixeira).' },
      { tipo: 'novidade', texto: 'Notas: vista em cards (▣) quadrados do mesmo tamanho com prévia do conteúdo; clicar abre a nota em janela.' },
      { tipo: 'melhoria', texto: 'Notas: Copiar tudo, Duplicar e Editar ficam no topo da nota, sem precisar rolar até o fim.' },
      { tipo: 'novidade', texto: 'Início: painel "Fazendo agora" com cronômetro ao vivo e botões para pausar, concluir (card pede o trabalho executado) ou iniciar as próximas.' },
      { tipo: 'novidade', texto: 'Início: prazos da semana em mini-agenda de seg a sex, com atrasadas e próxima semana.' },
      { tipo: 'novidade', texto: 'Início: progresso dos checklists das tarefas abertas.' },
      { tipo: 'novidade', texto: 'Início: sequência de dias úteis com card (e recorde), média por dia útil e projeção do mês.' },
      { tipo: 'novidade', texto: 'Início: top 5 de sistemas e linguagens no mês ou no ano.' },
      { tipo: 'novidade', texto: 'Início: campo "Nova tarefa" direto na tela. Aceita !urgente/!alta/!baixa e prazo dd/mm (também no Adicionar rápido das Tarefas).' },
      { tipo: 'novidade', texto: 'Início: ferramentas usadas recentemente e notas editadas recentemente.' },
      { tipo: 'novidade', texto: 'Início: issues atribuídas a você que saíram das tarefas, com botão para trazer de volta.' },
      { tipo: 'novidade', texto: 'Início: saudação com aviso de daily no dia, atrasadas e atalho para as novidades.' },
      { tipo: 'novidade', texto: 'Início: ⚙ Organizar para ordenar, trocar de coluna e esconder os painéis.' },
    ],
  },
  {
    versao: '1.0.25',
    data: '2026-11-11',
    itens: [
      { tipo: 'novidade', texto: 'Notas, Histórico e Tarefas com troca de visualização: mural/tabela/quadro, lista com prévia embaixo ou lista com prévia ao lado. A escolha fica salva.' },
      { tipo: 'novidade', texto: 'Notas em Markdown formatado (títulos, listas, checklist, código, links) com o botão M↓; Aa volta ao texto normal. Clicar no bloco continua copiando o texto cru.' },
      { tipo: 'novidade', texto: 'Histórico em lista: um mês por vez com ‹ › para trocar (pula meses vazios e vira o ano), cards separados por semana. Teclado: ←/→ troca o mês, ↑/↓ o card.' },
      { tipo: 'melhoria', texto: 'Tarefas em lista: tarefas agrupadas por status com prazo e prioridade; na prévia, troca de status por botões, sem arrastar.' },
      { tipo: 'melhoria', texto: 'As novidades do devTools aparecem também no "O que há de novo" do git-calm.' },
      { tipo: 'novidade', texto: 'Ctrl+K em qualquer tela: busca um bloco de qualquer nota pelo título, rótulo ou conteúdo e copia (Shift+Enter abre a nota).' },
      { tipo: 'novidade', texto: 'Notas com tags: filtro por tag no topo e sugestão das tags já usadas.' },
      { tipo: 'novidade', texto: 'Bloco SQL nas notas: destaque de sintaxe, :parametro e {{variavel}} marcados, e botão para formatar.' },
      { tipo: 'novidade', texto: 'Lixeira de notas: nota excluída fica 7 dias para restaurar.' },
      { tipo: 'novidade', texto: 'Duplicar nota e bloco.' },
      { tipo: 'novidade', texto: 'Tarefas: campos do Tiflux (cliente, técnico, banco, versão, inscrição, link) em destaque na tarefa e link direto para o ticket.' },
      { tipo: 'novidade', texto: 'Tarefas: ao concluir um card, pede o "trabalho executado", que vira o obs ao registrar no Histórico.' },
      { tipo: 'novidade', texto: 'Tarefas: checklist na tarefa, com progresso no quadro e marcação direto na prévia.' },
      { tipo: 'novidade', texto: 'Tarefas: tempo em "Fazendo" contado sozinho ao mover a tarefa.' },
      { tipo: 'novidade', texto: 'Tarefas: tarefa de ajuda com a pessoa ajudada e contagem de ajudas no mês.' },
      { tipo: 'melhoria', texto: 'Notas: título passa a ser obrigatório para salvar.' },
      { tipo: 'melhoria', texto: 'Labels de área (Arrecadação, Finanças, Suprimentos, Administração/RH) já vêm mapeadas para o campo Área.' },
      { tipo: 'novidade', texto: 'Tarefas: tipo Tarefa, para o que não é card, ajuda nem verificação.' },
      { tipo: 'melhoria', texto: 'Novidades: só a versão mais recente vem aberta; as anteriores ficam recolhidas, clique para expandir.' },
      { tipo: 'novidade', texto: 'Novidades abrem sozinhas no primeiro acesso do dia.' },
      { tipo: 'correcao', texto: 'Notificações do navegador: pedido de permissão repete até ser respondido, permissão liberada no cadeado vale sem recarregar e botão Testar em Dados.' },
    ],
  },
  {
    versao: '1.0.24',
    data: '2026-11-10',
    itens: [
      { tipo: 'novidade', texto: 'Notificação do navegador quando uma issue entra nas tarefas ou um card é registrado no histórico; clique abre a tela. Liga/desliga em Dados.' },
      { tipo: 'melhoria', texto: 'Dentro do git-calm as notificações são exibidas por ele.' },
      { tipo: 'correcao', texto: 'Texto de imagem: prévia da foto agora aparece no celular.' },
    ],
  },
  {
    versao: '1.0.23',
    data: '2026-11-10',
    itens: [
      { tipo: 'novidade', texto: 'Limpar texto colado: mostra e tira caracteres invisíveis, aspas curvas e travessões que quebram SQL e PHP.' },
      { tipo: 'novidade', texto: 'Extrair do texto: CPF, CNPJ, e-mail, URL, telefone, CEP, data, IP e números de qualquer texto.' },
      { tipo: 'novidade', texto: 'Anonimizar (LGPD): mascara documentos, e-mails, senhas e nomes antes de colar log ou SQL na issue.' },
      { tipo: 'novidade', texto: 'Leitor de log: filtra log do PHP, Apache e PostgreSQL por nível, texto e período e agrupa erros repetidos.' },
      { tipo: 'novidade', texto: 'Juros, multa e correção: calcula os acréscimos de um débito em atraso com multa fixa ou diária e juros por mês, fração ou dia.' },
      { tipo: 'novidade', texto: 'SELECT → UPDATE/DELETE: gera o comando com o mesmo filtro dentro de BEGIN/ROLLBACK, com contagem e backup.' },
      { tipo: 'novidade', texto: 'Gerador de DDL: cria o CREATE TABLE e o INSERT a partir de planilha ou grid colado, com os tipos inferidos.' },
      { tipo: 'novidade', texto: 'Diagnóstico PG: consultas prontas para sessões, bloqueios, queries lentas, tamanho, vacuum e sequences.' },
    ],
  },
  {
    versao: '1.0.22',
    data: '2026-11-09',
    itens: [
      { tipo: 'novidade', texto: 'Notas com tabela: linhas e colunas como planilha, clique na célula para copiar.' },
      { tipo: 'novidade', texto: 'Colar do Excel na tabela preenche várias células; "⧉ tabela" copia tudo pronto para colar no Excel.' },
      { tipo: 'novidade', texto: 'Ferramenta Entidades HTML: converte acentos e símbolos em entidades (ã → &atilde;) e volta para texto.' },
      { tipo: 'novidade', texto: 'Novidades de cada versão nesta janela. Clique no número da versão no topo para rever.' },
    ],
  },
];

const CHAVE = 'devtools:novidades';
const CHAVE_DIA = 'devtools:novidades-dia';
const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const ler = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const hojeLocal = () => new Date().toLocaleDateString('sv');

// versão nova: só as não vistas; senão, no primeiro acesso do dia, todas
export function pendentes(atual: string): Versao[] {
  const visto = ler(CHAVE);
  if (visto !== atual) return NOVIDADES.filter((v) => cmp(v.versao, atual) <= 0 && (visto ? cmp(v.versao, visto) > 0 : v.versao === atual));
  return ler(CHAVE_DIA) === hojeLocal() ? [] : NOVIDADES.filter((v) => cmp(v.versao, atual) <= 0);
}

export function marcarVisto(atual: string) {
  try {
    localStorage.setItem(CHAVE, atual);
    localStorage.setItem(CHAVE_DIA, hojeLocal());
  } catch {}
}
