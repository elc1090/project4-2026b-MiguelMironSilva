# Migrações do banco

Execute os comandos a partir de `backend`, com o ambiente virtual ativo e as dependências instaladas (`python -m pip install -r requirements.txt`). Antes de iniciar a API pela primeira vez ou após atualizar o código, execute:

```sh
python -m alembic upgrade head
uvicorn app.main:app --reload
```

O caminho padrão é o mesmo da aplicação: `sqlite:///./webapp_filmes.db`, relativo ao diretório de trabalho. Execute sempre a partir de `backend` para usar o banco esperado. A API não cria mais as tabelas automaticamente.

Antes de migrar um banco existente, pare a aplicação e faça um backup consistente do arquivo SQLite, incluindo eventuais arquivos WAL/SHM, ou use a API de backup do SQLite. A revisão inicial reconhece tanto o schema legado completo quanto o atual; no legado adiciona `users.is_superuser` com valor inicial falso sem apagar registros. Em um banco vazio cria as duas tabelas. Schemas parciais ou incompatíveis são recusados: não use `stamp` para contornar a verificação; investigue e faça backup antes de qualquer intervenção. Se a coluna já existir sem valor padrão no servidor, ela é preservada sem reconstrução da tabela; novas bases e bases legadas migradas recebem padrão SQL falso. Os inserts da aplicação também fornecem o valor padrão pelo ORM.

Para verificar a revisão ou gerar uma revisão após alterar modelos:

```sh
python -m alembic current
python -m alembic revision --autogenerate -m "descreva a alteração"
python -m alembic upgrade head
```

Revise migrações geradas antes de executá-las, especialmente alterações SQLite que podem reconstruir tabelas. Em bancos criados com declarações `UNIQUE` inline, a reflexão genérica do SQLAlchemy pode sugerir restrições duplicadas no autogenerate; a migração inicial consulta os índices reais para validar essas restrições, mas futuras revisões geradas ainda precisam ser conferidas. A revisão inicial não oferece downgrade automático, pois apagar tabelas ou remover a coluna poderia destruir dados; restaure um backup se necessário. A migração inicial exige conexão ao banco e não suporta `--sql`.

Para ensaiar em uma **cópia**, defina temporariamente `ALEMBIC_DATABASE_URL` com uma URL SQLAlchemy SQLite apontando para a cópia antes de executar o Alembic; a variável afeta somente o Alembic, não a aplicação. No PowerShell, por exemplo:

```powershell
$env:ALEMBIC_DATABASE_URL = 'sqlite:///./copia.db'
python -m alembic upgrade head
Remove-Item Env:ALEMBIC_DATABASE_URL
```

## Testes

A partir de `backend`, instale as dependências de desenvolvimento e execute a suíte:

```powershell
python -m pip install -r requirements-test.txt
python -m pytest -q
```

Os testes de API usam SQLite em memória, credenciais fictícias e bloqueiam chamadas HTTP externas. Os testes de migração executam o Alembic em arquivos SQLite temporários: cobrem banco vazio, banco legado com dados, adoção do schema atual, repetição do upgrade e rejeição de schemas incompatíveis. Nenhum teste aplica migrações ao banco real do projeto.

As regras de autorização e exclusão planejadas estão em [REGRAS_DE_ACESSO.md](<REGRAS_DE_ACESSO.md>). Ainda não há endpoints administrativos ou de resenhas; seus testes de permissão serão acrescentados nas próximas etapas.
