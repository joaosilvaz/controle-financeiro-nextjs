# Guia de configuração — Firebase (banco de dados compartilhado)

Este guia cria o banco de dados na nuvem que o app usa para compartilhar os lançamentos entre
você, sua mãe e seu pai. Leva uns 10 minutos e só precisa de uma conta Google — sem cartão de
crédito no plano gratuito.

## Passo 1 — Criar o projeto no Firebase

1. Acesse **console.firebase.google.com** e entre com sua conta Google.
2. Clique em **Criar projeto**.
3. Dê um nome, por exemplo `controle-financeiro-familia`.
4. Pode **desativar** o Google Analytics — não é necessário.
5. Clique em **Criar projeto**.

## Passo 2 — Registrar um "app da Web"

1. Na tela inicial do projeto, clique no ícone **`</>`** (Web).
2. Dê um apelido, por exemplo `dashboard`.
3. **Não** marque a opção de configurar o Firebase Hosting (vamos usar a Vercel).
4. Clique em **Registrar app**.
5. Copie o bloco `firebaseConfig` que aparece — você vai precisar de cada valor no próximo passo:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "controle-financeiro-familia.firebaseapp.com",
  projectId: "controle-financeiro-familia",
  storageBucket: "controle-financeiro-familia.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

## Passo 3 — Colocar as chaves no projeto

Para rodar **localmente**:

1. Copie o arquivo `.env.local.example` para `.env.local`.
2. Preencha cada linha com o valor correspondente do Passo 2:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=controle-financeiro-familia.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=controle-financeiro-familia
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=controle-financeiro-familia.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Para publicar **na Vercel**, essas mesmas seis variáveis vão em Settings → Environment Variables
(ou via `vercel env add`) — veja `GUIA_DEPLOY_VERCEL.md`.

> Essas chaves não são senha — não protegem nada sozinhas. Quem protege os dados de verdade são
> as regras do Firestore, configuradas no Passo 5.

## Passo 4 — Ativar o login anônimo

Isso permite que o app se conecte ao banco de dados sem contas individuais — vocês entram com
um PIN compartilhado em vez disso.

1. No menu lateral do Firebase, vá em **Build → Authentication**.
2. Clique em **Vamos começar**.
3. Na aba **Sign-in method**, clique em **Anônimo**.
4. **Ative** e clique em **Salvar**.

## Passo 5 — Criar o banco de dados (Firestore)

1. No menu lateral, vá em **Build → Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Escolha uma localização próxima, por exemplo `southamerica-east1 (São Paulo)`.
4. Escolha **Iniciar em modo de produção**.
5. Na aba **Regras**, substitua o conteúdo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Clique em **Publicar**.

## Passo 6 — Publicar e compartilhar

Siga o `GUIA_DEPLOY_VERCEL.md` para colocar o site no ar. Depois, envie o link para sua mãe e
seu pai. Na primeira vez, vai pedir o **PIN** — o inicial é `1234`. Depois de entrar, use
"Alterar PIN" na barra lateral para trocar por um número que só vocês três saibam.

## Perguntas frequentes

**Isso custa alguma coisa?**
Não. O plano gratuito do Firebase (Spark) aguenta tranquilamente o uso de uma família.

**É seguro?**
Razoavelmente, para uso pessoal: só quem tiver o link e o PIN acessa os dados. Não é o nível de
proteção de um banco de verdade — não guarde senha de banco, número de cartão completo ou dados
assim dentro do app, só valores e descrições dos gastos.

**Posso mudar o PIN depois?**
Sim, quantas vezes quiser, pelo botão "Alterar PIN" dentro do app — não precisa mexer em código
nem publicar de novo.

**E se eu quiser adicionar uma quarta pessoa ou um cartão novo?**
Use os botões "+ Nova pessoa" / "+ Novo cartão/forma" no formulário de lançamento.
