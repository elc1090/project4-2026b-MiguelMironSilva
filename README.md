# Projeto final

> 1. Leia com atenção as instruções abaixo para editar este README em formato Markdown.
> 2. Substitua todos os trechos de texto iniciados com "Substitua" por informações do seu projeto, conforme solicitado em cada trecho.
> 3. Substitua a imagem animada por um GIF/WEBP mostrando o resultado do seu projeto (o arquivo pode ser armazenado no repositório ou em URL externa). 
> 4. Remova todas as instruções de entrega.
> 5. Renomeie esta arquivo para README.md e entregue-o dentro da pasta raiz do seu repositório de entrega. 
> 6. Double-check: Certifique-se de que seu README.md não contenha instruções de entrega e seja visualizado corretamente ao abrir seu repositório!
> Opcional: você pode alterar a formatação deste README, mas mantenha todas as informações solicitadas.

![Substitua a imagem ao lado por um GIF/WEBP animado mostrando seu projeto](./moho_follow_through2.gif "GIF animado do projeto. Imagem temporária de Moho Animation https://moho.lostmarble.com/products/moho-pro-special-halls-head-college")



## Acesso

Substitua este texto pela URL para acesso ao seu app publicado. Adicione a URL também na seção "About" do seu repositório no GitHub.


## Desenvolvedor(a) / Desenvolvedor(es/as)
- [Miguel Miron Silva](misilva@inf.ufsm.br)


## Proposta
 Completar o desenvolvimento do trabalho do terceiro projeto, adicionando funções que faltam (superusuário, sistema de resenhas, habilidade de deletar resenhas/usuários). Além disso, implementar:


1) Containeirizar frontend e backend com o docker

2) Implementação de login com Google e/ou GitHub via OAuth2/OIDC 

3) API de IA (preferencialmente Gemini): Extrair todas as resenhas de um filme e retornar um resumo delas


## Desenvolvimento

### Processo

Substitua este texto (toda a seção) por uma descrição do processo de desenvolvimento **em primeira pessoa, sem ajuda de IA**.

Para trabalhos em dupla, explicar primeiramente como a dupla se organizou para realizar o trabalho: se houve ou não uma divisão, quem fez o quê, etc.

Cada pessoa deve explicar e justificar suas escolhas, destacando o que já sabia ou não, como lidou com dúvidas ou dificuldades específicas, que adaptações foram necessárias, etc. Evitar comentários genéricos como "pedi ajuda para IA e resolvi", dando preferência para expor detalhes específicos de um problema e sua solução.

### Trechos de código

Substitua este texto por uma indicação de pelo menos 3 trechos de código que você(s) queira(m) destacar para a turma (por exemplo, para explicar algo que aprendeu, para alertar sobre alguma dificuldade de compreensão, para mostrar uma curiosidade, etc).


## Tecnologias

### Linguagens e afins

Substitua este texto por uma lista detalhada de tecnologias utilizadas:
- ...
- ...
- 


### Ambiente de desenvolvimento

Backend
- Linguagem: Python
- Framework: FastAPI
- Banco de dados: SQLAlchemy + SQLite
- Hospedagem: Render

Frontend
- HTML5 + CSS3 + JavaScript
- Frameworks: React.js + Vite
- Hospedagem: Netlify

#### Login com Google (opcional)

No ambiente de desenvolvimento, abra o frontend em `http://localhost:5173` e use `http://127.0.0.1:8000/api/auth/google/callback` como URI de redirecionamento do cliente Web na Google Auth Platform. Configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no ambiente do backend, nunca no frontend. Para endereços diferentes, configure `FRONTEND_URL` (origem do frontend) e `GOOGLE_REDIRECT_URI` (callback exato no Google); `VITE_API_BASE_URL` deve usar a mesma origem pública do callback, com o prefixo `/api`.

Antes de reiniciar a API, instale as dependências e aplique as migrações em `backend` com `python -m pip install -r requirements.txt` e `python -m alembic upgrade head`. Faça backup do SQLite antes de migrar um banco existente. Evite registrar a query string do callback em logs de acesso, pois ela contém o código de autorização.

#### Backend local com Docker Compose

1. Preencha `TMDB_API_KEY` e `JWT_SECRET_KEY` em `backend/.env`. Se ainda não tiver esse arquivo, use [o exemplo de configuração](<backend/.env.example>) como ponto de partida. As credenciais não vão na imagem.
2. Na raiz do projeto, execute `docker compose up -d --build --wait backend`.
3. Abra <http://127.0.0.1:8000/health> para conferir a API. O frontend continua fora do Compose.

A API aplica as migrações antes de iniciar. Na primeira execução com um volume novo, o SQLite começa vazio; o banco do ambiente local não é copiado. `docker compose down` preserva o volume; `docker compose down -v` **apaga** os dados do contêiner. Para trocar a porta local, defina `BACKEND_PORT` ao executar o Compose e ajuste `VITE_API_BASE_URL` e, se usar login Google, o callback registrado e `GOOGLE_REDIRECT_URI`.

## Referências e créditos

- [Western Reels — projeto de rpklaue](https://github.com/elc1090/project2-2026b-rpklaue): referência para o formulário de resenhas nos detalhes do filme e para o fluxo de criar, editar e excluir. Neste projeto a resenha é um registro público independente da biblioteca pessoal, com uma resenha por usuário e filme.

Substitua este trecho por uma lista bem detalhada de todo material consultado para ajudar no projeto, por exemplo:  URLs de vídeos ou outro material consultado, créditos para colegas que colaboraram, geradores de código, etc.
- ...
- ...




---
Projeto entregue para a disciplina de [Desenvolvimento de Software para a Web](http://github.com/andreainfufsm/elc1090-2026b) em 2026b
