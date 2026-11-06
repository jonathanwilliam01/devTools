// QR Code e código de barras (ITF do boleto) a partir de imagem; wasm carregado só no primeiro uso
let pronto: Promise<typeof import('zxing-wasm/reader')> | null = null;

function carregar() {
  return (pronto ??= import('zxing-wasm/reader').then((z) => {
    z.prepareZXingModule({
      overrides: { locateFile: (arq: string, prefixo: string) => (arq.endsWith('.wasm') ? new URL('zxing/' + arq, document.baseURI).href : prefixo + arq) },
    });
    return z;
  }));
}

export async function lerImagem(img: Blob): Promise<string[]> {
  const z = await carregar();
  const r = await z.readBarcodes(img, { formats: ['QRCode', 'ITF'], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 4 });
  return [...new Set(r.filter((x) => x.isValid && x.text).map((x) => x.text))];
}

export function imagemDe(dt: DataTransfer | null): Blob | null {
  return [...(dt?.files ?? [])].find((f) => f.type.startsWith('image/')) ?? null;
}
