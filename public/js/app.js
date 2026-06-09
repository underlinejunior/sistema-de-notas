import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { auth, db, firebaseConfig } from "./firebase-init.js";
import { COLECOES, TIPOS_USUARIO, SITUACOES } from "./colecoes.js";
import {
  $,
  $$,
  protegerTexto,
  formatarNumero,
  calcularMedia,
  calcularPercentual,
  calcularSituacao,
  textoSituacao,
  classeSituacao,
  mostrarMensagem,
  mostrarCarregando,
  estadoVazio,
  buscarTodos,
  buscarPorCampo,
  buscarDocumento,
  preencherSelect,
  montarTabela
} from "./utils.js";

let usuarioAtual = null;
let perfilAtual = null;
let rotaAtual = "dashboard";

const cache = {
  usuarios: [],
  cursos: [],
  disciplinas: [],
  disciplinasCurso: [],
  dependencias: [],
  ofertas: [],
  matriculas: [],
  notas: [],
  aulas: []
};

const menuPorPerfil = {
  coordenador: [
    { rota: "dashboard", texto: "Painel inicial" },
    { rota: "usuarios", texto: "Usuários" },
    { rota: "cursos", texto: "Cursos" },
    { rota: "disciplinas", texto: "Disciplinas" },
    { rota: "matriz", texto: "Matriz e dependências" },
    { rota: "ofertas", texto: "Ofertas de disciplinas" },
    { rota: "matriculas", texto: "Matrículas e importação" },
    { rota: "notas", texto: "Notas" },
    { rota: "frequencia", texto: "Frequência" }
  ],
  professor: [
    { rota: "dashboard", texto: "Painel inicial" },
    { rota: "professor-ofertas", texto: "Minhas disciplinas" },
    { rota: "professor-notas", texto: "Lançar notas" },
    { rota: "professor-frequencia", texto: "Frequência" }
  ],
  aluno: [
    { rota: "dashboard", texto: "Painel inicial" },
    { rota: "aluno-notas", texto: "Minhas notas" },
    { rota: "aluno-frequencia", texto: "Minha frequência" },
    { rota: "aluno-progresso", texto: "Meu progresso" }
  ]
};

function conteudo() {
  return $("#conteudo");
}

function definirTitulo(titulo, subtitulo = "") {
  $("#titulo-pagina").textContent = titulo;
  $("#subtitulo-pagina").textContent = subtitulo;
}

function textoPerfil(tipo) {
  const mapa = {
    coordenador: "Coordenador",
    professor: "Professor",
    aluno: "Aluno"
  };
  return mapa[tipo] || "Usuário";
}

function nomeCurso(id) {
  return cache.cursos.find((curso) => curso.id === id)?.nome || "Curso não informado";
}

function nomeDisciplina(id) {
  return cache.disciplinas.find((disciplina) => disciplina.id === id)?.nome || "Disciplina não informada";
}

function nomeUsuario(id) {
  return cache.usuarios.find((usuario) => usuario.id === id)?.nome || "Usuário não informado";
}

function resumoDisciplinaCurso(item) {
  if (!item) return "Disciplina do curso não informada";
  return `${nomeCurso(item.cursoId)} · ${nomeDisciplina(item.disciplinaId)} · ${item.periodo || "?"}º período`;
}

function resumoOferta(oferta) {
  if (!oferta) return "Oferta não informada";
  return `${nomeDisciplina(oferta.disciplinaId)} · ${oferta.turma || "Turma"} · ${oferta.periodoLetivo || "Período"}`;
}

function professorDaOferta(oferta) {
  return nomeUsuario(oferta?.professorId);
}

function formatarData(dataISO) {
  if (!dataISO) return "-";
  const partes = String(dataISO).split("-");
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function ordenarAulas(aulas) {
  return [...aulas].sort((a, b) => String(a.dataAula || "").localeCompare(String(b.dataAula || "")));
}

function minimoFrequenciaOferta(oferta) {
  const minimo = Number(oferta?.frequenciaMinima || 75);
  return minimo > 0 ? minimo : 75;
}

function totalHorasAulas(aulas) {
  return aulas.reduce((total, aula) => total + Number(aula.horasAula || 0), 0);
}

function calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta) {
  const aulasRealizadas = aulasOferta.filter((aula) => aula.chamadaRealizada === true);
  const totalHoras = totalHorasAulas(aulasRealizadas);
  const frequenciasAluno = frequenciasOferta.filter((frequencia) => frequencia.alunoId === matricula.alunoId);
  const frequenciaPorAula = new Map(frequenciasAluno.map((frequencia) => [frequencia.aulaId, frequencia]));
  const horasPresentes = aulasRealizadas.reduce((total, aula) => {
    const frequencia = frequenciaPorAula.get(aula.id);
    if (!frequencia) return total;
    return total + Number(frequencia.horasPresente ?? (frequencia.presente ? aula.horasAula : 0));
  }, 0);
  const percentual = totalHoras ? Number(((horasPresentes / totalHoras) * 100).toFixed(1)) : 0;
  const minimo = minimoFrequenciaOferta(oferta);

  return {
    totalHoras,
    horasPresentes,
    percentual,
    minimo,
    alerta: totalHoras > 0 && percentual < minimo
  };
}

function badgeFrequencia(resumo) {
  if (!resumo.totalHoras) return '<span class="badge badge-muted">Sem chamada</span>';
  if (resumo.alerta) return '<span class="badge badge-danger">Abaixo do mínimo</span>';
  return '<span class="badge badge-success">Regular</span>';
}

function opcoesOfertasFrequencia(ofertas) {
  return ofertas.map((oferta) => ({
    id: oferta.id,
    nome: `${resumoOferta(oferta)} · ${professorDaOferta(oferta)}`
  }));
}

function badgeAtivo(valor, textoAtivo = "Ativo", textoInativo = "Inativo") {
  return `<span class="badge ${valor === false ? "badge-muted" : "badge-success"}">${valor === false ? textoInativo : textoAtivo}</span>`;
}

function botaoEditar(chave, id) {
  return `<button class="botao botao-secundario botao-pequeno" data-editar-${chave}="${id}">Editar</button>`;
}

function botaoToggle(chave, id, ativo = true, textoAtivo = "Inativar", textoInativo = "Reativar") {
  const classe = ativo === false ? "botao-secundario" : "botao-perigo";
  const texto = ativo === false ? textoInativo : textoAtivo;
  return `<button class="botao ${classe} botao-pequeno" data-toggle-${chave}="${id}">${texto}</button>`;
}

function botaoRemover(chave, id, texto = "Remover") {
  return `<button class="botao botao-perigo botao-pequeno" data-remover-${chave}="${id}">${texto}</button>`;
}

function limparEdicao(chaveSessao, renderizar) {
  sessionStorage.removeItem(chaveSessao);
  return renderizar();
}


function renderizarMenu() {
  const menu = $("#menu-principal");
  const itens = menuPorPerfil[perfilAtual.tipo] || [];

  menu.innerHTML = itens.map((item) => `
    <button type="button" data-rota="${item.rota}" class="${item.rota === rotaAtual ? "ativo" : ""}">
      ${protegerTexto(item.texto)}
    </button>
  `).join("");

  $$("button[data-rota]", menu).forEach((botao) => {
    botao.addEventListener("click", () => navegar(botao.dataset.rota));
  });
}

async function navegar(rota) {
  rotaAtual = rota;
  renderizarMenu();
  $("#sidebar").classList.remove("aberta");

  try {
    const permissoes = menuPorPerfil[perfilAtual.tipo].map((item) => item.rota);
    if (!permissoes.includes(rota)) {
      rotaAtual = "dashboard";
    }

    if (rotaAtual === "dashboard") await renderDashboard();
    else if (rotaAtual === "usuarios") await renderUsuarios();
    else if (rotaAtual === "cursos") await renderCursos();
    else if (rotaAtual === "disciplinas") await renderDisciplinas();
    else if (rotaAtual === "matriz") await renderMatriz();
    else if (rotaAtual === "ofertas") await renderOfertas();
    else if (rotaAtual === "matriculas") await renderMatriculas();
    else if (rotaAtual === "notas") await renderNotas(true);
    else if (rotaAtual === "frequencia") await renderFrequenciaCoordenador();
    else if (rotaAtual === "professor-ofertas") await renderProfessorOfertas();
    else if (rotaAtual === "professor-notas") await renderNotas(false);
    else if (rotaAtual === "professor-frequencia") await renderProfessorFrequencia();
    else if (rotaAtual === "aluno-notas") await renderAlunoNotas();
    else if (rotaAtual === "aluno-frequencia") await renderAlunoFrequencia();
    else if (rotaAtual === "aluno-progresso") await renderAlunoProgresso();
  } catch (erro) {
    console.error(erro);
    definirTitulo("Erro", "Não foi possível carregar esta área.");
    conteudo().innerHTML = estadoVazio("Ocorreu um erro ao carregar as informações.", erro.message || "Tente novamente.");
    mostrarMensagem("Erro ao carregar informações.", "erro");
  }
}

async function carregarPerfil(uid) {
  const perfilSnap = await getDoc(doc(db, COLECOES.usuarios, uid));
  if (!perfilSnap.exists()) return null;
  return { id: perfilSnap.id, ...perfilSnap.data() };
}

async function carregarBaseAcademica() {
  const [usuarios, cursos, disciplinas, disciplinasCurso, dependencias, ofertas, aulas] = await Promise.all([
    buscarTodos(COLECOES.usuarios),
    buscarTodos(COLECOES.cursos),
    buscarTodos(COLECOES.disciplinas),
    buscarTodos(COLECOES.disciplinasCurso),
    buscarTodos(COLECOES.dependencias),
    buscarTodos(COLECOES.ofertas),
    buscarTodos(COLECOES.aulas)
  ]);

  cache.usuarios = usuarios;
  cache.cursos = cursos;
  cache.disciplinas = disciplinas;
  cache.disciplinasCurso = disciplinasCurso;
  cache.dependencias = dependencias;
  cache.ofertas = ofertas;
  cache.aulas = aulas;
}

async function renderDashboard() {
  if (perfilAtual.tipo === TIPOS_USUARIO.COORDENADOR) {
    await carregarBaseAcademica();
    const matriculas = await buscarTodos(COLECOES.matriculas);
    const frequencias = await buscarTodos(COLECOES.frequencias);
    cache.matriculas = matriculas;
    const alertasFrequencia = matriculas.filter((matricula) => {
      const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
      const aulasOferta = cache.aulas.filter((aula) => aula.ofertaId === matricula.ofertaId);
      const frequenciasOferta = frequencias.filter((frequencia) => frequencia.ofertaId === matricula.ofertaId);
      return calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta).alerta;
    });

    definirTitulo("Painel do coordenador", "Visão geral do sistema acadêmico.");
    conteudo().innerHTML = `
      <section class="grid-cards">
        <div class="card"><strong>${cache.usuarios.length}</strong><span>Usuários cadastrados</span><p>Coordenadores, professores e alunos.</p></div>
        <div class="card"><strong>${cache.cursos.length}</strong><span>Cursos</span><p>Cursos ativos ou cadastrados.</p></div>
        <div class="card"><strong>${cache.disciplinas.length}</strong><span>Disciplinas</span><p>Base geral de disciplinas.</p></div>
        <div class="card"><strong>${cache.ofertas.length}</strong><span>Ofertas</span><p>Disciplinas abertas por período.</p></div>
        <div class="card"><strong>${matriculas.length}</strong><span>Matrículas</span><p>Alunos vinculados às ofertas.</p></div>
        <div class="card"><strong>${cache.aulas.length}</strong><span>Aulas previstas</span><p>Dias e horas cadastrados para frequência.</p></div>
        <div class="card"><strong>${alertasFrequencia.length}</strong><span>Alertas de frequência</span><p>Alunos abaixo do mínimo obrigatório.</p></div>
      </section>
      <section class="bloco">
        <h2>Próximos passos recomendados</h2>
        <p>Cadastre cursos, disciplinas, professores e alunos. Depois monte a matriz curricular, crie ofertas, matricule alunos e configure os dias de aula na área de frequência.</p>
      </section>
    `;
    return;
  }

  if (perfilAtual.tipo === TIPOS_USUARIO.PROFESSOR) {
    await carregarBaseAcademica();
    const minhasOfertas = cache.ofertas.filter((oferta) => oferta.professorId === usuarioAtual.uid);
    const minhasMatriculas = await buscarPorCampo(COLECOES.matriculas, "professorId", "==", usuarioAtual.uid);

    definirTitulo("Painel do professor", "Suas disciplinas e turmas.");
    conteudo().innerHTML = `
      <section class="grid-cards">
        <div class="card"><strong>${minhasOfertas.length}</strong><span>Disciplinas</span><p>Ofertas sob sua responsabilidade.</p></div>
        <div class="card"><strong>${minhasMatriculas.length}</strong><span>Alunos</span><p>Matrículas nas suas disciplinas.</p></div>
      </section>
      <section class="bloco">
        <h2>Atalhos</h2>
        <div class="acoes">
          <button class="botao botao-primario" data-ir="professor-notas">Lançar notas</button>
          <button class="botao botao-secundario" data-ir="professor-frequencia">Fazer frequência</button>
          <button class="botao botao-secundario" data-ir="professor-ofertas">Ver minhas disciplinas</button>
        </div>
      </section>
    `;
    $$(`[data-ir]`).forEach((botao) => botao.addEventListener("click", () => navegar(botao.dataset.ir)));
    return;
  }

  await renderAlunoResumo();
}

async function renderAlunoResumo() {
  await carregarBaseAcademica();
  const matriculas = await buscarPorCampo(COLECOES.matriculas, "alunoId", "==", usuarioAtual.uid);
  const aprovadas = matriculas.filter((matricula) => matricula.situacao === SITUACOES.APROVADO).length;
  const cursoId = perfilAtual.cursoId;
  const totalDisciplinas = cache.disciplinasCurso.filter((item) => item.cursoId === cursoId).length;
  const progresso = totalDisciplinas ? ((aprovadas / totalDisciplinas) * 100).toFixed(1) : 0;

  definirTitulo("Painel do aluno", "Suas disciplinas, notas e progresso.");
  conteudo().innerHTML = `
    <section class="grid-cards">
      <div class="card"><strong>${matriculas.length}</strong><span>Disciplinas cursadas</span><p>Inclui disciplinas em andamento.</p></div>
      <div class="card"><strong>${aprovadas}</strong><span>Disciplinas aprovadas</span><p>Concluídas com aproveitamento.</p></div>
      <div class="card"><strong>${formatarNumero(progresso)}%</strong><span>Progresso no curso</span><p>${protegerTexto(nomeCurso(cursoId))}</p></div>
    </section>
    <section class="bloco">
      <h2>Resumo</h2>
      <p>Use o menu para ver suas notas, frequência, professores responsáveis e disciplinas pendentes.</p>
    </section>
  `;
}

async function renderCursos() {
  definirTitulo("Cursos", "Cadastro básico de cursos.");
  mostrarCarregando(conteudo());
  cache.cursos = await buscarTodos(COLECOES.cursos);

  const cursoEdicaoId = sessionStorage.getItem("editarCursoId");
  const cursoEdicao = cursoEdicaoId ? cache.cursos.find((curso) => curso.id === cursoEdicaoId) : null;
  if (cursoEdicaoId && !cursoEdicao) sessionStorage.removeItem("editarCursoId");

  const linhas = cache.cursos.map((curso) => `
    <tr>
      <td>${protegerTexto(curso.nome)}</td>
      <td>${protegerTexto(curso.modalidade || "-")}</td>
      <td>${badgeAtivo(curso.ativo)}</td>
      <td><div class="acoes">${botaoEditar("curso", curso.id)}${botaoToggle("curso", curso.id, curso.ativo)}</div></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco ${cursoEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${cursoEdicao ? "Editar curso" : "Novo curso"}</h2>
          <p>${cursoEdicao ? "Altere as informações e salve." : "Cadastre os cursos que terão disciplinas e alunos."}</p>
        </div>
        ${cursoEdicao ? `<button id="cancelar-edicao-curso" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-curso" class="form-grid">
        <div>
          <label>Nome do curso</label>
          <input name="nome" required placeholder="Ex.: Análise e Desenvolvimento de Sistemas" value="${protegerTexto(cursoEdicao?.nome || "")}" />
        </div>
        <div>
          <label>Modalidade</label>
          <input name="modalidade" placeholder="Ex.: Superior, Técnico, Médio" value="${protegerTexto(cursoEdicao?.modalidade || "")}" />
        </div>
        ${cursoEdicao ? `
          <div>
            <label>Status</label>
            <select name="ativo">
              <option value="true" ${cursoEdicao.ativo !== false ? "selected" : ""}>Ativo</option>
              <option value="false" ${cursoEdicao.ativo === false ? "selected" : ""}>Inativo</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${cursoEdicao ? "Salvar alterações" : "Salvar curso"}</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Cursos cadastrados</h2>
      ${montarTabela(["Curso", "Modalidade", "Status", "Ações"], linhas)}
    </section>
  `;

  if (cursoEdicao) {
    $("#cancelar-edicao-curso").addEventListener("click", () => limparEdicao("editarCursoId", renderCursos));
  }

  $$('[data-editar-curso]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarCursoId", botao.dataset.editarCurso);
    await renderCursos();
  }));

  $$('[data-toggle-curso]').forEach((botao) => botao.addEventListener("click", async () => {
    const curso = cache.cursos.find((item) => item.id === botao.dataset.toggleCurso);
    if (!curso) return;
    await updateDoc(doc(db, COLECOES.cursos, curso.id), {
      ativo: curso.ativo === false,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    mostrarMensagem(curso.ativo === false ? "Curso reativado." : "Curso inativado.");
    await renderCursos();
  }));

  $("#form-curso").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const payload = {
      nome: dados.get("nome").trim(),
      modalidade: dados.get("modalidade").trim(),
      ativo: cursoEdicao ? dados.get("ativo") === "true" : true,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (cursoEdicao) {
      await updateDoc(doc(db, COLECOES.cursos, cursoEdicao.id), payload);
      sessionStorage.removeItem("editarCursoId");
      mostrarMensagem("Curso atualizado com sucesso.");
    } else {
      await addDoc(collection(db, COLECOES.cursos), {
        ...payload,
        criadoEm: serverTimestamp()
      });
      mostrarMensagem("Curso cadastrado com sucesso.");
    }
    await renderCursos();
  });
}

async function renderDisciplinas() {
  definirTitulo("Disciplinas", "Cadastro geral de disciplinas.");
  mostrarCarregando(conteudo());
  cache.disciplinas = await buscarTodos(COLECOES.disciplinas);

  const disciplinaEdicaoId = sessionStorage.getItem("editarDisciplinaId");
  const disciplinaEdicao = disciplinaEdicaoId ? cache.disciplinas.find((disciplina) => disciplina.id === disciplinaEdicaoId) : null;
  if (disciplinaEdicaoId && !disciplinaEdicao) sessionStorage.removeItem("editarDisciplinaId");

  const linhas = cache.disciplinas.map((disciplina) => `
    <tr>
      <td>${protegerTexto(disciplina.nome)}</td>
      <td>${protegerTexto(disciplina.codigo || "-")}</td>
      <td>${protegerTexto(disciplina.cargaHoraria || "-")}h</td>
      <td>${badgeAtivo(disciplina.ativo, "Ativa", "Inativa")}</td>
      <td><div class="acoes">${botaoEditar("disciplina", disciplina.id)}${botaoToggle("disciplina", disciplina.id, disciplina.ativo)}</div></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco ${disciplinaEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${disciplinaEdicao ? "Editar disciplina" : "Nova disciplina"}</h2>
          <p>${disciplinaEdicao ? "Atualize nome, código, carga horária ou status." : "Cadastre a disciplina uma vez e depois vincule à matriz do curso."}</p>
        </div>
        ${disciplinaEdicao ? `<button id="cancelar-edicao-disciplina" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-disciplina" class="form-grid">
        <div>
          <label>Nome</label>
          <input name="nome" required placeholder="Ex.: Programação I" value="${protegerTexto(disciplinaEdicao?.nome || "")}" />
        </div>
        <div>
          <label>Código</label>
          <input name="codigo" placeholder="Ex.: ADS001" value="${protegerTexto(disciplinaEdicao?.codigo || "")}" />
        </div>
        <div>
          <label>Carga horária</label>
          <input name="cargaHoraria" type="number" min="1" placeholder="80" value="${protegerTexto(disciplinaEdicao?.cargaHoraria || "")}" />
        </div>
        ${disciplinaEdicao ? `
          <div>
            <label>Status</label>
            <select name="ativo">
              <option value="true" ${disciplinaEdicao.ativo !== false ? "selected" : ""}>Ativa</option>
              <option value="false" ${disciplinaEdicao.ativo === false ? "selected" : ""}>Inativa</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${disciplinaEdicao ? "Salvar alterações" : "Salvar disciplina"}</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Disciplinas cadastradas</h2>
      ${montarTabela(["Disciplina", "Código", "Carga horária", "Status", "Ações"], linhas)}
    </section>
  `;

  if (disciplinaEdicao) {
    $("#cancelar-edicao-disciplina").addEventListener("click", () => limparEdicao("editarDisciplinaId", renderDisciplinas));
  }

  $$('[data-editar-disciplina]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarDisciplinaId", botao.dataset.editarDisciplina);
    await renderDisciplinas();
  }));

  $$('[data-toggle-disciplina]').forEach((botao) => botao.addEventListener("click", async () => {
    const disciplina = cache.disciplinas.find((item) => item.id === botao.dataset.toggleDisciplina);
    if (!disciplina) return;
    await updateDoc(doc(db, COLECOES.disciplinas, disciplina.id), {
      ativo: disciplina.ativo === false,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    mostrarMensagem(disciplina.ativo === false ? "Disciplina reativada." : "Disciplina inativada.");
    await renderDisciplinas();
  }));

  $("#form-disciplina").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const payload = {
      nome: dados.get("nome").trim(),
      codigo: dados.get("codigo").trim(),
      cargaHoraria: Number(dados.get("cargaHoraria") || 0),
      ativo: disciplinaEdicao ? dados.get("ativo") === "true" : true,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (disciplinaEdicao) {
      await updateDoc(doc(db, COLECOES.disciplinas, disciplinaEdicao.id), payload);
      sessionStorage.removeItem("editarDisciplinaId");
      mostrarMensagem("Disciplina atualizada com sucesso.");
    } else {
      await addDoc(collection(db, COLECOES.disciplinas), {
        ...payload,
        criadoEm: serverTimestamp()
      });
      mostrarMensagem("Disciplina cadastrada com sucesso.");
    }
    await renderDisciplinas();
  });
}

async function renderUsuarios() {
  definirTitulo("Usuários", "Cadastro de coordenadores, professores e alunos.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const usuarioEdicaoId = sessionStorage.getItem("editarUsuarioId");
  const usuarioEdicao = usuarioEdicaoId ? cache.usuarios.find((usuario) => usuario.id === usuarioEdicaoId) : null;
  if (usuarioEdicaoId && !usuarioEdicao) sessionStorage.removeItem("editarUsuarioId");

  const linhas = cache.usuarios.map((usuario) => {
    const ehUsuarioAtual = usuario.id === usuarioAtual.uid;
    const toggle = ehUsuarioAtual
      ? `<button class="botao botao-neutro botao-pequeno" disabled>Usuário atual</button>`
      : botaoToggle("usuario", usuario.id, usuario.ativo);
    return `
      <tr>
        <td>${protegerTexto(usuario.nome)}</td>
        <td>${protegerTexto(usuario.email)}</td>
        <td><span class="badge badge-info">${protegerTexto(textoPerfil(usuario.tipo))}</span></td>
        <td>${usuario.cursoId ? protegerTexto(nomeCurso(usuario.cursoId)) : "-"}</td>
        <td>${badgeAtivo(usuario.ativo)}</td>
        <td><div class="acoes">${botaoEditar("usuario", usuario.id)}${toggle}</div></td>
      </tr>
    `;
  });

  conteudo().innerHTML = `
    <section class="bloco ${usuarioEdicao ? "form-edicao" : ""}">
      <div class="aviso">
        ${usuarioEdicao
          ? "A edição altera os dados do perfil no Firestore. E-mail e senha do Firebase Authentication não são alterados por esta tela."
          : "Para criar professores e alunos, o sistema cria também uma conta no Firebase Authentication. Use uma senha inicial simples e peça ao usuário para trocar depois no painel do Firebase ou em uma versão futura do sistema."}
      </div>
      <div class="bloco-topo">
        <div>
          <h2>${usuarioEdicao ? "Editar usuário" : "Novo usuário"}</h2>
          <p>${usuarioEdicao ? "Altere nome, perfil, matrícula, curso e status." : "Cadastre coordenadores, professores e alunos."}</p>
        </div>
        ${usuarioEdicao ? `<button id="cancelar-edicao-usuario" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-usuario" class="form-grid">
        <div>
          <label>Nome completo</label>
          <input name="nome" required placeholder="Nome do usuário" value="${protegerTexto(usuarioEdicao?.nome || "")}" />
        </div>
        <div>
          <label>E-mail</label>
          <input name="email" type="email" required placeholder="email@exemplo.com" value="${protegerTexto(usuarioEdicao?.email || "")}" ${usuarioEdicao ? "readonly" : ""} />
        </div>
        ${usuarioEdicao ? "" : `
          <div>
            <label>Senha inicial</label>
            <input name="senha" type="password" minlength="6" required placeholder="Mínimo 6 caracteres" />
          </div>
        `}
        <div>
          <label>Perfil</label>
          <select name="tipo" id="tipo-usuario" required>
            <option value="coordenador" ${usuarioEdicao?.tipo === "coordenador" ? "selected" : ""}>Coordenador</option>
            <option value="professor" ${usuarioEdicao?.tipo === "professor" ? "selected" : ""}>Professor</option>
            <option value="aluno" ${usuarioEdicao?.tipo === "aluno" ? "selected" : ""}>Aluno</option>
          </select>
        </div>
        <div>
          <label>Matrícula</label>
          <input name="matricula" placeholder="Opcional" value="${protegerTexto(usuarioEdicao?.matricula || "")}" />
        </div>
        <div id="campo-curso-aluno">
          <label>Curso do aluno</label>
          <select name="cursoId" id="curso-usuario"></select>
        </div>
        ${usuarioEdicao ? `
          <div>
            <label>Status</label>
            <select name="ativo" ${usuarioEdicao.id === usuarioAtual.uid ? "disabled" : ""}>
              <option value="true" ${usuarioEdicao.ativo !== false ? "selected" : ""}>Ativo</option>
              <option value="false" ${usuarioEdicao.ativo === false ? "selected" : ""}>Inativo</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${usuarioEdicao ? "Salvar alterações" : "Criar usuário"}</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Usuários cadastrados</h2>
      ${montarTabela(["Nome", "E-mail", "Perfil", "Curso", "Status", "Ações"], linhas)}
    </section>
  `;

  preencherSelect($("#curso-usuario"), cache.cursos.filter((curso) => curso.ativo !== false), "Selecione o curso", "id", "nome");
  if (usuarioEdicao?.cursoId) $("#curso-usuario").value = usuarioEdicao.cursoId;

  function atualizarCampoCurso() {
    const tipo = $("#tipo-usuario").value;
    $("#campo-curso-aluno").style.display = tipo === TIPOS_USUARIO.ALUNO ? "block" : "none";
  }

  $("#tipo-usuario").addEventListener("change", atualizarCampoCurso);
  atualizarCampoCurso();

  if (usuarioEdicao) {
    $("#cancelar-edicao-usuario").addEventListener("click", () => limparEdicao("editarUsuarioId", renderUsuarios));
  }

  $$('[data-editar-usuario]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarUsuarioId", botao.dataset.editarUsuario);
    await renderUsuarios();
  }));

  $$('[data-toggle-usuario]').forEach((botao) => botao.addEventListener("click", async () => {
    const usuario = cache.usuarios.find((item) => item.id === botao.dataset.toggleUsuario);
    if (!usuario || usuario.id === usuarioAtual.uid) return;
    await updateDoc(doc(db, COLECOES.usuarios, usuario.id), {
      ativo: usuario.ativo === false,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    mostrarMensagem(usuario.ativo === false ? "Usuário reativado." : "Usuário inativado.");
    await renderUsuarios();
  }));

  $("#form-usuario").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const botao = evento.submitter;
    botao.disabled = true;
    botao.textContent = usuarioEdicao ? "Salvando..." : "Criando...";

    try {
      const dados = new FormData(evento.target);
      const tipo = dados.get("tipo");
      const cursoId = tipo === TIPOS_USUARIO.ALUNO ? dados.get("cursoId") : "";

      if (tipo === TIPOS_USUARIO.ALUNO && !cursoId) {
        mostrarMensagem("Selecione o curso do aluno.", "alerta");
        return;
      }

      if (usuarioEdicao) {
        await updateDoc(doc(db, COLECOES.usuarios, usuarioEdicao.id), {
          nome: dados.get("nome").trim(),
          tipo,
          matricula: dados.get("matricula").trim(),
          cursoId,
          ativo: usuarioEdicao.id === usuarioAtual.uid ? true : dados.get("ativo") === "true",
          atualizadoEm: serverTimestamp(),
          atualizadoPor: usuarioAtual.uid
        });
        sessionStorage.removeItem("editarUsuarioId");
        mostrarMensagem("Usuário atualizado com sucesso.");
      } else {
        const perfil = {
          nome: dados.get("nome").trim(),
          email: dados.get("email").trim().toLowerCase(),
          tipo,
          matricula: dados.get("matricula").trim(),
          cursoId,
          ativo: true,
          criadoEm: serverTimestamp(),
          criadoPor: usuarioAtual.uid
        };
        await criarUsuarioComAuth(perfil, dados.get("senha"));
        mostrarMensagem("Usuário criado com sucesso.");
      }
      await renderUsuarios();
    } catch (erro) {
      console.error(erro);
      mostrarMensagem(usuarioEdicao ? "Erro ao atualizar usuário." : "Erro ao criar usuário. Verifique se o e-mail já existe.", "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = usuarioEdicao ? "Salvar alterações" : "Criar usuário";
    }
  });
}

async function criarUsuarioComAuth(perfil, senha) {
  const appSecundario = initializeApp(firebaseConfig, `cadastro-${Date.now()}`);
  const authSecundario = getAuth(appSecundario);

  try {
    const credencial = await createUserWithEmailAndPassword(authSecundario, perfil.email, senha);
    await setDoc(doc(db, COLECOES.usuarios, credencial.user.uid), perfil);
    await signOut(authSecundario);
  } finally {
    await deleteApp(appSecundario);
  }
}

async function renderMatriz() {
  definirTitulo("Matriz e dependências", "Organize disciplinas por curso, período e pré-requisitos.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const matrizEdicaoId = sessionStorage.getItem("editarMatrizId");
  const matrizEdicao = matrizEdicaoId ? cache.disciplinasCurso.find((item) => item.id === matrizEdicaoId) : null;
  if (matrizEdicaoId && !matrizEdicao) sessionStorage.removeItem("editarMatrizId");

  const linhasMatriz = cache.disciplinasCurso.map((item) => `
    <tr>
      <td>${protegerTexto(nomeCurso(item.cursoId))}</td>
      <td>${protegerTexto(nomeDisciplina(item.disciplinaId))}</td>
      <td>${protegerTexto(item.periodo || "-")}</td>
      <td>${protegerTexto(item.ordem || "-")}</td>
      <td>${badgeAtivo(item.ativo)}</td>
      <td><div class="acoes">${botaoEditar("matriz", item.id)}${botaoToggle("matriz", item.id, item.ativo)}</div></td>
    </tr>
  `);

  const linhasDependencias = cache.dependencias.map((dep) => {
    const disciplina = cache.disciplinasCurso.find((item) => item.id === dep.disciplinaCursoId);
    const dependeDe = cache.disciplinasCurso.find((item) => item.id === dep.dependeDeDisciplinaCursoId);
    return `
      <tr>
        <td>${protegerTexto(resumoDisciplinaCurso(disciplina))}</td>
        <td>${protegerTexto(resumoDisciplinaCurso(dependeDe))}</td>
        <td><div class="acoes">${botaoRemover("dependencia", dep.id)}</div></td>
      </tr>
    `;
  });

  conteudo().innerHTML = `
    <section class="bloco ${matrizEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${matrizEdicao ? "Editar disciplina na matriz" : "Vincular disciplina ao curso"}</h2>
          <p>${matrizEdicao ? "Atualize período, ordem, curso, disciplina ou status." : "Monte a matriz curricular antes de criar as ofertas."}</p>
        </div>
        ${matrizEdicao ? `<button id="cancelar-edicao-matriz" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-matriz" class="form-grid">
        <div>
          <label>Curso</label>
          <select name="cursoId" id="matriz-curso" required></select>
        </div>
        <div>
          <label>Disciplina</label>
          <select name="disciplinaId" id="matriz-disciplina" required></select>
        </div>
        <div>
          <label>Período/Módulo</label>
          <input name="periodo" type="number" min="1" required placeholder="1" value="${protegerTexto(matrizEdicao?.periodo || "")}" />
        </div>
        <div>
          <label>Ordem</label>
          <input name="ordem" type="number" min="1" required placeholder="1" value="${protegerTexto(matrizEdicao?.ordem || "")}" />
        </div>
        ${matrizEdicao ? `
          <div>
            <label>Status</label>
            <select name="ativo">
              <option value="true" ${matrizEdicao.ativo !== false ? "selected" : ""}>Ativo</option>
              <option value="false" ${matrizEdicao.ativo === false ? "selected" : ""}>Inativo</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${matrizEdicao ? "Salvar alterações" : "Adicionar à matriz"}</button>
      </form>
    </section>

    <section class="bloco">
      <h2>Cadastrar dependência</h2>
      <form id="form-dependencia" class="form-grid">
        <div>
          <label>Disciplina</label>
          <select name="disciplinaCursoId" id="dep-disciplina" required></select>
        </div>
        <div>
          <label>Depende de</label>
          <select name="dependeDeDisciplinaCursoId" id="dep-depende" required></select>
        </div>
        <button class="botao botao-primario" type="submit">Salvar dependência</button>
      </form>
    </section>

    <section class="bloco">
      <h2>Disciplinas na matriz</h2>
      ${montarTabela(["Curso", "Disciplina", "Período", "Ordem", "Status", "Ações"], linhasMatriz)}
    </section>

    <section class="bloco">
      <h2>Dependências cadastradas</h2>
      ${montarTabela(["Disciplina", "Depende de", "Ações"], linhasDependencias)}
    </section>
  `;

  preencherSelect($("#matriz-curso"), cache.cursos.filter((curso) => curso.ativo !== false || curso.id === matrizEdicao?.cursoId), "Selecione o curso", "id", "nome");
  preencherSelect($("#matriz-disciplina"), cache.disciplinas.filter((disciplina) => disciplina.ativo !== false || disciplina.id === matrizEdicao?.disciplinaId), "Selecione a disciplina", "id", "nome");
  if (matrizEdicao) {
    $("#matriz-curso").value = matrizEdicao.cursoId;
    $("#matriz-disciplina").value = matrizEdicao.disciplinaId;
    $("#cancelar-edicao-matriz").addEventListener("click", () => limparEdicao("editarMatrizId", renderMatriz));
  }

  const opcoesMatriz = cache.disciplinasCurso
    .filter((item) => item.ativo !== false)
    .map((item) => ({ id: item.id, nome: resumoDisciplinaCurso(item) }));
  preencherSelect($("#dep-disciplina"), opcoesMatriz, "Selecione a disciplina", "id", "nome");
  preencherSelect($("#dep-depende"), opcoesMatriz, "Selecione o pré-requisito", "id", "nome");

  $$('[data-editar-matriz]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarMatrizId", botao.dataset.editarMatriz);
    await renderMatriz();
  }));

  $$('[data-toggle-matriz]').forEach((botao) => botao.addEventListener("click", async () => {
    const item = cache.disciplinasCurso.find((matriz) => matriz.id === botao.dataset.toggleMatriz);
    if (!item) return;
    await updateDoc(doc(db, COLECOES.disciplinasCurso, item.id), {
      ativo: item.ativo === false,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    mostrarMensagem(item.ativo === false ? "Item da matriz reativado." : "Item da matriz inativado.");
    await renderMatriz();
  }));

  $$('[data-remover-dependencia]').forEach((botao) => botao.addEventListener("click", async () => {
    if (!confirm("Remover esta dependência?")) return;
    await deleteDoc(doc(db, COLECOES.dependencias, botao.dataset.removerDependencia));
    mostrarMensagem("Dependência removida.");
    await renderMatriz();
  }));

  $("#form-matriz").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const cursoId = dados.get("cursoId");
    const disciplinaId = dados.get("disciplinaId");
    const jaExiste = cache.disciplinasCurso.some((item) => item.id !== matrizEdicao?.id && item.cursoId === cursoId && item.disciplinaId === disciplinaId);
    if (jaExiste) {
      mostrarMensagem("Essa disciplina já está vinculada a este curso.", "alerta");
      return;
    }

    const payload = {
      cursoId,
      disciplinaId,
      periodo: Number(dados.get("periodo")),
      ordem: Number(dados.get("ordem")),
      ativo: matrizEdicao ? dados.get("ativo") === "true" : true,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (matrizEdicao) {
      await updateDoc(doc(db, COLECOES.disciplinasCurso, matrizEdicao.id), payload);
      sessionStorage.removeItem("editarMatrizId");
      mostrarMensagem("Item da matriz atualizado.");
    } else {
      await addDoc(collection(db, COLECOES.disciplinasCurso), {
        ...payload,
        criadoEm: serverTimestamp()
      });
      mostrarMensagem("Disciplina adicionada à matriz.");
    }
    await renderMatriz();
  });

  $("#form-dependencia").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const disciplinaCursoId = dados.get("disciplinaCursoId");
    const dependeDeDisciplinaCursoId = dados.get("dependeDeDisciplinaCursoId");

    if (disciplinaCursoId === dependeDeDisciplinaCursoId) {
      mostrarMensagem("A disciplina não pode depender dela mesma.", "alerta");
      return;
    }

    const jaExiste = cache.dependencias.some((dep) => dep.disciplinaCursoId === disciplinaCursoId && dep.dependeDeDisciplinaCursoId === dependeDeDisciplinaCursoId);
    if (jaExiste) {
      mostrarMensagem("Essa dependência já foi cadastrada.", "alerta");
      return;
    }

    await addDoc(collection(db, COLECOES.dependencias), {
      disciplinaCursoId,
      dependeDeDisciplinaCursoId,
      criadoEm: serverTimestamp(),
      criadoPor: usuarioAtual.uid
    });
    mostrarMensagem("Dependência cadastrada.");
    await renderMatriz();
  });
}

async function renderOfertas() {
  definirTitulo("Ofertas de disciplinas", "Abra disciplinas por período letivo, turma e professor.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const ofertaEdicaoId = sessionStorage.getItem("editarOfertaId");
  const ofertaEdicao = ofertaEdicaoId ? cache.ofertas.find((oferta) => oferta.id === ofertaEdicaoId) : null;
  if (ofertaEdicaoId && !ofertaEdicao) sessionStorage.removeItem("editarOfertaId");

  const professores = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.PROFESSOR && usuario.ativo !== false);
  const opcoesMatriz = cache.disciplinasCurso
    .filter((item) => item.ativo !== false || item.id === ofertaEdicao?.disciplinaCursoId)
    .map((item) => ({ id: item.id, nome: resumoDisciplinaCurso(item) }));

  const linhas = cache.ofertas.map((oferta) => `
    <tr>
      <td>${protegerTexto(nomeCurso(oferta.cursoId))}</td>
      <td>${protegerTexto(nomeDisciplina(oferta.disciplinaId))}</td>
      <td>${protegerTexto(oferta.turma || "-")}</td>
      <td>${protegerTexto(oferta.periodoLetivo || "-")}</td>
      <td>${protegerTexto(professorDaOferta(oferta))}</td>
      <td>${formatarNumero(minimoFrequenciaOferta(oferta))}%</td>
      <td>${badgeAtivo(oferta.ativa, "Ativa", "Inativa")}</td>
      <td><div class="acoes">${botaoEditar("oferta", oferta.id)}${botaoToggle("oferta", oferta.id, oferta.ativa)}</div></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco ${ofertaEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${ofertaEdicao ? "Editar oferta" : "Nova oferta"}</h2>
          <p>${ofertaEdicao ? "Altere professor, turma, período, frequência mínima ou status." : "Crie uma turma/oferta a partir da matriz curricular."}</p>
        </div>
        ${ofertaEdicao ? `<button id="cancelar-edicao-oferta" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-oferta" class="form-grid">
        <div>
          <label>Disciplina na matriz</label>
          <select name="disciplinaCursoId" id="oferta-disciplina-curso" required></select>
        </div>
        <div>
          <label>Professor responsável</label>
          <select name="professorId" id="oferta-professor" required></select>
        </div>
        <div>
          <label>Período letivo</label>
          <input name="periodoLetivo" required placeholder="Ex.: 2026.2" value="${protegerTexto(ofertaEdicao?.periodoLetivo || "")}" />
        </div>
        <div>
          <label>Turma</label>
          <input name="turma" required placeholder="Ex.: Módulo III - Noite" value="${protegerTexto(ofertaEdicao?.turma || "")}" />
        </div>
        <div>
          <label>Frequência mínima obrigatória (%)</label>
          <input name="frequenciaMinima" type="number" min="1" max="100" value="${protegerTexto(ofertaEdicao?.frequenciaMinima || 75)}" />
        </div>
        ${ofertaEdicao ? `
          <div>
            <label>Status</label>
            <select name="ativa">
              <option value="true" ${ofertaEdicao.ativa !== false ? "selected" : ""}>Ativa</option>
              <option value="false" ${ofertaEdicao.ativa === false ? "selected" : ""}>Inativa</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${ofertaEdicao ? "Salvar alterações" : "Criar oferta"}</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Ofertas cadastradas</h2>
      ${montarTabela(["Curso", "Disciplina", "Turma", "Período", "Professor", "Frequência mínima", "Status", "Ações"], linhas)}
    </section>
  `;

  preencherSelect($("#oferta-disciplina-curso"), opcoesMatriz, "Selecione a disciplina", "id", "nome");
  preencherSelect($("#oferta-professor"), professores, "Selecione o professor", "id", "nome");
  if (ofertaEdicao) {
    $("#oferta-disciplina-curso").value = ofertaEdicao.disciplinaCursoId;
    $("#oferta-professor").value = ofertaEdicao.professorId;
    $("#cancelar-edicao-oferta").addEventListener("click", () => limparEdicao("editarOfertaId", renderOfertas));
  }

  $$('[data-editar-oferta]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarOfertaId", botao.dataset.editarOferta);
    await renderOfertas();
  }));

  $$('[data-toggle-oferta]').forEach((botao) => botao.addEventListener("click", async () => {
    const oferta = cache.ofertas.find((item) => item.id === botao.dataset.toggleOferta);
    if (!oferta) return;
    await updateDoc(doc(db, COLECOES.ofertas, oferta.id), {
      ativa: oferta.ativa === false,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    mostrarMensagem(oferta.ativa === false ? "Oferta reativada." : "Oferta inativada.");
    await renderOfertas();
  }));

  $("#form-oferta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const disciplinaCurso = cache.disciplinasCurso.find((item) => item.id === dados.get("disciplinaCursoId"));

    if (!disciplinaCurso) {
      mostrarMensagem("Selecione uma disciplina válida.", "alerta");
      return;
    }

    const payload = {
      cursoId: disciplinaCurso.cursoId,
      disciplinaCursoId: disciplinaCurso.id,
      disciplinaId: disciplinaCurso.disciplinaId,
      professorId: dados.get("professorId"),
      periodoLetivo: dados.get("periodoLetivo").trim(),
      turma: dados.get("turma").trim(),
      frequenciaMinima: Number(dados.get("frequenciaMinima") || 75),
      ativa: ofertaEdicao ? dados.get("ativa") === "true" : true,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (ofertaEdicao) {
      await updateDoc(doc(db, COLECOES.ofertas, ofertaEdicao.id), payload);
      sessionStorage.removeItem("editarOfertaId");
      mostrarMensagem("Oferta atualizada com sucesso.");
    } else {
      await addDoc(collection(db, COLECOES.ofertas), {
        ...payload,
        criadoEm: serverTimestamp()
      });
      mostrarMensagem("Oferta criada com sucesso.");
    }

    await renderOfertas();
  });
}

async function renderMatriculas() {
  definirTitulo("Matrículas e importação", "Matricule alunos, edite situação e importe de uma disciplina para outra.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();
  const alunos = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.ALUNO && usuario.ativo !== false);
  const ofertas = cache.ofertas.filter((oferta) => oferta.ativa !== false);
  const ofertaSelecionadaId = sessionStorage.getItem("ofertaMatriculas") || ofertas[0]?.id || "";
  const matriculasOferta = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId) : [];

  const matriculaEdicaoId = sessionStorage.getItem("editarMatriculaId");
  const matriculaEdicao = matriculaEdicaoId ? matriculasOferta.find((matricula) => matricula.id === matriculaEdicaoId) : null;
  if (matriculaEdicaoId && !matriculaEdicao) sessionStorage.removeItem("editarMatriculaId");

  const linhas = matriculasOferta.map((matricula) => `
    <tr>
      <td>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</td>
      <td><span class="badge ${classeSituacao(matricula.situacao)}">${protegerTexto(textoSituacao(matricula.situacao))}</span></td>
      <td>${formatarNumero(matricula.mediaFinal || 0)}</td>
      <td>${formatarNumero(matricula.percentualAproveitamento || 0)}%</td>
      <td><div class="acoes">${botaoEditar("matricula", matricula.id)}${botaoRemover("matricula", matricula.id, "Remover")}</div></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco ${matriculaEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${matriculaEdicao ? "Editar matrícula" : "Matricular aluno manualmente"}</h2>
          <p>${matriculaEdicao ? "Atualize a situação do aluno nesta oferta." : "Vincule um aluno a uma oferta de disciplina."}</p>
        </div>
        ${matriculaEdicao ? `<button id="cancelar-edicao-matricula" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
      </div>
      <form id="form-matricula" class="form-grid">
        <div>
          <label>Oferta da disciplina</label>
          <select name="ofertaId" id="matricula-oferta" required ${matriculaEdicao ? "disabled" : ""}></select>
        </div>
        <div>
          <label>Aluno</label>
          <select name="alunoId" id="matricula-aluno" required ${matriculaEdicao ? "disabled" : ""}></select>
        </div>
        ${matriculaEdicao ? `
          <div>
            <label>Situação</label>
            <select name="situacao" id="matricula-situacao">
              <option value="cursando" ${matriculaEdicao.situacao === "cursando" ? "selected" : ""}>Cursando</option>
              <option value="aprovado" ${matriculaEdicao.situacao === "aprovado" ? "selected" : ""}>Aprovado</option>
              <option value="reprovado" ${matriculaEdicao.situacao === "reprovado" ? "selected" : ""}>Reprovado</option>
              <option value="trancado" ${matriculaEdicao.situacao === "trancado" ? "selected" : ""}>Trancado</option>
              <option value="dependencia" ${matriculaEdicao.situacao === "dependencia" ? "selected" : ""}>Dependência</option>
            </select>
          </div>
        ` : ""}
        <button class="botao botao-primario" type="submit">${matriculaEdicao ? "Salvar alterações" : "Matricular aluno"}</button>
      </form>
    </section>

    <section class="bloco">
      <h2>Importar alunos de outra disciplina</h2>
      <form id="form-importar" class="form-grid">
        <div>
          <label>Disciplina de origem</label>
          <select name="origemId" id="importar-origem" required></select>
        </div>
        <div>
          <label>Disciplina de destino</label>
          <select name="destinoId" id="importar-destino" required></select>
        </div>
        <div>
          <label>Filtro</label>
          <select name="filtro">
            <option value="todos">Importar todos</option>
            <option value="aprovados">Importar somente aprovados</option>
          </select>
        </div>
        <button class="botao botao-primario" type="submit">Importar alunos</button>
      </form>
    </section>

    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Alunos matriculados</h2>
          <p>Selecione uma oferta para visualizar os alunos.</p>
        </div>
        <select id="filtro-oferta-matriculas"></select>
      </div>
      ${montarTabela(["Aluno", "Situação", "Média", "Aproveitamento", "Ações"], linhas)}
    </section>
  `;

  const opcoesOfertas = ofertas.map((oferta) => ({ id: oferta.id, nome: resumoOferta(oferta) }));
  preencherSelect($("#matricula-oferta"), opcoesOfertas, "Selecione a oferta", "id", "nome");
  preencherSelect($("#matricula-aluno"), alunos, "Selecione o aluno", "id", "nome");
  preencherSelect($("#importar-origem"), opcoesOfertas, "Selecione a origem", "id", "nome");
  preencherSelect($("#importar-destino"), opcoesOfertas, "Selecione o destino", "id", "nome");
  preencherSelect($("#filtro-oferta-matriculas"), opcoesOfertas, "Selecione uma oferta", "id", "nome");

  $("#filtro-oferta-matriculas").value = ofertaSelecionadaId;
  $("#matricula-oferta").value = matriculaEdicao?.ofertaId || ofertaSelecionadaId;
  if (matriculaEdicao?.alunoId) $("#matricula-aluno").value = matriculaEdicao.alunoId;

  if (matriculaEdicao) {
    $("#cancelar-edicao-matricula").addEventListener("click", () => limparEdicao("editarMatriculaId", renderMatriculas));
  }

  $("#filtro-oferta-matriculas").addEventListener("change", async (evento) => {
    sessionStorage.setItem("ofertaMatriculas", evento.target.value);
    sessionStorage.removeItem("editarMatriculaId");
    await renderMatriculas();
  });

  $$('[data-editar-matricula]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarMatriculaId", botao.dataset.editarMatricula);
    await renderMatriculas();
  }));

  $$('[data-remover-matricula]').forEach((botao) => botao.addEventListener("click", async () => {
    const matricula = matriculasOferta.find((item) => item.id === botao.dataset.removerMatricula);
    if (!matricula) return;
    if (!confirm("Remover esta matrícula? As notas e frequências vinculadas também serão removidas.")) return;

    const lote = writeBatch(db);
    lote.delete(doc(db, COLECOES.matriculas, matricula.id));
    lote.delete(doc(db, COLECOES.notas, matricula.id));
    const frequenciasMatricula = await buscarPorCampo(COLECOES.frequencias, "matriculaId", "==", matricula.id);
    frequenciasMatricula.forEach((freq) => lote.delete(doc(db, COLECOES.frequencias, freq.id)));
    await lote.commit();

    mostrarMensagem("Matrícula removida.");
    await renderMatriculas();
  }));

  $("#form-matricula").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);

    if (matriculaEdicao) {
      const situacao = dados.get("situacao") || SITUACOES.CURSANDO;
      await updateDoc(doc(db, COLECOES.matriculas, matriculaEdicao.id), {
        situacao,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuarioAtual.uid
      });
      await updateDoc(doc(db, COLECOES.notas, matriculaEdicao.id), {
        situacao,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuarioAtual.uid
      }).catch(() => {});
      sessionStorage.removeItem("editarMatriculaId");
      mostrarMensagem("Matrícula atualizada com sucesso.");
    } else {
      await matricularAluno(dados.get("alunoId"), dados.get("ofertaId"));
      sessionStorage.setItem("ofertaMatriculas", dados.get("ofertaId"));
      mostrarMensagem("Aluno matriculado com sucesso.");
    }
    await renderMatriculas();
  });

  $("#form-importar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const origemId = dados.get("origemId");
    const destinoId = dados.get("destinoId");
    const filtro = dados.get("filtro");

    if (origemId === destinoId) {
      mostrarMensagem("A origem e o destino precisam ser diferentes.", "alerta");
      return;
    }

    const total = await importarAlunos(origemId, destinoId, filtro);
    sessionStorage.setItem("ofertaMatriculas", destinoId);
    mostrarMensagem(`${total} aluno(s) importado(s) com sucesso.`);
    await renderMatriculas();
  });
}

async function matricularAluno(alunoId, ofertaId) {
  const oferta = cache.ofertas.find((item) => item.id === ofertaId) || await buscarDocumento(COLECOES.ofertas, ofertaId);
  const aluno = cache.usuarios.find((item) => item.id === alunoId) || await buscarDocumento(COLECOES.usuarios, alunoId);
  const matriculasDaOferta = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaId);
  const jaExiste = matriculasDaOferta.some((matricula) => matricula.alunoId === alunoId);

  if (jaExiste) {
    mostrarMensagem("Esse aluno já está matriculado nessa oferta.", "alerta");
    return;
  }

  await addDoc(collection(db, COLECOES.matriculas), {
    alunoId,
    alunoNome: aluno?.nome || "",
    ofertaId,
    cursoId: oferta.cursoId,
    disciplinaCursoId: oferta.disciplinaCursoId,
    disciplinaId: oferta.disciplinaId,
    professorId: oferta.professorId,
    situacao: SITUACOES.CURSANDO,
    mediaFinal: 0,
    percentualAproveitamento: 0,
    criadoEm: serverTimestamp(),
    criadoPor: usuarioAtual.uid
  });
}

async function importarAlunos(origemId, destinoId, filtro) {
  const origem = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", origemId);
  const destino = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", destinoId);
  const ofertaDestino = cache.ofertas.find((item) => item.id === destinoId) || await buscarDocumento(COLECOES.ofertas, destinoId);
  const alunosJaNoDestino = new Set(destino.map((matricula) => matricula.alunoId));
  const alunosParaImportar = origem.filter((matricula) => {
    if (alunosJaNoDestino.has(matricula.alunoId)) return false;
    if (filtro === "aprovados") return matricula.situacao === SITUACOES.APROVADO;
    return true;
  });

  if (alunosParaImportar.length === 0) return 0;

  const lote = writeBatch(db);
  alunosParaImportar.forEach((matricula) => {
    const ref = doc(collection(db, COLECOES.matriculas));
    lote.set(ref, {
      alunoId: matricula.alunoId,
      alunoNome: matricula.alunoNome || nomeUsuario(matricula.alunoId),
      ofertaId: destinoId,
      cursoId: ofertaDestino.cursoId,
      disciplinaCursoId: ofertaDestino.disciplinaCursoId,
      disciplinaId: ofertaDestino.disciplinaId,
      professorId: ofertaDestino.professorId,
      situacao: SITUACOES.CURSANDO,
      mediaFinal: 0,
      percentualAproveitamento: 0,
      importadoDeOfertaId: origemId,
      criadoEm: serverTimestamp(),
      criadoPor: usuarioAtual.uid
    });
  });
  await lote.commit();
  return alunosParaImportar.length;
}

async function renderProfessorOfertas() {
  definirTitulo("Minhas disciplinas", "Disciplinas sob sua responsabilidade.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();
  const minhasOfertas = cache.ofertas.filter((oferta) => oferta.professorId === usuarioAtual.uid);

  const linhas = minhasOfertas.map((oferta) => `
    <tr>
      <td>${protegerTexto(nomeDisciplina(oferta.disciplinaId))}</td>
      <td>${protegerTexto(nomeCurso(oferta.cursoId))}</td>
      <td>${protegerTexto(oferta.turma || "-")}</td>
      <td>${protegerTexto(oferta.periodoLetivo || "-")}</td>
      <td><div class="acoes"><button class="botao botao-secundario" data-notas-oferta="${oferta.id}">Lançar notas</button><button class="botao botao-secundario" data-frequencia-oferta="${oferta.id}">Frequência</button></div></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Minhas disciplinas</h2>
      ${montarTabela(["Disciplina", "Curso", "Turma", "Período", "Ação"], linhas)}
    </section>
  `;

  $$('[data-notas-oferta]').forEach((botao) => {
    botao.addEventListener("click", () => {
      sessionStorage.setItem("ofertaNotas", botao.dataset.notasOferta);
      navegar("professor-notas");
    });
  });

  $$('[data-frequencia-oferta]').forEach((botao) => {
    botao.addEventListener("click", () => {
      sessionStorage.setItem("ofertaFrequencia", botao.dataset.frequenciaOferta);
      navegar("professor-frequencia");
    });
  });
}

async function renderNotas(coordenador = false) {
  definirTitulo(coordenador ? "Notas" : "Lançar notas", coordenador ? "Acompanhe e edite notas de qualquer oferta." : "Edite somente as notas das suas disciplinas.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const ofertasPermitidas = coordenador
    ? cache.ofertas
    : cache.ofertas.filter((oferta) => oferta.professorId === usuarioAtual.uid);

  const ofertaSelecionadaId = sessionStorage.getItem("ofertaNotas") || ofertasPermitidas[0]?.id || "";
  const matriculas = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId) : [];
  const notas = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.notas, "ofertaId", "==", ofertaSelecionadaId) : [];
  const notaPorMatricula = new Map(notas.map((nota) => [nota.matriculaId || nota.id, nota]));

  const linhas = matriculas.map((matricula) => {
    const nota = notaPorMatricula.get(matricula.id) || {};
    const media = nota.media ?? matricula.mediaFinal ?? 0;
    const situacao = matricula.situacao || SITUACOES.CURSANDO;

    return `
      <tr data-matricula-id="${matricula.id}" data-aluno-id="${matricula.alunoId}" data-oferta-id="${matricula.ofertaId}" data-professor-id="${matricula.professorId}">
        <td>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</td>
        <td><input class="nota-input" data-campo="nota1" type="number" min="0" max="10" step="0.1" value="${nota.nota1 ?? ""}" /></td>
        <td><input class="nota-input" data-campo="nota2" type="number" min="0" max="10" step="0.1" value="${nota.nota2 ?? ""}" /></td>
        <td><input class="nota-input" data-campo="nota3" type="number" min="0" max="10" step="0.1" value="${nota.nota3 ?? ""}" /></td>
        <td class="media-linha">${formatarNumero(media)}</td>
        <td class="percentual-linha">${formatarNumero(calcularPercentual(media))}%</td>
        <td class="situacao-linha"><span class="badge ${classeSituacao(situacao)}">${protegerTexto(textoSituacao(situacao))}</span></td>
      </tr>
    `;
  });

  const opcoesOfertas = ofertasPermitidas.map((oferta) => ({ id: oferta.id, nome: `${resumoOferta(oferta)} · ${professorDaOferta(oferta)}` }));

  conteudo().innerHTML = `
    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Notas da oferta</h2>
          <p>As notas são calculadas por média simples de três avaliações.</p>
        </div>
        <div class="acoes">
          <select id="select-oferta-notas"></select>
          <button id="salvar-notas" class="botao botao-primario" ${matriculas.length ? "" : "disabled"}>Salvar notas</button>
        </div>
      </div>
      ${montarTabela(["Aluno", "Nota 1", "Nota 2", "Nota 3", "Média", "Aproveitamento", "Situação"], linhas)}
    </section>
  `;

  preencherSelect($("#select-oferta-notas"), opcoesOfertas, "Selecione uma oferta", "id", "nome");
  $("#select-oferta-notas").value = ofertaSelecionadaId;

  $("#select-oferta-notas").addEventListener("change", async (evento) => {
    sessionStorage.setItem("ofertaNotas", evento.target.value);
    await renderNotas(coordenador);
  });

  $$(".nota-input").forEach((input) => {
    input.addEventListener("input", atualizarCalculoLinha);
  });

  const salvar = $("#salvar-notas");
  if (salvar) {
    salvar.addEventListener("click", async () => {
      salvar.disabled = true;
      salvar.textContent = "Salvando...";
      try {
        await salvarNotasDaTabela();
        mostrarMensagem("Notas salvas com sucesso.");
        await renderNotas(coordenador);
      } catch (erro) {
        console.error(erro);
        mostrarMensagem("Erro ao salvar notas.", "erro");
      } finally {
        salvar.disabled = false;
        salvar.textContent = "Salvar notas";
      }
    });
  }
}

function atualizarCalculoLinha(evento) {
  const linha = evento.target.closest("tr");
  const nota1 = linha.querySelector('[data-campo="nota1"]').value;
  const nota2 = linha.querySelector('[data-campo="nota2"]').value;
  const nota3 = linha.querySelector('[data-campo="nota3"]').value;
  const media = calcularMedia(nota1, nota2, nota3);
  const percentual = calcularPercentual(media);
  const situacao = calcularSituacao(media);

  linha.querySelector(".media-linha").textContent = formatarNumero(media);
  linha.querySelector(".percentual-linha").textContent = `${formatarNumero(percentual)}%`;
  linha.querySelector(".situacao-linha").innerHTML = `<span class="badge ${classeSituacao(situacao)}">${textoSituacao(situacao)}</span>`;
}

async function salvarNotasDaTabela() {
  const linhas = $$("tr[data-matricula-id]");
  if (linhas.length === 0) return;

  const lote = writeBatch(db);

  linhas.forEach((linha) => {
    const matriculaId = linha.dataset.matriculaId;
    const ofertaId = linha.dataset.ofertaId;
    const alunoId = linha.dataset.alunoId;
    const professorId = linha.dataset.professorId;
    const nota1 = Number(linha.querySelector('[data-campo="nota1"]').value || 0);
    const nota2 = Number(linha.querySelector('[data-campo="nota2"]').value || 0);
    const nota3 = Number(linha.querySelector('[data-campo="nota3"]').value || 0);
    const media = calcularMedia(nota1, nota2, nota3);
    const percentual = calcularPercentual(media);
    const situacao = calcularSituacao(media);

    const notaRef = doc(db, COLECOES.notas, matriculaId);
    lote.set(notaRef, {
      matriculaId,
      ofertaId,
      alunoId,
      professorId,
      nota1,
      nota2,
      nota3,
      media,
      percentualAproveitamento: percentual,
      situacao,
      atualizadoPor: usuarioAtual.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    const matriculaRef = doc(db, COLECOES.matriculas, matriculaId);
    lote.update(matriculaRef, {
      mediaFinal: media,
      percentualAproveitamento: percentual,
      situacao,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
  });

  await lote.commit();
}


async function renderFrequenciaCoordenador() {
  definirTitulo("Frequência", "Cadastre os dias de aula, horas e acompanhe alertas.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const ofertas = cache.ofertas.filter((oferta) => oferta.ativa !== false);
  const ofertaSelecionadaId = sessionStorage.getItem("ofertaFrequencia") || ofertas[0]?.id || "";
  const ofertaSelecionada = cache.ofertas.find((oferta) => oferta.id === ofertaSelecionadaId);
  const aulasOferta = ofertaSelecionadaId
    ? ordenarAulas(cache.aulas.filter((aula) => aula.ofertaId === ofertaSelecionadaId))
    : [];
  const aulaEdicaoId = sessionStorage.getItem("editarAulaId");
  const aulaEdicao = aulaEdicaoId ? aulasOferta.find((aula) => aula.id === aulaEdicaoId) : null;
  if (aulaEdicaoId && !aulaEdicao) sessionStorage.removeItem("editarAulaId");

  const matriculas = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId) : [];
  const frequencias = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.frequencias, "ofertaId", "==", ofertaSelecionadaId) : [];
  const minimo = minimoFrequenciaOferta(ofertaSelecionada);

  const linhasAulas = aulasOferta.map((aula) => {
    const podeAlterar = aula.chamadaRealizada !== true;
    const acoes = podeAlterar
      ? `${botaoEditar("aula", aula.id)}${botaoRemover("aula", aula.id)}`
      : `<button class="botao botao-neutro botao-pequeno" disabled>Chamada bloqueada</button>`;
    return `
      <tr>
        <td>${formatarData(aula.dataAula)}</td>
        <td>${formatarNumero(aula.horasAula || 0)}h</td>
        <td>${protegerTexto(aula.descricao || "-")}</td>
        <td><span class="badge ${aula.chamadaRealizada ? "badge-success" : "badge-warning"}">${aula.chamadaRealizada ? "Chamada feita" : "Pendente"}</span></td>
        <td><div class="acoes">${acoes}</div></td>
      </tr>
    `;
  });

  const linhasResumo = matriculas.map((matricula) => {
    const resumo = calcularResumoFrequencia(matricula, ofertaSelecionada, aulasOferta, frequencias);
    return `
      <tr class="${resumo.alerta ? "linha-alerta" : ""}">
        <td>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</td>
        <td>${formatarNumero(resumo.horasPresentes)}h / ${formatarNumero(resumo.totalHoras)}h</td>
        <td>${formatarNumero(resumo.percentual)}%</td>
        <td>${formatarNumero(resumo.minimo)}%</td>
        <td>${badgeFrequencia(resumo)}</td>
      </tr>
    `;
  });

  conteudo().innerHTML = `
    <section class="bloco ${aulaEdicao ? "form-edicao" : ""}">
      <div class="bloco-topo">
        <div>
          <h2>${aulaEdicao ? "Editar aula cadastrada" : "Configurar frequência da oferta"}</h2>
          <p>O coordenador informa os dias de aula, as horas-aula daquele dia e o mínimo obrigatório.</p>
        </div>
        <div class="acoes">
          ${aulaEdicao ? `<button id="cancelar-edicao-aula" class="botao botao-neutro" type="button">Cancelar edição</button>` : ""}
          <select id="select-oferta-frequencia"></select>
        </div>
      </div>
      <form id="form-aula" class="form-grid">
        <div>
          <label>Frequência mínima obrigatória (%)</label>
          <input name="frequenciaMinima" type="number" min="1" max="100" value="${minimo}" required />
        </div>
        <div>
          <label>Data da aula</label>
          <input name="dataAula" type="date" value="${protegerTexto(aulaEdicao?.dataAula || "")}" />
        </div>
        <div>
          <label>Horas-aula do dia</label>
          <input name="horasAula" type="number" min="1" step="0.5" placeholder="Ex.: 4" value="${protegerTexto(aulaEdicao?.horasAula || "")}" />
        </div>
        <div>
          <label>Descrição/observação</label>
          <input name="descricao" placeholder="Ex.: Aula teórica, revisão, avaliação" value="${protegerTexto(aulaEdicao?.descricao || "")}" />
        </div>
        <button class="botao botao-primario" type="submit" ${ofertaSelecionadaId ? "" : "disabled"}>${aulaEdicao ? "Salvar alterações" : "Salvar configuração/aula"}</button>
      </form>
      <div class="aviso">
        ${aulaEdicao
          ? "A edição de data e horas só fica disponível para aulas que ainda não tiveram chamada realizada."
          : "Se informar apenas a frequência mínima, o sistema atualiza a regra da oferta. Para cadastrar uma aula, preencha também data e horas-aula."}
      </div>
    </section>

    <section class="bloco">
      <h2>Aulas cadastradas</h2>
      ${montarTabela(["Data", "Horas-aula", "Descrição", "Chamada", "Ações"], linhasAulas)}
    </section>

    <section class="bloco">
      <h2>Resumo e alertas dos alunos</h2>
      ${montarTabela(["Aluno", "Presença", "Frequência", "Mínimo", "Status"], linhasResumo)}
    </section>
  `;

  preencherSelect($("#select-oferta-frequencia"), opcoesOfertasFrequencia(ofertas), "Selecione a oferta", "id", "nome");
  $("#select-oferta-frequencia").value = ofertaSelecionadaId;

  $("#select-oferta-frequencia").addEventListener("change", async (evento) => {
    sessionStorage.setItem("ofertaFrequencia", evento.target.value);
    sessionStorage.removeItem("editarAulaId");
    await renderFrequenciaCoordenador();
  });

  if (aulaEdicao) {
    $("#cancelar-edicao-aula").addEventListener("click", () => limparEdicao("editarAulaId", renderFrequenciaCoordenador));
  }

  $$('[data-editar-aula]').forEach((botao) => botao.addEventListener("click", async () => {
    sessionStorage.setItem("editarAulaId", botao.dataset.editarAula);
    await renderFrequenciaCoordenador();
  }));

  $$('[data-remover-aula]').forEach((botao) => botao.addEventListener("click", async () => {
    const aula = aulasOferta.find((item) => item.id === botao.dataset.removerAula);
    if (!aula || aula.chamadaRealizada === true) {
      mostrarMensagem("Aula com chamada feita não pode ser removida por aqui.", "alerta");
      return;
    }
    if (!confirm("Remover esta aula cadastrada?")) return;
    await deleteDoc(doc(db, COLECOES.aulas, aula.id));
    mostrarMensagem("Aula removida.");
    await renderFrequenciaCoordenador();
  }));

  $("#form-aula").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const frequenciaMinima = Number(dados.get("frequenciaMinima") || 75);
    const dataAula = dados.get("dataAula");
    const horasAula = Number(dados.get("horasAula") || 0);

    if (!ofertaSelecionadaId) {
      mostrarMensagem("Selecione uma oferta.", "alerta");
      return;
    }

    await updateDoc(doc(db, COLECOES.ofertas, ofertaSelecionadaId), {
      frequenciaMinima,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });

    if ((dataAula && !horasAula) || (!dataAula && horasAula)) {
      mostrarMensagem("Para cadastrar aula, informe data e horas-aula.", "alerta");
      return;
    }

    if (aulaEdicao) {
      if (!dataAula || !horasAula) {
        mostrarMensagem("Para editar a aula, informe data e horas-aula.", "alerta");
        return;
      }
      const jaExiste = aulasOferta.some((aula) => aula.id !== aulaEdicao.id && aula.dataAula === dataAula);
      if (jaExiste) {
        mostrarMensagem("Já existe uma aula cadastrada nessa data para esta oferta.", "alerta");
        return;
      }

      await updateDoc(doc(db, COLECOES.aulas, aulaEdicao.id), {
        dataAula,
        horasAula,
        descricao: dados.get("descricao").trim(),
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuarioAtual.uid
      });
      sessionStorage.removeItem("editarAulaId");
    } else if (dataAula && horasAula) {
      const jaExiste = aulasOferta.some((aula) => aula.dataAula === dataAula);
      if (jaExiste) {
        mostrarMensagem("Já existe uma aula cadastrada nessa data para esta oferta.", "alerta");
        return;
      }

      await addDoc(collection(db, COLECOES.aulas), {
        ofertaId: ofertaSelecionadaId,
        cursoId: ofertaSelecionada.cursoId,
        disciplinaCursoId: ofertaSelecionada.disciplinaCursoId,
        disciplinaId: ofertaSelecionada.disciplinaId,
        professorId: ofertaSelecionada.professorId,
        dataAula,
        horasAula,
        descricao: dados.get("descricao").trim(),
        chamadaRealizada: false,
        criadoEm: serverTimestamp(),
        criadoPor: usuarioAtual.uid
      });
    }

    mostrarMensagem(aulaEdicao ? "Aula atualizada com sucesso." : "Frequência configurada com sucesso.");
    await renderFrequenciaCoordenador();
  });
}

async function renderProfessorFrequencia() {
  definirTitulo("Frequência", "Faça a chamada dos alunos nas suas disciplinas.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const minhasOfertas = cache.ofertas.filter((oferta) => oferta.professorId === usuarioAtual.uid && oferta.ativa !== false);
  const ofertaSelecionadaId = sessionStorage.getItem("ofertaFrequencia") || minhasOfertas[0]?.id || "";
  const ofertaSelecionada = minhasOfertas.find((oferta) => oferta.id === ofertaSelecionadaId);
  const aulasOferta = ofertaSelecionadaId
    ? ordenarAulas(cache.aulas.filter((aula) => aula.ofertaId === ofertaSelecionadaId))
    : [];
  const aulaSelecionadaId = sessionStorage.getItem("aulaFrequencia") || aulasOferta[0]?.id || "";
  const aulaSelecionada = aulasOferta.find((aula) => aula.id === aulaSelecionadaId);
  const matriculas = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId) : [];
  const frequenciasOferta = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.frequencias, "professorId", "==", usuarioAtual.uid) : [];
  const frequenciasDaOferta = frequenciasOferta.filter((frequencia) => frequencia.ofertaId === ofertaSelecionadaId);
  const frequenciasAula = frequenciasDaOferta.filter((frequencia) => frequencia.aulaId === aulaSelecionadaId);
  const frequenciaPorMatricula = new Map(frequenciasAula.map((frequencia) => [frequencia.matriculaId, frequencia]));

  const linhasChamada = matriculas.map((matricula) => {
    const frequencia = frequenciaPorMatricula.get(matricula.id);
    const presente = frequencia ? frequencia.presente === true : true;
    return `
      <tr data-matricula-id="${matricula.id}" data-aluno-id="${matricula.alunoId}">
        <td>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</td>
        <td><input class="checkbox-frequencia" data-presenca type="checkbox" ${presente ? "checked" : ""} /></td>
      </tr>
    `;
  });

  const linhasResumo = matriculas.map((matricula) => {
    const resumo = calcularResumoFrequencia(matricula, ofertaSelecionada, aulasOferta, frequenciasDaOferta);
    return `
      <tr class="${resumo.alerta ? "linha-alerta" : ""}">
        <td>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</td>
        <td>${formatarNumero(resumo.horasPresentes)}h / ${formatarNumero(resumo.totalHoras)}h</td>
        <td>${formatarNumero(resumo.percentual)}%</td>
        <td>${badgeFrequencia(resumo)}</td>
      </tr>
    `;
  });

  const opcoesAulas = aulasOferta.map((aula) => ({
    id: aula.id,
    nome: `${formatarData(aula.dataAula)} · ${formatarNumero(aula.horasAula)}h${aula.chamadaRealizada ? " · chamada feita" : " · pendente"}`
  }));

  conteudo().innerHTML = `
    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Selecionar disciplina e data</h2>
          <p>O professor só visualiza as ofertas sob sua responsabilidade.</p>
        </div>
        <div class="acoes">
          <select id="select-oferta-frequencia-professor"></select>
          <select id="select-aula-frequencia"></select>
        </div>
      </div>
      ${!aulasOferta.length ? '<div class="aviso">Nenhuma aula foi cadastrada pelo coordenador para esta oferta.</div>' : ""}
    </section>

    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Chamada da data</h2>
          <p>${aulaSelecionada ? `${formatarData(aulaSelecionada.dataAula)} · ${formatarNumero(aulaSelecionada.horasAula)} horas-aula` : "Selecione uma aula cadastrada."}</p>
        </div>
        <button id="salvar-frequencia" class="botao botao-primario" ${aulaSelecionada && matriculas.length ? "" : "disabled"}>Salvar frequência</button>
      </div>
      ${montarTabela(["Aluno", "Presente"], linhasChamada)}
    </section>

    <section class="bloco">
      <h2>Resumo da frequência</h2>
      ${montarTabela(["Aluno", "Presença", "Frequência", "Status"], linhasResumo)}
    </section>
  `;

  preencherSelect($("#select-oferta-frequencia-professor"), opcoesOfertasFrequencia(minhasOfertas), "Selecione a oferta", "id", "nome");
  $("#select-oferta-frequencia-professor").value = ofertaSelecionadaId;
  preencherSelect($("#select-aula-frequencia"), opcoesAulas, "Selecione a aula", "id", "nome");
  $("#select-aula-frequencia").value = aulaSelecionadaId;

  $("#select-oferta-frequencia-professor").addEventListener("change", async (evento) => {
    sessionStorage.setItem("ofertaFrequencia", evento.target.value);
    sessionStorage.removeItem("aulaFrequencia");
    await renderProfessorFrequencia();
  });

  $("#select-aula-frequencia").addEventListener("change", async (evento) => {
    sessionStorage.setItem("aulaFrequencia", evento.target.value);
    await renderProfessorFrequencia();
  });

  const botaoSalvar = $("#salvar-frequencia");
  if (botaoSalvar) {
    botaoSalvar.addEventListener("click", async () => {
      botaoSalvar.disabled = true;
      botaoSalvar.textContent = "Salvando...";
      try {
        await salvarFrequenciaDaTabela(aulaSelecionada, ofertaSelecionada);
        mostrarMensagem("Frequência salva com sucesso.");
        await renderProfessorFrequencia();
      } catch (erro) {
        console.error(erro);
        mostrarMensagem("Erro ao salvar frequência.", "erro");
      } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar frequência";
      }
    });
  }
}

async function salvarFrequenciaDaTabela(aula, oferta) {
  if (!aula || !oferta) return;
  const linhas = $$('tr[data-matricula-id]');
  if (!linhas.length) return;

  const lote = writeBatch(db);
  linhas.forEach((linha) => {
    const matriculaId = linha.dataset.matriculaId;
    const alunoId = linha.dataset.alunoId;
    const presente = linha.querySelector('[data-presenca]').checked;
    const ref = doc(db, COLECOES.frequencias, `${aula.id}_${matriculaId}`);

    lote.set(ref, {
      aulaId: aula.id,
      matriculaId,
      alunoId,
      ofertaId: oferta.id,
      cursoId: oferta.cursoId,
      disciplinaCursoId: oferta.disciplinaCursoId,
      disciplinaId: oferta.disciplinaId,
      professorId: oferta.professorId,
      dataAula: aula.dataAula,
      horasAula: Number(aula.horasAula || 0),
      presente,
      horasPresente: presente ? Number(aula.horasAula || 0) : 0,
      atualizadoPor: usuarioAtual.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });
  });

  const aulaRef = doc(db, COLECOES.aulas, aula.id);
  lote.update(aulaRef, {
    chamadaRealizada: true,
    realizadaPor: usuarioAtual.uid,
    realizadaEm: serverTimestamp()
  });

  await lote.commit();
}

async function renderAlunoFrequencia() {
  definirTitulo("Minha frequência", "Acompanhe sua presença por disciplina.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const matriculas = await buscarPorCampo(COLECOES.matriculas, "alunoId", "==", usuarioAtual.uid);
  const frequenciasAluno = await buscarPorCampo(COLECOES.frequencias, "alunoId", "==", usuarioAtual.uid);

  const blocos = matriculas.map((matricula) => {
    const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
    const aulasOferta = ordenarAulas(cache.aulas.filter((aula) => aula.ofertaId === matricula.ofertaId));
    const frequenciasOferta = frequenciasAluno.filter((frequencia) => frequencia.ofertaId === matricula.ofertaId);
    const frequenciaPorAula = new Map(frequenciasOferta.map((frequencia) => [frequencia.aulaId, frequencia]));
    const resumo = calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta);

    const linhasDetalhes = aulasOferta.map((aula) => {
      const frequencia = frequenciaPorAula.get(aula.id);
      const texto = !aula.chamadaRealizada
        ? "Aguardando chamada"
        : frequencia?.presente
          ? "Presente"
          : "Falta";
      const classe = !aula.chamadaRealizada
        ? "badge-warning"
        : frequencia?.presente
          ? "badge-success"
          : "badge-danger";

      return `
        <tr>
          <td>${formatarData(aula.dataAula)}</td>
          <td>${formatarNumero(aula.horasAula || 0)}h</td>
          <td><span class="badge ${classe}">${texto}</span></td>
        </tr>
      `;
    });

    return `
      <section class="bloco">
        <div class="bloco-topo">
          <div>
            <h2>${protegerTexto(nomeDisciplina(matricula.disciplinaId || oferta?.disciplinaId))}</h2>
            <p>Professor: ${protegerTexto(professorDaOferta(oferta))}</p>
          </div>
          ${badgeFrequencia(resumo)}
        </div>
        <section class="grid-cards grid-cards-pequeno">
          <div class="card"><strong>${formatarNumero(resumo.percentual)}%</strong><span>Frequência atual</span><p>Mínimo: ${formatarNumero(resumo.minimo)}%</p></div>
          <div class="card"><strong>${formatarNumero(resumo.horasPresentes)}h</strong><span>Horas presentes</span><p>De ${formatarNumero(resumo.totalHoras)}h com chamada feita.</p></div>
        </section>
        ${montarTabela(["Data", "Horas-aula", "Situação"], linhasDetalhes)}
      </section>
    `;
  });

  conteudo().innerHTML = blocos.length ? blocos.join("") : estadoVazio("Nenhuma matrícula encontrada.");
}

async function renderAlunoNotas() {
  definirTitulo("Minhas notas", "Notas, professores e situação por disciplina.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const matriculas = await buscarPorCampo(COLECOES.matriculas, "alunoId", "==", usuarioAtual.uid);
  const notas = await buscarPorCampo(COLECOES.notas, "alunoId", "==", usuarioAtual.uid);
  const notaPorMatricula = new Map(notas.map((nota) => [nota.matriculaId || nota.id, nota]));

  const linhas = matriculas.map((matricula) => {
    const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
    const nota = notaPorMatricula.get(matricula.id) || {};
    const media = nota.media ?? matricula.mediaFinal ?? 0;
    const situacao = matricula.situacao || SITUACOES.CURSANDO;

    return `
      <tr>
        <td>${protegerTexto(nomeDisciplina(matricula.disciplinaId || oferta?.disciplinaId))}</td>
        <td>${protegerTexto(professorDaOferta(oferta))}</td>
        <td>${formatarNumero(nota.nota1 || 0)}</td>
        <td>${formatarNumero(nota.nota2 || 0)}</td>
        <td>${formatarNumero(nota.nota3 || 0)}</td>
        <td>${formatarNumero(media)}</td>
        <td>${formatarNumero(matricula.percentualAproveitamento || nota.percentualAproveitamento || 0)}%</td>
        <td><span class="badge ${classeSituacao(situacao)}">${protegerTexto(textoSituacao(situacao))}</span></td>
      </tr>
    `;
  });

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Minhas notas</h2>
      ${montarTabela(["Disciplina", "Professor", "Nota 1", "Nota 2", "Nota 3", "Média", "Aproveitamento", "Situação"], linhas)}
    </section>
  `;
}

async function renderAlunoProgresso() {
  definirTitulo("Meu progresso", "Matriz curricular, disciplinas concluídas e dependências.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const cursoId = perfilAtual.cursoId;
  const matriz = cache.disciplinasCurso
    .filter((item) => item.cursoId === cursoId)
    .sort((a, b) => (a.periodo || 0) - (b.periodo || 0) || (a.ordem || 0) - (b.ordem || 0));

  const matriculas = await buscarPorCampo(COLECOES.matriculas, "alunoId", "==", usuarioAtual.uid);
  const matriculasPorDisciplinaCurso = new Map(matriculas.map((matricula) => [matricula.disciplinaCursoId, matricula]));
  const aprovadas = new Set(matriculas.filter((matricula) => matricula.situacao === SITUACOES.APROVADO).map((matricula) => matricula.disciplinaCursoId));

  const linhas = matriz.map((item) => {
    const matricula = matriculasPorDisciplinaCurso.get(item.id);
    const deps = cache.dependencias.filter((dep) => dep.disciplinaCursoId === item.id);
    const bloqueada = deps.some((dep) => !aprovadas.has(dep.dependeDeDisciplinaCursoId));
    const situacao = matricula?.situacao || (bloqueada ? SITUACOES.DEPENDENCIA : "pendente");
    const texto = situacao === "pendente" ? "Pendente" : textoSituacao(situacao);
    const classe = situacao === "pendente" ? "badge-muted" : classeSituacao(situacao);

    const dependeDe = deps.length
      ? deps.map((dep) => {
          const depende = cache.disciplinasCurso.find((disc) => disc.id === dep.dependeDeDisciplinaCursoId);
          return nomeDisciplina(depende?.disciplinaId);
        }).join(", ")
      : "-";

    return `
      <tr>
        <td>${protegerTexto(item.periodo || "-")}</td>
        <td>${protegerTexto(nomeDisciplina(item.disciplinaId))}</td>
        <td>${protegerTexto(dependeDe)}</td>
        <td>${formatarNumero(matricula?.mediaFinal || 0)}</td>
        <td><span class="badge ${classe}">${protegerTexto(texto)}</span></td>
      </tr>
    `;
  });

  const total = matriz.length;
  const totalAprovadas = aprovadas.size;
  const progresso = total ? ((totalAprovadas / total) * 100).toFixed(1) : 0;

  conteudo().innerHTML = `
    <section class="grid-cards">
      <div class="card"><strong>${totalAprovadas}</strong><span>Aprovadas</span><p>De ${total} disciplinas na matriz.</p></div>
      <div class="card"><strong>${formatarNumero(progresso)}%</strong><span>Progresso</span><p>${protegerTexto(nomeCurso(cursoId))}</p></div>
    </section>
    <section class="bloco">
      <h2>Matriz do curso</h2>
      ${montarTabela(["Período", "Disciplina", "Pré-requisito", "Média", "Situação"], linhas)}
    </section>
  `;
}

function configurarEventosGlobais() {
  $("#botao-sair").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  $("#botao-menu-mobile").addEventListener("click", () => {
    $("#sidebar").classList.toggle("aberta");
  });
}

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  usuarioAtual = usuario;
  perfilAtual = await carregarPerfil(usuario.uid);

  if (!perfilAtual || perfilAtual.ativo === false) {
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  $("#usuario-nome").textContent = perfilAtual.nome || usuario.email;
  $("#perfil-label").textContent = `${textoPerfil(perfilAtual.tipo)} · edição v2`;

  configurarEventosGlobais();
  renderizarMenu();
  await navegar("dashboard");
});
