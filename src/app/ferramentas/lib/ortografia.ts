export interface Erro {
  inicio: number;
  fim: number;
  trecho: string;
  msg: string;
  sugestoes: string[];
  tipo: 'ortografia' | 'gramatica' | 'estilo';
}

// LanguageTool público: 20 req/min e 20 KB por texto
export async function verificar(texto: string, idioma = 'pt-BR'): Promise<Erro[]> {
  const r = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ text: texto, language: idioma }),
  });
  if (r.status === 429) throw new Error('Limite do LanguageTool atingido. Aguarde um minuto.');
  if (r.status === 413) throw new Error('Texto grande demais (máx. 20 KB).');
  if (!r.ok) throw new Error(`LanguageTool respondeu ${r.status}.`);
  const j = await r.json();
  return j.matches.map((m: any) => ({
    inicio: m.offset,
    fim: m.offset + m.length,
    trecho: texto.slice(m.offset, m.offset + m.length),
    msg: m.message,
    sugestoes: m.replacements.slice(0, 5).map((x: any) => x.value),
    tipo: m.rule.issueType === 'misspelling' ? 'ortografia' : m.rule.issueType === 'style' ? 'estilo' : 'gramatica',
  }));
}

// troca um trecho e desloca os erros seguintes
export function aplicar(texto: string, erros: Erro[], e: Erro, troca: string) {
  const delta = troca.length - (e.fim - e.inicio);
  return {
    texto: texto.slice(0, e.inicio) + troca + texto.slice(e.fim),
    erros: erros
      .filter((x) => x !== e && (x.fim <= e.inicio || x.inicio >= e.fim))
      .map((x) => (x.inicio >= e.fim ? { ...x, inicio: x.inicio + delta, fim: x.fim + delta } : x)),
  };
}
