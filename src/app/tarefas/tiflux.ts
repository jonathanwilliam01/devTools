import { Tarefa, chaveNome } from '../models';

export const TICKET_URL = (n: string) => `https://demandas.embras.net/v/tickets/${n}/basic_info`;

// rótulo exibido -> chaves aceitas (chaveNome, começo da chave)
const CAMPOS: [string, RegExp][] = [
  ['Cliente', /^CLIENTE/],
  ['Técnico', /^TECNICO/],
  ['Ambiente', /^(WEB OU DESK|DESK OU WEB|TIPO DE SISTEMA|AMBIENTE)/],
  ['Módulo', /^MODULO$/],
  ['Banco', /^BANCO/],
  ['Versão do cliente', /^VERSAO( DO CLIENTE| CLIENTE| DO MODULO NO CLIENTE)?$/],
  ['Versão recente', /^(VERSAO MAIS RECENTE|ULTIMA VERSAO)/],
  ['Inscrição', /INSCRICAO|^DOCUMENTO$/],
  ['Caminho', /^CAMINHO/],
  ['Link', /^LINK$/],
  ['Prazo legal', /PRAZO LEGAL/],
];

export interface CampoTiflux {
  rotulo: string;
  valor: string;
  partes: { t: string; url: boolean }[];
}

const partesUrl = (v: string) => v.split(/(https?:\/\/[^\s<>"]+)/).filter(Boolean).map((t) => ({ t, url: /^https?:\/\//.test(t) }));

// linhas "Chave: valor" da descrição (html do Tiflux ou texto)
export function camposTiflux(descricao: string): CampoTiflux[] {
  if (!descricao) return [];
  const html = descricao.replace(/<br\s*\/?>|<\/(div|p|li|h\d)>/gi, '\n');
  const texto = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  const achados = new Map<string, string>();
  for (const linha of texto.split('\n')) {
    const m = linha.replace(/ /g, ' ').match(/^\s*\*?\s*([^:]{3,50}?)\s*:\s*(.+?)\s*$/);
    if (!m || /^https?$/i.test(m[1])) continue;
    const chave = chaveNome(m[1]);
    const campo = CAMPOS.find(([, re]) => re.test(chave));
    const valor = m[2].replace(/\.$/, '').trim();
    if (campo && valor && !achados.has(campo[0])) achados.set(campo[0], valor);
  }
  return CAMPOS.filter(([r]) => achados.has(r)).map(([rotulo]) => {
    const valor = achados.get(rotulo)!;
    return { rotulo, valor, partes: partesUrl(valor) };
  });
}

// "367664 - ...", "RETORNO 365011 - ...", "#356582 - ..." ou "Ticket de origem: 366771" na descrição
export function ticketTarefa(t: Tarefa) {
  const m = t.titulo.match(/(?:^|[\s#])(\d{6})(?=\s|-|–|\)|$)/);
  if (m) return m[1];
  const d = t.descricao.replace(/<[^>]+>/g, ' ');
  return d.match(/(?:ticket de origem|ticket origem|SD)\s*:?\s*#?(\d{6})\b/i)?.[1] ?? d.match(/tickets\/(\d{6})/)?.[1] ?? d.match(/\b(\d{6})\s+[-–]\s/)?.[1] ?? null;
}
