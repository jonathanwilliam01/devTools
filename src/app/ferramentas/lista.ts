import { detectar } from './lib/detectar';
import { limpar, preencher } from './lib/estado';

export interface Ferramenta {
  id: string;
  grupo: string;
  nome: string;
  icone: string;
  desc: string;
}

export const FERRAMENTAS: Ferramenta[] = [
  { id: 'gerador', grupo: 'Documentos', nome: 'Gerador', icone: '✦', desc: 'CPF, CNPJ, CNPJ alfanumérico e RG válidos, um a um ou em lote. Clique no valor para copiar.' },
  { id: 'validador', grupo: 'Documentos', nome: 'Validador', icone: '✓', desc: 'Cole um ou vários documentos (um por linha). O tipo é detectado pelo tamanho.' },
  { id: 'mascara', grupo: 'Documentos', nome: 'Máscara', icone: '.-/', desc: 'Põe ou tira a máscara de CPF, CNPJ, RG e CEP em lote.' },
  { id: 'fake', grupo: 'Documentos', nome: 'Dados fake', icone: '☺', desc: 'Pessoa ou empresa fictícia com documentos válidos e endereço, um a um ou em lote (JSON, CSV, INSERT).' },
  { id: 'cep', grupo: 'Documentos', nome: 'CEP', icone: 'cep', desc: 'Busca endereço pelo CEP ou CEP pelo endereço, com código IBGE do município.' },
  { id: 'boleto', grupo: 'Arrecadação', nome: 'Boleto e guia', icone: '|||', desc: 'Converte linha digitável ↔ código de barras e confere os dígitos verificadores.' },
  { id: 'pix', grupo: 'Arrecadação', nome: 'Pix copia e cola', icone: 'px', desc: 'Lê um código Pix (chave, valor, TXID, CRC) ou gera um Pix estático.' },
  { id: 'datas', grupo: 'Datas', nome: 'Cálculo de datas', icone: '±d', desc: 'Diferença entre datas e soma de dias corridos ou úteis.' },
  { id: 'cron', grupo: 'Datas', nome: 'Cron', icone: '⏱', desc: 'Explica uma expressão cron e mostra as próximas execuções.' },
  { id: 'tempo', grupo: 'Datas', nome: 'Timestamp', icone: 'ts', desc: 'Converte Unix (s/ms), data/hora e TDateTime do Delphi.' },
  { id: 'sqlfmt', grupo: 'SQL', nome: 'Formatador SQL', icone: '≡', desc: 'Indenta e padroniza a caixa das palavras-chave, ou compacta em uma linha.' },
  { id: 'sql', grupo: 'SQL', nome: 'Lista para SQL', icone: 'IN', desc: 'Cole uma coluna (ou várias, do Excel) e gere IN, VALUES ou UNION.' },
  { id: 'conversor', grupo: 'SQL', nome: 'CSV ↔ JSON ↔ INSERT', icone: '⇄', desc: 'Converte CSV (ou planilha colada) e JSON entre si e gera INSERTs.' },
  { id: 'grade', grupo: 'SQL', nome: 'Grid → tabela', icone: '▦', desc: 'Cole o resultado de uma consulta e gere tabela em Markdown, ASCII, texto alinhado ou HTML.' },
  { id: 'diff', grupo: 'Texto', nome: 'Comparar textos', icone: '±', desc: 'Diferença linha a linha entre dois textos.' },
  { id: 'regex', grupo: 'Texto', nome: 'Regex', icone: '.*', desc: 'Testa expressão regular: destaca ocorrências, mostra grupos e faz substituição.' },
  { id: 'formatador', grupo: 'Texto', nome: 'Formatador', icone: '{}', desc: 'Formata, compacta e valida JSON e XML.' },
  { id: 'lote', grupo: 'Texto', nome: 'Lote de texto', icone: '¶', desc: 'Insere texto ou numeração em cada linha e localiza/substitui vários termos de uma vez, sem regex.' },
  { id: 'caixa', grupo: 'Texto', nome: 'Caixa e nomes', icone: 'Aa', desc: 'camelCase, snake_case, CONSTANTE, kebab-case, Título, sem acentos e outros.' },
  { id: 'ocr', grupo: 'Texto', nome: 'Texto de imagem', icone: 'T▣', desc: 'Extrai o texto de um print ou imagem (OCR) para copiar. Cole com Ctrl+V, arraste ou escolha o arquivo.' },
  { id: 'contador', grupo: 'Texto', nome: 'Contador', icone: '123', desc: 'Caracteres, bytes, palavras e linhas; aponta linhas que passam do limite do campo.' },
  { id: 'encoding', grupo: 'Codificação', nome: 'Encoding', icone: 'Ã', desc: 'Corrige acentuação quebrada entre UTF-8 e Latin1 (Ã§ → ç) e mostra os bytes de cada caractere.' },
  { id: 'base64', grupo: 'Codificação', nome: 'Base64', icone: '64', desc: 'Base64 simples ou 5x invertido (encode5t / decode5t).' },
  { id: 'jwt', grupo: 'Codificação', nome: 'JWT', icone: 'jw', desc: 'Lê header e payload de um token. Não verifica a assinatura.' },
  { id: 'hash', grupo: 'Codificação', nome: 'Hash', icone: '#', desc: 'MD5, SHA-1, SHA-256 e SHA-512 do texto.' },
  { id: 'senha', grupo: 'Codificação', nome: 'Senha', icone: '***', desc: 'Senhas fortes com tamanho e caracteres configuráveis, e UUID v4.' },
];

// reconhece o colado, deixa os campos da ferramenta preenchidos e diz qual abrir
export function prepararColado(texto: string) {
  const d = detectar(texto);
  const f = d && FERRAMENTAS.find((x) => x.id === d.id);
  if (!f) return null;
  limpar(f.id);
  preencher(f.id, d.campos);
  return f;
}
