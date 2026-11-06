import type { Worker } from 'tesseract.js';

// worker e modelos (por+eng) baixados do CDN no primeiro uso, depois ficam em cache
let worker: Promise<Worker> | null = null;
let progresso: (p: number) => void = () => {};

function carregar() {
  // CommonJS: no build de produção as exportações vêm em default
  return (worker ??= import('tesseract.js').then((m) =>
    (m.default ?? m).createWorker(['por', 'eng'], 1, {
      logger: (l) => l.status === 'recognizing text' && progresso(l.progress),
    }),
  ).catch((e) => {
    // falhou (rede, CDN): tenta de novo na próxima imagem
    worker = null;
    throw e;
  }));
}

// print de tela tem pouca resolução; ampliar melhora bastante o reconhecimento
async function ampliar(img: Blob): Promise<Blob | HTMLCanvasElement> {
  const bmp = await createImageBitmap(img);
  const f = bmp.width < 1600 ? 2 : 1;
  if (f === 1) return img;
  const c = document.createElement('canvas');
  c.width = bmp.width * f;
  c.height = bmp.height * f;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

export async function lerTexto(img: Blob, aoProgredir: (p: number) => void = () => {}): Promise<string> {
  const [w, entrada] = await Promise.all([carregar(), ampliar(img)]);
  progresso = aoProgredir;
  const { data } = await w.recognize(entrada);
  return data.text.replace(/\n{3,}/g, '\n\n').trim();
}
