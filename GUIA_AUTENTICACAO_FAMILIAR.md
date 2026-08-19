# Autenticação familiar

O aplicativo usa o Firebase Authentication com e-mail e senha. Os dados financeiros existentes
continuam nas coleções atuais e passam a ser acessíveis somente por membros ativos da família
principal depois que as regras forem publicadas.

## 1. Ativar o provedor

No Firebase Console, abra **Authentication → Sign-in method → E-mail/senha**, ative a primeira
opção e salve. O provedor anônimo pode ser desativado depois que o primeiro administrador criar
sua conta.

## 2. Criar o primeiro administrador

Abra o aplicativo, selecione **Criar conta** e depois **Criar família**. A primeira pessoa cria a
família principal e recebe o papel de administrador. Os dados antigos aparecem automaticamente.

## 3. Publicar as regras

Com o Firebase CLI instalado e autenticado:

```bash
firebase use finances-control-a8b73
firebase deploy --only firestore:rules
```

As regras em `firestore.rules` bloqueiam usuários anônimos, exigem membro ativo para acessar os
dados financeiros e reservam alterações de acesso aos administradores.

## 4. Convidar outras pessoas

O administrador abre **Gerenciar família** na barra lateral, copia o código de convite e o envia
ao familiar. A outra pessoa cria a própria conta e escolhe **Entrar com código**.
