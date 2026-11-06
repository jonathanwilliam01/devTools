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
import { Pix } from './tools/pix';
import { Cep } from './tools/cep';
import { Fake } from './tools/fake';
import { SqlFmt } from './tools/sqlfmt';
import { Grade } from './tools/grade';
import { Caixa } from './tools/caixa';
import { Encoding } from './tools/encoding';
import { Contador } from './tools/contador';
import { Senha } from './tools/senha';

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
  { id: 'fake', grupo: 'Documentos', nome: 'Dados fake', icone: '☺', desc: 'Pessoa ou empresa fictícia com documentos válidos e endereço, um a um ou em lote (JSON, CSV, INSERT).' },
  { id: 'cep', grupo: 'Documentos', nome: 'CEP', icone: 'cep', desc: 'Busca endereço pelo CEP ou CEP pelo endereço, com código IBGE do município.' },
  { id: 'boleto', grupo: 'Arrecadação', nome: 'Boleto e guia', icone: '|||', desc: 'Converte linha digitável ↔ código de barras e confere os dígitos verificadores.' },
  { id: 'pix', grupo: 'Arrecadação', nome: 'Pix copia e cola', icone: 'px', desc: 'Lê um código Pix (chave, valor, TXID, CRC) ou gera um Pix estático.' },
  { id: 'datas', grupo: 'Datas', nome: 'Cálculo de datas', icone: '±d', desc: 'Diferença entre datas e soma de dias corridos ou úteis.' },
  { id: 'cron', grupo: 'Datas', nome: 'Cron', icone: '⏱', desc: 'Explica uma expressão cron e mostra as próximas execuções.' },
  { id: 'tempo', grupo: 'Datas', nome: 'Timestamp', icone: 'ts', desc: 'Converte Unix (s/ms), data/hora e TDateTime do Delphi.' },
  { id: 'sqlfmt', grupo: 'SQL', nome: 'Formatador SQL', icone: '≡', desc: 'Indenta e padroniza a caixa das palavras-chave, ou compacta em uma linha.' },
  { id: 'sql', grupo: 'SQL', nome: 'Lista para SQL', icone: 'IN', desc: 'Cole uma coluna (ou várias, do Excel) e gere IN, VALUES ou UNION.' },
  { id: 'conversor', grupo: 'SQL', nome: 'CSV ↔ JSON ↔ INSERT', icone: '⇄', desc: 'Converte CSV (ou planilha colada) e JSON entre si e gera INSERTs.' },
  { id: 'grade', grupo: 'SQL', nome: 'Grid → tabela', icone: '▦', desc: 'Cole o resultado de uma consulta e gere tabela em Markdown, ASCII, texto alinhado ou HTML.' },
  { id: 'diff', grupo: 'Texto', nome: 'Comparar textos', icone: '±', desc: 'Diferença linha a linha entre dois textos.' },
  { id: 'regex', grupo: 'Texto', nome: 'Regex', icone: '.*', desc: 'Testa expressão regular: destaca ocorrências, mostra grupos e faz substituição.' },
  { id: 'formatador', grupo: 'Texto', nome: 'Formatador', icone: '{}', desc: 'Formata, compacta e valida JSON e XML.' },
  { id: 'caixa', grupo: 'Texto', nome: 'Caixa e nomes', icone: 'Aa', desc: 'camelCase, snake_case, CONSTANTE, kebab-case, Título, sem acentos e outros.' },
  { id: 'contador', grupo: 'Texto', nome: 'Contador', icone: '123', desc: 'Caracteres, bytes, palavras e linhas; aponta linhas que passam do limite do campo.' },
  { id: 'encoding', grupo: 'Codificação', nome: 'Encoding', icone: 'Ã', desc: 'Corrige acentuação quebrada entre UTF-8 e Latin1 (Ã§ → ç) e mostra os bytes de cada caractere.' },
  { id: 'base64', grupo: 'Codificação', nome: 'Base64', icone: '64', desc: 'Base64 simples ou 5x invertido (encode5t / decode5t).' },
  { id: 'jwt', grupo: 'Codificação', nome: 'JWT', icone: 'jw', desc: 'Lê header e payload de um token. Não verifica a assinatura.' },
  { id: 'hash', grupo: 'Codificação', nome: 'Hash', icone: '#', desc: 'MD5, SHA-1, SHA-256 e SHA-512 do texto.' },
  { id: 'senha', grupo: 'Codificação', nome: 'Senha', icone: '***', desc: 'Senhas fortes com tamanho e caracteres configuráveis, e UUID v4.' },
];

const CHAVE = 'devtools:ferramenta';

@Component({
  selector: 'app-ferramentas',
  imports: [FormsModule, RouterLink, Gerador, Validador, Mascara, Boleto, Datas, Tempo, Sql, Formatador, Base64, JwtTool, Hash, Diff, Conversor, Regex, CronTool, Pix, Cep, Fake, SqlFmt, Grade, Caixa, Encoding, Contador, Senha],
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
