import { VERSAO } from '../versao';

// sem dependências: o topo usa para o aviso de novidade sem carregar as ferramentas
export interface Ferramenta {
  id: string;
  grupo: string;
  nome: string;
  icone: string;
  desc: string;
  // versão em que entrou; mostra "novo" no menu
  desde?: string;
}

export const FERRAMENTAS: Ferramenta[] = [
  { id: 'gerador', grupo: 'Documentos', nome: 'Gerador', icone: '✦', desc: 'CPF, CNPJ, CNPJ alfanumérico e RG válidos, um a um ou em lote. Clique no valor para copiar.' },
  { id: 'validador', grupo: 'Documentos', nome: 'Validador', icone: '✓', desc: 'Cole um ou vários documentos (um por linha). O tipo é detectado pelo tamanho.' },
  { id: 'mascara', grupo: 'Documentos', nome: 'Máscara', icone: '.-/', desc: 'Põe ou tira a máscara de CPF, CNPJ, RG e CEP em lote.' },
  { id: 'fake', grupo: 'Documentos', nome: 'Dados fake', icone: '☺', desc: 'Pessoa ou empresa fictícia com documentos válidos e endereço, um a um ou em lote (JSON, CSV, INSERT).' },
  { id: 'cep', grupo: 'Documentos', nome: 'CEP', icone: 'cep', desc: 'Busca endereço pelo CEP ou CEP pelo endereço, com código IBGE do município.' },
  { id: 'extenso', grupo: 'Arrecadação', nome: 'Valor por extenso', icone: 'R$', desc: 'Escreve valores em reais ou números por extenso, um por linha, para certidão, guia e recibo.', desde: '1.0.21' },
  { id: 'boleto', grupo: 'Arrecadação', nome: 'Boleto e guia', icone: '|||', desc: 'Converte linha digitável ↔ código de barras e confere os dígitos verificadores.' },
  { id: 'pix', grupo: 'Arrecadação', nome: 'Pix copia e cola', icone: 'px', desc: 'Lê um código Pix (chave, valor, TXID, CRC) ou gera um Pix estático.' },
  { id: 'datas', grupo: 'Datas', nome: 'Cálculo de datas', icone: '±d', desc: 'Diferença entre datas e soma de dias corridos ou úteis.' },
  { id: 'cron', grupo: 'Datas', nome: 'Cron', icone: '⏱', desc: 'Explica uma expressão cron e mostra as próximas execuções.' },
  { id: 'tempo', grupo: 'Datas', nome: 'Timestamp', icone: 'ts', desc: 'Converte Unix (s/ms), data/hora e TDateTime do Delphi.' },
  { id: 'sqlfmt', grupo: 'SQL', nome: 'Formatador SQL', icone: '≡', desc: 'Indenta e padroniza a caixa das palavras-chave, ou compacta em uma linha.' },
  { id: 'sql', grupo: 'SQL', nome: 'Lista para SQL', icone: 'IN', desc: 'Cole uma coluna (ou várias, do Excel) e gere IN, VALUES ou UNION.' },
  { id: 'conversor', grupo: 'SQL', nome: 'CSV ↔ JSON ↔ INSERT', icone: '⇄', desc: 'Converte CSV (ou planilha colada) e JSON entre si e gera INSERTs.' },
  { id: 'pgbusca', grupo: 'SQL', nome: 'Buscar no banco (PG)', icone: '⌕', desc: 'Monta o SQL para achar tabela, campo, proc/função ou dado no PostgreSQL pelo nome, com o select pronto de cada resultado.', desde: '1.0.20' },
  { id: 'builder', grupo: 'SQL', nome: 'Zend/Arel → SQL', icone: '→Q', desc: 'Converte o encadeamento do Zend_Db_Select (PHP) ou do Arel (Ruby) no SQL que ele gera.', desde: '1.0.20' },
  { id: 'sqlstr', grupo: 'SQL', nome: 'SQL ↔ string', icone: '\'\'', desc: 'Põe o SQL em string do Delphi (SQL.Add ou concatenação), PHP ou Ruby, ou tira o SQL do código colado.', desde: '1.0.21' },
  { id: 'explain', grupo: 'SQL', nome: 'Leitor de EXPLAIN', icone: 'EX', desc: 'Lê o EXPLAIN (ANALYZE) do PostgreSQL em texto ou JSON: tempo por nó, estimativa errada, seq scan e sort em disco.', desde: '1.0.21' },
  { id: 'grade', grupo: 'SQL', nome: 'Grid → tabela', icone: '▦', desc: 'Cole o resultado de uma consulta e gere tabela em Markdown, ASCII, texto alinhado ou HTML.' },
  { id: 'diff', grupo: 'Texto', nome: 'Comparar textos', icone: '±', desc: 'Diferença linha a linha entre dois textos, com cor para o que saiu (antes) e o que entrou (depois).' },
  { id: 'arrayjson', grupo: 'Texto', nome: 'Array → JSON', icone: '[]', desc: 'Converte array do PHP (literal, print_r, var_dump, var_export), hash do Ruby ou objeto JS em JSON.', desde: '1.0.20' },
  { id: 'regex', grupo: 'Texto', nome: 'Regex', icone: '.*', desc: 'Testa expressão regular: destaca ocorrências, mostra grupos e faz substituição.' },
  { id: 'formatador', grupo: 'Texto', nome: 'Formatador', icone: '{}', desc: 'Formata, compacta e valida JSON e XML.' },
  { id: 'lote', grupo: 'Texto', nome: 'Lote de texto', icone: '¶', desc: 'Insere texto ou numeração em cada linha e localiza/substitui vários termos de uma vez, sem regex.' },
  { id: 'caixa', grupo: 'Texto', nome: 'Caixa e nomes', icone: 'Aa', desc: 'camelCase, snake_case, CONSTANTE, kebab-case, Título, sem acentos e outros.' },
  { id: 'ocr', grupo: 'Texto', nome: 'Texto de imagem', icone: 'T▣', desc: 'Extrai o texto de um print ou imagem (OCR) para copiar e filtra as linhas por palavra. Cole com Ctrl+V, arraste ou escolha o arquivo.' },
  { id: 'contador', grupo: 'Texto', nome: 'Contador', icone: '123', desc: 'Caracteres, bytes, palavras e linhas; aponta linhas que passam do limite do campo.' },
  { id: 'encoding', grupo: 'Codificação', nome: 'Encoding', icone: 'Ã', desc: 'Corrige acentuação quebrada entre UTF-8 e Latin1 (Ã§ → ç) e mostra os bytes de cada caractere.' },
  { id: 'base64', grupo: 'Codificação', nome: 'Base64', icone: '64', desc: 'Base64 simples ou 5x invertido (encode5t / decode5t).' },
  { id: 'jwt', grupo: 'Codificação', nome: 'JWT', icone: 'jw', desc: 'Lê header e payload de um token. Não verifica a assinatura.' },
  { id: 'hash', grupo: 'Codificação', nome: 'Hash', icone: '#', desc: 'MD5, SHA-1, SHA-256 e SHA-512 do texto.' },
  { id: 'senha', grupo: 'Codificação', nome: 'Senha', icone: '***', desc: 'Senhas fortes com tamanho e caracteres configuráveis, e UUID v4.' },
];

const num = (v: string) => v.split('.').reduce((a, p) => a * 1000 + +p, 0);

// "novo" até ser aberta ou passar 2 versões da que entrou
export const ehNova = (f: Ferramenta, vistas: string[] = []) =>
  !!f.desde && !vistas.includes(f.id) && num(VERSAO.numero) - num(f.desde) <= 2;
