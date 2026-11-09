import { detectar } from './lib/detectar';
import { limpar, preencher } from './lib/estado';
import { FERRAMENTAS } from './catalogo';

export { FERRAMENTAS, ehNova } from './catalogo';
export type { Ferramenta } from './catalogo';

// reconhece o colado, deixa os campos da ferramenta preenchidos e diz qual abrir
export function prepararColado(texto: string) {
  const d = detectar(texto);
  const f = d && FERRAMENTAS.find((x) => x.id === d.id);
  if (!f) return null;
  limpar(f.id);
  preencher(f.id, d.campos);
  return f;
}
