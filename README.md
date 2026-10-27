# devTools

Notas copiáveis, registro de cards concluídos e kanban. Dados ficam no `localStorage`, com espelho comprimido em cookies (até ~10 KB) e backup automático em pasta (Chrome/Edge/Vivaldi) pelo menu **Dados**.

Atalhos: `/` buscar, `n` novo, `1` `2` `3` trocar de tela, `Esc` fechar, `Ctrl+Enter` salvar, `?` ajuda.

```bash
npm install
npm start        # http://localhost:4200
npm run build    # dist/devtools/browser
```

Deploy na Vercel: importar o repositório; `vercel.json` já define build, saída e rewrite da SPA.
