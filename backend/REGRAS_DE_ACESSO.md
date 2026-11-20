# Regras de acesso

## Resenhas públicas e nota da comunidade

- Qualquer visitante pode ler as resenhas de um filme. A resposta pública inclui o nome e o identificador do autor, mas não seu e-mail.
- É preciso entrar na conta para publicar. Cada usuário pode manter uma avaliação por filme, contendo uma nota inteira de 1 a 10, um texto de até 2.000 caracteres, ou ambos. Após apagar a própria avaliação, é possível publicar outra.
- A nota da comunidade é pública e corresponde à média das avaliações com nota daquele filme, exibida com até duas casas decimais. Resenhas só com texto não contam.
- **Apenas o autor** pode editar sua avaliação. O **autor ou um superusuário** pode excluí-la inteira (nota e texto). Excluir não impede o autor de publicar outra.
- Favoritos, assistidos e a lista **Desejo assistir** são estados pessoais e independentes da biblioteca. Nota e texto pertencem juntos à avaliação pública. Remover um filme da biblioteca não apaga sua avaliação, e excluir a avaliação não altera esses estados.
- A aba **Minhas Resenhas** usa `GET /api/reviews/mine`, que exige autenticação e reúne só avaliações da conta atual, incluindo avaliações só com nota. As avaliações individuais continuam públicas nos detalhes dos filmes.
- A API verifica a autoria e o papel atual no banco. Sem autenticação retorna `401`; sem permissão para a operação, `403`. Uma resenha inexistente no filme solicitado retorna `404`; publicação duplicada retorna `409`.

## Promoção de contas

- Apenas um superusuário pode promover uma conta existente via `POST /api/admin/users/{user_id}/promote`. A interface confirma o alvo e mostra os poderes concedidos. A API relê o papel do ator depois de obter o bloqueio de escrita e muda apenas o papel do alvo, sem redefinir credenciais ou alterar conteúdo. Repetir a promoção não tem efeito adicional.
- O cadastro público continua criando somente usuários comuns. Não há opção pública de promoção nem função de rebaixamento neste painel.

## Exclusão definitiva de contas

- Nas duas formas de exclusão, a conta, suas avaliações (nota e texto, sem anonimização), favoritos, assistidos e a lista **Desejo assistir** são removidos na mesma transação. As notas removidas deixam de contar na média dos filmes. Filmes do catálogo e dados de terceiros não são afetados.
- **Administração:** apenas superusuários podem listar as contas e excluir outra conta por `DELETE /api/admin/users/{user_id}`. A lista inclui identificador, nome e papel, sem e-mail, senha ou hash. A rota administrativa não permite excluir a própria conta (`409`); retorna `403` sem papel administrativo e `404` se o alvo não existir.
- **Minha conta:** qualquer pessoa autenticada pode pedir sua própria exclusão por `DELETE /api/auth/me`, confirmando a senha atual. A API identifica a conta pelo token, não aceita um identificador de alvo (`422`) e recusa senha incorreta (`403`). O último superusuário não pode se autoexcluir (`409`); outra conta precisa ser promovida primeiro. A verificação é feita dentro da transação de exclusão.
- Ambas as rotas retornam `204` no sucesso, `401` sem autenticação válida e `503` se o banco não tiver a proteção contra reutilização de identificadores. Após autoexclusão, a interface encerra a sessão. Credenciais anteriores não dão acesso a uma conta nova.
- A exclusão vale para a base em uso. Cópias de segurança e exportações anteriores seguem a política de retenção do operador.
