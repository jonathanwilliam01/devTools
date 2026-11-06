import { cnpj, cpf, rg } from './docs';

const NOMES_M = ['João', 'José', 'Pedro', 'Lucas', 'Gabriel', 'Rafael', 'Mateus', 'Felipe', 'Gustavo', 'Bruno', 'Carlos', 'Antônio', 'Paulo', 'Marcos', 'André', 'Diego', 'Thiago', 'Rodrigo', 'Eduardo', 'Vinícius'];
const NOMES_F = ['Maria', 'Ana', 'Juliana', 'Fernanda', 'Mariana', 'Beatriz', 'Camila', 'Larissa', 'Patrícia', 'Aline', 'Letícia', 'Gabriela', 'Amanda', 'Bruna', 'Carla', 'Vanessa', 'Renata', 'Luciana', 'Sandra', 'Débora'];
const SOBRENOMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Moreira', 'Cardoso'];
const RUAS = ['Rua das Flores', 'Rua São José', 'Avenida Brasil', 'Rua XV de Novembro', 'Rua Sete de Setembro', 'Avenida Getúlio Vargas', 'Rua Tiradentes', 'Rua Dom Pedro II', 'Rua Santos Dumont', 'Avenida Independência', 'Rua Rui Barbosa', 'Rua Marechal Deodoro', 'Rua das Palmeiras', 'Travessa Boa Vista', 'Rua Monteiro Lobato'];
const BAIRROS = ['Centro', 'Jardim América', 'Vila Nova', 'Parque das Árvores', 'Jardim Primavera', 'Vila São João', 'Bela Vista', 'Santa Luzia', 'Campo Belo', 'Jardim Europa'];
const RAMOS = ['Comércio de Alimentos', 'Serviços Contábeis', 'Construções', 'Transportes', 'Informática', 'Materiais de Construção', 'Auto Peças', 'Consultoria', 'Distribuidora', 'Engenharia'];
const SUFIXOS = ['Ltda', 'ME', 'EPP', 'S/A'];

// [cidade, UF, IBGE, DDD, CEP inicial, CEP final] (faixas de 5 dígitos)
export const CIDADES: [string, string, string, string, number, number][] = [
  ['São Paulo', 'SP', '3550308', '11', 1000, 5999],
  ['Guaratinguetá', 'SP', '3518404', '12', 12500, 12519],
  ['Lorena', 'SP', '3527207', '12', 12600, 12614],
  ['Taubaté', 'SP', '3554102', '12', 12010, 12119],
  ['São José dos Campos', 'SP', '3549904', '12', 12200, 12248],
  ['Campinas', 'SP', '3509502', '19', 13010, 13109],
  ['Rio de Janeiro', 'RJ', '3304557', '21', 20000, 23799],
  ['Belo Horizonte', 'MG', '3106200', '31', 30000, 31999],
  ['Curitiba', 'PR', '4106902', '41', 80000, 82999],
  ['Porto Alegre', 'RS', '4314902', '51', 90000, 91999],
  ['Salvador', 'BA', '2927408', '71', 40000, 42599],
  ['Recife', 'PE', '2611606', '81', 50000, 52999],
  ['Fortaleza', 'CE', '2304400', '85', 60000, 61599],
  ['Goiânia', 'GO', '5208707', '62', 74000, 74899],
];

const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const um = <T>(l: T[]) => l[int(0, l.length - 1)];
const pad = (n: number, t: number) => String(n).padStart(t, '0');
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

function endereco() {
  const [cidade, uf, ibge, ddd, ini, fim] = um(CIDADES);
  return {
    cep: `${pad(int(ini, fim), 5)}-${pad(int(0, 999), 3)}`,
    logradouro: um(RUAS),
    numero: String(int(1, 3000)),
    complemento: Math.random() < 0.3 ? `Apto ${int(1, 30)}${int(1, 4)}` : '',
    bairro: um(BAIRROS),
    cidade,
    uf,
    ibge,
    ddd,
  };
}

const telefone = (ddd: string, cel: boolean) => (cel ? `(${ddd}) 9${int(6000, 9999)}-${pad(int(0, 9999), 4)}` : `(${ddd}) ${int(2000, 5999)}-${pad(int(0, 9999), 4)}`);

export function pessoa() {
  const fem = Math.random() < 0.5;
  const primeiro = um(fem ? NOMES_F : NOMES_M);
  const s1 = um(SOBRENOMES);
  let s2 = um(SOBRENOMES);
  while (s2 === s1) s2 = um(SOBRENOMES);
  const nasc = new Date(Date.now() - int(18, 80) * 365.25 * 864e5 - int(0, 364) * 864e5);
  const { ddd, ...end } = endereco();
  return {
    nome: `${primeiro} ${s1} ${s2}`,
    cpf: cpf(),
    rg: rg(),
    nascimento: `${pad(nasc.getDate(), 2)}/${pad(nasc.getMonth() + 1, 2)}/${nasc.getFullYear()}`,
    sexo: fem ? 'F' : 'M',
    email: `${slug(primeiro)}.${slug(s2)}${int(1, 99)}@exemplo.com.br`,
    celular: telefone(ddd, true),
    telefone: telefone(ddd, false),
    ...end,
  };
}

export function empresa() {
  const s = um(SOBRENOMES);
  const ramo = um(RAMOS);
  const { ddd, ...end } = endereco();
  return {
    razao_social: `${s} ${ramo} ${um(SUFIXOS)}`,
    nome_fantasia: `${s} ${ramo.split(' ')[0]}`,
    cnpj: cnpj(),
    abertura: `${pad(int(1, 28), 2)}/${pad(int(1, 12), 2)}/${int(1980, 2024)}`,
    email: `contato@${slug(s + ramo.split(' ')[0])}.com.br`,
    telefone: telefone(ddd, false),
    ...end,
  };
}
