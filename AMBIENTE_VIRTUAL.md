# Backend: ambiente virtual e Uvicorn

Guia para **Windows/PowerShell**, com Python 3.12 instalado. O ambiente virtual isola as dependências; o Uvicorn executa a API FastAPI.

## 1. Criar e ativar o ambiente

Abra o terminal na raiz do projeto e execute:

```powershell
cd backend
py -3.12 -m venv .venv
python.exe -m pip install -r requirements.txt
.\.venv\Scripts\Activate
```

Se `.venv` já existir e estiver funcionando, pule sua criação. Se `py` não estiver disponível, use `python -m venv .venv`, verificando antes a versão com `python --version`.

## 2. Configurar as credenciais

Crie ou edite o arquivo [backend/.env](<backend/.env>) com estas duas variáveis. **Se ele já existir, preserve suas credenciais; não o sobrescreva com os exemplos.**

```dotenv
TMDB_API_KEY=SEU_TOKEN_DE_LEITURA_DA_API_TMDB
JWT_SECRET_KEY=SUA_CHAVE_ALEATORIA_FORTE
```

Para gerar uma chave JWT, execute e copie o resultado para `JWT_SECRET_KEY`:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

O TMDB deve fornecer um **API Read Access Token** (Bearer), não apenas a chave de API curta. Não publique as credenciais nem versione o arquivo de ambiente.

## 3. Preparar o banco e iniciar a API

Ainda dentro de `backend`, com o ambiente ativado:

```powershell
python -m alembic upgrade head
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Banco existente:** pare a aplicação e faça backup consistente antes da migração; veja o [guia de migrações](<backend/MIGRACOES.md>). Execute sempre a partir de `backend`: o caminho do SQLite e a leitura das credenciais dependem desse diretório. `--reload` é destinado ao desenvolvimento.

- API: http://127.0.0.1:8000
- Documentação interativa: http://127.0.0.1:8000/docs
- Verificação de saúde: http://127.0.0.1:8000/health

## 4. Retomar e encerrar

Em um novo terminal, partindo da raiz:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

Pare o servidor com **Ctrl+C** e saia do ambiente com `deactivate`. Não é necessário recriar o ambiente a cada execução; reinstale as dependências quando elas mudarem.

**Se o PowerShell bloquear a ativação:** não é preciso alterar a política de execução. Substitua `python` nos comandos acima por `.\.venv\Scripts\python.exe`; isso usa o ambiente virtual sem ativá-lo.

**Testes opcionais:** os testes e o arquivo `requirements-test.txt` são locais e não vêm em um clone novo. Se estiverem disponíveis, com o ambiente ativo, execute `python -m pip install -r requirements-test.txt` e depois `python -m pytest -q`.
