# Relatório da etapa 0

## Resultado

A etapa 0 foi concluída em código e validada com testes automatizados. O banco original não foi migrado nem teve seus registros alterados. A aplicação passa a exigir a execução explícita das migrações antes de ser usada com um banco novo ou legado.

Esta entrega prepara a base para as próximas etapas; não implementa ainda criação administrativa de superusuário, resenhas, painel administrativo ou endpoints de exclusão de contas.

## Alterações

### 1. Modelo de usuário

- Corrigido o import de `Boolean`, que impedia a importação normal do modelo.
- Mantido `is_superuser=False` por padrão no ORM e acrescentado valor padrão SQL falso para schemas novos.
- Não houve promoção de contas existentes.
- Arquivo: [modelo User](<app/models/user.py>).

### 2. Migrações Alembic

- Adicionada dependência `alembic>=1.16,<2` em [requirements.txt](<requirements.txt>).
- Criados [alembic.ini](<alembic.ini>), [ambiente do Alembic](<alembic/env.py>) e [template de revisões](<alembic/script.py.mako>).
- Criada a [revisão inicial 20261117_01](<alembic/versions/20261117_01_baseline.py>), que:
  - cria as tabelas em um banco vazio;
  - reconhece e valida as tabelas legadas existentes, incluindo tipos, nulidade, chaves primárias, unicidade e relacionamentos;
  - acrescenta `users.is_superuser` com valor falso sem apagar registros;
  - reconhece um schema que já tenha essa coluna sem sobrescrever os papéis existentes;
  - recusa tabelas parciais ou estruturas incompatíveis;
  - consulta os índices reais do SQLite para reconhecer também restrições `UNIQUE` inline;
  - recusa downgrade destrutivo da revisão inicial e orienta restaurar backup.
- Removido `Base.metadata.create_all()` da importação da [aplicação](<app/main.py>). A estrutura passa a ser controlada por migrações explícitas.
- Autogenerate configurado para gerar operações batch em SQLite e comparar tipos; engines são liberadas mesmo quando ocorre erro.
- Procedimentos de backup, atualização e testes descritos em [MIGRACOES.md](<MIGRACOES.md>).

### 3. Regras de autorização e exclusão

Registradas em [REGRAS_DE_ACESSO.md](<REGRAS_DE_ACESSO.md>) como decisões para as próximas implementações:

- cadastro público nunca concede privilégios administrativos;
- criar resenha requer autenticação;
- autor ou superusuário pode excluir a resenha;
- somente superusuário pode excluir outro usuário;
- proposta inicial de exclusão física com remoção dos estados pessoais e resenhas associados;
- proteção do último superusuário;
- resenhas independentes de favoritos, assistidos e notas;
- autorização obrigatória no backend e respostas esperadas `401`, `403` e `404`.

As regras futuras estão documentadas, não foram apresentadas como funcionalidades já existentes.

### 4. Testes

Criados [fixtures isolados](<tests/conftest.py>), [testes de autenticação e isolamento](<tests/test_auth_permissions.py>) e [testes de migração](<tests/test_migrations.py>). Dependências de desenvolvimento em [requirements-test.txt](<requirements-test.txt>).

Cobertura desta etapa:

- cadastro, normalização de e-mail, login por usuário/e-mail e consulta da própria conta;
- ausência de senhas e hashes nas respostas públicas;
- senha armazenada com hash verificável;
- rejeição de duplicatas e credenciais incorretas;
- cadastro público não promove privilégios nem aceita ID arbitrário, mesmo recebendo campos extras;
- proteção das cinco operações autenticadas existentes;
- rejeição de tokens inválidos, expirados, com assinatura errada, sem sujeito ou referenciando conta inexistente;
- rejeição de token após remoção da conta no banco de teste;
- isolamento de leitura, atualização e exclusão dos estados de filmes entre usuários;
- upgrade em banco vazio, preservação de dados legados, padrões seguros e unicidade;
- repetição de upgrade e ausência de divergência estrutural no schema padrão;
- adoção de schema atual, com e sem valor padrão SQL, preservando superusuário já existente;
- rejeição de schemas incompatíveis e recusa de downgrade com perda de dados.

Os testes de API usam SQLite em memória, segredos fictícios e bloqueiam HTTP externo. Os testes de migração usam bancos temporários. Acrescentadas exclusões de caches Python, pytest e artefatos locais no [.gitignore](<.gitignore>); arquivos anteriormente versionados não foram removidos.

## Validações executadas

Comandos executados a partir de `backend`, usando o Python do ambiente virtual:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m pip check
```

- **20 testes aprovados**.
- **2 avisos de depreciação** de Starlette/TestClient sobre httpx e o alias de BlockingPortal do AnyIO; não são falhas de teste.
- `pip check`: nenhuma dependência incompatível.
- `git diff --check`: sem erros de whitespace nas alterações rastreadas.
- Ensaio de upgrade e verificação de schema em uma cópia SQLite temporária: preservados **2 usuários e 3 estados de filmes**; integridade e relacionamentos verificados.
- O hash SHA-256 do banco original foi conferido antes e depois das verificações, sem mudança.

## Cuidados e próximos passos

1. Antes de usar a API no banco existente, pare a aplicação, faça backup consistente e execute `python -m alembic upgrade head` a partir de `backend`. Esse comando ainda não foi aplicado ao banco original nesta entrega.
2. A revisão inicial suporta SQLite e exige conexão ao banco; não suporta geração offline com `--sql` nem downgrade automático.
3. Ao adotar um schema que já tenha `is_superuser` sem padrão SQL, a migração preserva essa definição para evitar reconstrução desnecessária; o padrão do ORM continua sendo falso.
4. Revisões geradas automaticamente devem ser revisadas. A reflexão genérica de `UNIQUE` inline pode sugerir restrições redundantes, embora a revisão inicial valide os índices reais.
5. Testes de permissões administrativas `403`, resenhas e exclusões deverão acompanhar a implementação dessas funcionalidades; elas ainda não existem.
6. Nenhum arquivo do frontend ou conteúdo do README de entrega foi alterado.
