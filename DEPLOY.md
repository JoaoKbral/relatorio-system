# Como fazer o deploy (publicar o sistema)

## 1. Criar o banco de dados (Neon — gratuito)

1. Acesse https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto chamado **igreja-relatorios**
3. Na tela do projeto, copie a **Connection string** (começa com `postgresql://...`)

## 2. Configurar o banco de dados localmente

No arquivo `.env`, cole a connection string do Neon:

```
DATABASE_URL="postgresql://usuario:senha@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Depois, execute no terminal (dentro da pasta `web`):

```bash
npx prisma db push
node scripts/prepare-template.mjs
```

Isso cria as tabelas no banco e prepara o template ODT.

## 3. Publicar no Vercel (gratuito)

1. Acesse https://vercel.com e crie uma conta gratuita (pode entrar com o GitHub)
2. Clique em **Add New → Project**
3. Faça upload da pasta `web` ou conecte com um repositório GitHub
4. Na tela de configuração, adicione a variável de ambiente:
   - **Name:** `DATABASE_URL`
   - **Value:** (cole a connection string do Neon)
5. Clique em **Deploy**

Após o deploy, o sistema estará acessível por um link como `https://seu-projeto.vercel.app`

## 4. Usar em celular (como app)

No celular, abra o link do Vercel no navegador e procure a opção
**"Adicionar à tela inicial"** (Chrome: menu ⋮ → Adicionar à tela inicial).
O sistema funcionará como um aplicativo instalado.

## Executar localmente (para testes)

```bash
cd web
npm install
npm run dev
```

Abra http://localhost:3000 no navegador.
