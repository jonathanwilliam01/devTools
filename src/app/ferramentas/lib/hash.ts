const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);
const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

// WebCrypto não tem MD5
export function md5(bytes: Uint8Array) {
  const len = bytes.length;
  const n = (((len + 8) >> 6) + 1) * 16;
  const w = new Int32Array(n);
  bytes.forEach((b, i) => (w[i >> 2] |= b << ((i % 4) * 8)));
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[n - 2] = len * 8;
  w[n - 1] = Math.floor(len / 0x20000000);
  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];
  for (let o = 0; o < n; o += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      const f = r === 0 ? (b & c) | (~b & d) : r === 1 ? (d & b) | (~d & c) : r === 2 ? b ^ c ^ d : c ^ (b | ~d);
      const g = r === 0 ? i : r === 1 ? (5 * i + 1) % 16 : r === 2 ? (3 * i + 5) % 16 : (7 * i) % 16;
      const x = (a + f + K[i] + w[o + g]) | 0;
      const s = S[r * 4 + (i % 4)];
      [a, d, c, b] = [d, c, b, (b + ((x << s) | (x >>> (32 - s)))) | 0];
    }
    [a0, b0, c0, d0] = [(a0 + a) | 0, (b0 + b) | 0, (c0 + c) | 0, (d0 + d) | 0];
  }
  return [a0, b0, c0, d0].map((v) => Array.from({ length: 4 }, (_, i) => ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export async function hashes(bytes: Uint8Array) {
  const sha = async (alg: string) => hex(await crypto.subtle.digest(alg, bytes as BufferSource));
  return [
    ['MD5', md5(bytes)],
    ['SHA-1', await sha('SHA-1')],
    ['SHA-256', await sha('SHA-256')],
    ['SHA-512', await sha('SHA-512')],
  ] as [string, string][];
}
