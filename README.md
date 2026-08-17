# Controle Financeiro (Next.js)

Dashboard de controle financeiro compartilhado, feito em Next.js (App Router) + TypeScript,
com contas, saldos, cartões, fechamento e pagamento de faturas, orçamentos, recorrências, metas financeiras, reserva de emergência, previsão de caixa, receitas, despesas e transferências sincronizadas em tempo real no Firebase
(Firestore), além de tela de PIN compartilhado.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # depois cole suas chaves do Firebase no .env.local
npm run dev
```

Abra http://localhost:3000

## Publicando na Vercel

Veja o passo a passo completo em `GUIA_CONFIGURACAO.md` (configuração do Firebase) e
`GUIA_DEPLOY_VERCEL.md` (publicar o site).

## Estrutura

- `app/page.tsx` — página principal (monta sidebar, formulário, tabela e gráficos)
- `app/layout.tsx` — fonte (Poppins) e metadados
- `components/` — contas, cartões, orçamentos, recorrências, metas, reserva de emergência, previsão de caixa, formulário, tabela e gráficos
- `hooks/useAppData.ts` — autenticação anônima + leitura/escrita em tempo real no Firestore
- `lib/firebase.ts` — inicialização do Firebase a partir das variáveis de ambiente
- `lib/categories.ts` — categorias, cores e funções de formatação
