export const IDIOMAS: [string, string][] = [
  ['pt', 'Português'],
  ['en', 'Inglês'],
  ['es', 'Espanhol'],
  ['fr', 'Francês'],
  ['it', 'Italiano'],
  ['de', 'Alemão'],
];

const decodificar = (s: string) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent ?? s;

// tradutor embutido do Chrome (local, sem enviar o texto)
async function local(texto: string, de: string, para: string): Promise<string | null> {
  const g = globalThis as any;
  try {
    if (!g.Translator) return null;
    if (de === 'auto') {
      if (!g.LanguageDetector) return null;
      const [melhor] = await (await g.LanguageDetector.create()).detect(texto);
      de = melhor?.detectedLanguage?.split('-')[0];
      if (!de || de === para) return de === para ? texto : null;
    }
    if ((await g.Translator.availability({ sourceLanguage: de, targetLanguage: para })) === 'unavailable') return null;
    const t = await g.Translator.create({ sourceLanguage: de, targetLanguage: para });
    return await t.translate(texto);
  } catch {
    return null;
  }
}

// MyMemory: até 500 bytes por pedido, então vai em pedaços
function pedacos(texto: string) {
  const res: string[] = [];
  for (const parte of texto.split(/(\n+)/)) {
    if (!parte.trim() || /^\n+$/.test(parte) || parte.length <= 400) {
      res.push(parte);
      continue;
    }
    let atual = '';
    for (const frase of parte.split(/(?<=[.!?;])\s+/)) {
      for (let f = frase; f; f = f.slice(400)) {
        const p = f.slice(0, 400);
        if (atual && atual.length + p.length + 1 > 400) res.push(atual + ' '), (atual = '');
        atual += (atual ? ' ' : '') + p;
      }
    }
    if (atual) res.push(atual);
  }
  return res;
}

async function mymemory(texto: string, de: string, para: string) {
  const par = `${de === 'auto' ? 'Autodetect' : de}|${para}`;
  const out: string[] = [];
  for (const p of pedacos(texto)) {
    if (!p.trim()) {
      out.push(p);
      continue;
    }
    const r = await fetch(`https://api.mymemory.translated.net/get?langpair=${encodeURIComponent(par)}&q=${encodeURIComponent(p.trim())}`);
    if (!r.ok) throw new Error(`MyMemory respondeu ${r.status}.`);
    const j = await r.json();
    if (j.quotaFinished) throw new Error('Cota diária grátis da MyMemory acabou.');
    if (+j.responseStatus !== 200) throw new Error(j.responseDetails || 'Falha na tradução.');
    out.push(decodificar(j.responseData.translatedText) + (p.endsWith(' ') ? ' ' : ''));
  }
  return out.join('');
}

export async function traduzir(texto: string, de: string, para: string) {
  const l = await local(texto, de, para);
  if (l !== null) return { texto: l, motor: 'Chrome (local)' };
  return { texto: await mymemory(texto, de, para), motor: 'MyMemory' };
}
