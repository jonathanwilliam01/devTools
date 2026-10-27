import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Store } from './store';
import { diasEntre, hoje } from './models';
import { idbGet, idbSet } from './persist';

type Estado = 'indisponivel' | 'desligado' | 'ativo' | 'reativar';
// File System Access API ainda não está no lib.dom do TS
type Pasta = FileSystemDirectoryHandle & {
  queryPermission(o: object): Promise<PermissionState>;
  requestPermission(o: object): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemHandle>;
};

const MODO = { mode: 'readwrite' };
const MANTER_DIAS = 30;

// Backup automático (Chrome/Edge/Vivaldi): grava devtools-backup-AAAA-MM-DD.json numa pasta escolhida
@Injectable({ providedIn: 'root' })
export class Backup {
  private readonly store = inject(Store);
  private pasta: Pasta | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  readonly suportado = 'showDirectoryPicker' in window;
  readonly estado = signal<Estado>(this.suportado ? 'desligado' : 'indisponivel');
  readonly nomePasta = signal('');
  readonly ultimo = signal(lerUltimo());
  readonly dias = computed(() => {
    const u = this.ultimo();
    return u ? diasEntre(u.slice(0, 10), hoje()) : null;
  });
  readonly lembrete = computed(
    () => this.estado() !== 'ativo' && (this.dias() ?? 99) >= 7 && this.store.cards().length + this.store.notas().length > 0,
  );

  constructor() {
    this.iniciar();
    effect(() => {
      this.store.snapshot();
      if (this.estado() !== 'ativo') return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.gravar(), 10_000);
    });
  }

  private async iniciar() {
    if (!this.suportado) return;
    const p = await idbGet<Pasta>('pasta').catch(() => undefined);
    if (!p) return;
    this.pasta = p;
    this.nomePasta.set(p.name);
    if ((await p.queryPermission(MODO)) === 'granted') {
      this.estado.set('ativo');
      if (this.ultimo()?.slice(0, 10) !== hoje()) this.gravar();
    } else this.estado.set('reativar');
  }

  async escolherPasta() {
    try {
      const p = await (window as unknown as { showDirectoryPicker(o: object): Promise<Pasta> }).showDirectoryPicker({
        id: 'devtools-backup',
        ...MODO,
      });
      this.pasta = p;
      await idbSet('pasta', p);
      this.nomePasta.set(p.name);
      this.estado.set('ativo');
      await this.gravar();
    } catch {}
  }

  // permissão expira ao fechar o navegador; precisa de um clique para renovar
  async reativar() {
    if (this.pasta && (await this.pasta.requestPermission(MODO)) === 'granted') {
      this.estado.set('ativo');
      await this.gravar();
    }
  }

  async desligar() {
    this.pasta = null;
    this.nomePasta.set('');
    await idbSet('pasta', undefined);
    this.estado.set('desligado');
  }

  async gravar() {
    if (!this.pasta) return;
    try {
      const arq = await this.pasta.getFileHandle(`devtools-backup-${hoje()}.json`, { create: true });
      const w = await arq.createWritable();
      await w.write(JSON.stringify(this.store.snapshot(), null, 2));
      await w.close();
      this.marcar();
      await this.limparAntigos();
    } catch {
      this.estado.set('reativar');
    }
  }

  marcar() {
    const agora = new Date().toLocaleString('sv-SE');
    this.ultimo.set(agora);
    try {
      localStorage.setItem('devtools:backup', agora);
    } catch {}
  }

  private async limparAntigos() {
    for await (const h of this.pasta!.values()) {
      const m = h.name.match(/^devtools-backup-(\d{4}-\d{2}-\d{2})\.json$/);
      if (m && diasEntre(m[1], hoje()) > MANTER_DIAS) await this.pasta!.removeEntry(h.name);
    }
  }
}

function lerUltimo() {
  try {
    return localStorage.getItem('devtools:backup');
  } catch {
    return null;
  }
}
