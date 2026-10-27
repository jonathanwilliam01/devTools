import { Injectable, computed, inject, signal } from '@angular/core';
import { Store } from './store';
import { Nota } from './models';
import { deB64, paraB64 } from './persist';

const ITERACOES = 310_000;
const TESTE = 'devtools-ok';

// Senha mestra: blocos secretos são cifrados com AES-GCM (chave PBKDF2). A chave só fica em memória.
@Injectable({ providedIn: 'root' })
export class Cofre {
  private readonly store = inject(Store);
  private readonly chave = signal<CryptoKey | null>(null);
  // conteúdo decifrado por id de bloco, enquanto desbloqueado
  readonly abertos = signal(new Map<string, string>());

  readonly ativo = computed(() => !!this.store.config().senha);
  readonly bloqueado = computed(() => this.ativo() && !this.chave());

  private timer?: ReturnType<typeof setTimeout>;

  async criar(senha: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const chave = await derivar(senha, salt);
    const verificador = await cifrar(chave, TESTE);
    this.store.config.update((c) => ({ ...c, senha: { salt: paraB64(salt), verificador } }));
    this.chave.set(chave);
    await this.cifrarPendentes();
    this.manterAberto();
  }

  async desbloquear(senha: string) {
    const cfg = this.store.config().senha;
    if (!cfg) return true;
    const chave = await derivar(senha, deB64(cfg.salt));
    try {
      if ((await decifrar(chave, cfg.verificador)) !== TESTE) return false;
    } catch {
      return false;
    }
    this.chave.set(chave);
    await this.cifrarPendentes();
    await this.abrirTodos();
    this.manterAberto();
    return true;
  }

  bloquear() {
    this.chave.set(null);
    this.abertos.set(new Map());
    clearTimeout(this.timer);
  }

  // bloqueia sozinho após 30 min sem uso
  manterAberto() {
    clearTimeout(this.timer);
    if (this.chave()) this.timer = setTimeout(() => this.bloquear(), 30 * 60_000);
  }

  async trocar(nova: string) {
    await this.removerSenha();
    await this.criar(nova);
  }

  // decifra tudo e volta para texto puro
  async removerSenha() {
    if (this.bloqueado()) return;
    await this.abrirTodos();
    const abertos = this.abertos();
    this.store.notas.update((l) =>
      l.map((n) => ({ ...n, blocos: n.blocos.map((b) => (abertos.has(b.id) ? { ...b, conteudo: abertos.get(b.id)! } : b)) })),
    );
    this.store.config.update((c) => ({ ...c, senha: null }));
    this.bloquear();
  }

  // valor legível de um bloco (null se bloqueado)
  ler(b: { id: string; conteudo: string }) {
    if (!b.conteudo.startsWith('enc:')) return b.conteudo;
    this.manterAberto();
    return this.abertos().get(b.id) ?? null;
  }

  // prepara nota para salvar: cifra blocos secretos se a senha estiver ativa
  async selar(n: Nota): Promise<Nota> {
    const chave = this.chave();
    if (!this.ativo() || !chave) return n;
    const abertos = new Map(this.abertos());
    const blocos = await Promise.all(
      n.blocos.map(async (b) => {
        if (!b.secreto) {
          abertos.delete(b.id);
          return b;
        }
        abertos.set(b.id, b.conteudo);
        return { ...b, conteudo: await cifrar(chave, b.conteudo) };
      }),
    );
    this.abertos.set(abertos);
    return { ...n, blocos };
  }

  // nota com conteúdo legível para edição
  abrirNota(n: Nota): Nota {
    return { ...structuredClone(n), blocos: n.blocos.map((b) => ({ ...b, conteudo: this.ler(b) ?? '' })) };
  }

  private async abrirTodos() {
    const chave = this.chave();
    if (!chave) return;
    const m = new Map<string, string>();
    for (const n of this.store.notas())
      for (const b of n.blocos)
        if (b.conteudo.startsWith('enc:')) {
          try {
            m.set(b.id, await decifrar(chave, b.conteudo));
          } catch {
            m.set(b.id, '⚠ não foi possível decifrar (outra senha?)');
          }
        }
    this.abertos.set(m);
  }

  // cifra secretos ainda em texto puro (ex.: vindos de importação)
  private async cifrarPendentes() {
    const chave = this.chave();
    if (!chave) return;
    const notas = await Promise.all(
      this.store.notas().map(async (n) => {
        if (!n.blocos.some((b) => b.secreto && !b.conteudo.startsWith('enc:'))) return n;
        const blocos = await Promise.all(
          n.blocos.map(async (b) =>
            b.secreto && !b.conteudo.startsWith('enc:') ? { ...b, conteudo: await cifrar(chave, b.conteudo) } : b,
          ),
        );
        return { ...n, blocos };
      }),
    );
    this.store.notas.set(notas);
    await this.abrirTodos();
  }
}

async function derivar(senha: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERACOES, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function cifrar(chave: CryptoKey, texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));
  return `enc:${paraB64(iv)}:${paraB64(new Uint8Array(dados))}`;
}

async function decifrar(chave: CryptoKey, valor: string) {
  const [, iv, dados] = valor.split(':');
  const r = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) as BufferSource }, chave, deB64(dados) as BufferSource);
  return new TextDecoder().decode(r);
}
