# Superusuário — operação e acesso na etapa 1

## Escopo e autorização

A coluna `User.is_superuser` e a migração da etapa 0 são reutilizadas, sem alterar modelos ou criar migrações. Cadastro público ignora campos extras (incluindo `is_superuser`, `role` e `id`) e cria sempre usuário comum. Cadastro e `GET /api/auth/me` incluem `is_superuser: bool` no `UserResponse`, sem senha/hash.

`GET /api/admin/me` usa `get_current_superuser`, encadeado a `get_current_user`: anônimo/token inválido/usuário removido recebe 401, comum recebe 403, superusuário recebe 200 e `UserResponse`. O papel é lido do usuário atual no banco a cada requisição; claims JWT ou dados frontend não concedem privilégios. Promoção/revogação no banco vale já na próxima requisição com o mesmo token. Não existe endpoint público de promoção nem checkbox administrativo.

## Preparação e backups (operador autorizado)

**Esta entrega não cria/promove contas reais, não aplica migrações e não modifica o banco real.** Os comandos abaixo são instruções de operação futura, não automações executadas pela aplicação.

1. Faça a operação em ambiente autorizado, terminal confiável, sem gravação de sessão ou logging de teclas. Restrinja acesso ao host, banco e backups.
2. Confira o diretório: execute a partir de `backend`. A configuração atual usa SQLite `sqlite:///./webapp_filmes.db`, relativo ao diretório corrente; executar em outro lugar pode apontar para outro banco. A CLI não oferece `--database`, não cria tabelas e não executa migrações.
3. Antes de qualquer alteração, faça backup consistente e teste restauração em cópia isolada. Pare os escritores e copie o banco (incluindo arquivos auxiliares SQLite, quando aplicável), ou use a API SQLite Backup/`.backup` com ferramenta administrada; não copie apenas o arquivo principal durante escritas/WAL. Proteja o backup como dado sensível e registre local/data/responsável sem segredos.
4. Confirme que a migração **existente** da etapa 0 já foi aplicada ao banco pretendido. A CLI falha com mensagem sanitizada se o schema não estiver pronto; ela não tenta consertá-lo. Se necessário, siga o [guia de migrações](<MIGRACOES.md>) após fazer backup. Esta etapa não acrescenta migração nem aplica alterações ao banco real automaticamente.

## Comandos locais

Com a venv existente ativada, no diretório `backend`:

```powershell
python -m app.cli --help
python -m app.cli create-superuser --username administrador --email admin@example.com
python -m app.cli promote-superuser --username EXISTENTE
```

Sem ativação, em Windows, substitua `python` por `.\.venv\Scripts\python.exe`.

- `create-superuser`: solicita senha oculta duas vezes. Não há argumento, variável de ambiente própria ou opção para fornecer senha. Terminal sem ocultação é recusado (sem fallback com eco). Não cole a senha em comandos, histórico ou logs.
- `promote-superuser`: solicita a frase exata `PROMOVER EXISTENTE` (após normalização do username). Só altera `is_superuser`; preserva senha/hash, email, id, criação e dados relacionados. Repetir em admin já existente é idempotente. Não há criação implícita de usuário ausente.
- Validação equivale ao cadastro: `strip` antes dos limites de username (3–30) e email (3–255); email é armazenado em minúsculas. A senha tem limite de 8–128 caracteres e é preservada **exatamente**, incluindo espaços nas pontas, tanto no cadastro quanto na CLI. Não há validação extra de formato email (igual ao registro atual).
- Username ou email duplicado, identidade inválida, usuário ausente, senha divergente, confirmação incorreta, EOF/Ctrl+C ou falha de banco terminam com código diferente de zero. Falhas transacionais fazem rollback. Mensagens não exibem SQL, parâmetros, senhas ou hashes. Erros de argumentos também não reproduzem valores fornecidos.
- Sucesso termina com código zero. A CLI exige confirmação mesmo para promoção já aplicada. Não inclui reset de senha, rebaixamento, listagem ou administração remota; execute recuperação/revogação somente por procedimento operacional autorizado, fora do escopo desta etapa.

## Acesso pelo frontend

Após criar ou promover a conta, faça login normalmente no aplicativo. O cabeçalho exibirá o selo **Superusuário** e o botão **Administração**. A área administrativa confirma o acesso no servidor antes de mostrar a identidade da conta. Se a sessão já estava aberta durante a promoção, atualize a página ou entre novamente para atualizar o papel exibido.

Uma resposta `401` solicita novo login; `403` remove a identificação administrativa obsoleta e atualiza a sessão. O backend continua sendo a autoridade, mesmo que o estado local da interface seja adulterado. As operações de moderação, resenhas e exclusões serão implementadas nas próximas etapas.

A CLI local não depende de credenciais TMDB/JWT para provisionar a conta ou exibir ajuda. Já a API HTTP e o login continuam exigindo a configuração habitual do ambiente.

## Validação automatizada

Sem instalar dependências, a partir de `backend`:

```powershell
$env:PYTHONDONTWRITEBYTECODE = "1"
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
```

Os testes novos em [test_superusers.py](tests/test_superusers.py) reutilizam `client`/`db_session` de [conftest.py](tests/conftest.py), com SQLite em memória; a CLI é redirecionada para a sessão descartável. A suíte existente de migrações usa apenas bancos temporários próprios. Não execute comandos administrativos reais para validar a implementação.

Cobertura: contrato público, autorização 401/403/200, claims assinadas de papel ignoradas, mudança de papel com mesmo token, remoção de usuário, hashing, limites e normalização, duplicidade/rollback, promoção idempotente sem reset, confirmação, terminal inseguro, cancelamentos, argumentos sem senha e mensagens sanitizadas.
