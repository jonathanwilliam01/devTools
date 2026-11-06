import { valido } from './docs';

// BR Code (EMV MPM): blocos ID(2) + tamanho(2) + valor; CRC16-CCITT no campo 63
export interface CampoPix {
  id: string;
  nome: string;
  valor: string;
  filhos?: CampoPix[];
}

const NOMES: Record<string, string> = {
  '00': 'Versão do payload',
  '01': 'Iniciação',
  '26': 'Conta (Pix)',
  '52': 'Categoria (MCC)',
  '53': 'Moeda',
  '54': 'Valor',
  '58': 'País',
  '59': 'Recebedor',
  '60': 'Cidade',
  '61': 'CEP',
  '62': 'Dados adicionais',
  '63': 'CRC16',
  '80': 'Não usado',
};
const NOMES_26: Record<string, string> = { '00': 'GUI', '01': 'Chave', '02': 'Descrição', '25': 'URL (Pix dinâmico)' };
const NOMES_62: Record<string, string> = { '05': 'TXID' };

export function crc16(s: string) {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function blocos(s: string, nomes: Record<string, string>): CampoPix[] {
  const l: CampoPix[] = [];
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const tam = +s.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || isNaN(tam) || i + 4 + tam > s.length) throw new Error(`Bloco inválido na posição ${i}.`);
    const valor = s.slice(i + 4, i + 4 + tam);
    l.push({ id, nome: nomes[id] ?? (+id >= 26 && +id <= 51 ? 'Conta' : 'Campo'), valor });
    i += 4 + tam;
  }
  return l;
}

export function lerPix(codigo: string) {
  const s = codigo.trim().replace(/\r?\n/g, '');
  const campos = blocos(s, NOMES);
  for (const c of campos) {
    if (c.id === '26' || (+c.id >= 27 && +c.id <= 51)) c.filhos = blocos(c.valor, NOMES_26);
    if (c.id === '62') c.filhos = blocos(c.valor, NOMES_62);
  }
  const crc = campos.find((c) => c.id === '63')?.valor ?? '';
  const esperado = crc16(s.slice(0, s.length - 4));
  return { campos, crc, esperado, crcOk: crc.toUpperCase() === esperado, avisos: validar(campos) };
}

export function tipoChave(c: string) {
  if (/^\d{11}$/.test(c)) return valido('CPF', c) ? 'CPF' : 'CPF com DV inválido';
  if (/^[\dA-Z]{12}\d{2}$/.test(c)) return valido('CNPJ', c) ? 'CNPJ' : 'CNPJ com DV inválido';
  if (/^\+[1-9]\d{1,14}$/.test(c)) return c.startsWith('+55') && !/^\+55\d{10,11}$/.test(c) ? 'Telefone com tamanho inválido' : 'Telefone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return c.length > 77 ? 'E-mail com mais de 77 caracteres' : 'E-mail';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'Aleatória (EVP)';
  return '';
}

// regras do manual do BR Code que dá para conferir sem consultar o PSP
function validar(campos: CampoPix[]) {
  const a: string[] = [];
  const v = (id: string) => campos.find((c) => c.id === id)?.valor;
  for (const [id, nome] of [['00', 'versão'], ['52', 'MCC'], ['53', 'moeda'], ['58', 'país'], ['59', 'recebedor'], ['60', 'cidade'], ['62', 'dados adicionais'], ['63', 'CRC']])
    if (v(id) === undefined) a.push(`Campo ${id} (${nome}) obrigatório ausente.`);
  if (campos[0]?.id !== '00') a.push('O campo 00 deve ser o primeiro.');
  if (campos.at(-1)?.id !== '63') a.push('O campo 63 (CRC) deve ser o último.');
  if (v('00') !== undefined && v('00') !== '01') a.push(`Versão ${v('00')}, esperado 01.`);
  if (v('01') !== undefined && !['11', '12'].includes(v('01')!)) a.push(`Iniciação ${v('01')}, esperado 11 (estático) ou 12 (dinâmico).`);
  if (v('53') !== undefined && v('53') !== '986') a.push(`Moeda ${v('53')}, esperado 986 (Real).`);
  if (v('58') !== undefined && v('58') !== 'BR') a.push(`País ${v('58')}, esperado BR.`);
  if (v('54') !== undefined && !/^\d+(\.\d{1,2})?$/.test(v('54')!)) a.push(`Valor "${v('54')}" fora do formato (ponto decimal, até 2 casas).`);
  if ((v('59')?.length ?? 0) > 25) a.push('Recebedor (59) passa de 25 caracteres.');
  if ((v('60')?.length ?? 0) > 15) a.push('Cidade (60) passa de 15 caracteres.');

  const conta = campos.find((c) => c.filhos?.some((f) => f.id === '00' && f.valor.toLowerCase() === 'br.gov.bcb.pix'));
  if (!conta) a.push('Nenhum campo de conta (26 a 51) com GUI br.gov.bcb.pix.');
  else {
    const f = (id: string) => conta.filhos!.find((x) => x.id === id)?.valor;
    const chave = f('01');
    const url = f('25');
    if (chave && url) a.push('Conta tem chave (01) e URL (25) juntas: use só uma.');
    if (!chave && !url) a.push('Conta sem chave (01) nem URL (25).');
    if (chave && !tipoChave(chave)) a.push(`Chave "${chave}" não é CPF, CNPJ, e-mail, telefone (+55...) nem EVP.`);
    else if (chave && /inválido|mais de/.test(tipoChave(chave))) a.push(`Chave: ${tipoChave(chave)}.`);
    if (url && /^https?:\/\//i.test(url)) a.push('URL (25) não deve ter https://.');
    if (url && v('01') === '11') a.push('Pix dinâmico (URL) marcado como estático (01 = 11).');
  }
  const txid = campos.find((c) => c.id === '62')?.filhos?.find((x) => x.id === '05')?.valor;
  if (v('62') !== undefined && txid === undefined) a.push('Dados adicionais (62) sem TXID (05).');
  if (txid !== undefined && txid !== '***' && !/^[A-Za-z0-9]{1,25}$/.test(txid)) a.push(`TXID "${txid}" deve ter até 25 letras/números ou ser ***.`);
  return a;
}

export interface DadosPix {
  chave: string;
  nome: string;
  cidade: string;
  valor: string;
  txid: string;
  descricao: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const bloco = (id: string, v: string) => (v ? id + String(v.length).padStart(2, '0') + v : '');

export function gerarPix(d: DadosPix) {
  if (!d.chave.trim()) throw new Error('Informe a chave.');
  const conta = bloco('00', 'br.gov.bcb.pix') + bloco('01', d.chave.trim()) + bloco('02', d.descricao.trim());
  if (conta.length > 99) throw new Error('Chave + descrição passam de 99 caracteres.');
  const valor = d.valor.trim().replace(',', '.');
  if (valor && !/^\d+(\.\d{1,2})?$/.test(valor)) throw new Error('Valor inválido. Use até 2 casas decimais.');
  const txid = semAcento(d.txid.trim()).replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const s =
    bloco('00', '01') +
    bloco('26', conta) +
    bloco('52', '0000') +
    bloco('53', '986') +
    bloco('54', valor ? (+valor).toFixed(2) : '') +
    bloco('58', 'BR') +
    bloco('59', semAcento(d.nome.trim()).slice(0, 25) || 'N') +
    bloco('60', semAcento(d.cidade.trim()).slice(0, 15) || 'N') +
    bloco('62', bloco('05', txid)) +
    '6304';
  return s + crc16(s);
}
