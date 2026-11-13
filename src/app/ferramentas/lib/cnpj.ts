import { limpar, valido } from './docs';

// kitana.opencnpj.com: grátis, sem token, CORS liberado, 300 consultas/min
const URL_KITANA = 'https://kitana.opencnpj.com/cnpj/';

export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  dataSituacaoCadastral: string;
  motivoSituacaoCadastral: string | null;
  dataInicioAtividades: string;
  matriz: string;
  naturezaJuridica: string;
  capitalSocial: number;
  email: string | null;
  telefone: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  opcaoSimples: string;
  opcaoMei: string;
  situacaoEspecial: string | null;
  cnaes: { cnae: string; descricao: string }[];
  socios: { nomeSocio: string; descricao: string; cnpjCpfSocio: string; dataEntradaSociedade: string; faixaEtaria: string }[];
}

// CNPJs do texto, sem repetir; aceita com ou sem máscara
export function cnpjsDoTexto(texto: string): string[] {
  const achados = texto.toUpperCase().match(/[0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?\d{2}/g) ?? [];
  return [...new Set(achados.map(limpar))];
}

export const cnpjValido = (c: string) => valido('CNPJ', c);

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function consultarCnpj(cnpj: string, tentativas = 3): Promise<DadosCnpj> {
  const c = limpar(cnpj);
  if (!cnpjValido(c)) throw new Error('CNPJ inválido.');
  let r: Response;
  try {
    r = await fetch(URL_KITANA + c);
  } catch {
    throw new Error('Sem conexão com a kitana.');
  }
  if (r.status === 429 && tentativas > 1) {
    await espera(15000);
    return consultarCnpj(c, tentativas - 1);
  }
  if (r.status === 404) throw new Error('Não encontrado na Receita.');
  if (!r.ok) throw new Error(`kitana respondeu HTTP ${r.status}.`);
  const j = await r.json();
  if (!j.success || !j.data) throw new Error(j.message || 'Resposta sem dados.');
  return j.data;
}
