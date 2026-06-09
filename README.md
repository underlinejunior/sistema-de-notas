# Sistema de Notas com Firebase

Sistema básico feito em HTML, CSS e JavaScript, usando Firebase Authentication, Cloud Firestore e Firebase Hosting.

## Recursos implementados

- Login por e-mail e senha.
- Perfis de acesso: coordenador, professor e aluno.
- Painel específico por perfil.
- Cadastro de usuários pelo coordenador.
- Cadastro de cursos.
- Cadastro de disciplinas.
- Matriz curricular com período, ordem e dependências.
- Oferta de disciplina por período letivo, turma e professor.
- Matrícula manual de alunos.
- Importação de alunos de uma disciplina para outra.
- Lançamento de notas pelo professor.
- Visualização de notas pelo aluno.
- Controle de frequência por data e horas-aula.
- Cadastro de frequência mínima obrigatória por oferta.
- Chamada por professor.
- Alertas de alunos abaixo da frequência mínima.
- Cálculo automático de média, percentual de aproveitamento, frequência e situação.

## 1. Criar o projeto no Firebase

1. Acesse o Firebase Console.
2. Crie um novo projeto.
3. Adicione um app Web.
4. Copie a configuração do Firebase.
5. Cole a configuração no arquivo:

```txt
public/js/firebase-config.js
```

Exemplo:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 2. Ativar login por e-mail e senha

No Firebase Console:

1. Authentication.
2. Sign-in method.
3. Ative Email/Password.

## 3. Criar o banco Firestore

No Firebase Console:

1. Firestore Database.
2. Criar banco de dados.
3. Escolha o modo de produção.
4. Depois cole as regras do arquivo `firestore.rules` na aba Rules do Firestore.

Também é possível publicar as regras usando Firebase CLI.

## 4. Criar o primeiro coordenador

O primeiro coordenador precisa ser criado manualmente.

### Passo 1

No Firebase Authentication, crie um usuário com e-mail e senha.

### Passo 2

Copie o UID desse usuário.

### Passo 3

No Firestore, crie a coleção:

```txt
usuarios
```

Dentro dela, crie um documento com o ID igual ao UID do usuário.

Campos sugeridos:

```js
{
  nome: "Coordenador Geral",
  email: "coordenador@email.com",
  tipo: "coordenador",
  matricula: "",
  cursoId: "",
  ativo: true
}
```

Depois disso, entre no sistema com o e-mail e senha desse coordenador. Ele poderá cadastrar professores, alunos, cursos, disciplinas e ofertas.

## 5. Rodar localmente

Não abra o arquivo dando dois cliques. Use um servidor local.

No terminal, dentro da pasta do projeto:

```bash
cd public
python -m http.server 5500
```

Depois acesse:

```txt
http://localhost:5500
```

## 6. Publicar no Firebase Hosting

Instale a Firebase CLI, faça login e publique:

```bash
firebase login
firebase use --add
firebase deploy
```

Para publicar apenas o site e as regras do Firestore:

```bash
firebase deploy --only hosting,firestore:rules
```

## 7. Fluxo recomendado de cadastro

1. Criar coordenador manualmente.
2. Entrar como coordenador.
3. Cadastrar cursos.
4. Cadastrar disciplinas.
5. Vincular disciplinas ao curso na matriz curricular.
6. Cadastrar dependências, se houver.
7. Cadastrar professores.
8. Cadastrar alunos.
9. Criar ofertas de disciplinas.
10. Matricular alunos ou importar alunos de outra oferta.
11. Configurar a frequência mínima e cadastrar os dias/horas de aula.
12. Professor lança notas.
13. Professor faz a chamada por data.
14. Coordenador, professor e aluno acompanham a frequência.
15. Aluno visualiza suas notas, frequência e progresso.


## 8. Controle de frequência

A frequência funciona assim:

1. O coordenador acessa o menu **Frequência**.
2. Seleciona uma oferta de disciplina.
3. Informa a frequência mínima obrigatória, por exemplo 75%.
4. Cadastra os dias de aula e a quantidade de horas-aula de cada dia.
5. O professor acessa o menu **Frequência** e faz a chamada da data.
6. O sistema calcula automaticamente:
   - total de horas com chamada feita;
   - horas presentes do aluno;
   - percentual de frequência;
   - alerta quando o aluno fica abaixo do mínimo.

O coordenador vê todos os alertas, o professor vê os alunos das próprias disciplinas e o aluno vê apenas a própria frequência.

## Observações importantes

Esta é uma primeira versão básica. Para uma versão mais avançada, é recomendável adicionar:

- troca de senha pelo próprio usuário;
- recuperação de senha personalizada;
- edição e exclusão pelos painéis;
- edição e exclusão de aulas/frequências;
- justificativa de faltas;
- boletim em PDF;
- histórico escolar;
- notas com pesos diferentes;
- relatórios em Excel;
- Cloud Functions para criação administrativa de usuários com mais segurança.

## Atualização: edição de registros

Esta versão permite ao coordenador editar os cadastros principais:

- usuários;
- cursos;
- disciplinas;
- matriz curricular;
- dependências;
- ofertas de disciplinas.

Nos registros principais, o sistema usa **inativar/reativar** em vez de apagar, para preservar histórico. Em usuários, a edição altera o perfil salvo no Firestore, mas não troca o e-mail/senha do Firebase Authentication.

Também foram adicionadas ações de edição/remoção controlada em matrículas e aulas cadastradas para frequência. Aulas com chamada já realizada ficam bloqueadas para alteração direta.
