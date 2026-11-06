export interface OpcoesLinhas {
  antes: string;
  depois: string;
  numerar: boolean;
  inicio: number;
  passo: number;
  digitos: number;
  separador: string;
  pularVazias: boolean;
}

export interface Par {
  de: string;
  para: string;
}

export function inserirLinhas(texto: string, o: OpcoesLinhas) {
  let n = o.inicio;
  return texto
    .split(/\r?\n/)
    .map((l) => {
      if (o.pularVazias && !l.trim()) return l;
      let num = '';
      if (o.numerar) {
        num = String(n).padStart(o.digitos, '0') + o.separador;
        n += o.passo;
      }
      return num + o.antes + l + o.depois;
    })
    .join('\n');
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// aplica os pares em sequência, como vários Ctrl+H seguidos
export function substituir(texto: string, pares: Par[], o: { caixa: boolean; palavra: boolean }) {
  const contagem = pares.map((p) => {
    if (!p.de) return 0;
    const fonte = o.palavra ? `(?<![\\p{L}\\p{N}_])${escapar(p.de)}(?![\\p{L}\\p{N}_])` : escapar(p.de);
    let c = 0;
    texto = texto.replace(new RegExp(fonte, o.caixa ? 'gu' : 'giu'), () => (c++, p.para));
    return c;
  });
  return { texto, contagem, total: contagem.reduce((a, b) => a + b, 0) };
}
