# Controle Financeiro (Next.js)

Dashboard de controle financeiro compartilhado, feito em Next.js (App Router) + TypeScript,
com contas, saldos, cartões, faturas, orçamentos, recorrências, metas, reserva de emergência, previsão de caixa, importação CSV/OFX, categorias personalizadas, tags, notas, regras automáticas, insights e revisão inteligente sincronizados em tempo real no Firebase
(Firestore), além de autenticação individual e gestão de acesso familiar.

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
- `components/` — contas, cartões, orçamentos, recorrências, metas, importação de extratos, categorias personalizadas, regras automáticas, insights, revisão, previsão de caixa, formulário, tabela e gráficos
- `hooks/useAppData.ts` — autenticação familiar + leitura/escrita em tempo real no Firestore
- `components/FamilyAuthGate.tsx` — login, cadastro e entrada na família por convite
- `components/FamilyManager.tsx` — membros, papéis, acessos e código de convite
- `lib/firebase.ts` — inicialização do Firebase a partir das variáveis de ambiente
- `lib/categories.ts` — categorias, cores e funções de formatação
- `lib/insights.ts` — análise local de anomalias, tendências, assinaturas, riscos e saúde financeira
- `lib/transaction-review.ts` — detecção local de dados incompletos, categorias genéricas e possíveis duplicidades
- `lib/statement-import.ts` — leitura local de CSV/OFX, normalização bancária e prevenção de reimportações
- `lib/categorization-rules.ts` — correspondência e aplicação determinística de regras por descrição
