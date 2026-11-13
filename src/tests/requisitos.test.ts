import assert from 'node:assert';
import { Request, Response } from 'express';
import { initializeDatabase } from '../database/connection';
import { SolicitacaoController } from '../controllers/SolicitacaoController';

// Utilitário simples para simular Request e Response do Express nos testes
function criarMockRes() {
  let statusCode = 200;
  let jsonBody: any = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };

  return res as unknown as Response & { getStatus: () => number; getJson: () => any };
}

function executarTestes() {
  console.log('🧪 Iniciando validação automatizada dos Requisitos (RF01 a RF06)...\n');
  initializeDatabase();

  // 1. RF01 — Cadastro válido com status inicial 'Aberta'
  const reqCriar = {
    body: {
      titulo: 'Teste Automatizado RF01',
      descricao: 'Verificando criação com status inicial Aberta',
      categoria: 'Testes / QA',
      prioridade: 'alta',
    },
  } as unknown as Request;
  const resCriar = criarMockRes();
  SolicitacaoController.criar(reqCriar, resCriar);

  assert.strictEqual(resCriar.getStatus(), 201, 'RF01: Status HTTP deve ser 201 Created');
  assert.strictEqual(resCriar.getJson().dados.status, 'Aberta', 'RF01: Status inicial deve ser Aberta');
  const idCriado: number = resCriar.getJson().dados.id;
  console.log(`✅ [RF01] Cadastro de solicitação #${idCriado} criado com status inicial "Aberta".`);

  // 2. RF06 — Rejeição de campos obrigatórios vazios
  const reqInvalido = {
    body: {
      titulo: '',
      descricao: '',
      categoria: '',
      prioridade: 'invalida',
    },
  } as unknown as Request;
  const resInvalido = criarMockRes();
  SolicitacaoController.criar(reqInvalido, resInvalido);

  assert.strictEqual(resInvalido.getStatus(), 400, 'RF06: Campos vazios devem retornar HTTP 400');
  assert.strictEqual(resInvalido.getJson().erro, true, 'RF06: Resposta deve sinalizar erro');
  console.log(`✅ [RF06] Rejeição de campos obrigatórios vazios funcionando (HTTP 400).`);

  // 3. RF02 & RF03 — Consulta e Filtros por status e prioridade
  const reqFiltro = {
    query: { status: 'Aberta', prioridade: 'alta', busca: 'Teste Automatizado' },
  } as unknown as Request;
  const resFiltro = criarMockRes();
  SolicitacaoController.listar(reqFiltro, resFiltro);

  assert.strictEqual(resFiltro.getStatus(), 200);
  assert.ok(resFiltro.getJson().dados.some((s: any) => s.id === idCriado), 'RF03: Item deve aparecer no filtro');
  console.log(`✅ [RF02/RF03] Consulta e filtros por status, prioridade e busca textual validados.`);

  // 4. RF04 & RF06 — Bloqueio de salto de etapa (Aberta -> Concluída diretamente)
  const reqSaltoInvalido = {
    params: { id: String(idCriado) },
    body: { status: 'Concluída' },
  } as unknown as Request;
  const resSaltoInvalido = criarMockRes();
  SolicitacaoController.atualizarStatus(reqSaltoInvalido, resSaltoInvalido);

  assert.strictEqual(
    resSaltoInvalido.getStatus(),
    400,
    'RF04: Saltar de Aberta direto para Concluída deve ser bloqueado com HTTP 400'
  );
  console.log(`✅ [RF04/RF06] Bloqueio de salto de etapa ("Aberta" → "Concluída") validado:`);
  console.log(`   ↳ Mensagem retornada: "${resSaltoInvalido.getJson().mensagem}"`);

  // 5. RF04 — Transição válida: Aberta -> Em andamento -> Concluída
  const reqPasso1 = {
    params: { id: String(idCriado) },
    body: { status: 'Em andamento', observacao: 'Iniciando atendimento no teste' },
  } as unknown as Request;
  const resPasso1 = criarMockRes();
  SolicitacaoController.atualizarStatus(reqPasso1, resPasso1);
  assert.strictEqual(resPasso1.getStatus(), 200);
  assert.strictEqual(resPasso1.getJson().dados.status, 'Em andamento');

  const reqPasso2 = {
    params: { id: String(idCriado) },
    body: { status: 'Concluída', observacao: 'Finalizando atendimento no teste' },
  } as unknown as Request;
  const resPasso2 = criarMockRes();
  SolicitacaoController.atualizarStatus(reqPasso2, resPasso2);
  assert.strictEqual(resPasso2.getStatus(), 200);
  assert.strictEqual(resPasso2.getJson().dados.status, 'Concluída');
  assert.strictEqual(
    resPasso2.getJson().dados.historico.length,
    3,
    'Histórico deve conter 3 registros (Aberta, Em andamento, Concluída)'
  );
  console.log(`✅ [RF04] Fluxo completo "Aberta" → "Em andamento" → "Concluída" e histórico validados.`);

  // Limpa o registro criado pelo teste para manter o banco limpo
  const reqDelete = { params: { id: String(idCriado) } } as unknown as Request;
  const resDelete = criarMockRes();
  SolicitacaoController.excluir(reqDelete, resDelete);
  assert.strictEqual(resDelete.getStatus(), 200);

  console.log('\n🎉 Todos os requisitos obrigatórios e opcionais passaram nos testes com sucesso!');
}

executarTestes();
