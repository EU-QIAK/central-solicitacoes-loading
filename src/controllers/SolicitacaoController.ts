import { Request, Response } from 'express';
import {
  PrioridadeSolicitacao,
  SolicitacaoModel,
  StatusSolicitacao,
} from '../models/SolicitacaoModel';

const PRIORIDADES_VALIDAS: PrioridadeSolicitacao[] = ['baixa', 'média', 'alta'];
const STATUS_VALIDOS: StatusSolicitacao[] = ['Aberta', 'Em andamento', 'Concluída'];

/**
 * Mapa estrito de transições permitidas (RF04):
 * Aberta -> Em andamento -> Concluída (não permite saltar etapas nem retroceder)
 */
const TRANSICOES_PERMITIDAS: Record<StatusSolicitacao, StatusSolicitacao | null> = {
  'Aberta': 'Em andamento',
  'Em andamento': 'Concluída',
  'Concluída': null,
};

function normalizarPrioridade(valor: unknown): PrioridadeSolicitacao | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().toLowerCase();
  if (limpo === 'media') return 'média';
  if (PRIORIDADES_VALIDAS.includes(limpo as PrioridadeSolicitacao)) {
    return limpo as PrioridadeSolicitacao;
  }
  return null;
}

export class SolicitacaoController {
  /**
   * GET /api/solicitacoes
   * Lista todas as solicitações com suporte a filtros de status, prioridade e busca textual (RF02, RF03)
   */
  static listar(req: Request, res: Response): void {
    try {
      const { status, prioridade, busca } = req.query;

      let filtroStatus: string | undefined;
      let filtroPrioridade: string | undefined;

      if (typeof status === 'string' && status.trim() !== '') {
        if (!STATUS_VALIDOS.includes(status.trim() as StatusSolicitacao)) {
          res.status(400).json({
            erro: true,
            mensagem: `Filtro de status inválido: "${status}". Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`,
          });
          return;
        }
        filtroStatus = status.trim();
      }

      if (typeof prioridade === 'string' && prioridade.trim() !== '') {
        const prioNormalizada = normalizarPrioridade(prioridade);
        if (!prioNormalizada) {
          res.status(400).json({
            erro: true,
            mensagem: `Filtro de prioridade inválido: "${prioridade}". Valores aceitos: baixa, média ou alta.`,
          });
          return;
        }
        filtroPrioridade = prioNormalizada;
      }

      const solicitacoes = SolicitacaoModel.listar({
        status: filtroStatus,
        prioridade: filtroPrioridade,
        busca: typeof busca === 'string' ? busca : undefined,
      });

      res.status(200).json({
        erro: false,
        total: solicitacoes.length,
        dados: solicitacoes,
      });
    } catch (error) {
      console.error('Erro ao listar solicitações:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao consultar as solicitações.',
      });
    }
  }

  /**
   * GET /api/solicitacoes/:id
   * Consulta os dados detalhados de uma solicitação e seu histórico de status (RF02)
   */
  static buscarPorId(req: Request, res: Response): void {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          erro: true,
          mensagem: 'O identificador (ID) da solicitação deve ser um número inteiro positivo.',
        });
        return;
      }

      const solicitacao = SolicitacaoModel.buscarPorId(id);
      if (!solicitacao) {
        res.status(404).json({
          erro: true,
          mensagem: `Solicitação #${id} não encontrada.`,
        });
        return;
      }

      res.status(200).json({
        erro: false,
        dados: solicitacao,
      });
    } catch (error) {
      console.error('Erro ao buscar solicitação por ID:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao buscar os detalhes da solicitação.',
      });
    }
  }

  /**
   * POST /api/solicitacoes
   * Cadastra uma nova solicitação com validação de campos obrigatórios e status inicial 'Aberta' (RF01, RF06)
   */
  static criar(req: Request, res: Response): void {
    try {
      const { titulo, descricao, categoria, prioridade } = req.body;
      const erros: string[] = [];

      if (typeof titulo !== 'string' || titulo.trim().length === 0) {
        erros.push('O campo "título" é obrigatório e não pode estar vazio.');
      } else if (titulo.trim().length < 3) {
        erros.push('O campo "título" deve ter pelo menos 3 caracteres.');
      }

      if (typeof categoria !== 'string' || categoria.trim().length === 0) {
        erros.push('O campo "categoria" é obrigatório e não pode estar vazio.');
      }

      const prioridadeValida = normalizarPrioridade(prioridade);
      if (!prioridadeValida) {
        erros.push('O campo "prioridade" é obrigatório e deve ser "baixa", "média" ou "alta".');
      }

      if (erros.length > 0) {
        res.status(400).json({
          erro: true,
          mensagem: erros[0],
          erros,
        });
        return;
      }

      const descricaoFinal =
        typeof descricao === 'string' && descricao.trim().length > 0
          ? descricao.trim()
          : 'sem descrições detalhadas';

      const novaSolicitacao = SolicitacaoModel.criar({
        titulo: titulo.trim(),
        descricao: descricaoFinal,
        categoria: categoria.trim(),
        prioridade: prioridadeValida!,
      });

      res.status(201).json({
        erro: false,
        mensagem: 'Solicitação registrada com sucesso com status inicial "Aberta".',
        dados: novaSolicitacao,
      });
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao cadastrar a solicitação.',
      });
    }
  }

  /**
   * PUT /api/solicitacoes/:id
   * Edita os dados cadastrais (título, descrição, categoria, prioridade) de uma solicitação (Opcional + RF06)
   */
  static atualizarDados(req: Request, res: Response): void {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          erro: true,
          mensagem: 'O identificador (ID) da solicitação deve ser um número inteiro positivo.',
        });
        return;
      }

      const existente = SolicitacaoModel.buscarPorId(id);
      if (!existente) {
        res.status(404).json({
          erro: true,
          mensagem: `Solicitação #${id} não encontrada.`,
        });
        return;
      }

      const { titulo, descricao, categoria, prioridade } = req.body;
      const erros: string[] = [];

      if (typeof titulo !== 'string' || titulo.trim().length === 0) {
        erros.push('O campo "título" é obrigatório e não pode estar vazio.');
      } else if (titulo.trim().length < 3) {
        erros.push('O campo "título" deve ter pelo menos 3 caracteres.');
      }

      if (typeof categoria !== 'string' || categoria.trim().length === 0) {
        erros.push('O campo "categoria" é obrigatório e não pode estar vazio.');
      }

      const prioridadeValida = normalizarPrioridade(prioridade);
      if (!prioridadeValida) {
        erros.push('O campo "prioridade" é obrigatório e deve ser "baixa", "média" ou "alta".');
      }

      if (erros.length > 0) {
        res.status(400).json({
          erro: true,
          mensagem: erros[0],
          erros,
        });
        return;
      }

      const descricaoFinal =
        typeof descricao === 'string' && descricao.trim().length > 0
          ? descricao.trim()
          : 'sem descrições detalhadas';

      const atualizada = SolicitacaoModel.atualizarDados(id, {
        titulo: titulo.trim(),
        descricao: descricaoFinal,
        categoria: categoria.trim(),
        prioridade: prioridadeValida!,
      });

      res.status(200).json({
        erro: false,
        mensagem: `Solicitação #${id} atualizada com sucesso.`,
        dados: atualizada,
      });
    } catch (error) {
      console.error('Erro ao atualizar solicitação:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao atualizar os dados da solicitação.',
      });
    }
  }

  /**
   * PATCH /api/solicitacoes/:id/status
   * Altera o status da solicitação respeitando estritamente o fluxo Aberta -> Em andamento -> Concluída (RF04, RF06)
   */
  static atualizarStatus(req: Request, res: Response): void {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          erro: true,
          mensagem: 'O identificador (ID) da solicitação deve ser um número inteiro positivo.',
        });
        return;
      }

      const solicitacao = SolicitacaoModel.buscarPorId(id);
      if (!solicitacao) {
        res.status(404).json({
          erro: true,
          mensagem: `Solicitação #${id} não encontrada.`,
        });
        return;
      }

      const { status: novoStatus, observacao } = req.body;

      if (typeof novoStatus !== 'string' || novoStatus.trim() === '') {
        res.status(400).json({
          erro: true,
          mensagem: 'O campo "status" é obrigatório para realizar a transição.',
        });
        return;
      }

      const statusDesejado = novoStatus.trim() as StatusSolicitacao;
      if (!STATUS_VALIDOS.includes(statusDesejado)) {
        res.status(400).json({
          erro: true,
          mensagem: `Status "${novoStatus}" inválido. Os status permitidos são: ${STATUS_VALIDOS.join(', ')}.`,
        });
        return;
      }

      const statusAtual = solicitacao.status;
      const proximoPermitido = TRANSICOES_PERMITIDAS[statusAtual];

      if (statusAtual === statusDesejado) {
        res.status(400).json({
          erro: true,
          mensagem: `A solicitação #${id} já se encontra com o status "${statusAtual}".`,
        });
        return;
      }

      if (proximoPermitido === null) {
        res.status(400).json({
          erro: true,
          mensagem: `Transição inválida: a solicitação #${id} já está "Concluída" e não permite novas alterações de status.`,
        });
        return;
      }

      if (statusDesejado !== proximoPermitido) {
        res.status(400).json({
          erro: true,
          mensagem: `Transição inválida de "${statusAtual}" para "${statusDesejado}". O fluxo exige a ordem Aberta → Em andamento → Concluída (próxima etapa permitida: "${proximoPermitido}").`,
        });
        return;
      }

      const solicitacaoAtualizada = SolicitacaoModel.atualizarStatus(
        id,
        statusAtual,
        statusDesejado,
        typeof observacao === 'string' ? observacao : undefined
      );

      res.status(200).json({
        erro: false,
        mensagem: `Status da solicitação #${id} alterado de "${statusAtual}" para "${statusDesejado}".`,
        dados: solicitacaoAtualizada,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao atualizar o status da solicitação.',
      });
    }
  }

  /**
   * DELETE /api/solicitacoes/:id
   * Remove uma solicitação do sistema (Funcionalidade opcional de exclusão)
   */
  static excluir(req: Request, res: Response): void {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({
          erro: true,
          mensagem: 'O identificador (ID) da solicitação deve ser um número inteiro positivo.',
        });
        return;
      }

      const removida = SolicitacaoModel.excluir(id);
      if (!removida) {
        res.status(404).json({
          erro: true,
          mensagem: `Solicitação #${id} não encontrada para exclusão.`,
        });
        return;
      }

      res.status(200).json({
        erro: false,
        mensagem: `Solicitação #${id} excluída com sucesso.`,
      });
    } catch (error) {
      console.error('Erro ao excluir solicitação:', error);
      res.status(500).json({
        erro: true,
        mensagem: 'Ocorreu um erro interno ao excluir a solicitação.',
      });
    }
  }
}
