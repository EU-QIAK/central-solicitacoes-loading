/**
 * Central de Solicitações Internas - LOADING Desenvolvimento Jr.
 * Camada de Integração Frontend (HTML/CSS/JS + Bootstrap 5)
 * Lista de Solicitações implementada como um Carrossel de Páginas com Cabeçalho e Rodapé fixos
 */

const API_URL = '/api/solicitacoes';

// Estado em memória para controle dos modais, carrossel de páginas e paginação
let solicitacaoDetalheAtual = null;
let modalFormularioInstancia = null;
let modalDetalhesInstancia = null;
let carrosselInstancia = null;
let debounceTimer = null;

let todasSolicitacoesFiltradas = [];
let paginaAtual = 1;
let itensPorPagina = 4;

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa instâncias dos modais do Bootstrap 5
  const modalFormEl = document.getElementById('modalFormulario');
  const modalDetEl = document.getElementById('modalDetalhes');
  modalFormularioInstancia = new bootstrap.Modal(modalFormEl);
  modalDetalhesInstancia = new bootstrap.Modal(modalDetEl);

  // Inicializa instância do Carrossel de Páginas de Solicitações
  const carrosselEl = document.getElementById('carrosselSolicitacoes');
  carrosselInstancia = new bootstrap.Carousel(carrosselEl, {
    interval: false,
    ride: false,
    wrap: false,
    touch: true,
  });

  configurarEventos();
  carregarSolicitacoes();
  atualizarContadoresGerais();
});

/**
 * Configura todos os ouvintes de eventos da interface
 */
function configurarEventos() {
  // Botões para abrir modal de Nova Solicitação
  document.getElementById('btnNovaSolicitacao').addEventListener('click', abrirModalCriacao);
  document.getElementById('btnEmptyNova').addEventListener('click', abrirModalCriacao);

  // Submissão do formulário de criação / edição (RF01 / RF06)
  document.getElementById('formSolicitacao').addEventListener('submit', salvarSolicitacao);

  // Filtros de Status, Prioridade e Busca Textual (RF03)
  document.getElementById('filtroStatus').addEventListener('change', () => {
    paginaAtual = 1;
    destacarCardKpi(document.getElementById('filtroStatus').value);
    carregarSolicitacoes();
  });

  document.getElementById('filtroPrioridade').addEventListener('change', () => {
    paginaAtual = 1;
    carregarSolicitacoes();
  });

  document.getElementById('filtroBusca').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      paginaAtual = 1;
      carregarSolicitacoes();
    }, 250);
  });

  document.getElementById('formFiltros').addEventListener('submit', (e) => {
    e.preventDefault();
    paginaAtual = 1;
    carregarSolicitacoes();
  });

  document.getElementById('btnLimparFiltros').addEventListener('click', limparFiltros);

  // Seletor de quantidade de itens por página (redivide os slides do carrossel)
  document.getElementById('selectItensPorPagina').addEventListener('change', (e) => {
    itensPorPagina = Number(e.target.value) || 4;
    paginaAtual = 1;
    construirCarrosselDePaginas();
  });

  // Botões laterais do Carrossel (Anterior / Próxima Página)
  document.getElementById('btnCarrosselPrev').addEventListener('click', () => {
    if (paginaAtual > 1) {
      irParaPagina(paginaAtual - 1);
    }
  });

  document.getElementById('btnCarrosselNext').addEventListener('click', () => {
    const totalPaginas = Math.max(1, Math.ceil(todasSolicitacoesFiltradas.length / itensPorPagina));
    if (paginaAtual < totalPaginas) {
      irParaPagina(paginaAtual + 1);
    }
  });

  // Sincroniza a paginação do rodapé caso o carrossel deslize (ex.: swipe/teclado)
  const carrosselEl = document.getElementById('carrosselSolicitacoes');
  carrosselEl.addEventListener('slid.bs.carousel', (evento) => {
    const novaPagina = evento.to + 1;
    if (novaPagina !== paginaAtual) {
      paginaAtual = novaPagina;
      atualizarRodapePaginacao();
    }
  });

  // Clique nos cards KPI filtra automaticamente por status
  document.querySelectorAll('.kpi-card').forEach((card) => {
    card.addEventListener('click', () => {
      const status = card.getAttribute('data-filter-status') || '';
      document.getElementById('filtroStatus').value = status;
      paginaAtual = 1;
      destacarCardKpi(status);
      carregarSolicitacoes();
    });
  });

  // Submissão de transição de status no modal de detalhes (RF04)
  document.getElementById('formTransicaoStatus').addEventListener('submit', submeterTransicaoNoModal);

  // Botão Editar dentro do modal de detalhes
  document.getElementById('btnEditarNoModal').addEventListener('click', () => {
    if (!solicitacaoDetalheAtual) return;
    modalDetalhesInstancia.hide();
    abrirModalEdicao(solicitacaoDetalheAtual);
  });
}

/**
 * Busca a listagem de solicitações aplicando os filtros ativos e monta o Carrossel de Páginas (RF02, RF03)
 */
async function carregarSolicitacoes() {
  const status = document.getElementById('filtroStatus').value;
  const prioridade = document.getElementById('filtroPrioridade').value;
  const busca = document.getElementById('filtroBusca').value.trim();

  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (prioridade) params.append('prioridade', prioridade);
  if (busca) params.append('busca', busca);

  const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;

  try {
    const resposta = await fetch(url);
    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      exibirFeedbackGlobal(json.mensagem || 'Erro ao carregar solicitações.', 'danger');
      return;
    }

    todasSolicitacoesFiltradas = json.dados || [];
    construirCarrosselDePaginas();
  } catch (erro) {
    console.error('Erro de conexão com a API:', erro);
    exibirFeedbackGlobal('Não foi possível conectar à API do servidor.', 'danger');
  }
}

/**
 * Divide as solicitações em páginas e cria um slide (.carousel-item) para cada página
 */
function construirCarrosselDePaginas() {
  const containerInner = document.getElementById('carrosselPaginasInner');
  const carrosselEl = document.getElementById('carrosselSolicitacoes');
  const estadoVazio = document.getElementById('estadoVazio');
  const cabecalhoColunas = document.getElementById('cabecalhoColunasFixo');
  const resumo = document.getElementById('resumoListagem');

  const totalItens = todasSolicitacoesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
  }
  if (paginaAtual < 1) {
    paginaAtual = 1;
  }

  resumo.textContent =
    totalItens === 1
      ? '1 solicitação encontrada • Navegue pelas páginas no carrossel'
      : `${totalItens} solicitações encontradas • Divididas em ${totalPaginas} ${totalPaginas === 1 ? 'página' : 'páginas'} no carrossel`;

  containerInner.innerHTML = '';

  if (totalItens === 0) {
    carrosselEl.classList.add('d-none');
    cabecalhoColunas.classList.remove('d-md-grid');
    estadoVazio.classList.remove('d-none');
    atualizarRodapePaginacao();
    return;
  }

  carrosselEl.classList.remove('d-none');
  cabecalhoColunas.classList.add('d-md-grid');
  estadoVazio.classList.add('d-none');

  // Cria cada página como um slide (.carousel-item) do Carrossel
  for (let indicePagina = 0; indicePagina < totalPaginas; indicePagina += 1) {
    const inicio = indicePagina * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensDaPagina = todasSolicitacoesFiltradas.slice(inicio, fim);

    const slideItem = document.createElement('div');
    slideItem.className = `carousel-item ${indicePagina + 1 === paginaAtual ? 'active' : ''}`;

    const linhasHtml = itensDaPagina.map((item) => criarLinhaSolicitacaoHtml(item)).join('');

    slideItem.innerHTML = `
      <div class="pagina-slide-container">
        ${linhasHtml}
      </div>
    `;

    containerInner.appendChild(slideItem);
  }

  // Associa eventos aos botões de todas as páginas dentro do carrossel
  vincularEventosDaLista(containerInner);

  // Atualiza os controles de paginação e setas laterais
  atualizarRodapePaginacao();
}

/**
 * Gera o HTML de uma linha de solicitação dentro do slide da página atual
 */
function criarLinhaSolicitacaoHtml(item) {
  const proximoStatus = obterProximoStatusPermitido(item.status);
  let botaoFluxoHtml = '';

  if (proximoStatus === 'Em andamento') {
    botaoFluxoHtml = `
      <button class="btn btn-sm btn-outline-warning text-dark fw-semibold btn-avancar py-1 px-2" data-id="${item.id}" data-proximo="Em andamento" title="Avançar de Aberta para Em andamento">
        <i class="bi bi-play-fill me-1"></i>Iniciar
      </button>
    `;
  } else if (proximoStatus === 'Concluída') {
    botaoFluxoHtml = `
      <button class="btn btn-sm btn-outline-success fw-semibold btn-avancar py-1 px-2" data-id="${item.id}" data-proximo="Concluída" title="Avançar de Em andamento para Concluída">
        <i class="bi bi-check2-all me-1"></i>Concluir
      </button>
    `;
  } else {
    botaoFluxoHtml = `
      <span class="badge bg-light text-secondary border">
        <i class="bi bi-lock-fill me-1"></i>Finalizada
      </span>
    `;
  }

  return `
    <div class="solicitacao-grid-row">
      <div class="fw-bold text-secondary small">#${item.id}</div>
      <div>
        <a class="titulo-solicitacao btn-detalhes" data-id="${item.id}">
          ${escaparHtml(item.titulo)}
        </a>
        <div class="descricao-resumo">${escaparHtml(item.descricao)}</div>
        <small class="text-muted" style="font-size: 0.72rem;">
          <i class="bi bi-calendar3 me-1"></i>${formatarDataHora(item.criado_em)}
        </small>
      </div>
      <div>
        <span class="badge bg-secondary bg-opacity-10 text-dark border fw-medium text-truncate" style="max-width: 155px;">
          ${escaparHtml(item.categoria)}
        </span>
      </div>
      <div>${gerarBadgePrioridade(item.prioridade)}</div>
      <div>${gerarBadgeStatus(item.status)}</div>
      <div>${botaoFluxoHtml}</div>
      <div class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-secondary btn-detalhes" data-id="${item.id}" title="Consultar detalhes e histórico">
            <i class="bi bi-eye"></i>
          </button>
          <button type="button" class="btn btn-outline-primary btn-editar" data-id="${item.id}" title="Editar solicitação">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-excluir" data-id="${item.id}" title="Excluir solicitação">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Associa os eventos de clique aos botões de ação dentro dos slides do carrossel
 */
function vincularEventosDaLista(container) {
  container.querySelectorAll('.btn-detalhes').forEach((el) => {
    el.addEventListener('click', () => abrirModalDetalhes(Number(el.getAttribute('data-id'))));
  });

  container.querySelectorAll('.btn-avancar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const proximo = btn.getAttribute('data-proximo');
      avancarStatusRapido(id, proximo);
    });
  });

  container.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      const item = todasSolicitacoesFiltradas.find((s) => s.id === id);
      if (item) abrirModalEdicao(item);
    });
  });

  container.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-id'));
      excluirSolicitacao(id);
    });
  });
}

/**
 * Desliza o Carrossel de Solicitações para a página selecionada e atualiza o rodapé fixo
 */
function irParaPagina(numeroPagina) {
  const totalPaginas = Math.max(1, Math.ceil(todasSolicitacoesFiltradas.length / itensPorPagina));
  if (numeroPagina < 1 || numeroPagina > totalPaginas) return;

  paginaAtual = numeroPagina;
  if (carrosselInstancia) {
    carrosselInstancia.to(paginaAtual - 1);
  }
  atualizarRodapePaginacao();
}

/**
 * Atualiza os botões numerados da paginação no rodapé fixo e o estado das setas do carrossel
 */
function atualizarRodapePaginacao() {
  const infoEl = document.getElementById('infoPaginacao');
  const ulPaginacao = document.getElementById('paginacaoControles');
  const rodapePaginacao = document.getElementById('rodapePaginacao');
  const btnPrev = document.getElementById('btnCarrosselPrev');
  const btnNext = document.getElementById('btnCarrosselNext');

  const totalItens = todasSolicitacoesFiltradas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));

  ulPaginacao.innerHTML = '';

  if (totalItens === 0) {
    rodapePaginacao.classList.add('d-none');
    return;
  }

  rodapePaginacao.classList.remove('d-none');

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const primeiroExibido = inicio + 1;
  const ultimoExibido = Math.min(inicio + itensPorPagina, totalItens);

  infoEl.innerHTML = `Mostrando <strong>${primeiroExibido}–${ultimoExibido}</strong> de <strong>${totalItens}</strong> solicitações • Slide/Página <strong>${paginaAtual}</strong> de <strong>${totalPaginas}</strong>`;

  // Atualiza estado das setas laterais do carrossel
  if (paginaAtual <= 1) {
    btnPrev.classList.add('disabled');
  } else {
    btnPrev.classList.remove('disabled');
  }

  if (paginaAtual >= totalPaginas) {
    btnNext.classList.add('disabled');
  } else {
    btnNext.classList.remove('disabled');
  }

  // Botão Anterior na paginação do rodapé
  const liPrev = document.createElement('li');
  liPrev.className = `page-item ${paginaAtual === 1 ? 'disabled' : ''}`;
  liPrev.innerHTML = `
    <button class="page-link" type="button" aria-label="Página Anterior">
      <i class="bi bi-chevron-left small"></i> Anterior
    </button>
  `;
  if (paginaAtual > 1) {
    liPrev.querySelector('button').addEventListener('click', () => irParaPagina(paginaAtual - 1));
  }
  ulPaginacao.appendChild(liPrev);

  // Botões numerados das páginas (sincronizados com os slides do carrossel)
  for (let num = 1; num <= totalPaginas; num += 1) {
    const li = document.createElement('li');
    li.className = `page-item ${num === paginaAtual ? 'active' : ''}`;
    li.innerHTML = `<button class="page-link" type="button">${num}</button>`;
    li.querySelector('button').addEventListener('click', () => irParaPagina(num));
    ulPaginacao.appendChild(li);
  }

  // Botão Próxima na paginação do rodapé
  const liNext = document.createElement('li');
  liNext.className = `page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}`;
  liNext.innerHTML = `
    <button class="page-link" type="button" aria-label="Próxima Página">
      Próxima <i class="bi bi-chevron-right small"></i>
    </button>
  `;
  if (paginaAtual < totalPaginas) {
    liNext.querySelector('button').addEventListener('click', () => irParaPagina(paginaAtual + 1));
  }
  ulPaginacao.appendChild(liNext);
}

/**
 * Atualiza os contadores gerais dos cards de resumo (Total, Abertas, Em andamento, Concluídas)
 */
async function atualizarContadoresGerais() {
  try {
    const resposta = await fetch(API_URL);
    const json = await resposta.json();
    if (!resposta.ok || !json.dados) return;

    const todas = json.dados;
    const total = todas.length;
    const abertas = todas.filter((s) => s.status === 'Aberta').length;
    const andamento = todas.filter((s) => s.status === 'Em andamento').length;
    const concluidas = todas.filter((s) => s.status === 'Concluída').length;

    document.getElementById('countTotal').textContent = total;
    document.getElementById('countAberta').textContent = abertas;
    document.getElementById('countAndamento').textContent = andamento;
    document.getElementById('countConcluida').textContent = concluidas;
  } catch (erro) {
    console.error('Erro ao atualizar contadores:', erro);
  }
}

/**
 * Abre o modal para cadastrar uma nova solicitação (RF01)
 */
function abrirModalCriacao() {
  document.getElementById('formSolicitacao').reset();
  document.getElementById('solicitacaoId').value = '';
  document.getElementById('modalFormularioTitulo').innerHTML =
    '<i class="bi bi-file-earmark-plus me-2"></i>Nova Solicitação';
  document.getElementById('avisoStatusInicial').classList.remove('d-none');
  ocultarAlertaForm();
  modalFormularioInstancia.show();
}

/**
 * Abre o modal preenchido para edição de uma solicitação existente
 */
function abrirModalEdicao(solicitacao) {
  document.getElementById('solicitacaoId').value = solicitacao.id;
  document.getElementById('inputTitulo').value = solicitacao.titulo;
  document.getElementById('inputCategoria').value = solicitacao.categoria;
  document.getElementById('inputPrioridade').value = solicitacao.prioridade;
  document.getElementById('inputDescricao').value = solicitacao.descricao;

  document.getElementById('modalFormularioTitulo').innerHTML =
    `<i class="bi bi-pencil-square me-2"></i>Editar Solicitação #${solicitacao.id}`;
  document.getElementById('avisoStatusInicial').classList.add('d-none');
  ocultarAlertaForm();
  modalFormularioInstancia.show();
}

/**
 * Salva uma nova solicitação (POST) ou atualiza uma existente (PUT) com validação (RF01, RF06)
 */
async function salvarSolicitacao(evento) {
  evento.preventDefault();
  ocultarAlertaForm();

  const id = document.getElementById('solicitacaoId').value;
  const payload = {
    titulo: document.getElementById('inputTitulo').value,
    categoria: document.getElementById('inputCategoria').value,
    prioridade: document.getElementById('inputPrioridade').value,
    descricao: document.getElementById('inputDescricao').value,
  };

  const metodo = id ? 'PUT' : 'POST';
  const url = id ? `${API_URL}/${id}` : API_URL;

  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      const listaErros = Array.isArray(json.erros) && json.erros.length > 0
        ? `<ul class="mb-0 ps-3">${json.erros.map((e) => `<li>${escaparHtml(e)}</li>`).join('')}</ul>`
        : escaparHtml(json.mensagem || 'Erro de validação nos dados informados.');
      exibirAlertaForm(listaErros);
      return;
    }

    if (!id) {
      paginaAtual = 1;
    }

    modalFormularioInstancia.hide();
    exibirFeedbackGlobal(json.mensagem, 'success');
    await carregarSolicitacoes();
    await atualizarContadoresGerais();
  } catch (erro) {
    console.error('Erro ao salvar solicitação:', erro);
    exibirAlertaForm('Falha de comunicação com o servidor ao salvar a solicitação.');
  }
}

/**
 * Avança o status diretamente a partir do botão de ação rápida no slide do carrossel (RF04)
 */
async function avancarStatusRapido(id, novoStatus) {
  try {
    const resposta = await fetch(`${API_URL}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus }),
    });

    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      exibirFeedbackGlobal(json.mensagem || 'Transição de status não permitida.', 'danger');
      return;
    }

    exibirFeedbackGlobal(json.mensagem, 'success');
    await carregarSolicitacoes();
    await atualizarContadoresGerais();
  } catch (erro) {
    console.error('Erro ao atualizar status:', erro);
    exibirFeedbackGlobal('Erro de conexão ao tentar atualizar o status.', 'danger');
  }
}

/**
 * Consulta uma solicitação na API por ID e abre o modal de detalhes e histórico (RF02)
 */
async function abrirModalDetalhes(id) {
  ocultarAlertasDetalhes();

  try {
    const resposta = await fetch(`${API_URL}/${id}`);
    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      exibirFeedbackGlobal(json.mensagem || 'Não foi possível carregar os detalhes.', 'danger');
      return;
    }

    preencherModalDetalhes(json.dados);
    modalDetalhesInstancia.show();
  } catch (erro) {
    console.error('Erro ao buscar detalhes:', erro);
    exibirFeedbackGlobal('Falha ao buscar os detalhes da solicitação.', 'danger');
  }
}

/**
 * Preenche os campos e a linha do tempo do histórico dentro do modal de detalhes
 */
function preencherModalDetalhes(solicitacao) {
  solicitacaoDetalheAtual = solicitacao;

  document.getElementById('modalDetalhesTitulo').textContent = `Solicitação #${solicitacao.id}`;
  document.getElementById('detalheCategoria').textContent = solicitacao.categoria;
  document.getElementById('detalheTitulo').textContent = solicitacao.titulo;
  document.getElementById('detalheDescricao').textContent = solicitacao.descricao;
  document.getElementById('detalheDatas').innerHTML =
    `Registrada em <strong>${formatarDataHora(solicitacao.criado_em)}</strong> • Última atualização em <strong>${formatarDataHora(solicitacao.atualizado_em)}</strong>`;

  document.getElementById('detalheStatusBadge').innerHTML = gerarBadgeStatus(solicitacao.status);
  document.getElementById('detalhePrioridadeBadge').innerHTML = gerarBadgePrioridade(solicitacao.prioridade);

  const proximo = obterProximoStatusPermitido(solicitacao.status);
  document.getElementById('selectNovoStatus').value = proximo || solicitacao.status;
  document.getElementById('inputObservacaoStatus').value = '';

  const containerHistorico = document.getElementById('listaHistorico');
  containerHistorico.innerHTML = '';

  if (!solicitacao.historico || solicitacao.historico.length === 0) {
    containerHistorico.innerHTML = '<p class="text-muted small mb-0">Nenhum registro de histórico disponível.</p>';
    return;
  }

  solicitacao.historico.forEach((h) => {
    const div = document.createElement('div');
    div.className = 'timeline-item';

    const transicaoTexto = h.status_anterior
      ? `<span class="badge bg-light text-dark border">${escaparHtml(h.status_anterior)}</span> <i class="bi bi-arrow-right mx-1 text-muted"></i> ${gerarBadgeStatus(h.status_novo)}`
      : `${gerarBadgeStatus(h.status_novo)} <span class="text-muted small ms-1">(Cadastro inicial)</span>`;

    div.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="bg-light border rounded p-2 px-3">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
          <div>${transicaoTexto}</div>
          <small class="text-muted">
            <i class="bi bi-clock me-1"></i>${formatarDataHora(h.data_mudanca)}
          </small>
        </div>
        ${h.observacao ? `<div class="small text-secondary">${escaparHtml(h.observacao)}</div>` : ''}
      </div>
    `;
    containerHistorico.appendChild(div);
  });
}

/**
 * Submete uma mudança de status a partir do modal de detalhes (permite demonstrar tanto o fluxo válido quanto o bloqueio RF04)
 */
async function submeterTransicaoNoModal(evento) {
  evento.preventDefault();
  if (!solicitacaoDetalheAtual) return;

  ocultarAlertasDetalhes();

  const novoStatus = document.getElementById('selectNovoStatus').value;
  const observacao = document.getElementById('inputObservacaoStatus').value;

  try {
    const resposta = await fetch(`${API_URL}/${solicitacaoDetalheAtual.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus, observacao }),
    });

    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      const alertaErro = document.getElementById('alertaErroDetalhes');
      alertaErro.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i><strong>Operação bloqueada (RF04/RF06):</strong> ${escaparHtml(json.mensagem)}`;
      alertaErro.classList.remove('d-none');
      return;
    }

    const alertaSucesso = document.getElementById('alertaSucessoDetalhes');
    alertaSucesso.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>${escaparHtml(json.mensagem)}`;
    alertaSucesso.classList.remove('d-none');

    preencherModalDetalhes(json.dados);
    await carregarSolicitacoes();
    await atualizarContadoresGerais();
  } catch (erro) {
    console.error('Erro ao submeter transição no modal:', erro);
  }
}

/**
 * Exclui uma solicitação após confirmação do usuário
 */
async function excluirSolicitacao(id) {
  const confirmar = window.confirm(`Deseja realmente excluir a solicitação #${id}? Esta ação não pode ser desfeita.`);
  if (!confirmar) return;

  try {
    const resposta = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    const json = await resposta.json();

    if (!resposta.ok || json.erro) {
      exibirFeedbackGlobal(json.mensagem || 'Erro ao excluir solicitação.', 'danger');
      return;
    }

    exibirFeedbackGlobal(json.mensagem, 'success');
    await carregarSolicitacoes();
    await atualizarContadoresGerais();
  } catch (erro) {
    console.error('Erro ao excluir solicitação:', erro);
    exibirFeedbackGlobal('Falha de comunicação ao excluir a solicitação.', 'danger');
  }
}

/**
 * Limpa todos os filtros ativos, reseta para a página 1 e recarrega o carrossel
 */
function limparFiltros() {
  document.getElementById('filtroBusca').value = '';
  document.getElementById('filtroStatus').value = '';
  document.getElementById('filtroPrioridade').value = '';
  paginaAtual = 1;
  destacarCardKpi('');
  carregarSolicitacoes();
}

/**
 * Destaca visualmente o card KPI correspondente ao filtro de status selecionado
 */
function destacarCardKpi(statusAtivo) {
  document.querySelectorAll('.kpi-card').forEach((card) => {
    const statusCard = card.getAttribute('data-filter-status') || '';
    if (statusCard === statusAtivo) {
      card.classList.add('active-kpi');
    } else {
      card.classList.remove('active-kpi');
    }
  });
}

/**
 * Retorna a próxima etapa válida de acordo com a regra RF04
 */
function obterProximoStatusPermitido(statusAtual) {
  if (statusAtual === 'Aberta') return 'Em andamento';
  if (statusAtual === 'Em andamento') return 'Concluída';
  return null;
}

/**
 * Helpers visuais para Badges e Formatação
 */
function gerarBadgeStatus(status) {
  if (status === 'Aberta') {
    return '<span class="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary-subtle px-2 py-1"><i class="bi bi-record-circle me-1"></i>Aberta</span>';
  }
  if (status === 'Em andamento') {
    return '<span class="badge rounded-pill bg-warning bg-opacity-25 text-warning-emphasis border border-warning-subtle px-2 py-1"><i class="bi bi-arrow-repeat me-1"></i>Em andamento</span>';
  }
  if (status === 'Concluída') {
    return '<span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success-subtle px-2 py-1"><i class="bi bi-check-circle-fill me-1"></i>Concluída</span>';
  }
  return `<span class="badge bg-secondary">${escaparHtml(status)}</span>`;
}

function gerarBadgePrioridade(prioridade) {
  if (prioridade === 'alta') {
    return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle text-uppercase"><i class="bi bi-arrow-up-short"></i>Alta</span>';
  }
  if (prioridade === 'média') {
    return '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle text-uppercase"><i class="bi bi-dash"></i>Média</span>';
  }
  if (prioridade === 'baixa') {
    return '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle text-uppercase"><i class="bi bi-arrow-down-short"></i>Baixa</span>';
  }
  return `<span class="badge bg-secondary">${escaparHtml(prioridade)}</span>`;
}

function formatarDataHora(isoString) {
  if (!isoString) return '-';
  const data = new Date(isoString);
  if (Number.isNaN(data.getTime())) return isoString;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function exibirFeedbackGlobal(mensagem, tipo = 'success') {
  const container = document.getElementById('feedbackContainer');
  const icone = tipo === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-octagon-fill';

  container.innerHTML = `
    <div class="alert alert-${tipo} alert-dismissible fade show shadow-sm d-flex align-items-center py-2 mb-0" role="alert">
      <i class="bi ${icone} me-2"></i>
      <div class="small">${escaparHtml(mensagem)}</div>
      <button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>
  `;

  setTimeout(() => {
    const alertEl = container.querySelector('.alert');
    if (alertEl) {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertEl);
      bsAlert.close();
    }
  }, 5000);
}

function exibirAlertaForm(htmlMensagem) {
  const el = document.getElementById('alertaErroForm');
  el.innerHTML = htmlMensagem;
  el.classList.remove('d-none');
}

function ocultarAlertaForm() {
  const el = document.getElementById('alertaErroForm');
  el.innerHTML = '';
  el.classList.add('d-none');
}

function ocultarAlertasDetalhes() {
  const erroEl = document.getElementById('alertaErroDetalhes');
  const sucessoEl = document.getElementById('alertaSucessoDetalhes');
  erroEl.classList.add('d-none');
  sucessoEl.classList.add('d-none');
}

function escaparHtml(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
