# NewPix Web Tester

Plataforma full-stack de testes para protocolo bancário TCP, construída com Node.js/Express e React.

## Características

- ✅ **Aplicação Portátil**: Usa SQLite como banco de dados principal (arquivo local)
- ✅ **Painel de Admin**: Gerenciamento de whitelist de RAs e usuários
- ✅ **Testes Automatizados**: Testa tanto servidor quanto cliente do aluno
- ✅ **WebSocket em Tempo Real**: Logs de teste ao vivo
- ✅ **Sistema de Pontuação**: Avaliação automática baseada em critérios definidos

## Pré-requisitos

- Node.js 24 ou superior
- npm ou yarn

**Não é necessário instalar PostgreSQL ou qualquer servidor de banco de dados!** A aplicação usa SQLite (arquivo local).

## Instalação

### 1. Instalar Dependências

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configurar Banco de Dados

O banco de dados SQLite será criado automaticamente na primeira migration. Execute:

```bash
npx prisma migrate dev --name init_sqlite
```

Isso criará o arquivo `database.db` na raiz do projeto.

### 3. Popular Banco com Dados Iniciais

Execute o seed para adicionar RAs iniciais à whitelist:

```bash
npm run seed
```

### 4. Criar Usuário Admin

1. Registre um usuário através da interface web (`/register`)
   - Use um dos RAs que estão na whitelist (ex: `a2317974`)
2. Promova o usuário a admin:
   - Via Prisma Studio: `npx prisma studio` → edite `is_admin = true`
   - Ou via SQL: `UPDATE User SET is_admin = 1 WHERE ra = 'a2317974';`

## Executando a Aplicação

### Backend

```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3000`

### Frontend

```bash
cd frontend
npm run dev
```

O frontend estará rodando em `http://localhost:5173` (ou outra porta do Vite)

## Estrutura do Projeto

```
NewPixWebTester/
├── database.db          # Banco de dados SQLite (criado automaticamente)
├── prisma/
│   ├── schema.prisma    # Schema do banco de dados
│   └── seed.ts         # Script para popular dados iniciais
├── src/
│   ├── config.ts        # Configurações (JWT, etc)
│   ├── index.ts         # Servidor Express
│   ├── middleware/      # Middlewares (auth, adminAuth)
│   ├── routes/          # Rotas da API
│   ├── services/        # Serviços (WebSocket, TCP, Scoring)
│   ├── validator.ts     # Validador de protocolo
│   └── rules.ts         # Regras do protocolo
└── frontend/
    └── src/
        └── pages/       # Páginas React (Login, Dashboard, Admin)
```

## Funcionalidades

### Autenticação
- Registro com whitelist de RAs
- Login com JWT
- Proteção de rotas

### Testes
- **Teste de Servidor**: Testa o servidor TCP do aluno (itens f-o)
- **Teste de Cliente**: Testa o cliente TCP do aluno com wizard passo-a-passo (itens a-e)

### Painel de Admin
- Gerenciar whitelist de RAs
- Gerenciar usuários
- Promover/rebaixar admins

## Banco de Dados

A aplicação usa **SQLite** como banco principal, armazenado no arquivo `database.db`.

### Backup

Para fazer backup, simplesmente copie o arquivo:

```bash
copy database.db database.backup.db
```

### Visualizar Dados

Use o Prisma Studio:

```bash
npx prisma studio
```

## Documentação Adicional

- `ADMIN_SETUP.md` - Configuração do painel de admin
- `DATABASE_SETUP.md` - Informações sobre o banco SQLite

## Tecnologias

- **Backend**: Node.js, Express.js, TypeScript, Prisma, SQLite
- **Frontend**: React, Vite, Axios
- **WebSocket**: ws
- **TCP**: Módulo nativo `net`
- **Autenticação**: JWT

## Licença

ISC





