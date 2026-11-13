import db from '../database/connection';

export type PrioridadeSolicitacao = 'baixa' | 'média' | 'alta';
export type StatusSolicitacao = 'Aberta' | 'Em andamento' | 'Concluída';

export interface HistoricoStatus {
  id: number;
  solicitacao_id: number;
  status_anterior: StatusSolicitacao | null;
  status_novo: StatusSolicitacao;
  observacao: string | null;
  data_mudanca: string;
}

export interface Solicitacao {
  id: number;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: PrioridadeSolicitacao;
  status: StatusSolicitacao;
  criado_em: string;
  atualizado_em: string;
}

export interface SolicitacaoComHistorico extends Solicitacao {
  historico: HistoricoStatus[];
}

export interface CriarSolicitacaoDTO {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: PrioridadeSolicitacao;
}

export interface AtualizarSolicitacaoDTO {
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: PrioridadeSolicitacao;
}

export interface FiltrosSolicitacao {
  status?: string;
  prioridade?: string;
  busca?: string;
}

export class SolicitacaoModel {
  /**
   * Lista solicitações aplicando filtros opcionais de status, prioridade e busca textual (RF02, RF03)
   */
  static listar(filtros: FiltrosSolicitacao = {}): Solicitacao[] {
    let query = 'SELECT * FROM solicitacoes WHERE 1=1';
    const params: (string | number)[] = [];

    if (filtros.status && filtros.status.trim() !== '') {
      query += ' AND status = ?';
      params.push(filtros.status.trim());
    }

    if (filtros.prioridade && filtros.prioridade.trim() !== '') {
      query += ' AND prioridade = ?';
      params.push(filtros.prioridade.trim());
    }

    if (filtros.busca && filtros.busca.trim() !== '') {
      const termo = `%${filtros.busca.trim()}%`;
      query += ' AND (titulo LIKE ? OR descricao LIKE ? OR categoria LIKE ?)';
      params.push(termo, termo, termo);
    }

    query += ' ORDER BY id DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params) as unknown as Solicitacao[];
  }

  /**
   * Busca uma solicitação pelo ID junto com seu histórico de mudanças de status (RF02)
   */
  static buscarPorId(id: number): SolicitacaoComHistorico | undefined {
    const stmtSolicitacao = db.prepare('SELECT * FROM solicitacoes WHERE id = ?');
    const solicitacao = stmtSolicitacao.get(id) as unknown as Solicitacao | undefined;

    if (!solicitacao) {
      return undefined;
    }

    const stmtHistorico = db.prepare(
      'SELECT * FROM historico_status WHERE solicitacao_id = ? ORDER BY id ASC'
    );
    const historico = stmtHistorico.all(id) as unknown as HistoricoStatus[];

    return {
      ...solicitacao,
      historico,
    };
  }

  /**
   * Registra uma nova solicitação com status inicial obrigatoriamente 'Aberta' (RF01)
   */
  static criar(dados: CriarSolicitacaoDTO): SolicitacaoComHistorico {
    const agora = new Date().toISOString();
    const statusInicial: StatusSolicitacao = 'Aberta';

    db.exec('BEGIN TRANSACTION');
    try {
      const stmtInsert = db.prepare(`
        INSERT INTO solicitacoes (titulo, descricao, categoria, prioridade, status, criado_em, atualizado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const resultado = stmtInsert.run(
        dados.titulo,
        dados.descricao,
        dados.categoria,
        dados.prioridade,
        statusInicial,
        agora,
        agora
      );

      const novoId = Number(resultado.lastInsertRowid);

      const stmtHistorico = db.prepare(`
        INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, observacao, data_mudanca)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmtHistorico.run(
        novoId,
        null,
        statusInicial,
        'Solicitação registrada com status inicial Aberta.',
        agora
      );

      db.exec('COMMIT');
      return this.buscarPorId(novoId)!;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Atualiza os dados cadastrais de uma solicitação (funcionalidade opcional de edição)
   */
  static atualizarDados(id: number, dados: AtualizarSolicitacaoDTO): SolicitacaoComHistorico | undefined {
    const existente = this.buscarPorId(id);
    if (!existente) {
      return undefined;
    }

    const agora = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE solicitacoes
      SET titulo = ?, descricao = ?, categoria = ?, prioridade = ?, atualizado_em = ?
      WHERE id = ?
    `);

    stmt.run(dados.titulo, dados.descricao, dados.categoria, dados.prioridade, agora, id);
    return this.buscarPorId(id);
  }

  /**
   * Atualiza o status da solicitação e grava o registro no histórico (RF04)
   */
  static atualizarStatus(
    id: number,
    statusAnterior: StatusSolicitacao,
    novoStatus: StatusSolicitacao,
    observacao?: string
  ): SolicitacaoComHistorico | undefined {
    const agora = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      const stmtUpdate = db.prepare(`
        UPDATE solicitacoes
        SET status = ?, atualizado_em = ?
        WHERE id = ?
      `);
      stmtUpdate.run(novoStatus, agora, id);

      const stmtHistorico = db.prepare(`
        INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, observacao, data_mudanca)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmtHistorico.run(
        id,
        statusAnterior,
        novoStatus,
        observacao?.trim() || `Status alterado de "${statusAnterior}" para "${novoStatus}".`,
        agora
      );

      db.exec('COMMIT');
      return this.buscarPorId(id);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Exclui uma solicitação do banco de dados (funcionalidade opcional de exclusão)
   */
  static excluir(id: number): boolean {
    const stmt = db.prepare('DELETE FROM solicitacoes WHERE id = ?');
    const resultado = stmt.run(id);
    return resultado.changes > 0;
  }
}
