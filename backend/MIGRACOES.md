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

## Avaliações públicas

A etapa 2 acrescenta a tabela independente de avaliações públicas. A revisão `20261117_03` transfere para ela as notas pessoais já salvas em `user_movies.rating`, mesclando-as às resenhas existentes do mesmo autor e filme, e remove a coluna antiga. Nota e texto passam a pertencer à mesma avaliação; favoritos e assistidos permanecem em `user_movies`.

Antes de atualizar banco existente, pare a API e faça backup consistente. Execute `python -m alembic upgrade head` dentro de `backend` antes de reiniciar. O downgrade da revisão 3 devolve as notas à estrutura anterior e descarta avaliações que eram apenas nota; o downgrade seguinte da revisão 2 remove a tabela de resenhas. Faça backup antes de qualquer downgrade.

## Testes

A suíte e o arquivo `requirements-test.txt` são locais e não vêm em um clone novo. Quando estiverem disponíveis, a partir de `backend`, instale as dependências de desenvolvimento e execute a suíte:

```powershell
python -m pip install -r requirements-test.txt
python -m pytest -q
```

Os testes de API usam bancos SQLite descartáveis e credenciais fictícias. Os testes de migração usam arquivos SQLite temporários. Nenhum teste aplica migrações ao banco real do projeto.

As regras de autorização e exclusão estão em [REGRAS_DE_ACESSO.md](<REGRAS_DE_ACESSO.md>). A edição e a exclusão de resenhas pelo autor já fazem parte da API; exclusões administrativas ainda não estão disponíveis.
