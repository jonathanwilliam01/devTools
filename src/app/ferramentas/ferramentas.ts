import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Gerador } from './tools/gerador';
import { Validador } from './tools/validador';
import { Mascara } from './tools/mascara';
import { Boleto } from './tools/boleto';
import { Datas } from './tools/datas';
import { Tempo } from './tools/tempo';
import { Sql } from './tools/sql';
import { Formatador } from './tools/formatador';
import { Base64 } from './tools/base64';
import { JwtTool } from './tools/jwt';
import { Hash } from './tools/hash';
import { Diff } from './tools/diff';
import { Conversor } from './tools/conversor';
import { Regex } from './tools/regex';
import { CronTool } from './tools/cron';

interface Ferramenta {
  id: string;
  grupo: string;
  nome: string;
  icone: string;
  desc: string;
}

const FERRAMENTAS: Ferramenta[] = [
  { id: 'gerador', grupo: 'Documentos', nome: 'Gerador', icone: '✦', desc: 'CPF, CNPJ, CNPJ alfanumérico e RG válidos, um a um ou em lote. Clique no valor para copiar.' },
  { id: 'validador', grupo: 'Documentos', nome: 'Validador', icone: '✓', desc: 'Cole um ou vários documentos (um por linha). O tipo é detectado pelo tamanho.' },
  { id: 'mascara', grupo: 'Documentos', nome: 'Máscara', icone: '.-/', desc: 'Põe ou tira a máscara de CPF, CNPJ, RG e CEP em lote.' },
  { id: 'boleto', grupo: 'Arrecadação', nome: 'Boleto e guia', icone: '|||', desc: 'Converte linha digitável ↔ código de barras e confere os dígitos verificadores.' },
  { id: 'datas', grupo: 'Datas', nome: 'Cálculo de datas', icone: '±d', desc: 'Diferença entre datas e soma de dias corridos ou úteis.' },
  { id: 'cron', grupo: 'Datas', nome: 'Cron', icone: '⏱', desc: 'Explica uma expressão cron e mostra as próximas execuções.' },
  { id: 'tempo', grupo: 'Datas', nome: 'Timestamp', icone: 'ts', desc: 'Converte Unix (s/ms), data/hora e TDateTime do Delphi.' },
  { id: 'sql', grupo: 'Texto', nome: 'Lista para SQL', icone: 'IN', desc: 'Cole uma coluna (ou várias, do Excel) e gere IN, VALUES ou UNION.' },
  { id: 'conversor', grupo: 'Texto', nome: 'CSV ↔ JSON ↔ INSERT', icone: '⇄', desc: 'Converte CSV (ou planilha colada) e JSON entre si e gera INSERTs.' },
  { id: 'diff', grupo: 'Texto', nome: 'Comparar textos', icone: '±', desc: 'Diferença linha a linha entre dois textos.' },
  { id: 'regex', grupo: 'Texto', nome: 'Regex', icone: '.*', desc: 'Testa expressão regular: destaca ocorrências, mostra grupos e faz substituição.' },
  { id: 'formatador', grupo: 'Texto', nome: 'Formatador', icone: '{}', desc: 'Formata, compacta e valida JSON e XML.' },
  { id: 'base64', grupo: 'Codificação', nome: 'Base64', icone: '64', desc: 'Base64 simples ou 5x invertido (encode5t / decode5t).' },
  { id: 'jwt', grupo: 'Codificação', nome: 'JWT', icone: 'jw', desc: 'Lê header e payload de um token. Não verifica a assinatura.' },
  { id: 'hash', grupo: 'Codificação', nome: 'Hash', icone: '#', desc: 'MD5, SHA-1, SHA-256 e SHA-512 do texto.' },
];

const CHAVE = 'devtools:ferramenta';

@Component({
  selector: 'app-ferramentas',
  imports: [FormsModule, RouterLink, Gerador, Validador, Mascara, Boleto, Datas, Tempo, Sql, Formatador, Base64, JwtTool, Hash, Diff, Conversor, Regex, CronTool],
  templateUrl: './ferramentas.html',
  styleUrl: './ferramentas.css',
  encapsulation: ViewEncapsulation.None,
})
export class Ferramentas {
  private readonly router = inject(Router);
  protected readonly busca = signal('');
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id'))));

  protected readonly atual = computed(() => FERRAMENTAS.find((f) => f.id === this.id()) ?? FERRAMENTAS[0]);

  protected readonly grupos = computed(() => {
    const t = this.busca().toLowerCase().trim();
    const grupos = new Map<string, Ferramenta[]>();
    FERRAMENTAS.filter((f) => !t || (f.nome + f.grupo + f.desc).toLowerCase().includes(t)).forEach((f) =>
      grupos.set(f.grupo, [...(grupos.get(f.grupo) ?? []), f]),
    );
    return [...grupos].map(([nome, itens]) => ({ nome, itens }));
  });

  constructor() {
    const id = this.id();
    if (!FERRAMENTAS.some((f) => f.id === id)) {
      let ultima: string | null = null;
      try {
        ultima = localStorage.getItem(CHAVE);
      } catch {}
      this.router.navigate(['/ferramentas', FERRAMENTAS.find((f) => f.id === ultima)?.id ?? 'gerador'], { replaceUrl: true });
    } else {
      try {
        localStorage.setItem(CHAVE, id!);
      } catch {}
    }
  }

  lembrar(id: string) {
    try {
      localStorage.setItem(CHAVE, id);
    } catch {}
  }

  abrirPrimeira() {
    const f = this.grupos()[0]?.itens[0];
    if (!f) return;
    this.busca.set('');
    this.lembrar(f.id);
    this.router.navigate(['/ferramentas', f.id]);
  }
}
