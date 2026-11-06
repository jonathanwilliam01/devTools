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
  return { campos, crc, esperado, crcOk: crc.toUpperCase() === esperado };
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
