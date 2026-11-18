# Regras de acesso

## Resenhas públicas — etapas 2 e 3

- Qualquer visitante pode ler as resenhas de um filme. A resposta pública inclui o nome e o identificador do autor, mas não seu e-mail.
- É preciso entrar na conta para publicar. Cada usuário pode manter uma avaliação por filme, contendo uma nota de 0 a 10, um texto de até 2.000 caracteres, ou ambos. Após apagar a própria avaliação, é possível publicar outra.
- **Apenas o autor** pode editar sua avaliação. O **autor ou um superusuário** pode excluí-la inteira (nota e texto). Excluir não impede o autor de publicar outra.
- Favoritos e assistidos continuam sendo estado pessoal da biblioteca. Nota e texto pertencem juntos à avaliação pública. Remover um filme da biblioteca não apaga sua avaliação, e excluir a avaliação não altera favoritos nem assistidos.
- A API verifica a autoria e o papel atual no banco. Sem autenticação retorna `401`; sem permissão para a operação, `403`. Uma resenha inexistente no filme solicitado retorna `404`; publicação duplicada retorna `409`.

## Exclusão definitiva de contas — etapa 4

- Apenas superusuários podem listar as contas no painel e excluir outra conta. A lista inclui identificador, nome de usuário e papel, sem e-mail, senha ou hash.
- Não é possível excluir a própria conta pelo painel ou pela API. Para remover uma conta administrativa, outra conta administrativa precisa executar a operação.
- A exclusão remove a conta, suas avaliações (nota e texto, sem anonimização) e seus estados de filmes (favoritos e assistidos) na mesma transação. Não remove os filmes do catálogo nem dados de outros usuários.
- A interface pede confirmação e identifica a conta e os dados afetados. A rota retorna `204` no sucesso, `401` sem autenticação, `403` sem papel administrativo, `404` se a conta não existir, `409` em tentativa de autoexclusão e `503` se o banco ainda não tiver a proteção contra reutilização de identificadores.
- A exclusão vale para a base em uso. Cópias de segurança e exportações anteriores seguem a política de retenção do operador.
