# Como fazer o deploy (publicar o sistema)

## 1. Criar o banco de dados (Neon — gratuito)

1. Acesse https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto chamado **igreja-relatorios**
3. Na tela do projeto, copie a **Connection string** (começa com `postgresql://...`)

## 2. Configurar o banco de dados localmente

Copie `.env.example` para `.env` e preencha:

```
DATABASE_URL="postgresql://usuario:senha@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
SESSION_SECRET="(gere com: openssl rand -base64 32)"
```

As variáveis `SEED_*` e `CHURCH_*` só são usadas pelo comando de seed.

Depois, execute no terminal (na raiz do projeto):

```bash
npm install
npx prisma db push
npm run db:seed
```

Isso cria as tabelas no banco e o usuário super-admin e a igreja inicial.
O template do relatório (`public/template/REFC-template.docx`) já vem pronto.

## 3. Publicar no Vercel (gratuito)

1. Acesse https://vercel.com e crie uma conta gratuita (pode entrar com o GitHub)
2. Clique em **Add New → Project**
3. Conecte com o repositório GitHub do projeto
4. Na tela de configuração, adicione as variáveis de ambiente:
   - `DATABASE_URL`: a connection string do Neon
   - `SESSION_SECRET`: um segredo aleatório (o mesmo tipo do `.env`; sem ele o login não funciona)
5. Clique em **Deploy**

Após o deploy, o sistema estará acessível por um link como `https://seu-projeto.vercel.app`

## 4. Usar em celular (como app)

No celular, abra o link do Vercel no navegador e procure a opção
**"Adicionar à tela inicial"** (Chrome: menu ⋮ → Adicionar à tela inicial).
O sistema funcionará como um aplicativo instalado.

## Executar localmente (para testes)

```bash
npm install
npm run dev
```

Abra http://localhost:3000 no navegador.
