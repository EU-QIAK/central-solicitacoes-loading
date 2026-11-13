import { Router } from 'express';
import { SolicitacaoController } from '../controllers/SolicitacaoController';

const router = Router();

// RF02 & RF03: Listar solicitações e aplicar filtros (status, prioridade, busca textual)
router.get('/', SolicitacaoController.listar);

// RF02: Consultar detalhes e histórico de mudanças de status de uma solicitação
router.get('/:id', SolicitacaoController.buscarPorId);

// RF01 & RF06: Cadastrar nova solicitação com validação (status inicial sempre 'Aberta')
router.post('/', SolicitacaoController.criar);

// Funcionalidade Opcional & RF06: Editar dados cadastrais da solicitação
router.put('/:id', SolicitacaoController.atualizarDados);

// RF04 & RF06: Avançar status (Aberta -> Em andamento -> Concluída) com validação de transição
router.patch('/:id/status', SolicitacaoController.atualizarStatus);

// Funcionalidade Opcional: Excluir solicitação
router.delete('/:id', SolicitacaoController.excluir);

export default router;
