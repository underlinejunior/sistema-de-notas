import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { COLECOES } from "./colecoes.js";
import { $, protegerTexto } from "./utils.js";

const formularioLogin = $("#form-login");
const campoEmail = $("#email");
const campoSenha = $("#senha");
const botaoEntrar = $("#botao-entrar");
const botaoEsqueciSenha = $("#botao-esqueci-senha");
const botaoToggleSenha = $("#toggle-senha-login");
const alerta = $("#alerta-login");
const sucesso = $("#sucesso-login");

function mostrarAlerta(mensagem) {
  if (!alerta) return;
  alerta.innerHTML = protegerTexto(mensagem);
  alerta.hidden = false;
}

function ocultarAlerta() {
  if (alerta) {
    alerta.hidden = true;
    alerta.textContent = "";
  }
  if (sucesso) {
    sucesso.hidden = true;
    sucesso.textContent = "";
  }
}

function mostrarSucesso(mensagem) {
  if (!sucesso) return;
  sucesso.innerHTML = protegerTexto(mensagem);
  sucesso.hidden = false;
}

async function buscarPerfil(uid) {
  const perfilSnap = await getDoc(doc(db, COLECOES.usuarios, uid));
  if (!perfilSnap.exists()) return null;
  return { id: perfilSnap.id, ...perfilSnap.data() };
}

async function entrar(evento) {
  evento.preventDefault();
  ocultarAlerta();

  const email = campoEmail.value.trim();
  const senha = campoSenha.value;

  if (!email || !senha) {
    mostrarAlerta("Informe e-mail e senha para entrar.");
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Entrando...</span>';

  try {
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    const perfil = await buscarPerfil(credencial.user.uid);

    if (!perfil) {
      await signOut(auth);
      mostrarAlerta("Usuário autenticado, mas sem perfil cadastrado no sistema. Peça ao coordenador para criar seu cadastro.");
      return;
    }

    if (perfil.ativo === false) {
      await signOut(auth);
      mostrarAlerta("Seu cadastro está inativo. Procure a coordenação.");
      return;
    }

    window.location.href = "painel.html";
  } catch (erro) {
    console.error(erro);
    mostrarAlerta("Não foi possível entrar. Confira o e-mail e a senha.");
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i><span>Entrar no sistema</span>';
  }
}

async function enviarRedefinicaoSenha() {
  ocultarAlerta();
  const email = campoEmail.value.trim();

  if (!email) {
    mostrarAlerta("Informe seu e-mail cadastrado para receber o link de redefinição de senha.");
    campoEmail.focus();
    return;
  }

  botaoEsqueciSenha.disabled = true;
  botaoEsqueciSenha.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>Enviando link...</span>';

  try {
    await sendPasswordResetEmail(auth, email);
    mostrarSucesso("Enviamos um link de redefinição de senha para o e-mail informado. Confira sua caixa de entrada e o spam.");
  } catch (erro) {
    console.error(erro);
    mostrarAlerta("Não foi possível enviar o link de redefinição. Confira se o e-mail está correto e se ele foi cadastrado no sistema.");
  } finally {
    botaoEsqueciSenha.disabled = false;
    botaoEsqueciSenha.innerHTML = '<i class="fa-solid fa-key" aria-hidden="true"></i><span>Esqueci minha senha</span>';
  }
}

function alternarSenhaLogin() {
  if (!campoSenha || !botaoToggleSenha) return;
  const deveMostrar = campoSenha.type === "password";
  campoSenha.type = deveMostrar ? "text" : "password";
  botaoToggleSenha.innerHTML = deveMostrar ? '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>' : '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
  botaoToggleSenha.setAttribute("aria-label", deveMostrar ? "Ocultar senha" : "Mostrar senha");
  botaoToggleSenha.setAttribute("title", deveMostrar ? "Ocultar senha" : "Mostrar senha");
  campoSenha.focus();
}

if (formularioLogin) {
  formularioLogin.addEventListener("submit", entrar);
  if (botaoEsqueciSenha) botaoEsqueciSenha.addEventListener("click", enviarRedefinicaoSenha);
  if (botaoToggleSenha) botaoToggleSenha.addEventListener("click", alternarSenhaLogin);

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) return;
    const perfil = await buscarPerfil(usuario.uid);
    if (perfil && perfil.ativo !== false) {
      window.location.href = "painel.html";
    }
  });
}
