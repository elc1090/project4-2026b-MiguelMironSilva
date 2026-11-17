# Regras de acesso e exclusão

Este documento registra as regras planejadas para as próximas etapas. A existência destas regras não significa que resenhas, administração ou exclusão de contas já estejam implementadas. O README não determina todos esses detalhes; são decisões de projeto que podem ser revistas antes da implementação.

## Papéis e autenticação

- Visitantes podem consultar filmes e resenhas públicas.
- Usuários autenticados podem gerenciar seus próprios estados de filmes e criar resenhas.
- Superusuários têm permissões de moderação. O cadastro público nunca concede esse papel; o primeiro superusuário deve ser criado ou promovido por procedimento administrativo controlado.
- O backend deve verificar a identidade e as permissões em toda operação protegida. Ocultar controles na interface não é autorização.

## Resenhas

- Uma resenha pertence a um usuário e identifica um filme pelo ID do TMDB. A proposta inicial é permitir no máximo uma resenha por usuário e filme.
- O autor ou um superusuário pode excluir uma resenha; outro usuário autenticado não pode. Consultar uma resenha não requer login.
- Resenhas devem ser armazenadas separadamente de favoritos, assistidos e notas pessoais: apagar uma resenha não altera esses dados e remover o estado pessoal do filme não apaga a resenha.

## Usuários e dados associados

- Somente um superusuário pode excluir outro usuário. Exclusão da própria conta não está definida como recurso nesta etapa.
- Decisão inicial para a implementação futura: a exclusão física de uma conta também exclui suas resenhas e seus estados pessoais de filmes. A interface deverá informar essa consequência e pedir confirmação; esta decisão pode ser revista antes da implementação.
- Não permitir excluir o último superusuário. Operações administrativas e a proteção do último superusuário devem ser verificadas no backend.
- Após a exclusão da conta, o backend deve rejeitar novos pedidos autenticados com os tokens dessa conta.

## Respostas e testes esperados

- Ausência de autenticação ou token inválido: `401`; usuário autenticado sem permissão: `403`; recurso inexistente: `404`, considerando a política de privacidade adotada.
- Testar registros comuns sem privilégios, acesso sem token, tokens inválidos, isolamento entre usuários, permissões de autor e superusuário, exclusão e dados associados. Os testes dependentes de resenhas e administração devem ser adicionados quando essas funcionalidades forem implementadas.
