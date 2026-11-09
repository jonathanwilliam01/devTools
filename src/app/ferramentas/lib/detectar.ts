// reconhece o que foi colado e diz em qual ferramenta abrir
export interface Destino {
  id: string;
  campos: Record<string, unknown>;
}

const SQL = /^\s*(select|insert|update|delete|with|create|alter)\b/i;

export function detectar(bruto: string): Destino | null {
  const t = bruto.trim();
  if (!t) return null;
  const digitos = t.replace(/\D/g, '');
  const soNumeros = /^[\d\s.\-/]+$/.test(t);

  if (t.startsWith('000201')) return { id: 'pix', campos: { modo: 'ler', codigo: t } };
  if (/^eyJ[\w-]*\.[\w-]+\.[\w-]*$/.test(t)) return { id: 'jwt', campos: { token: t } };
  if (soNumeros && [44, 47, 48].includes(digitos.length)) return { id: 'boleto', campos: { modo: 'ler', entrada: t } };
  if (/^\d{5}-?\d{3}$/.test(t)) return { id: 'cep', campos: { cep: t } };
  if (/^\d{10}(\d{3})?$/.test(t)) return { id: 'tempo', campos: { entrada: t } };

  // um documento por linha (CPF, CNPJ, CNPJ alfanumérico)
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const doc = (l: string) => {
    const s = l.replace(/[.\-/\s]/g, '');
    return /^\d{11}$/.test(s) || /^[\dA-Z]{12}\d{2}$/i.test(s);
  };
  if (linhas.every(doc)) return { id: 'validador', campos: { texto: t } };

  if (/^(\S+\s+){4}\S+$/.test(t) && /^[\d*/,\-?LW#A-Z\s]+$/i.test(t) && /[*\d]/.test(t[0])) return { id: 'cron', campos: { expr: t } };
  if (/\(cost=\d[\d.]*\.\.\d|\(actual (time|rows)=|"Node Type"\s*:/.test(t)) return { id: 'explain', campos: { texto: t } };
  if (/SQL\s*\.\s*Add\s*\(|^\s*\$?\w+\s*[.:]?=\s*(<<<|<<~)?\s*['"]?\s*(select|insert|update|delete|with)\b/i.test(t))
    return { id: 'sqlstr', campos: { modo: 'extrair', codigo: t } };
  if (/^[[{]/.test(t)) {
    try {
      JSON.parse(t);
      return { id: 'formatador', campos: { texto: t } };
    } catch {}
  }
  if (/^<[?!\w]/.test(t)) return { id: 'formatador', campos: { texto: t } };
  if (SQL.test(t)) return { id: 'sqlfmt', campos: { texto: t } };
  if (/->\s*select\s*\(|\.project\s*\(|Arel::/.test(t)) return { id: 'builder', campos: { texto: t } };
  if (/^(Array\s*\(|array\s*\(|array\(\d+\) \{|\[\s*['"\w]+\s*=>|\{\s*:?\w+\s*=>)/.test(t)) return { id: 'arrayjson', campos: { texto: t } };
  return null;
}
