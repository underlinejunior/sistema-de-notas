import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateEmail
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
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
    { rota: "dashboard", texto: "Painel inicial", icone: "fa-solid fa-chart-line" },
    { rota: "usuarios", texto: "Usuários", icone: "fa-solid fa-users" },
    { rota: "cursos", texto: "Cursos", icone: "fa-solid fa-graduation-cap" },
    { rota: "disciplinas", texto: "Disciplinas", icone: "fa-solid fa-book-open" },
    { rota: "matriz", texto: "Matriz e dependências", icone: "fa-solid fa-diagram-project" },
    { rota: "ofertas", texto: "Ofertas de disciplinas", icone: "fa-solid fa-calendar-days" },
    { rota: "matriculas", texto: "Matrículas e importação", icone: "fa-solid fa-user-graduate" },
    { rota: "notas", texto: "Notas", icone: "fa-solid fa-file-pen" },
    { rota: "frequencia", texto: "Frequência", icone: "fa-solid fa-clipboard-user" },
    { rota: "meu-perfil", texto: "Meu perfil", icone: "fa-regular fa-id-card" }
  ],
  professor: [
    { rota: "dashboard", texto: "Painel inicial", icone: "fa-solid fa-chart-line" },
    { rota: "professor-ofertas", texto: "Minhas disciplinas", icone: "fa-solid fa-book-open-reader" },
    { rota: "professor-notas", texto: "Lançar notas", icone: "fa-solid fa-file-pen" },
    { rota: "professor-frequencia", texto: "Frequência", icone: "fa-solid fa-clipboard-user" },
    { rota: "meu-perfil", texto: "Meu perfil", icone: "fa-regular fa-id-card" }
  ],
  aluno: [
    { rota: "dashboard", texto: "Painel inicial", icone: "fa-solid fa-chart-line" },
    { rota: "aluno-notas", texto: "Minhas notas", icone: "fa-solid fa-square-poll-vertical" },
    { rota: "aluno-frequencia", texto: "Minha frequência", icone: "fa-solid fa-calendar-check" },
    { rota: "aluno-progresso", texto: "Meu progresso", icone: "fa-solid fa-route" },
    { rota: "meu-perfil", texto: "Meu perfil", icone: "fa-regular fa-id-card" }
  ]
};

function conteudo() {
  return $("#conteudo");
}

function iconeDaRota(rota = rotaAtual) {
  const itens = Object.values(menuPorPerfil).flat();
  return itens.find((item) => item.rota === rota)?.icone || "fa-solid fa-circle-info";
}

function definirTitulo(titulo, subtitulo = "") {
  const tituloPagina = $("#titulo-pagina");
  if (tituloPagina) {
    const icone = titulo === "Erro" ? "fa-solid fa-triangle-exclamation" : iconeDaRota();
    tituloPagina.innerHTML = `<span class="titulo-pagina-icone"><i class="${icone}" aria-hidden="true"></i></span><span>${protegerTexto(titulo)}</span>`;
  }
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

function atualizarNomeUsuario(nome) {
  const area = $("#usuario-nome");
  if (!area) return;
  let texto = area.querySelector("span");
  if (!texto) {
    area.innerHTML = '<i class="fa-regular fa-circle-user" aria-hidden="true"></i><span></span>';
    texto = area.querySelector("span");
  }
  texto.textContent = nome || "Usuário";
}

const iconesAcoes = [
  [/salvando|carregando|corrigindo|enviando/i, "fa-solid fa-spinner fa-spin"],
  [/entrar/i, "fa-solid fa-right-to-bracket"],
  [/esqueci|redefini/i, "fa-solid fa-key"],
  [/cadastrar.*usu|criar.*usu/i, "fa-solid fa-user-plus"],
  [/matricular|matrícula/i, "fa-solid fa-user-graduate"],
  [/importar/i, "fa-solid fa-file-import"],
  [/lançar notas|salvar notas/i, "fa-solid fa-file-pen"],
  [/frequência|chamada/i, "fa-solid fa-clipboard-user"],
  [/disciplina/i, "fa-solid fa-book-open"],
  [/curso/i, "fa-solid fa-graduation-cap"],
  [/dependência|matriz/i, "fa-solid fa-diagram-project"],
  [/oferta/i, "fa-solid fa-calendar-days"],
  [/editar|alterar/i, "fa-solid fa-pen-to-square"],
  [/salvar/i, "fa-solid fa-floppy-disk"],
  [/cancelar matrícula/i, "fa-solid fa-user-xmark"],
  [/cancelar/i, "fa-solid fa-xmark"],
  [/reativar/i, "fa-solid fa-rotate-left"],
  [/inativar|bloquear/i, "fa-solid fa-ban"],
  [/excluir|remover/i, "fa-solid fa-trash"],
  [/corrigir/i, "fa-solid fa-screwdriver-wrench"],
  [/adicionar|novo|nova/i, "fa-solid fa-plus"],
  [/ver progresso|progresso/i, "fa-solid fa-route"],
  [/ver frequência/i, "fa-solid fa-calendar-check"],
  [/ver notas/i, "fa-solid fa-square-poll-vertical"],
  [/ver disciplinas/i, "fa-solid fa-book-open-reader"],
  [/meu perfil/i, "fa-regular fa-id-card"],
  [/sair/i, "fa-solid fa-right-from-bracket"],
  [/voltar/i, "fa-solid fa-arrow-left"],
  [/pesquisar|buscar/i, "fa-solid fa-magnifying-glass"]
];

const iconesSecoes = [
  [/usuário|aluno|professor/i, "fa-solid fa-users"],
  [/curso/i, "fa-solid fa-graduation-cap"],
  [/disciplina/i, "fa-solid fa-book-open"],
  [/matriz|dependência/i, "fa-solid fa-diagram-project"],
  [/oferta|período/i, "fa-solid fa-calendar-days"],
  [/matrícula|importação/i, "fa-solid fa-user-graduate"],
  [/nota|desempenho/i, "fa-solid fa-file-pen"],
  [/frequência|chamada|aula/i, "fa-solid fa-clipboard-user"],
  [/progresso/i, "fa-solid fa-route"],
  [/perfil/i, "fa-regular fa-id-card"],
  [/resumo|visão|painel/i, "fa-solid fa-chart-line"],
  [/alerta|correção/i, "fa-solid fa-triangle-exclamation"],
  [/como|orientação|ordem/i, "fa-solid fa-circle-info"]
];

const iconesCards = [
  [/usuário|aluno|professor/i, "fa-solid fa-users"],
  [/curso/i, "fa-solid fa-graduation-cap"],
  [/disciplina|oferta/i, "fa-solid fa-book-open"],
  [/matrícula/i, "fa-solid fa-user-graduate"],
  [/nota|média|aproveitamento/i, "fa-solid fa-square-poll-vertical"],
  [/frequência|chamada|aula|horas/i, "fa-solid fa-calendar-check"],
  [/progresso|aprovad/i, "fa-solid fa-route"],
  [/alerta|reprovad/i, "fa-solid fa-triangle-exclamation"],
  [/cursando/i, "fa-solid fa-person-chalkboard"]
];

function localizarIcone(texto, mapa, padrao = "fa-solid fa-circle-info") {
  return mapa.find(([expressao]) => expressao.test(texto))?.[1] || padrao;
}

function aplicarIconesInterface(raiz = document) {
  $$(".botao, .link-esqueceu-senha", raiz).forEach((botao) => {
    if (botao.classList.contains("botao-olho") || botao.querySelector("i")) return;
    const texto = botao.textContent.trim();
    if (!texto) return;
    const icone = localizarIcone(texto, iconesAcoes, "fa-solid fa-circle-arrow-right");
    botao.insertAdjacentHTML("afterbegin", `<i class="${icone} icone-botao" aria-hidden="true"></i>`);
  });

  $$(".bloco h2, .bloco h3, .modal-card h2, .painel-guia h2", raiz).forEach((titulo) => {
    if (titulo.querySelector("i")) return;
    const icone = localizarIcone(titulo.textContent.trim(), iconesSecoes);
    titulo.classList.add("titulo-secao");
    titulo.insertAdjacentHTML("afterbegin", `<i class="${icone}" aria-hidden="true"></i>`);
  });

  $$(".card", raiz).forEach((card) => {
    if (card.querySelector(":scope > .card-icone")) return;
    const rotulo = card.querySelector("span")?.textContent?.trim() || "";
    const icone = localizarIcone(rotulo, iconesCards);
    card.insertAdjacentHTML("afterbegin", `<span class="card-icone" aria-hidden="true"><i class="${icone}"></i></span>`);
  });

  $$(".badge", raiz).forEach((badge) => {
    if (badge.querySelector("i")) return;
    const texto = badge.textContent.trim();
    let icone = "fa-solid fa-circle-info";
    if (/aprovad|ativ|regular|presente/i.test(texto)) icone = "fa-solid fa-circle-check";
    else if (/reprovad|cancelad|falta|abaixo/i.test(texto)) icone = "fa-solid fa-circle-xmark";
    else if (/cursando|andamento/i.test(texto)) icone = "fa-solid fa-clock";
    else if (/dependência|pendente|aguardando/i.test(texto)) icone = "fa-solid fa-triangle-exclamation";
    badge.insertAdjacentHTML("afterbegin", `<i class="${icone}" aria-hidden="true"></i>`);
  });
}

function iniciarObservadorIcones() {
  aplicarIconesInterface(document);
  const observador = new MutationObserver(() => {
    window.requestAnimationFrame(() => aplicarIconesInterface(document));
  });
  observador.observe(document.body, { childList: true, subtree: true });
}

function configurarBotoesSenha(raiz = document) {
  $$('[data-toggle-senha]', raiz).forEach((botao) => {
    if (botao.dataset.configurado === "true") return;
    botao.dataset.configurado = "true";

    botao.addEventListener("click", () => {
      const campo = document.getElementById(botao.dataset.toggleSenha);
      if (!campo) return;

      const mostrar = campo.type === "password";
      campo.type = mostrar ? "text" : "password";
      botao.innerHTML = mostrar ? '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>' : '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
      botao.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    });
  });
}

function mostrarAlertaModal(mensagem) {
  const alerta = $("#alerta-alterar-senha");
  if (!alerta) return;
  alerta.textContent = mensagem;
  alerta.hidden = false;
}

function fecharModalAlterarSenha() {
  const modal = $("#modal-alterar-senha");
  if (modal) modal.remove();
}

function abrirModalAlterarSenha() {
  fecharModalAlterarSenha();

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modal-alterar-senha" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-senha">
      <section class="modal-card">
        <div class="modal-topo">
          <div>
            <h2 id="titulo-modal-senha">Alterar senha</h2>
            <p>Informe sua senha atual e defina uma nova senha com pelo menos 6 caracteres.</p>
          </div>
          <button type="button" class="modal-fechar" data-fechar-modal aria-label="Fechar">×</button>
        </div>

        <form id="form-alterar-senha" class="formulario">
          <label for="senha-atual">Senha atual</label>
          <div class="campo-senha">
            <input id="senha-atual" name="senhaAtual" type="password" autocomplete="current-password" required placeholder="Digite sua senha atual" />
            <button class="botao-olho" type="button" data-toggle-senha="senha-atual" aria-label="Mostrar senha"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          </div>

          <label for="nova-senha">Nova senha</label>
          <div class="campo-senha">
            <input id="nova-senha" name="novaSenha" type="password" autocomplete="new-password" minlength="6" required placeholder="Mínimo 6 caracteres" />
            <button class="botao-olho" type="button" data-toggle-senha="nova-senha" aria-label="Mostrar senha"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          </div>

          <label for="confirmar-nova-senha">Confirmar nova senha</label>
          <div class="campo-senha">
            <input id="confirmar-nova-senha" name="confirmarSenha" type="password" autocomplete="new-password" minlength="6" required placeholder="Repita a nova senha" />
            <button class="botao-olho" type="button" data-toggle-senha="confirmar-nova-senha" aria-label="Mostrar senha"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          </div>

          <div id="alerta-alterar-senha" class="alerta" hidden></div>

          <div class="acoes modal-acoes">
            <button type="button" class="botao botao-secundario" data-fechar-modal>Cancelar</button>
            <button id="botao-confirmar-senha" type="submit" class="botao botao-primario">Salvar nova senha</button>
          </div>
        </form>
      </section>
    </div>
  `);

  const modal = $("#modal-alterar-senha");
  configurarBotoesSenha(modal);

  $$('[data-fechar-modal]', modal).forEach((botao) => {
    botao.addEventListener("click", fecharModalAlterarSenha);
  });

  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModalAlterarSenha();
  });

  $("#form-alterar-senha").addEventListener("submit", alterarSenhaUsuarioAtual);
  $("#senha-atual").focus();
}

async function alterarSenhaUsuarioAtual(evento) {
  evento.preventDefault();
  const dados = new FormData(evento.target);
  const senhaAtual = String(dados.get("senhaAtual") || "");
  const novaSenha = String(dados.get("novaSenha") || "");
  const confirmarSenha = String(dados.get("confirmarSenha") || "");
  const alerta = $("#alerta-alterar-senha");
  const botao = $("#botao-confirmar-senha");

  if (alerta) {
    alerta.hidden = true;
    alerta.textContent = "";
  }

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    mostrarAlertaModal("Preencha todos os campos para alterar a senha.");
    return;
  }

  if (novaSenha.length < 6) {
    mostrarAlertaModal("A nova senha precisa ter pelo menos 6 caracteres.");
    return;
  }

  if (novaSenha !== confirmarSenha) {
    mostrarAlertaModal("A confirmação da senha não confere.");
    return;
  }

  if (!auth.currentUser?.email) {
    mostrarAlertaModal("Não foi possível identificar o e-mail do usuário atual.");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    const credencial = EmailAuthProvider.credential(auth.currentUser.email, senhaAtual);
    await reauthenticateWithCredential(auth.currentUser, credencial);
    await updatePassword(auth.currentUser, novaSenha);
    fecharModalAlterarSenha();
    mostrarMensagem("Senha alterada com sucesso.");
  } catch (erro) {
    console.error(erro);
    const mensagens = {
      "auth/invalid-credential": "A senha atual não confere. Verifique e tente novamente.",
      "auth/wrong-password": "A senha atual não confere. Verifique e tente novamente.",
      "auth/weak-password": "A nova senha é muito fraca. Use pelo menos 6 caracteres.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      "auth/requires-recent-login": "Por segurança, saia do sistema, entre novamente e tente alterar a senha."
    };
    mostrarAlertaModal(mensagens[erro.code] || "Não foi possível alterar a senha. Tente novamente.");
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar nova senha";
  }
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

function matriculaCancelada(matricula) {
  return matricula?.situacao === SITUACOES.CANCELADA || matricula?.ativo === false || matricula?.cancelada === true;
}

function ordenarMatriculasPorAluno(matriculas) {
  return [...matriculas].sort((a, b) => {
    const aCancelada = matriculaCancelada(a) ? 1 : 0;
    const bCancelada = matriculaCancelada(b) ? 1 : 0;
    if (aCancelada !== bCancelada) return aCancelada - bCancelada;

    const nomeA = nomeUsuario(a.alunoId) || a.alunoNome || "";
    const nomeB = nomeUsuario(b.alunoId) || b.alunoNome || "";
    return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
  });
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

function normalizarChaveOferta(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sem-info";
}

function chaveOfertaUnica(dados) {
  return [
    normalizarChaveOferta(dados.disciplinaCursoId),
    normalizarChaveOferta(dados.periodoLetivo),
    normalizarChaveOferta(dados.turma)
  ].join("__");
}

function idOfertaUnica(dados) {
  return `oferta_${chaveOfertaUnica(dados)}`;
}

function identificarOfertasDuplicadas() {
  const grupos = new Map();

  cache.ofertas
    .filter((oferta) => oferta.ativa !== false)
    .forEach((oferta) => {
      const chave = chaveOfertaUnica(oferta);
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(oferta);
    });

  return Array.from(grupos.values())
    .filter((grupo) => grupo.length > 1)
    .map((grupo) => ({ principal: grupo[0], duplicadas: grupo.slice(1) }));
}

function ofertaDuplicadaAtiva(dados, ignorarId = null) {
  const chave = chaveOfertaUnica(dados);
  return cache.ofertas.find((oferta) =>
    oferta.ativa !== false
    && oferta.id !== ignorarId
    && chaveOfertaUnica(oferta) === chave
  );
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

function renderizarMenu() {
  const menu = $("#menu-principal");
  const itens = menuPorPerfil[perfilAtual.tipo] || [];

  menu.innerHTML = itens.map((item) => `
    <button type="button" data-rota="${item.rota}" class="${item.rota === rotaAtual ? "ativo" : ""}">
      <i class="${item.icone}" aria-hidden="true"></i>
      <span>${protegerTexto(item.texto)}</span>
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
    else if (rotaAtual === "meu-perfil") await renderMeuPerfil();
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

async function buscarRegistrosPorOfertas(colecaoNome, ofertas) {
  if (!ofertas?.length) return [];

  const resultados = await Promise.all(
    ofertas.map(async (oferta) => {
      try {
        return await buscarPorCampo(colecaoNome, "ofertaId", "==", oferta.id);
      } catch (erro) {
        console.warn(`Não foi possível buscar ${colecaoNome} da oferta ${oferta.id}.`, erro);
        return [];
      }
    })
  );

  const mapa = new Map();
  resultados.flat().forEach((item) => mapa.set(item.id, item));
  return [...mapa.values()];
}

async function renderDashboard() {
  if (perfilAtual.tipo === TIPOS_USUARIO.COORDENADOR) {
    await carregarBaseAcademica();
    const matriculas = await buscarTodos(COLECOES.matriculas);
    const frequencias = await buscarTodos(COLECOES.frequencias);
    cache.matriculas = matriculas;

    const usuariosAtivos = cache.usuarios.filter((usuario) => usuario.ativo !== false);
    const professores = usuariosAtivos.filter((usuario) => usuario.tipo === TIPOS_USUARIO.PROFESSOR).length;
    const alunos = usuariosAtivos.filter((usuario) => usuario.tipo === TIPOS_USUARIO.ALUNO).length;
    const ofertasAtivas = cache.ofertas.filter((oferta) => oferta.ativa !== false);
    const aulasPendentes = cache.aulas.filter((aula) => aula.chamadaRealizada !== true).length;
    const matriculasSemProfessor = matriculas.filter((matricula) => {
      const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
      return oferta?.professorId && matricula.professorId !== oferta.professorId;
    });

    const alertasFrequencia = matriculas.filter((matricula) => {
      const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
      const aulasOferta = cache.aulas.filter((aula) => aula.ofertaId === matricula.ofertaId);
      const frequenciasOferta = frequencias.filter((frequencia) => frequencia.ofertaId === matricula.ofertaId);
      return calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta).alerta;
    });

    definirTitulo("Painel do coordenador", "Resumo geral e próximos passos do sistema.");
    conteudo().innerHTML = `
      <section class="painel-guia">
        <div>
          <span class="rotulo-painel">Visão geral</span>
          <h2>Olá, ${protegerTexto(perfilAtual.nome || "coordenador")}.</h2>
          <p>Comece pelos cadastros básicos, depois crie as ofertas, matricule os alunos, configure os dias de aula e acompanhe notas e frequência.</p>
        </div>
        <div class="acoes atalhos-painel">
          <button class="botao botao-primario" data-ir="usuarios">Cadastrar usuários</button>
          <button class="botao botao-secundario" data-ir="matriculas">Matricular alunos</button>
          <button class="botao botao-secundario" data-ir="frequencia">Configurar frequência</button>
        </div>
      </section>

      <section class="grid-cards">
        <div class="card card-destaque"><strong>${usuariosAtivos.length}</strong><span>Usuários ativos</span><p>${professores} professor(es) e ${alunos} aluno(s).</p></div>
        <div class="card"><strong>${cache.cursos.length}</strong><span>Cursos</span><p>Cursos cadastrados no sistema.</p></div>
        <div class="card"><strong>${ofertasAtivas.length}</strong><span>Ofertas ativas</span><p>Disciplinas abertas por período.</p></div>
        <div class="card"><strong>${matriculas.length}</strong><span>Matrículas</span><p>Alunos vinculados às disciplinas.</p></div>
        <div class="card"><strong>${aulasPendentes}</strong><span>Chamadas pendentes</span><p>Aulas cadastradas ainda sem frequência.</p></div>
        <div class="card ${alertasFrequencia.length ? "card-alerta" : ""}"><strong>${alertasFrequencia.length}</strong><span>Alertas de frequência</span><p>Alunos abaixo do mínimo obrigatório.</p></div>
      </section>

      ${matriculasSemProfessor.length ? `
        <section class="bloco bloco-alerta-suave">
          <div class="bloco-topo">
            <div>
              <h2>Correção recomendada</h2>
              <p>Encontramos ${matriculasSemProfessor.length} matrícula(s) antiga(s) sem vínculo correto com professor. Isso pode impedir que o professor veja alunos em notas ou frequência.</p>
            </div>
            <button id="corrigir-vinculos-professor" class="botao botao-primario">Corrigir vínculos</button>
          </div>
        </section>
      ` : ""}

      <section class="bloco">
        <h2>Ordem sugerida para usar o sistema</h2>
        <div class="passos-painel">
          <div><strong>1</strong><span>Cadastrar cursos, disciplinas, professores e alunos.</span></div>
          <div><strong>2</strong><span>Montar matriz curricular e dependências.</span></div>
          <div><strong>3</strong><span>Criar ofertas de disciplinas e matricular alunos.</span></div>
          <div><strong>4</strong><span>Configurar aulas, lançar frequência e notas.</span></div>
        </div>
      </section>
    `;

    $$(`[data-ir]`).forEach((botao) => botao.addEventListener("click", () => navegar(botao.dataset.ir)));
    const botaoCorrigir = $("#corrigir-vinculos-professor");
    if (botaoCorrigir) {
      botaoCorrigir.addEventListener("click", async () => {
        botaoCorrigir.disabled = true;
        botaoCorrigir.textContent = "Corrigindo...";
        await corrigirVinculosProfessorMatriculas();
        mostrarMensagem("Vínculos das matrículas corrigidos com sucesso.");
        await renderDashboard();
      });
    }
    return;
  }

  if (perfilAtual.tipo === TIPOS_USUARIO.PROFESSOR) {
    await carregarBaseAcademica();
    const minhasOfertas = cache.ofertas.filter((oferta) => oferta.professorId === usuarioAtual.uid && oferta.ativa !== false);
    const minhasMatriculas = await buscarRegistrosPorOfertas(COLECOES.matriculas, minhasOfertas);
    const minhasFrequencias = await buscarRegistrosPorOfertas(COLECOES.frequencias, minhasOfertas);
    const idsOfertas = new Set(minhasOfertas.map((oferta) => oferta.id));
    const minhasAulas = cache.aulas.filter((aula) => idsOfertas.has(aula.ofertaId));
    const chamadasPendentes = minhasAulas.filter((aula) => aula.chamadaRealizada !== true).length;
    const alunosUnicos = new Set(minhasMatriculas.map((matricula) => matricula.alunoId)).size;

    const alertasFrequencia = minhasMatriculas.filter((matricula) => {
      const oferta = minhasOfertas.find((item) => item.id === matricula.ofertaId);
      const aulasOferta = minhasAulas.filter((aula) => aula.ofertaId === matricula.ofertaId);
      const frequenciasOferta = minhasFrequencias.filter((frequencia) => frequencia.ofertaId === matricula.ofertaId);
      return calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta).alerta;
    });

    const linhasOfertas = minhasOfertas.map((oferta) => {
      const totalAlunos = minhasMatriculas.filter((matricula) => matricula.ofertaId === oferta.id).length;
      const totalAulas = minhasAulas.filter((aula) => aula.ofertaId === oferta.id).length;
      const pendentes = minhasAulas.filter((aula) => aula.ofertaId === oferta.id && aula.chamadaRealizada !== true).length;
      return `
        <tr>
          <td>${protegerTexto(nomeDisciplina(oferta.disciplinaId))}</td>
          <td>${protegerTexto(oferta.turma || "-")}</td>
          <td>${protegerTexto(oferta.periodoLetivo || "-")}</td>
          <td>${totalAlunos}</td>
          <td>${totalAulas}</td>
          <td>${pendentes}</td>
        </tr>
      `;
    });

    definirTitulo("Painel do professor", "Resumo das suas disciplinas, notas e frequência.");
    conteudo().innerHTML = `
      <section class="painel-guia">
        <div>
          <span class="rotulo-painel">Área do professor</span>
          <h2>Olá, ${protegerTexto(perfilAtual.nome || "professor")}.</h2>
          <p>Você visualiza apenas as disciplinas em que foi definido como professor responsável. Use os atalhos abaixo para lançar notas ou fazer a chamada.</p>
        </div>
        <div class="acoes atalhos-painel">
          <button class="botao botao-primario" data-ir="professor-notas">Lançar notas</button>
          <button class="botao botao-secundario" data-ir="professor-frequencia">Fazer frequência</button>
          <button class="botao botao-secundario" data-ir="professor-ofertas">Ver disciplinas</button>
        </div>
      </section>

      <section class="grid-cards">
        <div class="card card-destaque"><strong>${minhasOfertas.length}</strong><span>Minhas disciplinas</span><p>Ofertas sob sua responsabilidade.</p></div>
        <div class="card"><strong>${alunosUnicos}</strong><span>Alunos vinculados</span><p>Alunos nas suas disciplinas.</p></div>
        <div class="card"><strong>${minhasAulas.length}</strong><span>Aulas cadastradas</span><p>Dias de aula criados pelo coordenador.</p></div>
        <div class="card ${chamadasPendentes ? "card-alerta" : ""}"><strong>${chamadasPendentes}</strong><span>Chamadas pendentes</span><p>Aulas ainda sem frequência.</p></div>
        <div class="card ${alertasFrequencia.length ? "card-alerta" : ""}"><strong>${alertasFrequencia.length}</strong><span>Alertas</span><p>Alunos abaixo da frequência mínima.</p></div>
      </section>

      <section class="bloco">
        <h2>Resumo por disciplina</h2>
        ${montarTabela(["Disciplina", "Turma", "Período", "Alunos", "Aulas", "Pendentes"], linhasOfertas)}
      </section>

      <section class="bloco bloco-info-suave">
        <h2>Sobre a frequência</h2>
        <p>Se a tela de frequência não mostrar alunos, confira com o coordenador se os alunos foram matriculados na oferta correta e se a oferta está vinculada ao seu usuário como professor responsável.</p>
      </section>
    `;
    $$(`[data-ir]`).forEach((botao) => botao.addEventListener("click", () => navegar(botao.dataset.ir)));
    return;
  }

  await renderAlunoResumo();
}

async function corrigirVinculosProfessorMatriculas() {
  await carregarBaseAcademica();
  const matriculas = await buscarTodos(COLECOES.matriculas);
  const lote = writeBatch(db);
  let alteracoes = 0;

  matriculas.forEach((matricula) => {
    const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
    if (!oferta?.professorId) return;
    if (matricula.professorId === oferta.professorId && matricula.cursoId === oferta.cursoId && matricula.disciplinaId === oferta.disciplinaId) return;

    lote.update(doc(db, COLECOES.matriculas, matricula.id), {
      professorId: oferta.professorId,
      cursoId: oferta.cursoId,
      disciplinaCursoId: oferta.disciplinaCursoId,
      disciplinaId: oferta.disciplinaId,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });
    alteracoes += 1;
  });

  if (alteracoes > 0) await lote.commit();
  return alteracoes;
}

async function renderAlunoResumo() {
  await carregarBaseAcademica();
  const matriculas = await buscarPorCampo(COLECOES.matriculas, "alunoId", "==", usuarioAtual.uid);
  const frequenciasAluno = await buscarPorCampo(COLECOES.frequencias, "alunoId", "==", usuarioAtual.uid);
  const aprovadas = matriculas.filter((matricula) => matricula.situacao === SITUACOES.APROVADO).length;
  const cursando = matriculas.filter((matricula) => matricula.situacao === SITUACOES.CURSANDO).length;
  const cursoId = perfilAtual.cursoId;
  const totalDisciplinas = cache.disciplinasCurso.filter((item) => item.cursoId === cursoId).length;
  const progresso = totalDisciplinas ? ((aprovadas / totalDisciplinas) * 100).toFixed(1) : 0;

  const alertasFrequencia = matriculas.filter((matricula) => {
    const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
    const aulasOferta = cache.aulas.filter((aula) => aula.ofertaId === matricula.ofertaId);
    const frequenciasOferta = frequenciasAluno.filter((frequencia) => frequencia.ofertaId === matricula.ofertaId);
    return calcularResumoFrequencia(matricula, oferta, aulasOferta, frequenciasOferta).alerta;
  });

  const linhas = matriculas.slice(0, 6).map((matricula) => {
    const oferta = cache.ofertas.find((item) => item.id === matricula.ofertaId);
    return `
      <tr>
        <td>${protegerTexto(nomeDisciplina(matricula.disciplinaId || oferta?.disciplinaId))}</td>
        <td>${protegerTexto(nomeUsuario(matricula.professorId || oferta?.professorId))}</td>
        <td><span class="badge ${classeSituacao(matricula.situacao)}">${protegerTexto(textoSituacao(matricula.situacao))}</span></td>
        <td>${formatarNumero(matricula.mediaFinal || 0)}</td>
      </tr>
    `;
  });

  definirTitulo("Painel do aluno", "Resumo das suas disciplinas, notas e frequência.");
  conteudo().innerHTML = `
    <section class="painel-guia">
      <div>
        <span class="rotulo-painel">Área do aluno</span>
        <h2>Olá, ${protegerTexto(perfilAtual.nome || "aluno")}.</h2>
        <p>Aqui você acompanha somente suas informações: disciplinas, professores, notas, frequência e progresso no curso.</p>
      </div>
      <div class="acoes atalhos-painel atalhos-aluno">
        <button class="botao botao-primario" data-ir="aluno-notas">Ver notas</button>
        <button class="botao botao-secundario" data-ir="aluno-frequencia">Ver frequência</button>
        <button class="botao botao-secundario" data-ir="aluno-progresso">Ver progresso</button>
      </div>
    </section>

    <section class="grid-cards">
      <div class="card card-destaque"><strong>${matriculas.length}</strong><span>Disciplinas vinculadas</span><p>Inclui disciplinas em andamento e concluídas.</p></div>
      <div class="card"><strong>${cursando}</strong><span>Cursando</span><p>Disciplinas em andamento.</p></div>
      <div class="card"><strong>${aprovadas}</strong><span>Aprovadas</span><p>Disciplinas concluídas.</p></div>
      <div class="card"><strong>${formatarNumero(progresso)}%</strong><span>Progresso no curso</span><p>${protegerTexto(nomeCurso(cursoId))}</p></div>
      <div class="card ${alertasFrequencia.length ? "card-alerta" : ""}"><strong>${alertasFrequencia.length}</strong><span>Alertas de frequência</span><p>Disciplinas abaixo do mínimo.</p></div>
    </section>

    <section class="bloco">
      <h2>Minhas disciplinas mais recentes</h2>
      ${montarTabela(["Disciplina", "Professor", "Situação", "Média"], linhas)}
    </section>
  `;

  $$(`[data-ir]`).forEach((botao) => botao.addEventListener("click", () => navegar(botao.dataset.ir)));
}

async function renderCursos() {
  definirTitulo("Cursos", "Cadastro básico de cursos.");
  mostrarCarregando(conteudo());
  cache.cursos = await buscarTodos(COLECOES.cursos);

  const linhas = cache.cursos.map((curso) => `
    <tr>
      <td>${protegerTexto(curso.nome)}</td>
      <td>${protegerTexto(curso.modalidade || "-")}</td>
      <td><span class="badge ${curso.ativo === false ? "badge-muted" : "badge-success"}">${curso.ativo === false ? "Inativo" : "Ativo"}</span></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Novo curso</h2>
          <p>Cadastre os cursos que terão disciplinas e alunos.</p>
        </div>
      </div>
      <form id="form-curso" class="form-grid">
        <div>
          <label>Nome do curso</label>
          <input name="nome" required placeholder="Ex.: Análise e Desenvolvimento de Sistemas" />
        </div>
        <div>
          <label>Modalidade</label>
          <input name="modalidade" placeholder="Ex.: Superior, Técnico, Médio" />
        </div>
        <button class="botao botao-primario" type="submit">Salvar curso</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Cursos cadastrados</h2>
      ${montarTabela(["Curso", "Modalidade", "Status"], linhas)}
    </section>
  `;

  $("#form-curso").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    await addDoc(collection(db, COLECOES.cursos), {
      nome: dados.get("nome").trim(),
      modalidade: dados.get("modalidade").trim(),
      ativo: true,
      criadoEm: serverTimestamp()
    });
    mostrarMensagem("Curso cadastrado com sucesso.");
    await renderCursos();
  });
}

async function renderDisciplinas() {
  definirTitulo("Disciplinas", "Cadastro geral de disciplinas.");
  mostrarCarregando(conteudo());
  cache.disciplinas = await buscarTodos(COLECOES.disciplinas);

  const linhas = cache.disciplinas.map((disciplina) => `
    <tr>
      <td>${protegerTexto(disciplina.nome)}</td>
      <td>${protegerTexto(disciplina.codigo || "-")}</td>
      <td>${protegerTexto(disciplina.cargaHoraria || "-")}h</td>
      <td><span class="badge ${disciplina.ativo === false ? "badge-muted" : "badge-success"}">${disciplina.ativo === false ? "Inativa" : "Ativa"}</span></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Nova disciplina</h2>
      <form id="form-disciplina" class="form-grid">
        <div>
          <label>Nome</label>
          <input name="nome" required placeholder="Ex.: Programação I" />
        </div>
        <div>
          <label>Código</label>
          <input name="codigo" placeholder="Ex.: ADS001" />
        </div>
        <div>
          <label>Carga horária</label>
          <input name="cargaHoraria" type="number" min="1" placeholder="80" />
        </div>
        <button class="botao botao-primario" type="submit">Salvar disciplina</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Disciplinas cadastradas</h2>
      ${montarTabela(["Disciplina", "Código", "Carga horária", "Status"], linhas)}
    </section>
  `;

  $("#form-disciplina").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    await addDoc(collection(db, COLECOES.disciplinas), {
      nome: dados.get("nome").trim(),
      codigo: dados.get("codigo").trim(),
      cargaHoraria: Number(dados.get("cargaHoraria") || 0),
      ativo: true,
      criadoEm: serverTimestamp()
    });
    mostrarMensagem("Disciplina cadastrada com sucesso.");
    await renderDisciplinas();
  });
}


function fecharModalEditarUsuario() {
  const modal = $("#modal-editar-usuario");
  if (modal) modal.remove();
}

function abrirModalEditarUsuario(usuarioId) {
  fecharModalEditarUsuario();
  const usuario = cache.usuarios.find((item) => item.id === usuarioId);
  if (!usuario) {
    mostrarMensagem("Usuário não encontrado.", "erro");
    return;
  }

  const editandoProprioCadastro = usuario.id === usuarioAtual.uid;

  const opcoesCurso = cache.cursos
    .filter((curso) => curso.ativo !== false || curso.id === usuario.cursoId)
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" }))
    .map((curso) => `<option value="${protegerTexto(curso.id)}" ${curso.id === usuario.cursoId ? "selected" : ""}>${protegerTexto(curso.nome)}</option>`)
    .join("");

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modal-editar-usuario" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-editar-usuario">
      <section class="modal-card modal-card-largo">
        <div class="modal-topo">
          <div>
            <h2 id="titulo-modal-editar-usuario">Editar usuário</h2>
            <p>Atualize os dados cadastrais de ${protegerTexto(usuario.nome || "usuário")}.</p>
          </div>
          <button type="button" class="modal-fechar" data-fechar-editar-usuario aria-label="Fechar">×</button>
        </div>

        <form id="form-editar-usuario" class="form-grid">
          <input type="hidden" name="usuarioId" value="${protegerTexto(usuario.id)}" />

          <div class="campo-largo">
            <label>Nome completo</label>
            <input name="nome" required value="${protegerTexto(usuario.nome || "")}" />
          </div>

          <div class="campo-largo">
            <label>Novo e-mail</label>
            <input name="email" type="email" required value="${protegerTexto(usuario.emailPendente || usuario.email || "")}" />
            <small class="texto-ajuda">E-mail atual de acesso: <strong>${protegerTexto(usuario.email || "Não informado")}</strong>. Se houver alteração, o usuário deverá confirmá-la em <strong>Meu perfil</strong> usando a senha atual.</small>
          </div>

          <div>
            <label>Perfil</label>
            <select name="tipo" id="editar-tipo-usuario" required ${editandoProprioCadastro ? "disabled" : ""}>
              <option value="coordenador" ${usuario.tipo === TIPOS_USUARIO.COORDENADOR ? "selected" : ""}>Coordenador</option>
              <option value="professor" ${usuario.tipo === TIPOS_USUARIO.PROFESSOR ? "selected" : ""}>Professor</option>
              <option value="aluno" ${usuario.tipo === TIPOS_USUARIO.ALUNO ? "selected" : ""}>Aluno</option>
            </select>
            ${editandoProprioCadastro ? `<input type="hidden" name="tipo" value="${protegerTexto(usuario.tipo)}" /><small class="texto-ajuda">Para evitar bloqueio do sistema, você não pode alterar o próprio perfil de acesso nesta tela.</small>` : ""}
          </div>

          <div>
            <label>Matrícula</label>
            <input name="matricula" value="${protegerTexto(usuario.matricula || "")}" placeholder="Opcional" />
          </div>

          <div id="editar-campo-curso-aluno">
            <label>Curso do aluno</label>
            <select name="cursoId" id="editar-curso-usuario">
              <option value="">Selecione o curso</option>
              ${opcoesCurso}
            </select>
          </div>

          <div>
            <label>Status</label>
            <select name="ativo" ${editandoProprioCadastro ? "disabled" : ""}>
              <option value="true" ${usuario.ativo !== false ? "selected" : ""}>Ativo</option>
              <option value="false" ${usuario.ativo === false ? "selected" : ""}>Inativo</option>
            </select>
            ${editandoProprioCadastro ? `<input type="hidden" name="ativo" value="${usuario.ativo !== false ? "true" : "false"}" /><small class="texto-ajuda">O próprio coordenador não pode inativar a própria conta.</small>` : ""}
          </div>

          <div class="acoes modal-acoes campo-largo">
            <button type="button" class="botao botao-secundario" data-fechar-editar-usuario>Cancelar</button>
            <button id="botao-salvar-edicao-usuario" type="submit" class="botao botao-primario">Salvar alterações</button>
          </div>
        </form>
      </section>
    </div>
  `);

  const modal = $("#modal-editar-usuario");
  const tipo = $("#editar-tipo-usuario");
  const campoCurso = $("#editar-campo-curso-aluno");

  const atualizarCurso = () => {
    campoCurso.style.display = tipo.value === TIPOS_USUARIO.ALUNO ? "block" : "none";
  };
  tipo.addEventListener("change", atualizarCurso);
  atualizarCurso();

  $$('[data-fechar-editar-usuario]', modal).forEach((botao) => botao.addEventListener("click", fecharModalEditarUsuario));
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModalEditarUsuario();
  });

  $("#form-editar-usuario").addEventListener("submit", salvarEdicaoUsuario);
}

async function salvarEdicaoUsuario(evento) {
  evento.preventDefault();
  const dados = new FormData(evento.target);
  const usuarioId = String(dados.get("usuarioId") || "");
  const usuario = cache.usuarios.find((item) => item.id === usuarioId);
  const botao = $("#botao-salvar-edicao-usuario");

  if (!usuario) {
    mostrarMensagem("Usuário não encontrado.", "erro");
    return;
  }

  const nome = String(dados.get("nome") || "").trim();
  const novoEmail = String(dados.get("email") || "").trim().toLowerCase();
  const tipo = String(dados.get("tipo") || "");
  const cursoId = tipo === TIPOS_USUARIO.ALUNO ? String(dados.get("cursoId") || "") : "";

  if (!nome || !novoEmail) {
    mostrarMensagem("Informe nome e e-mail.", "alerta");
    return;
  }
  if (tipo === TIPOS_USUARIO.ALUNO && !cursoId) {
    mostrarMensagem("Selecione o curso do aluno.", "alerta");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    const alteracoes = {
      nome,
      tipo,
      matricula: String(dados.get("matricula") || "").trim(),
      cursoId,
      ativo: String(dados.get("ativo")) === "true",
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (novoEmail !== String(usuario.email || "").toLowerCase()) {
      alteracoes.emailPendente = novoEmail;
    } else {
      alteracoes.emailPendente = "";
    }

    await updateDoc(doc(db, COLECOES.usuarios, usuarioId), alteracoes);
    fecharModalEditarUsuario();

    if (alteracoes.emailPendente) {
      mostrarMensagem("Dados atualizados. O novo e-mail ficará pendente até o usuário confirmá-lo em Meu perfil.", "alerta");
    } else {
      mostrarMensagem("Usuário atualizado com sucesso.");
    }

    if (usuarioId === usuarioAtual.uid) {
      perfilAtual = { ...perfilAtual, ...alteracoes };
      atualizarNomeUsuario(nome);
      $("#perfil-label").textContent = textoPerfil(tipo);
    }

    await renderUsuarios();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem("Não foi possível atualizar o usuário.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar alterações";
  }
}

async function renderMeuPerfil() {
  definirTitulo("Meu perfil", "Atualize seu nome e seus dados de acesso.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();
  perfilAtual = await carregarPerfil(usuarioAtual.uid);

  const emailAtual = auth.currentUser?.email || perfilAtual.email || "";
  const emailSugerido = perfilAtual.emailPendente || emailAtual;

  conteudo().innerHTML = `
    <section class="grid-cards grid-cards-pequeno">
      <div class="card"><strong>👤</strong><span>${protegerTexto(textoPerfil(perfilAtual.tipo))}</span><p>Seu perfil de acesso no sistema.</p></div>
      <div class="card"><strong>✉</strong><span>${protegerTexto(emailAtual)}</span><p>E-mail usado para entrar.</p></div>
      <div class="card"><strong>✓</strong><span>${perfilAtual.ativo === false ? "Inativo" : "Ativo"}</span><p>Status do seu cadastro.</p></div>
    </section>

    ${perfilAtual.emailPendente ? `
      <section class="bloco aviso aviso-pendente-email">
        <strong>Alteração de e-mail pendente</strong>
        <p>A coordenação indicou o novo e-mail <strong>${protegerTexto(perfilAtual.emailPendente)}</strong>. Para concluir, confirme abaixo usando sua senha atual.</p>
      </section>
    ` : ""}

    <section class="bloco perfil-bloco">
      <div class="bloco-topo">
        <div>
          <h2>Dados pessoais</h2>
          <p>Você pode alterar seu nome e e-mail. Perfil, curso, matrícula e status são administrados pela coordenação.</p>
        </div>
      </div>

      <form id="form-meu-perfil" class="form-grid">
        <div class="campo-largo">
          <label>Nome completo</label>
          <input name="nome" required value="${protegerTexto(perfilAtual.nome || "")}" />
        </div>

        <div class="campo-largo">
          <label>E-mail de acesso</label>
          <input name="email" type="email" required value="${protegerTexto(emailSugerido)}" />
          <small class="texto-ajuda">Ao alterar o e-mail, ele passará a ser usado no próximo acesso ao sistema.</small>
        </div>

        <div id="grupo-senha-confirmar-email" class="campo-largo" ${emailSugerido === emailAtual ? "hidden" : ""}>
          <label for="senha-confirmar-email">Senha atual para confirmar a troca do e-mail</label>
          <div class="campo-senha">
            <input id="senha-confirmar-email" name="senhaAtual" type="password" autocomplete="current-password" placeholder="Informe sua senha atual" />
            <button class="botao-olho" type="button" data-toggle-senha="senha-confirmar-email" aria-label="Mostrar senha"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          </div>
        </div>

        <div>
          <label>Perfil</label>
          <input value="${protegerTexto(textoPerfil(perfilAtual.tipo))}" disabled />
        </div>
        <div>
          <label>Matrícula</label>
          <input value="${protegerTexto(perfilAtual.matricula || "Não informada")}" disabled />
        </div>
        <div>
          <label>Curso</label>
          <input value="${protegerTexto(perfilAtual.cursoId ? nomeCurso(perfilAtual.cursoId) : "Não se aplica")}" disabled />
        </div>
        <div>
          <label>Status</label>
          <input value="${perfilAtual.ativo === false ? "Inativo" : "Ativo"}" disabled />
        </div>

        <div class="acoes campo-largo">
          <button id="botao-salvar-meu-perfil" class="botao botao-primario" type="submit">Salvar meu perfil</button>
        </div>
      </form>
    </section>
  `;

  configurarBotoesSenha(conteudo());

  const campoEmail = $('#form-meu-perfil input[name="email"]');
  const grupoSenha = $("#grupo-senha-confirmar-email");
  campoEmail.addEventListener("input", () => {
    const mudou = campoEmail.value.trim().toLowerCase() !== String(emailAtual).toLowerCase();
    grupoSenha.hidden = !mudou;
    const senha = $("#senha-confirmar-email");
    senha.required = mudou;
  });
  campoEmail.dispatchEvent(new Event("input"));

  $("#form-meu-perfil").addEventListener("submit", salvarMeuPerfil);
}

async function salvarMeuPerfil(evento) {
  evento.preventDefault();
  const dados = new FormData(evento.target);
  const nome = String(dados.get("nome") || "").trim();
  const novoEmail = String(dados.get("email") || "").trim().toLowerCase();
  const emailAtual = String(auth.currentUser?.email || perfilAtual.email || "").toLowerCase();
  const senhaAtual = String(dados.get("senhaAtual") || "");
  const botao = $("#botao-salvar-meu-perfil");

  if (!nome || !novoEmail) {
    mostrarMensagem("Informe nome e e-mail.", "alerta");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Salvando...";

  try {
    if (novoEmail !== emailAtual) {
      if (!senhaAtual) {
        mostrarMensagem("Informe sua senha atual para alterar o e-mail.", "alerta");
        return;
      }
      const credencial = EmailAuthProvider.credential(emailAtual, senhaAtual);
      await reauthenticateWithCredential(auth.currentUser, credencial);
      await updateEmail(auth.currentUser, novoEmail);
    }

    await updateDoc(doc(db, COLECOES.usuarios, usuarioAtual.uid), {
      nome,
      email: novoEmail,
      emailPendente: "",
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    });

    perfilAtual = {
      ...perfilAtual,
      nome,
      email: novoEmail,
      emailPendente: ""
    };
    const indice = cache.usuarios.findIndex((item) => item.id === usuarioAtual.uid);
    if (indice >= 0) cache.usuarios[indice] = { ...cache.usuarios[indice], ...perfilAtual };
    atualizarNomeUsuario(nome);
    mostrarMensagem("Perfil atualizado com sucesso.");
    await renderMeuPerfil();
  } catch (erro) {
    console.error(erro);
    const mensagens = {
      "auth/invalid-credential": "A senha atual não confere.",
      "auth/wrong-password": "A senha atual não confere.",
      "auth/email-already-in-use": "Este e-mail já está sendo usado por outra conta.",
      "auth/invalid-email": "Informe um e-mail válido.",
      "auth/requires-recent-login": "Por segurança, saia, entre novamente e tente alterar o e-mail.",
      "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente."
    };
    mostrarMensagem(mensagens[erro.code] || "Não foi possível atualizar o perfil.", "erro");
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar meu perfil";
  }
}

async function renderUsuarios() {
  definirTitulo("Usuários", "Cadastro de coordenadores, professores e alunos.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const filtrosIniciais = {
    busca: sessionStorage.getItem("filtroUsuariosBusca") || "",
    perfil: sessionStorage.getItem("filtroUsuariosPerfil") || "",
    status: sessionStorage.getItem("filtroUsuariosStatus") || ""
  };

  const totalUsuarios = cache.usuarios.length;
  const totalCoordenadores = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.COORDENADOR).length;
  const totalProfessores = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.PROFESSOR).length;
  const totalAlunos = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.ALUNO).length;

  conteudo().innerHTML = `
    <section class="bloco">
      <div class="aviso">
        Ao cadastrar professores e alunos, defina uma senha inicial e oriente o usuário a alterá-la no primeiro acesso pelo botão <strong>Alterar senha</strong>.
      </div>
      <h2>Novo usuário</h2>
      <form id="form-usuario" class="form-grid">
        <div>
          <label>Nome completo</label>
          <input name="nome" required placeholder="Nome do usuário" />
        </div>
        <div>
          <label>E-mail</label>
          <input name="email" type="email" required placeholder="email@exemplo.com" />
        </div>
        <div>
          <label for="senha-novo-usuario">Senha inicial</label>
          <div class="campo-senha">
            <input id="senha-novo-usuario" name="senha" type="password" minlength="6" required placeholder="Mínimo 6 caracteres" />
            <button class="botao-olho" type="button" data-toggle-senha="senha-novo-usuario" aria-label="Mostrar senha"><i class="fa-regular fa-eye" aria-hidden="true"></i></button>
          </div>
        </div>
        <div>
          <label>Perfil</label>
          <select name="tipo" id="tipo-usuario" required>
            <option value="coordenador">Coordenador</option>
            <option value="professor">Professor</option>
            <option value="aluno">Aluno</option>
          </select>
        </div>
        <div>
          <label>Matrícula</label>
          <input name="matricula" placeholder="Opcional" />
        </div>
        <div id="campo-curso-aluno">
          <label>Curso do aluno</label>
          <select name="cursoId" id="curso-usuario"></select>
        </div>
        <button class="botao botao-primario" type="submit">Criar usuário</button>
      </form>
    </section>

    <section class="grid-cards grid-cards-pequeno">
      <div class="card"><strong>${totalUsuarios}</strong><span>Total de usuários</span><p>Todos os perfis cadastrados.</p></div>
      <div class="card"><strong>${totalCoordenadores}</strong><span>Coordenadores</span><p>Acesso administrativo.</p></div>
      <div class="card"><strong>${totalProfessores}</strong><span>Professores</span><p>Responsáveis por disciplinas.</p></div>
      <div class="card"><strong>${totalAlunos}</strong><span>Alunos</span><p>Vinculados aos cursos.</p></div>
    </section>

    <section class="bloco">
      <div class="bloco-topo bloco-topo-responsivo">
        <div>
          <h2>Usuários cadastrados</h2>
          <p id="contador-usuarios">Mostrando 0 usuário(s).</p>
        </div>
      </div>

      <div class="form-grid filtros-lista">
        <div>
          <label>Pesquisar</label>
          <input id="busca-usuarios" placeholder="Buscar por nome, e-mail ou matrícula" value="${protegerTexto(filtrosIniciais.busca)}" />
        </div>
        <div>
          <label>Perfil</label>
          <select id="filtro-perfil-usuarios">
            <option value="">Todos os perfis</option>
            <option value="coordenador">Coordenador</option>
            <option value="professor">Professor</option>
            <option value="aluno">Aluno</option>
          </select>
        </div>
        <div>
          <label>Status</label>
          <select id="filtro-status-usuarios">
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
      </div>

      <div class="tabela-responsiva tabela-com-margem">
        <table>
          <thead>
            <tr>
              <th class="coluna-numero">Nº</th>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Curso</th>
              <th>Matrícula</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="tabela-usuarios-corpo"></tbody>
        </table>
      </div>
    </section>
  `;

  preencherSelect($("#curso-usuario"), cache.cursos, "Selecione o curso", "id", "nome");
  configurarBotoesSenha(conteudo());
  $("#filtro-perfil-usuarios").value = filtrosIniciais.perfil;
  $("#filtro-status-usuarios").value = filtrosIniciais.status;

  function atualizarCampoCurso() {
    const tipo = $("#tipo-usuario").value;
    $("#campo-curso-aluno").style.display = tipo === TIPOS_USUARIO.ALUNO ? "block" : "none";
  }

  function prioridadePerfil(tipo) {
    const ordem = {
      [TIPOS_USUARIO.COORDENADOR]: 1,
      [TIPOS_USUARIO.PROFESSOR]: 2,
      [TIPOS_USUARIO.ALUNO]: 3
    };
    return ordem[tipo] || 99;
  }

  function ordenarUsuariosHierarquicoAlfabetico(usuarios) {
    return [...usuarios].sort((a, b) => {
      const diferencaPerfil = prioridadePerfil(a.tipo) - prioridadePerfil(b.tipo);
      if (diferencaPerfil !== 0) return diferencaPerfil;

      const nomeA = a.nome || "";
      const nomeB = b.nome || "";
      const diferencaNome = nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
      if (diferencaNome !== 0) return diferencaNome;

      return (a.email || "").localeCompare(b.email || "", "pt-BR", { sensitivity: "base" });
    });
  }

  function obterUsuariosFiltrados() {
    const busca = $("#busca-usuarios").value.trim().toLowerCase();
    const perfil = $("#filtro-perfil-usuarios").value;
    const status = $("#filtro-status-usuarios").value;

    sessionStorage.setItem("filtroUsuariosBusca", $("#busca-usuarios").value);
    sessionStorage.setItem("filtroUsuariosPerfil", perfil);
    sessionStorage.setItem("filtroUsuariosStatus", status);

    const filtrados = cache.usuarios.filter((usuario) => {
      const textoBusca = [usuario.nome, usuario.email, usuario.emailPendente, usuario.matricula, nomeCurso(usuario.cursoId)]
        .join(" ")
        .toLowerCase();
      const combinaBusca = !busca || textoBusca.includes(busca);
      const combinaPerfil = !perfil || usuario.tipo === perfil;
      const usuarioAtivo = usuario.ativo !== false;
      const combinaStatus = !status || (status === "ativo" ? usuarioAtivo : !usuarioAtivo);
      return combinaBusca && combinaPerfil && combinaStatus;
    });

    return ordenarUsuariosHierarquicoAlfabetico(filtrados);
  }

  function atualizarTabelaUsuarios() {
    const usuariosFiltrados = obterUsuariosFiltrados();
    const corpo = $("#tabela-usuarios-corpo");
    $("#contador-usuarios").textContent = `Mostrando ${usuariosFiltrados.length} de ${totalUsuarios} usuário(s).`;

    if (usuariosFiltrados.length === 0) {
      corpo.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="estado-vazio estado-vazio-tabela">
              <strong>Nenhum usuário encontrado.</strong>
              <p>Tente mudar o texto da pesquisa, o perfil ou o status.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const totaisFiltrados = {
      coordenadores: usuariosFiltrados.filter((usuario) => usuario.tipo === TIPOS_USUARIO.COORDENADOR).length,
      professores: usuariosFiltrados.filter((usuario) => usuario.tipo === TIPOS_USUARIO.PROFESSOR).length,
      alunos: usuariosFiltrados.filter((usuario) => usuario.tipo === TIPOS_USUARIO.ALUNO).length
    };

    const linhasUsuarios = usuariosFiltrados.map((usuario, indice) => `
      <tr>
        <td class="coluna-numero">${indice + 1}</td>
        <td>${protegerTexto(usuario.nome)}</td>
        <td>${protegerTexto(usuario.email)}${usuario.emailPendente ? `<span class="texto-suave texto-pendente-email">Novo e-mail pendente: ${protegerTexto(usuario.emailPendente)}</span>` : ""}</td>
        <td><span class="badge badge-info">${protegerTexto(textoPerfil(usuario.tipo))}</span></td>
        <td>${usuario.cursoId ? protegerTexto(nomeCurso(usuario.cursoId)) : "-"}</td>
        <td>${usuario.matricula ? protegerTexto(usuario.matricula) : "-"}</td>
        <td><span class="badge ${usuario.ativo === false ? "badge-muted" : "badge-success"}">${usuario.ativo === false ? "Inativo" : "Ativo"}</span></td>
        <td><button type="button" class="botao botao-secundario botao-pequeno" data-editar-usuario="${protegerTexto(usuario.id)}">Editar</button></td>
      </tr>
    `).join("");

    corpo.innerHTML = `${linhasUsuarios}
      <tr class="linha-total">
        <td></td>
        <td><strong>Total</strong></td>
        <td colspan="6">
          <strong>${usuariosFiltrados.length} usuário(s) exibido(s)</strong>
          <span class="detalhe-total">Coordenadores: ${totaisFiltrados.coordenadores} · Professores: ${totaisFiltrados.professores} · Alunos: ${totaisFiltrados.alunos}</span>
        </td>
      </tr>
    `;
  }

  $("#tipo-usuario").addEventListener("change", atualizarCampoCurso);
  $("#busca-usuarios").addEventListener("input", atualizarTabelaUsuarios);
  $("#filtro-perfil-usuarios").addEventListener("change", atualizarTabelaUsuarios);
  $("#filtro-status-usuarios").addEventListener("change", atualizarTabelaUsuarios);
  atualizarCampoCurso();
  atualizarTabelaUsuarios();

  $("#tabela-usuarios-corpo").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-editar-usuario]");
    if (botao) abrirModalEditarUsuario(botao.dataset.editarUsuario);
  });

  $("#form-usuario").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const botao = evento.submitter;
    botao.disabled = true;
    botao.textContent = "Criando...";

    try {
      const dados = new FormData(evento.target);
      const perfil = {
        nome: dados.get("nome").trim(),
        email: dados.get("email").trim().toLowerCase(),
        tipo: dados.get("tipo"),
        matricula: dados.get("matricula").trim(),
        cursoId: dados.get("tipo") === TIPOS_USUARIO.ALUNO ? dados.get("cursoId") : "",
        ativo: true,
        criadoEm: serverTimestamp(),
        criadoPor: usuarioAtual.uid
      };

      if (perfil.tipo === TIPOS_USUARIO.ALUNO && !perfil.cursoId) {
        mostrarMensagem("Selecione o curso do aluno.", "alerta");
        return;
      }

      await criarUsuarioComAuth(perfil, dados.get("senha"));
      mostrarMensagem("Usuário criado com sucesso.");
      await renderUsuarios();
    } catch (erro) {
      console.error(erro);
      mostrarMensagem("Erro ao criar usuário. Verifique se o e-mail já existe.", "erro");
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar usuário";
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

  const linhasMatriz = cache.disciplinasCurso.map((item) => `
    <tr>
      <td>${protegerTexto(nomeCurso(item.cursoId))}</td>
      <td>${protegerTexto(nomeDisciplina(item.disciplinaId))}</td>
      <td>${protegerTexto(item.periodo || "-")}</td>
      <td>${protegerTexto(item.ordem || "-")}</td>
    </tr>
  `);

  const linhasDependencias = cache.dependencias.map((dep) => {
    const disciplina = cache.disciplinasCurso.find((item) => item.id === dep.disciplinaCursoId);
    const dependeDe = cache.disciplinasCurso.find((item) => item.id === dep.dependeDeDisciplinaCursoId);
    return `
      <tr>
        <td>${protegerTexto(resumoDisciplinaCurso(disciplina))}</td>
        <td>${protegerTexto(resumoDisciplinaCurso(dependeDe))}</td>
      </tr>
    `;
  });

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Vincular disciplina ao curso</h2>
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
          <input name="periodo" type="number" min="1" required placeholder="1" />
        </div>
        <div>
          <label>Ordem</label>
          <input name="ordem" type="number" min="1" required placeholder="1" />
        </div>
        <button class="botao botao-primario" type="submit">Adicionar à matriz</button>
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
      ${montarTabela(["Curso", "Disciplina", "Período", "Ordem"], linhasMatriz)}
    </section>

    <section class="bloco">
      <h2>Dependências cadastradas</h2>
      ${montarTabela(["Disciplina", "Depende de"], linhasDependencias)}
    </section>
  `;

  preencherSelect($("#matriz-curso"), cache.cursos, "Selecione o curso", "id", "nome");
  preencherSelect($("#matriz-disciplina"), cache.disciplinas, "Selecione a disciplina", "id", "nome");

  const opcoesMatriz = cache.disciplinasCurso.map((item) => ({ id: item.id, nome: resumoDisciplinaCurso(item) }));
  preencherSelect($("#dep-disciplina"), opcoesMatriz, "Selecione a disciplina", "id", "nome");
  preencherSelect($("#dep-depende"), opcoesMatriz, "Selecione o pré-requisito", "id", "nome");

  $("#form-matriz").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const jaExiste = cache.disciplinasCurso.some((item) => item.cursoId === dados.get("cursoId") && item.disciplinaId === dados.get("disciplinaId"));
    if (jaExiste) {
      mostrarMensagem("Essa disciplina já está vinculada a este curso.", "alerta");
      return;
    }
    await addDoc(collection(db, COLECOES.disciplinasCurso), {
      cursoId: dados.get("cursoId"),
      disciplinaId: dados.get("disciplinaId"),
      periodo: Number(dados.get("periodo")),
      ordem: Number(dados.get("ordem")),
      ativo: true,
      criadoEm: serverTimestamp()
    });
    mostrarMensagem("Disciplina adicionada à matriz.");
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
      criadoEm: serverTimestamp()
    });
    mostrarMensagem("Dependência cadastrada.");
    await renderMatriz();
  });
}

async function renderOfertas() {
  definirTitulo("Ofertas de disciplinas", "Abra disciplinas por período letivo, turma e professor.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const professores = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.PROFESSOR && usuario.ativo !== false);
  const opcoesMatriz = cache.disciplinasCurso.map((item) => ({ id: item.id, nome: resumoDisciplinaCurso(item) }));
  const gruposDuplicados = identificarOfertasDuplicadas();
  const idsDuplicados = new Set(gruposDuplicados.flatMap((grupo) => grupo.duplicadas.map((oferta) => oferta.id)));
  const avisoDuplicidade = gruposDuplicados.length ? `
    <div class="alerta alerta-compacta">
      <strong>Atenção:</strong> encontramos ${gruposDuplicados.reduce((total, grupo) => total + grupo.duplicadas.length, 0)} oferta(s) duplicada(s).
      O sistema agora bloqueia novos cadastros repetidos. Para corrigir o que já existe, clique em
      <button class="botao-link" type="button" data-acao="inativar-ofertas-duplicadas">inativar duplicadas</button>.
    </div>
  ` : "";

  const linhas = cache.ofertas.map((oferta) => {
    const status = oferta.ativa === false
      ? '<span class="badge badge-muted">Inativa</span>'
      : idsDuplicados.has(oferta.id)
        ? '<span class="badge badge-warning">Duplicada</span>'
        : '<span class="badge badge-success">Ativa</span>';

    return `
    <tr>
      <td>${protegerTexto(nomeCurso(oferta.cursoId))}</td>
      <td>${protegerTexto(nomeDisciplina(oferta.disciplinaId))}</td>
      <td>${protegerTexto(oferta.turma || "-")}</td>
      <td>${protegerTexto(oferta.periodoLetivo || "-")}</td>
      <td>${protegerTexto(professorDaOferta(oferta))}</td>
      <td>${formatarNumero(minimoFrequenciaOferta(oferta))}%</td>
      <td>${status}</td>
    </tr>
  `;
  });

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Nova oferta</h2>
      ${avisoDuplicidade}
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
          <input name="periodoLetivo" required placeholder="Ex.: 2026.2" />
        </div>
        <div>
          <label>Turma</label>
          <input name="turma" required placeholder="Ex.: Módulo III - Noite" />
        </div>
        <div>
          <label>Frequência mínima obrigatória (%)</label>
          <input name="frequenciaMinima" type="number" min="1" max="100" value="75" />
        </div>
        <button class="botao botao-primario" type="submit">Criar oferta</button>
      </form>
    </section>
    <section class="bloco">
      <h2>Ofertas cadastradas</h2>
      ${montarTabela(["Curso", "Disciplina", "Turma", "Período", "Professor", "Frequência mínima", "Status"], linhas)}
    </section>
  `;

  preencherSelect($("#oferta-disciplina-curso"), opcoesMatriz, "Selecione a disciplina", "id", "nome");
  preencherSelect($("#oferta-professor"), professores, "Selecione o professor", "id", "nome");

  const botaoInativarDuplicadas = $("[data-acao='inativar-ofertas-duplicadas']");
  if (botaoInativarDuplicadas) {
    botaoInativarDuplicadas.addEventListener("click", async () => {
      const duplicadas = identificarOfertasDuplicadas().flatMap((grupo) => grupo.duplicadas);
      if (!duplicadas.length) {
        mostrarMensagem("Não há ofertas duplicadas ativas.");
        return;
      }

      const confirmar = confirm(`Encontramos ${duplicadas.length} oferta(s) duplicada(s). Deseja inativar as repetidas e manter apenas a primeira oferta de cada configuração?`);
      if (!confirmar) return;

      const lote = writeBatch(db);
      duplicadas.forEach((oferta) => {
        lote.update(doc(db, COLECOES.ofertas, oferta.id), {
          ativa: false,
          inativadaPorDuplicidade: true,
          atualizadoEm: serverTimestamp()
        });
      });
      await lote.commit();
      mostrarMensagem("Ofertas duplicadas inativadas. As matrículas continuam preservadas nas ofertas originais.");
      await renderOfertas();
    });
  }

  $("#form-oferta").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    const disciplinaCurso = cache.disciplinasCurso.find((item) => item.id === dados.get("disciplinaCursoId"));

    if (!disciplinaCurso) {
      mostrarMensagem("Selecione uma disciplina válida.", "alerta");
      return;
    }

    const novaOferta = {
      cursoId: disciplinaCurso.cursoId,
      disciplinaCursoId: disciplinaCurso.id,
      disciplinaId: disciplinaCurso.disciplinaId,
      professorId: dados.get("professorId"),
      periodoLetivo: dados.get("periodoLetivo").trim(),
      turma: dados.get("turma").trim(),
      frequenciaMinima: Number(dados.get("frequenciaMinima") || 75),
      ativa: true,
      criadoEm: serverTimestamp()
    };

    if (ofertaDuplicadaAtiva(novaOferta)) {
      mostrarMensagem("Essa oferta já existe para a mesma disciplina, turma e período letivo. Para trocar professor ou frequência mínima, edite/inative a oferta existente em vez de cadastrar outra.", "alerta");
      return;
    }

    const ofertaId = idOfertaUnica(novaOferta);
    const referencia = doc(db, COLECOES.ofertas, ofertaId);
    const ofertaExistente = await getDoc(referencia);

    if (ofertaExistente.exists() && ofertaExistente.data().ativa !== false) {
      mostrarMensagem("Essa oferta já está cadastrada. O sistema bloqueou a duplicidade.", "alerta");
      return;
    }

    await setDoc(referencia, novaOferta, { merge: false });

    mostrarMensagem("Oferta criada com sucesso.");
    await renderOfertas();
  });
}

async function renderMatriculas() {
  definirTitulo("Matrículas e importação", "Matricule alunos, importe de outra disciplina e acompanhe os totais.");
  mostrarCarregando(conteudo());
  await carregarBaseAcademica();

  const alunos = cache.usuarios.filter((usuario) => usuario.tipo === TIPOS_USUARIO.ALUNO && usuario.ativo !== false);
  const ofertas = cache.ofertas.filter((oferta) => oferta.ativa !== false);
  const ofertaSelecionadaId = sessionStorage.getItem("ofertaMatriculas") || ofertas[0]?.id || "";
  const todasMatriculas = await buscarTodos(COLECOES.matriculas);
  const matriculasOfertaBrutas = ofertaSelecionadaId ? todasMatriculas.filter((matricula) => matricula.ofertaId === ofertaSelecionadaId) : [];
  const matriculasOferta = ordenarMatriculasPorAluno(matriculasOfertaBrutas);
  const matriculasAtivas = matriculasOferta.filter((matricula) => !matriculaCancelada(matricula));
  const matriculasCanceladas = matriculasOferta.filter((matricula) => matriculaCancelada(matricula));
  const ofertaSelecionada = ofertas.find((oferta) => oferta.id === ofertaSelecionadaId);

  const linhas = matriculasOferta.map((matricula, indice) => {
    const cancelada = matriculaCancelada(matricula);
    const acao = cancelada
      ? `<button class="botao botao-secundario botao-pequeno" data-reativar-matricula="${matricula.id}">Reativar</button>`
      : `<button class="botao botao-perigo botao-pequeno" data-cancelar-matricula="${matricula.id}">Cancelar</button>`;

    return `
      <tr class="${cancelada ? "linha-cancelada" : ""}">
        <td class="coluna-numero">${indice + 1}</td>
        <td>
          <strong>${protegerTexto(nomeUsuario(matricula.alunoId) || matricula.alunoNome)}</strong>
          ${cancelada && matricula.motivoCancelamento ? `<small class="texto-suave">Motivo: ${protegerTexto(matricula.motivoCancelamento)}</small>` : ""}
        </td>
        <td><span class="badge ${classeSituacao(matricula.situacao)}">${protegerTexto(textoSituacao(matricula.situacao))}</span></td>
        <td>${formatarNumero(matricula.mediaFinal || 0)}</td>
        <td>${formatarNumero(matricula.percentualAproveitamento || 0)}%</td>
        <td><div class="acoes">${acao}</div></td>
      </tr>
    `;
  });

  linhas.push(`
    <tr class="linha-total">
      <td></td>
      <td><strong>Total</strong></td>
      <td colspan="4"><strong>${matriculasAtivas.length} aluno(s) ativo(s) na disciplina · ${matriculasCanceladas.length} matrícula(s) cancelada(s) · ${matriculasOferta.length} total geral</strong></td>
    </tr>
  `);

  conteudo().innerHTML = `
    <section class="bloco">
      <h2>Matricular aluno manualmente</h2>
      <form id="form-matricula" class="form-grid">
        <div>
          <label>Oferta da disciplina</label>
          <select name="ofertaId" id="matricula-oferta" required></select>
        </div>
        <div>
          <label>Aluno</label>
          <select name="alunoId" id="matricula-aluno" required></select>
        </div>
        <button class="botao botao-primario" type="submit">Matricular aluno</button>
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
          <select name="filtro" id="importar-filtro">
            <option value="todos">Importar todos</option>
            <option value="aprovados">Importar somente aprovados</option>
          </select>
        </div>
        <div class="linha-inteira resumo-importacao" id="resumo-importacao">
          Selecione a origem e o destino para ver os totais antes de importar.
        </div>
        <button class="botao botao-primario" type="submit">Importar alunos</button>
      </form>
    </section>

    <section class="bloco">
      <div class="bloco-topo bloco-topo-responsivo">
        <div>
          <h2>Alunos matriculados</h2>
          <p>${ofertaSelecionada ? protegerTexto(resumoOferta(ofertaSelecionada)) : "Selecione uma oferta para visualizar os alunos."}</p>
        </div>
        <select id="filtro-oferta-matriculas"></select>
      </div>

      ${montarTabela(["Nº", "Aluno", "Situação", "Média", "Aproveitamento", "Ação"], linhas)}
    </section>
  `;

  const opcoesOfertas = ofertas.map((oferta) => ({ id: oferta.id, nome: resumoOferta(oferta) }));
  preencherSelect($("#matricula-oferta"), opcoesOfertas, "Selecione a oferta", "id", "nome");
  preencherSelect($("#matricula-aluno"), alunos, "Selecione o aluno", "id", "nome");
  preencherSelect($("#importar-origem"), opcoesOfertas, "Selecione a origem", "id", "nome");
  preencherSelect($("#importar-destino"), opcoesOfertas, "Selecione o destino", "id", "nome");
  preencherSelect($("#filtro-oferta-matriculas"), opcoesOfertas, "Selecione uma oferta", "id", "nome");

  $("#filtro-oferta-matriculas").value = ofertaSelecionadaId;
  $("#matricula-oferta").value = ofertaSelecionadaId;
  $("#importar-destino").value = ofertaSelecionadaId;

  function quantidadeDaOferta(ofertaId) {
    return todasMatriculas.filter((matricula) => matricula.ofertaId === ofertaId).length;
  }

  function quantidadeAprovadosDaOferta(ofertaId) {
    return todasMatriculas.filter((matricula) => matricula.ofertaId === ofertaId && matricula.situacao === SITUACOES.APROVADO).length;
  }

  function atualizarResumoImportacao() {
    const origemId = $("#importar-origem").value;
    const destinoId = $("#importar-destino").value;
    const filtro = $("#importar-filtro").value;
    const totalOrigem = quantidadeDaOferta(origemId);
    const totalDestino = quantidadeDaOferta(destinoId);
    const totalAprovadosOrigem = quantidadeAprovadosDaOferta(origemId);
    const totalConsiderado = filtro === "aprovados" ? totalAprovadosOrigem : totalOrigem;

    if (!origemId || !destinoId) {
      $("#resumo-importacao").textContent = "Selecione a origem e o destino para ver os totais antes de importar.";
      return;
    }

    if (origemId === destinoId) {
      $("#resumo-importacao").textContent = "A origem e o destino são iguais. Escolha disciplinas diferentes.";
      return;
    }

    $("#resumo-importacao").textContent = `Origem: ${totalOrigem} aluno(s). ${filtro === "aprovados" ? `${totalAprovadosOrigem} aprovado(s) serão considerados.` : `${totalConsiderado} aluno(s) serão considerados.`} Destino atual: ${totalDestino} aluno(s).`;
  }

  $("#filtro-oferta-matriculas").addEventListener("change", async (evento) => {
    sessionStorage.setItem("ofertaMatriculas", evento.target.value);
    await renderMatriculas();
  });

  $("#importar-origem").addEventListener("change", atualizarResumoImportacao);
  $("#importar-destino").addEventListener("change", atualizarResumoImportacao);
  $("#importar-filtro").addEventListener("change", atualizarResumoImportacao);
  atualizarResumoImportacao();

  $("#form-matricula").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = new FormData(evento.target);
    await matricularAluno(dados.get("alunoId"), dados.get("ofertaId"));
    sessionStorage.setItem("ofertaMatriculas", dados.get("ofertaId"));
    mostrarMensagem("Aluno matriculado com sucesso.");
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

    const resultado = await importarAlunos(origemId, destinoId, filtro);
    sessionStorage.setItem("ofertaMatriculas", destinoId);
    mostrarMensagem(`${resultado.importados} aluno(s) importado(s). ${resultado.ignoradosDuplicados} duplicado(s) ou cancelado(s) ignorado(s).`);
    await renderMatriculas();
  });

  $$('[data-cancelar-matricula]').forEach((botao) => {
    botao.addEventListener("click", async () => {
      await cancelarMatricula(botao.dataset.cancelarMatricula);
    });
  });

  $$('[data-reativar-matricula]').forEach((botao) => {
    botao.addEventListener("click", async () => {
      await reativarMatricula(botao.dataset.reativarMatricula);
    });
  });
}

async function matricularAluno(alunoId, ofertaId) {
  const oferta = cache.ofertas.find((item) => item.id === ofertaId) || await buscarDocumento(COLECOES.ofertas, ofertaId);
  const aluno = cache.usuarios.find((item) => item.id === alunoId) || await buscarDocumento(COLECOES.usuarios, alunoId);
  const matriculasDaOferta = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaId);
  const matriculaExistente = matriculasDaOferta.find((matricula) => matricula.alunoId === alunoId);

  if (matriculaExistente && !matriculaCancelada(matriculaExistente)) {
    mostrarMensagem("Esse aluno já está matriculado nessa oferta.", "alerta");
    return;
  }

  if (matriculaExistente && matriculaCancelada(matriculaExistente)) {
    mostrarMensagem("Esse aluno possui uma matrícula cancelada nessa oferta. Use o botão Reativar na lista de alunos matriculados.", "alerta");
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

async function cancelarMatricula(matriculaId) {
  const matricula = await buscarDocumento(COLECOES.matriculas, matriculaId);
  if (!matricula) {
    mostrarMensagem("Matrícula não encontrada.", "erro");
    return;
  }

  const aluno = nomeUsuario(matricula.alunoId) || matricula.alunoNome || "este aluno";
  const motivo = window.prompt(`Informe o motivo do cancelamento da matrícula de ${aluno}:`, "Desistência do curso");
  if (motivo === null) return;

  const confirmar = window.confirm(`Confirmar o cancelamento da matrícula de ${aluno}? O aluno deixará de aparecer nas telas de notas e frequência do professor.`);
  if (!confirmar) return;

  await updateDoc(doc(db, COLECOES.matriculas, matriculaId), {
    situacao: SITUACOES.CANCELADA,
    ativo: false,
    cancelada: true,
    motivoCancelamento: motivo.trim(),
    canceladaEm: serverTimestamp(),
    canceladaPor: usuarioAtual.uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: usuarioAtual.uid
  });

  mostrarMensagem("Matrícula cancelada com sucesso.");
  await renderMatriculas();
}

async function reativarMatricula(matriculaId) {
  const matricula = await buscarDocumento(COLECOES.matriculas, matriculaId);
  if (!matricula) {
    mostrarMensagem("Matrícula não encontrada.", "erro");
    return;
  }

  const aluno = nomeUsuario(matricula.alunoId) || matricula.alunoNome || "este aluno";
  const confirmar = window.confirm(`Deseja reativar a matrícula de ${aluno}?`);
  if (!confirmar) return;

  await updateDoc(doc(db, COLECOES.matriculas, matriculaId), {
    situacao: SITUACOES.CURSANDO,
    ativo: true,
    cancelada: false,
    reativadaEm: serverTimestamp(),
    reativadaPor: usuarioAtual.uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: usuarioAtual.uid
  });

  mostrarMensagem("Matrícula reativada com sucesso.");
  await renderMatriculas();
}

async function importarAlunos(origemId, destinoId, filtro) {
  const origem = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", origemId);
  const destino = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", destinoId);
  const ofertaDestino = cache.ofertas.find((item) => item.id === destinoId) || await buscarDocumento(COLECOES.ofertas, destinoId);
  const alunosJaNoDestino = new Set(destino.map((matricula) => matricula.alunoId));
  const candidatos = origem.filter((matricula) => {
    if (matriculaCancelada(matricula)) return false;
    if (filtro === "aprovados") return matricula.situacao === SITUACOES.APROVADO;
    return true;
  });
  const alunosParaImportar = candidatos.filter((matricula) => !alunosJaNoDestino.has(matricula.alunoId));
  const ignoradosDuplicados = candidatos.length - alunosParaImportar.length;
  const ignoradosFiltro = origem.length - candidatos.length;

  if (alunosParaImportar.length === 0) {
    return {
      importados: 0,
      ignoradosDuplicados,
      ignoradosFiltro,
      totalOrigem: origem.length,
      totalDestinoAntes: destino.length
    };
  }

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
  return {
    importados: alunosParaImportar.length,
    ignoradosDuplicados,
    ignoradosFiltro,
    totalOrigem: origem.length,
    totalDestinoAntes: destino.length
  };
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
  let matriculas = [];
  let notas = [];

  if (ofertaSelecionadaId) {
    if (coordenador) {
      matriculas = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId);
      notas = await buscarPorCampo(COLECOES.notas, "ofertaId", "==", ofertaSelecionadaId);
    } else {
      matriculas = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId);
      notas = await buscarPorCampo(COLECOES.notas, "ofertaId", "==", ofertaSelecionadaId);
    }
  }
  matriculas = matriculas.filter((matricula) => !matriculaCancelada(matricula));
  const notaPorMatricula = new Map(notas.map((nota) => [nota.matriculaId || nota.id, nota]));

  const linhas = matriculas.map((matricula) => {
    const nota = notaPorMatricula.get(matricula.id) || {};
    const media = nota.media ?? matricula.mediaFinal ?? 0;
    const situacao = matricula.situacao || SITUACOES.CURSANDO;
    const ofertaDaMatricula = cache.ofertas.find((oferta) => oferta.id === matricula.ofertaId);
    const professorIdLinha = matricula.professorId || ofertaDaMatricula?.professorId || usuarioAtual.uid;

    return `
      <tr data-matricula-id="${matricula.id}" data-aluno-id="${matricula.alunoId}" data-oferta-id="${matricula.ofertaId}" data-professor-id="${professorIdLinha}">
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
      professorId,
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
  const matriculasTodas = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId) : [];
  const matriculas = matriculasTodas.filter((matricula) => !matriculaCancelada(matricula));
  const frequencias = ofertaSelecionadaId ? await buscarPorCampo(COLECOES.frequencias, "ofertaId", "==", ofertaSelecionadaId) : [];
  const minimo = minimoFrequenciaOferta(ofertaSelecionada);

  const linhasAulas = aulasOferta.map((aula) => `
    <tr>
      <td>${formatarData(aula.dataAula)}</td>
      <td>${formatarNumero(aula.horasAula || 0)}h</td>
      <td>${protegerTexto(aula.descricao || "-")}</td>
      <td><span class="badge ${aula.chamadaRealizada ? "badge-success" : "badge-warning"}">${aula.chamadaRealizada ? "Chamada feita" : "Pendente"}</span></td>
    </tr>
  `);

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
    <section class="bloco">
      <div class="bloco-topo">
        <div>
          <h2>Configurar frequência da oferta</h2>
          <p>O coordenador informa os dias de aula, as horas-aula daquele dia e o mínimo obrigatório.</p>
        </div>
        <select id="select-oferta-frequencia"></select>
      </div>
      <form id="form-aula" class="form-grid">
        <div>
          <label>Frequência mínima obrigatória (%)</label>
          <input name="frequenciaMinima" type="number" min="1" max="100" value="${minimo}" required />
        </div>
        <div>
          <label>Data da aula</label>
          <input name="dataAula" type="date" />
        </div>
        <div>
          <label>Horas-aula do dia</label>
          <input name="horasAula" type="number" min="1" step="0.5" placeholder="Ex.: 4" />
        </div>
        <div>
          <label>Descrição/observação</label>
          <input name="descricao" placeholder="Ex.: Aula teórica, revisão, avaliação" />
        </div>
        <button class="botao botao-primario" type="submit" ${ofertaSelecionadaId ? "" : "disabled"}>Salvar configuração/aula</button>
      </form>
      <div class="aviso">
        Se informar apenas a frequência mínima, o sistema atualiza a regra da oferta. Para cadastrar uma aula, preencha também data e horas-aula.
      </div>
    </section>

    <section class="bloco">
      <h2>Aulas cadastradas</h2>
      ${montarTabela(["Data", "Horas-aula", "Descrição", "Chamada"], linhasAulas)}
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
    await renderFrequenciaCoordenador();
  });

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

    if (dataAula && horasAula) {
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

    mostrarMensagem("Frequência configurada com sucesso.");
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
  let matriculas = [];
  let frequenciasOferta = [];
  if (ofertaSelecionadaId) {
    matriculas = await buscarPorCampo(COLECOES.matriculas, "ofertaId", "==", ofertaSelecionadaId);
    matriculas = matriculas.filter((matricula) => !matriculaCancelada(matricula));
    frequenciasOferta = await buscarPorCampo(COLECOES.frequencias, "ofertaId", "==", ofertaSelecionadaId);
  }
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
  $("#botao-meu-perfil")?.addEventListener("click", () => navegar("meu-perfil"));
  $("#botao-alterar-senha")?.addEventListener("click", abrirModalAlterarSenha);

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

  atualizarNomeUsuario(perfilAtual.nome || usuario.email);
  $("#perfil-label").textContent = textoPerfil(perfilAtual.tipo);

  configurarEventosGlobais();
  iniciarObservadorIcones();
  renderizarMenu();
  await navegar("dashboard");
});
