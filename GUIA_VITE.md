# Frontend: executar com Vite

Guia para **Windows/PowerShell**. O frontend usa React + Vite e não precisa de ambiente virtual Python.

## 1. Pré-requisitos

Instale Node.js **22.12 ou superior** (recomendado: Node.js 24 LTS), com npm. O projeto também aceita versões da linha 20 a partir da 20.19.

Confira no terminal:

```powershell
node --version
npm --version
```

Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` no lugar de `npm` em todos os comandos abaixo; não é necessário mudar a política de execução.

## 2. Instalar as dependências

Abra o terminal na raiz do projeto:

```powershell
cd frontend
npm ci
```

O comando usa as versões do [package-lock.json](<frontend/package-lock.json>). Não precisa executá-lo a cada inicialização, apenas na primeira configuração ou quando as dependências mudarem. Para adicionar ou atualizar dependências intencionalmente, use `npm install` e revise as mudanças no lockfile.

## 3. Configurar o acesso ao backend

Por padrão, a interface chama `http://127.0.0.1:8000/api`. Para desenvolvimento local, basta manter o backend rodando nessa URL em **outro terminal**, seguindo o [guia de ambiente virtual e Uvicorn](<AMBIENTE_VIRTUAL.md>).

Para mudar a URL da API, crie um arquivo `.env.local` dentro de `frontend`, sem sobrescrever configurações existentes, com:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Inclua `/api` no final, sem barra extra. Variáveis `VITE_*` ficam disponíveis no navegador: **não coloque nelas senhas, a chave JWT ou o token do TMDB**. Essas credenciais pertencem ao backend. Reinicie o Vite após alterar as variáveis.

## 4. Iniciar o frontend

Ainda dentro de `frontend`:

```powershell
npm run dev -- --port 5173 --strictPort
```

Abra **http://localhost:5173** no navegador. O Vite atualiza a interface durante o desenvolvimento quando os arquivos são salvos.

`--strictPort` evita que o Vite escolha outra porta automaticamente: o backend já permite as origens locais da porta 5173. Se essa porta estiver ocupada, encerre a instância anterior ou ajuste conscientemente a porta e a configuração CORS do backend.

O frontend pode abrir sem o backend, mas login, pesquisa de filmes e funções autenticadas dependem da API.

## 5. Retomar e encerrar

Em um novo terminal, partindo da raiz:

```powershell
cd frontend
npm run dev -- --port 5173 --strictPort
```

Pare o servidor com **Ctrl+C**. Não há comando `deactivate` para o frontend.

## 6. Testes e build opcionais

Os testes do frontend são locais e não vêm em um clone novo. Se você tiver a suíte local, execute `npm test` dentro de `frontend`.

Para compilar e conferir o resultado, dentro de `frontend`:

```powershell
npm run build
npm run preview -- --port 4173 --strictPort
```

O build gera a pasta `frontend/dist`; o preview pode ser acessado em **http://localhost:4173**. Ele serve apenas para conferir o build localmente, não substitui uma hospedagem de produção. A API atual não permite a origem 4173 por padrão: para testar funções conectadas nessa porta, ajuste o CORS do backend ou, depois de parar o servidor de desenvolvimento, execute `npm run preview -- --port 5173 --strictPort`.

A URL `VITE_API_BASE_URL` é incorporada ao build: se mudar a API após compilar, gere um novo build. Para erros de conexão, confira se o backend está ativo, se a URL inclui `/api` e se a origem do navegador está autorizada no CORS.
