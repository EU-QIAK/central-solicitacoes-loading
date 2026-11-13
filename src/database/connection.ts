import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dbDir = path.resolve(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'solicitacoes.sqlite');
const isFirstCreation = !fs.existsSync(dbPath);

// Conexão síncrona nativa do Node.js (SQLite) com persistência em arquivo local (RF05)
const db = new DatabaseSync(dbPath);

// Habilita chaves estrangeiras no SQLite (necessário para ON DELETE CASCADE no histórico)
db.exec('PRAGMA foreign_keys = ON;');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      categoria TEXT NOT NULL,
      prioridade TEXT NOT NULL CHECK (prioridade IN ('baixa', 'média', 'alta')),
      status TEXT NOT NULL DEFAULT 'Aberta' CHECK (status IN ('Aberta', 'Em andamento', 'Concluída')),
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historico_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitacao_id INTEGER NOT NULL,
      status_anterior TEXT,
      status_novo TEXT NOT NULL,
      observacao TEXT,
      data_mudanca TEXT NOT NULL,
      FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes(id) ON DELETE CASCADE
    );
  `);

  // Popula dados iniciais de demonstração apenas na primeira criação do arquivo do banco
  if (isFirstCreation) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const countRow = db.prepare('SELECT COUNT(*) as total FROM solicitacoes').get() as { total: number };
  if (countRow.total > 0) return;

  const agora = new Date().toISOString();
  const umaHoraAtras = new Date(Date.now() - 3600 * 1000).toISOString();
  const duasHorasAtras = new Date(Date.now() - 7200 * 1000).toISOString();

  const insertSolicitacao = db.prepare(`
    INSERT INTO solicitacoes (titulo, descricao, categoria, prioridade, status, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHistorico = db.prepare(`
    INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, observacao, data_mudanca)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Exemplo 1: Aberta (Alta prioridade)
  const res1 = insertSolicitacao.run(
    'Instalação de ambiente Node.js nos computadores do laboratório',
    'Os novos membros do setor de projetos precisam do Node.js LTS e Git configurados nas máquinas da sala 03.',
    'Infraestrutura / TI',
    'alta',
    'Aberta',
    duasHorasAtras,
    duasHorasAtras
  );
  insertHistorico.run(
    res1.lastInsertRowid,
    null,
    'Aberta',
    'Solicitação registrada no sistema.',
    duasHorasAtras
  );

  // Exemplo 2: Em andamento (Média prioridade)
  const res2 = insertSolicitacao.run(
    'Acesso ao repositório do projeto interno no GitHub',
    'Liberar permissão de escrita para a equipe de desenvolvimento full stack no repositório da Central de Solicitações.',
    'Acessos e Permissões',
    'média',
    'Em andamento',
    duasHorasAtras,
    umaHoraAtras
  );
  insertHistorico.run(
    res2.lastInsertRowid,
    null,
    'Aberta',
    'Solicitação registrada no sistema.',
    duasHorasAtras
  );
  insertHistorico.run(
    res2.lastInsertRowid,
    'Aberta',
    'Em andamento',
    'Equipe de TI iniciou a configuração das permissões.',
    umaHoraAtras
  );

  // Exemplo 3: Concluída (Baixa prioridade)
  const res3 = insertSolicitacao.run(
    'Atualização da assinatura de e-mail institucional',
    'Padronizar o template de assinatura de e-mail com a nova identidade visual da Loading Desenvolvimento Jr.',
    'Comunicação / Design',
    'baixa',
    'Concluída',
    duasHorasAtras,
    agora
  );
  insertHistorico.run(
    res3.lastInsertRowid,
    null,
    'Aberta',
    'Solicitação registrada no sistema.',
    duasHorasAtras
  );
  insertHistorico.run(
    res3.lastInsertRowid,
    'Aberta',
    'Em andamento',
    'Template em revisão pela diretoria.',
    umaHoraAtras
  );
  insertHistorico.run(
    res3.lastInsertRowid,
    'Em andamento',
    'Concluída',
    'Template aprovado e enviado para todos os membros.',
    agora
  );
}

export default db;
