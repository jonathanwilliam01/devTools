const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string) {
  const codigos: string[] = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => `\x00${codigos.push(c) - 1}\x00`);
  s = s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, '<mark>{{$1}}</mark>');
  return s.replace(/\x00(\d+)\x00/g, (_, i) => `<code>${codigos[+i]}</code>`);
}

// markdown simples: títulos, listas, citação, código, links, negrito/itálico
export function markdown(txt: string): string {
  const out: string[] = [];
  const linhas = txt.replace(/\r/g, '').split('\n');
  let par: string[] = [];
  let lista = null as { tag: string; itens: string[] } | null;
  const fechar = () => {
    if (par.length) out.push(`<p>${par.map(inline).join('<br>')}</p>`);
    if (lista) out.push(`<${lista.tag}>${lista.itens.map((i) => `<li>${i}</li>`).join('')}</${lista.tag}>`);
    par = [];
    lista = null;
  };

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    let m: RegExpMatchArray | null;
    if (l.startsWith('```')) {
      fechar();
      const cod: string[] = [];
      while (++i < linhas.length && !linhas[i].startsWith('```')) cod.push(linhas[i]);
      out.push(`<pre><code>${esc(cod.join('\n'))}</code></pre>`);
    } else if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
      fechar();
      out.push(`<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) {
      fechar();
      out.push('<hr>');
    } else if ((m = l.match(/^>\s?(.*)/))) {
      fechar();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = l.match(/^\s*(?:([-*+])|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)/))) {
      const tag = m[1] ? 'ul' : 'ol';
      if (par.length || lista?.tag !== tag) fechar();
      lista ??= { tag, itens: [] };
      const chk = m[2] === undefined ? '' : m[2] === ' ' ? '☐ ' : '☑ ';
      lista.itens.push(chk + inline(m[3]));
    } else if (!l.trim()) {
      fechar();
    } else {
      if (lista) fechar();
      par.push(l);
    }
  }
  fechar();
  return out.join('');
}

export const temHtml = (s: string) => /<[a-z][^>]*>/i.test(s);
