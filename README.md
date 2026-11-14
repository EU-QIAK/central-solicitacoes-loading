# Central de Solicitações Internas — LOADING Desenvolvimento Jr.

Projeto prático Full Stack desenvolvido para o **Processo Seletivo 2026.2 (Setor de Projetos)** da **Loading Desenvolvimento Jr.**

A aplicação consiste em um sistema web completo (Interface Web + API REST + Persistência em Banco de Dados SQLite) para registrar solicitações internas de uma organização, filtrar demandas por prioridade, status e texto, e controlar seu ciclo de resolução com validação estrita de regras de negócio.

---

## Tecnologias e Dependências Utilizadas

### Backend (API e Persistência)
- **Node.js (v22+)**: Ambiente de execução JavaScript no servidor.
- **TypeScript (`typescript`, `tsx`)**: Tipagem estática para maior segurança, legibilidade e facilidade de manutenção do código.
- **Express (`express`, `cors`)**: Framework web para construção das rotas da API REST e entrega dos arquivos estáticos da interface.
- **SQLite (`node:sqlite`)**: Banco de dados relacional embutido em arquivo local (`database/solicitacoes.sqlite`), garantindo persistência real em disco após reiniciar a aplicação sem depender de servidores externos ou configurações adicionais.

### Frontend (Interface Web)
- **HTML5 Semântico e CSS3**: Estruturação limpa, layout responsivo com cabeçalho e rodapé fixos e estilização alinhada à identidade visual da Loading.
- **Bootstrap 5.3 e Bootstrap Icons**: Componentes responsivos (carrossel de páginas, paginação, modais, badges, formulários e alertas).
- **JavaScript (ES6+ / Fetch API)**: Consumo assíncrono da API REST, manipulação dinâmica do DOM e exibição de mensagens de validação.

---

## Arquitetura e Organização do Projeto

O projeto adota uma estrutura baseada no padrão **MVC (Model-View-Controller)**, separando as responsabilidades entre interface, controle de rotas/regras de negócio e persistência de dados:

```text
central-solicitacoes-loading/
├── database/
│   └── solicitacoes.sqlite          # Arquivo do banco SQLite (gerado automaticamente)
├── src/
│   ├── database/
│   │   └── connection.ts            # Conexão SQLite, criação das tabelas (DDL) e dados iniciais
│   ├── models/
│   │   └── SolicitacaoModel.ts      # Interfaces TypeScript e consultas SQL parametrizadas
│   ├── controllers/
│   │   └── SolicitacaoController.ts # Validações de entrada e regra de transição de status (RF04/RF06)
│   ├── routes/
│   │   └── solicitacaoRoutes.ts     # Definição dos endpoints REST (/api/solicitacoes)
│   ├── tests/
│   │   └── requisitos.test.ts       # Testes automatizados dos requisitos RF01 a RF06
│   └── server.ts                    # Inicialização do servidor Express e middlewares
├── view/
│   ├── assets/                      # Logotipo e favicon da Loading
│   ├── css/
│   │   └── style.css                # Estilização responsiva complementar ao Bootstrap 5
│   ├── js/
│   │   └── app.js                   # Integração Fetch API, carrossel paginado e eventos
│   └── index.html                   # Interface principal da aplicação
├── package.json
├── tsconfig.json
└── README.md
```

---

## Funcionalidades Implementadas

### Requisitos Obrigatórios
- **RF01 — Cadastro**: Registro de solicitação com `título`, `categoria`, `prioridade` (`baixa`, `média` ou `alta`) e `descrição` (opcional, assumindo o valor padrão `"sem descrições detalhadas"` quando não informada). O status inicial é definido obrigatoriamente pelo backend como `Aberta`.
- **RF02 — Consulta**: Listagem geral das solicitações e visualização detalhada de cada demanda em modal dedicado.
- **RF03 — Filtros**: Filtragem combinada na API e na interface por **status** (`Aberta`, `Em andamento`, `Concluída`) e por **prioridade** (`baixa`, `média`, `alta`).
- **RF04 — Regra de Negócio (Fluxo de Status)**: Controle estrito da máquina de estados `Aberta` → `Em andamento` → `Concluída`. A API bloqueia tentativas de saltar etapas (ex.: `Aberta` → `Concluída`) ou retroceder status.
- **RF05 — Persistência**: Armazenamento persistente em arquivo SQLite (`database/solicitacoes.sqlite`), mantendo todos os dados após reiniciar o servidor.
- **RF06 — Integração e Validação**: Integração via `fetch` entre frontend e API, rejeitando campos obrigatórios vazios ou transições inválidas com códigos HTTP adequados (`400 Bad Request`, `404 Not Found`) e mensagens compreensíveis ao usuário.

### Funcionalidades Opcionais Implementadas
- **Busca Textual**: Pesquisa em tempo real por termos presentes no `título`, `descrição` ou `categoria`.
- **Carrossel de Páginas e Paginação**: Listagem estruturada em slides de páginas sincronizados com controles de paginação e seletor de quantidade de itens por página.
- **Histórico de Mudanças de Status**: Tabela relacional (`historico_status`) vinculada por chave estrangeira (`ON DELETE CASCADE`) que registra cada mudança de status com data/hora, status anterior, novo status e observação opcional, exibida em formato de linha do tempo.
- **Edição e Exclusão**: Possibilidade de atualizar os dados cadastrais (`PUT /api/solicitacoes/:id`) ou remover uma solicitação (`DELETE /api/solicitacoes/:id`).
- **Cards de Resumo Interativos (KPIs)**: Contadores dinâmicos no topo da página (Total, Abertas, Em Andamento e Concluídas) que funcionam como atalhos de filtro.
- **Testes Automatizados**: Suite de verificação automatizada dos requisitos funcionais (`npm test`).

---

## Instruções para Instalação e Execução Local

### Pré-requisitos
- **Node.js** versão **22.5.0 ou superior** (recomendado: Node.js v22 LTS, que inclui o módulo nativo `node:sqlite`).
- **Git** instalado.

### Passo a passo

1. **Clone o repositório e acesse a pasta do projeto:**
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd central-solicitacoes-loading
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie a aplicação:**
   - Em modo de desenvolvimento (com recarregamento automático):
     ```bash
     npm run dev
     ```
   - Ou em modo padrão:
     ```bash
     npm start
     ```

4. **Acesse no navegador:**
   ```text
   http://localhost:3000
   ```

5. **Executar os testes automatizados de validação dos requisitos (RF01 a RF06):**
   ```bash
   npm test
   ```

---

## Documentação da API REST

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/solicitacoes` | Lista solicitações. Aceita query params opcionais: `?status=`, `?prioridade=` e `?busca=`. |
| `GET` | `/api/solicitacoes/:id` | Retorna os dados completos de uma solicitação e seu array `historico` de mudanças de status. |
| `POST` | `/api/solicitacoes` | Cria uma nova solicitação (`titulo`, `categoria`, `prioridade`, `descricao`). Status inicial sempre `Aberta`. |
| `PUT` | `/api/solicitacoes/:id` | Atualiza os dados cadastrais (`titulo`, `categoria`, `prioridade`, `descricao`) de uma solicitação. |
| `PATCH` | `/api/solicitacoes/:id/status` | Altera o status respeitando a regra `Aberta` → `Em andamento` → `Concluída`. Aceita `{ status, observacao }`. |
| `DELETE` | `/api/solicitacoes/:id` | Exclui uma solicitação e seu respectivo histórico. |

### Exemplos de Validação (RF04 e RF06)
- **Campo obrigatório vazio (`POST /api/solicitacoes`):** Retorna `HTTP 400` com a lista detalhada dos campos faltantes.
- **Salto de etapa inválido (`PATCH /api/solicitacoes/:id/status`):** Ao tentar mudar de `Aberta` diretamente para `Concluída`, a API retorna `HTTP 400`:
  ```json
  {
    "erro": true,
    "mensagem": "Transição inválida de \"Aberta\" para \"Concluída\". O fluxo exige a ordem Aberta → Em andamento → Concluída (próxima etapa permitida: \"Em andamento\")."
  }
  ```

---

## Declaração sobre Uso de Inteligência Artificial

Em conformidade com as orientações do edital do Processo Seletivo:
- Ferramentas de Inteligência Artificial foram utilizadas como apoio ao desenvolvimento para estruturação inicial do projeto Express/TypeScript, organização da estilização responsiva com Bootstrap 5 e revisão da documentação.
- Todas as regras de negócio (como a máquina de estados do fluxo RF04, validações RF06 e modelagem relacional SQLite RF05) foram revisadas, compreendidas e validadas na aplicação.
