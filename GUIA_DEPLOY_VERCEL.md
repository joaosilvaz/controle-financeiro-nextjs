# Guia de publicação — Vercel

Depois de configurar o Firebase (veja `GUIA_CONFIGURACAO.md`), falta colocar o site no ar com
um link que sua mãe e seu pai possam abrir de qualquer navegador.

A Vercel é a empresa que mantém o Next.js — hospedar um projeto Next.js lá é gratuito para uso
pessoal e não pede cartão de crédito.

## Opção A — pelo terminal (mais rápido, sem precisar de GitHub)

1. Instale a ferramenta da Vercel (uma vez só):
   ```bash
   npm install -g vercel
   ```
2. Dentro da pasta do projeto, rode:
   ```bash
   vercel login
   ```
   Isso abre o navegador para você entrar com Google, GitHub ou e-mail — a conta é sua, criada
   por você.
3. Ainda na pasta do projeto, rode:
   ```bash
   vercel
   ```
   Responda as perguntas (pode aceitar os padrões). Ele vai gerar um link de teste.
4. Adicione as variáveis de ambiente do Firebase (as mesmas do `.env.local`):
   ```bash
   vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
   vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
   vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
   ```
   Para cada uma, cole o valor correspondente do seu projeto Firebase quando for pedido, e
   escolha "Production" (e também "Preview"/"Development" se quiser testar).
5. Publique a versão de produção:
   ```bash
   vercel --prod
   ```
6. A Vercel mostra o link final (algo como `controle-financeiro.vercel.app`). Esse é o link que
   você compartilha com sua mãe e seu pai.

## Opção B — pelo site da Vercel, com GitHub (melhor se você for continuar mexendo no código)

1. Suba o código para um repositório no GitHub (crie uma conta em github.com se ainda não tiver).
2. Em vercel.com, crie uma conta (dá pra entrar direto com GitHub) e clique em **Add New → Project**.
3. Selecione o repositório do projeto.
4. Na tela de configuração, abra **Environment Variables** e adicione as seis variáveis
   `NEXT_PUBLIC_FIREBASE_*` com os valores do seu projeto Firebase.
5. Clique em **Deploy**.
6. A cada vez que você enviar uma alteração para o GitHub, a Vercel atualiza o site sozinha.

## Depois de publicado

- O link pode ser aberto em qualquer celular ou computador, sem instalar nada.
- Se quiser trocar de PIN, use o botão "Alterar PIN" dentro do app — não precisa mexer no
  código nem redeployar.
- Se quiser trocar as chaves do Firebase depois, atualize as variáveis de ambiente em
  Vercel → seu projeto → Settings → Environment Variables, e rode `vercel --prod` de novo
  (ou peça um "Redeploy" pelo site).
