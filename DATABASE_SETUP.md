# Configuração do Banco de Dados - SQLite

## Aplicação Portátil com SQLite

Esta aplicação usa **SQLite** como banco de dados principal, tornando-a completamente portátil. Não é necessário instalar ou configurar um servidor de banco de dados separado.

## Vantagens do SQLite

- ✅ **Portabilidade**: Apenas um arquivo de banco (`database.db`)
- ✅ **Simplicidade**: Não precisa de servidor de banco rodando
- ✅ **Fácil backup**: Copiar o arquivo `database.db`
- ✅ **Zero configuração**: Funciona out-of-the-box
- ✅ **Ideal para desenvolvimento e pequenas/médias aplicações**

## Configuração

### 1. O banco de dados é criado automaticamente

Quando você executar a primeira migration, o Prisma criará automaticamente o arquivo `database.db` na raiz do projeto:

```bash
npx prisma migrate dev --name init_sqlite
```

Isso criará:
- O arquivo `database.db` (banco de dados SQLite)
- Todas as tabelas necessárias (User, TestHistory, TestStepResult, RAWhitelist)

### 2. Não precisa de arquivo .env

Com SQLite, você **não precisa** criar um arquivo `.env` com `DATABASE_URL`. O caminho do banco está configurado diretamente no `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./database.db"
}
```

### 3. Executar Seed (opcional)

Para popular o banco com dados iniciais (RAs na whitelist):

```bash
npm run seed
```

Ou:

```bash
npx prisma db seed
```

## Estrutura do Banco

O arquivo `database.db` contém todas as tabelas:

- **User**: Usuários do sistema (com campo `is_admin`)
- **TestHistory**: Histórico de testes realizados
- **TestStepResult**: Resultados detalhados de cada passo do teste
- **RAWhitelist**: Lista de RAs permitidos para registro

## Backup e Restauração

### Backup

Simplesmente copie o arquivo `database.db`:

```bash
# Windows
copy database.db database.backup.db

# Linux/Mac
cp database.db database.backup.db
```

### Restauração

Substitua o arquivo `database.db` pelo backup:

```bash
# Windows
copy database.backup.db database.db

# Linux/Mac
cp database.backup.db database.db
```

## Localização do Arquivo

O banco de dados está localizado na raiz do projeto:

```
NewPixWebTester/
  ├── database.db          ← Banco de dados SQLite
  ├── prisma/
  ├── src/
  └── ...
```

## Limitações do SQLite

- ⚠️ Menos performance com muitas escritas simultâneas
- ⚠️ Recomendado para até ~100k requisições/dia
- ⚠️ Não suporta alguns recursos avançados do PostgreSQL

**Para produção com muitos usuários simultâneos**, considere migrar para PostgreSQL ou outro banco de dados mais robusto.

## Troubleshooting

### Erro: "database is locked"

Isso pode acontecer se:
- Múltiplas instâncias da aplicação estão tentando escrever simultaneamente
- O arquivo está aberto em outro programa (ex: DB Browser for SQLite)

**Solução**: Feche outras instâncias ou programas que possam estar usando o banco.

### Erro: "no such table"

Execute a migration:

```bash
npx prisma migrate dev
```

### Erro: "database file is corrupted"

Restore do backup ou recrie o banco:

```bash
# Deletar banco corrompido
rm database.db

# Recriar
npx prisma migrate dev
npm run seed
```

## Visualizar o Banco de Dados

Você pode usar ferramentas como:
- **DB Browser for SQLite** (https://sqlitebrowser.org/)
- **SQLite Studio** (https://sqlitestudio.pl/)
- **VS Code Extension**: SQLite Viewer

Ou via Prisma Studio:

```bash
npx prisma studio
```

Isso abrirá uma interface web em `http://localhost:5555` para visualizar e editar os dados.
