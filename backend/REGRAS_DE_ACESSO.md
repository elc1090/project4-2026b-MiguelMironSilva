# Regras de acesso

## Resenhas públicas — etapa 2

- Qualquer visitante pode ler as resenhas de um filme. A resposta pública inclui o nome e o identificador do autor, mas não seu e-mail.
- É preciso entrar na conta para publicar. Cada usuário pode manter uma avaliação por filme, contendo uma nota de 0 a 10, um texto de até 2.000 caracteres, ou ambos. Após apagar a própria avaliação, é possível publicar outra.
- Nesta etapa, **apenas o autor** pode editar ou excluir sua resenha. O papel de superusuário não concede acesso a essas operações sobre resenhas alheias.
- Favoritos e assistidos continuam sendo estado pessoal da biblioteca. Nota e texto pertencem juntos à avaliação pública. Remover um filme da biblioteca não apaga sua avaliação, e excluir a avaliação não altera favoritos nem assistidos.
- A API verifica o autor no banco e rejeita operações sem autenticação (`401`) ou sobre a resenha de outra pessoa (`403`). Uma resenha inexistente no filme solicitado retorna `404`; publicação duplicada retorna `409`.

## Etapas posteriores

A moderação de resenhas de terceiros e a exclusão de contas serão tratadas separadamente. A política planejada é permitir exclusão de contas apenas a superusuários, proteger a última conta administrativa e avisar sobre a remoção de dados associados. Não há rota de exclusão de contas nesta etapa.
