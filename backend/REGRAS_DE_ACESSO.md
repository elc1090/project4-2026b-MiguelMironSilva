# Regras de acesso

## Resenhas públicas — etapas 2 e 3

- Qualquer visitante pode ler as resenhas de um filme. A resposta pública inclui o nome e o identificador do autor, mas não seu e-mail.
- É preciso entrar na conta para publicar. Cada usuário pode manter uma avaliação por filme, contendo uma nota de 0 a 10, um texto de até 2.000 caracteres, ou ambos. Após apagar a própria avaliação, é possível publicar outra.
- **Apenas o autor** pode editar sua avaliação. O **autor ou um superusuário** pode excluí-la inteira (nota e texto). Excluir não impede o autor de publicar outra.
- Favoritos e assistidos continuam sendo estado pessoal da biblioteca. Nota e texto pertencem juntos à avaliação pública. Remover um filme da biblioteca não apaga sua avaliação, e excluir a avaliação não altera favoritos nem assistidos.
- A API verifica a autoria e o papel atual no banco. Sem autenticação retorna `401`; sem permissão para a operação, `403`. Uma resenha inexistente no filme solicitado retorna `404`; publicação duplicada retorna `409`.

## Etapas posteriores

A exclusão de contas será tratada separadamente. A política planejada é permitir exclusão de contas apenas a superusuários, proteger a última conta administrativa e avisar sobre a remoção de dados associados. Não há rota de exclusão de contas nesta etapa.
