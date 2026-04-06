# Analise de Melhorias - Aba Projetos (Kanban/Calendario)

> Analise realizada em 2026-04-06 com base no codigo atual do repositorio.

---

## 1. Padrao visualizacao de mes (volta pra semana ao alterar card)

**Status: Parcialmente resolvido.**

O `CalendarioView.tsx` ja e uma visualizacao mensal. Nao existe uma "visualizacao de semana" no calendario. Se o problema era que ao editar um card o usuario era jogado de volta para outra view, isso pode ser um problema de **estado/re-render** que reseta a view ativa no `ProjetosPage.tsx`. Seria necessario verificar se o estado da view persiste apos edicoes (ex: salvar em `localStorage` ou `useState` que nao reseta).

---

## 2. Permitir mais de um responsavel pelo Card

**Status: JA RESOLVIDO.**

O sistema ja usa a tabela `projeto_equipe` que permite multiplos membros por projeto (usuarios e professores). No Kanban, exibe ate 3 avatares com "+X" para os demais.

---

## 3. Incluir perfil Colab Kids/L.A no card

**Status: NAO resolvido.**

As unidades vem da tabela `unidades` (Campo Grande, Recreio, Barra). Nao existe um campo de "perfil" (Kids, LA, Colab Kids/LA) nos projetos.

**O que fazer:**
- Criar um campo `perfil` (ou `marca`) na tabela `projetos` com opcoes: `kids`, `la`, `colab_kids_la`
- Adicionar o seletor no modal de criacao/edicao

---

## 4. Incluir categoria EVENTO no Card

**Status: Resolvivel via configuracao.**

O sistema ja tem `projeto_tipos` (tipos customizaveis com nome, icone, cor). Basta adicionar um tipo "Evento" na tela de Configuracoes > Tipos de Projeto, sem precisar alterar codigo.

---

## 5. Dividir Data de Producao em Data de Gravacao e Data de Edicao

**Status: NAO resolvido.**

Projetos tem apenas `data_inicio` e `data_fim`. Tarefas tem apenas `prazo`. Nao existem campos separados para gravacao e edicao.

**O que fazer:**
- Adicionar colunas `data_gravacao` e `data_edicao` na tabela `projetos` (ou nas tarefas)
- Atualizar modais de criacao/edicao e o tipo TypeScript

---

## 6. Etiqueta Kids/LA/Colab visivel no calendario

**Status: NAO resolvido.**

O calendario mostra badges de tipo (projeto/tarefa) com cor do `projeto_tipos`, mas nao exibe nenhuma etiqueta de marca/perfil. Depende do ponto 3 ser implementado primeiro.

**O que fazer:**
- Apos implementar o ponto 3, exibir a etiqueta de perfil (Kids/LA/Colab) nos eventos do calendario

---

## 7. Verde se publicado, vermelho se nao postado

**Status: NAO resolvido.**

Atualmente as cores sao baseadas em **urgencia/prazo** (vermelho = atrasado, ambar = proximo do prazo, verde = concluido). Nao ha logica que diferencie "publicado" vs "agendado".

**O que fazer:**
- Que os status das colunas Kanban ("Publicado", "Agendado") influenciem a cor no calendario
- Logica: se status = `concluido` (publicado/agendado) -> verde; se prazo passou e status != concluido -> vermelho

---

## 8. Cards de Projetos no Calendario Geral como Entregas

**Status: Nao verificavel neste repo.**

O "Calendario Geral" parece estar em outro modulo/app (possivelmente o `LAperformanceReport`). No modulo de Projetos, o calendario interno usa `data_fim` para projetos e `prazo` para tarefas. Se ha integracao com um calendario geral, seria necessario verificar como os dados sao puxados la e ajustar para que projetos aparecam como "entregas" usando `data_fim`.

---

## Resumo

| # | Pedido | Status |
|---|--------|--------|
| 1 | View mes como padrao | Parcial — calendario ja e mensal, mas pode ter bug de reset de view |
| 2 | Multiplos responsaveis | **Ja resolvido** |
| 3 | Perfil Colab Kids/LA | **Resolvido** — badge de marca visivel no kanban, lista e calendario |
| 4 | Categoria EVENTO | Resolvivel via config no app (sem codigo) |
| 5 | Data Gravacao + Data Edicao | **Resolvido** — campos separados data_gravacao e data_edicao (opcionais) |
| 6 | Etiqueta Kids/LA no calendario | **Resolvido** — badge de marca nos chips do calendario |
| 7 | Verde/Vermelho por status publicacao | Nao resolvido — logica de cor precisa mudar |
| 8 | Projetos no Calendario Geral como Entregas | Precisa verificar no outro app |
