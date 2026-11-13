import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { initializeDatabase } from './database/connection';
import solicitacaoRoutes from './routes/solicitacaoRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Inicializa o banco de dados SQLite e garante a estrutura das tabelas (RF05)
initializeDatabase();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da camada de visualização (Frontend Bootstrap 5 + HTML/CSS/JS)
const viewPath = path.resolve(__dirname, '../view');
app.use(express.static(viewPath));

// Rotas da API REST
app.use('/api/solicitacoes', solicitacaoRoutes);

// Rota de verificação de saúde da API
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    aplicacao: 'Central de Solicitações - Loading Jr.',
    timestamp: new Date().toISOString(),
  });
});

// Fallback para entregar a interface principal em rotas não-API
app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      erro: true,
      mensagem: `Rota da API não encontrada: ${req.method} ${req.originalUrl}`,
    });
    return;
  }
  res.sendFile(path.join(viewPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🚀 Central de Solicitações (Loading Jr.) rodando com sucesso!`);
  console.log(`🌐 Interface Web: http://localhost:${PORT}`);
  console.log(`🔌 API REST:      http://localhost:${PORT}/api/solicitacoes`);
  console.log(`=============================================================`);
});

export default app;
