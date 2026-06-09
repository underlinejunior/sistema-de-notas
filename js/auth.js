import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { COLECOES } from "./colecoes.js";
import { $, $$, protegerTexto } from "./utils.js";

const formularioLogin = $("#form-login");
const campoEmail = $("#email");
const campoSenha = $("#senha");
const botaoEntrar = $("#botao-entrar");
const botaoRecuperarSenha = $("#botao-recuperar-senha");
const alerta = $("#alerta-login");

function mostrarAlerta(mensagem, tipo = "erro") {
  if (!alerta) return;
  alerta.className = `alerta ${tipo === "sucesso" ? "alerta-sucesso" : ""}`.trim();
  alerta.innerHTML = protegerTexto(mensagem);
  alerta.hidden = false;
}

function ocultarAlerta() {
  if (!alerta) return;
  alerta.hidden = true;
  alerta.textContent = "";
  alerta.className = "alerta";
}

function alternarVisibilidadeSenha(botao) {
  const campoId = botao.dataset.alternarSenha;
  const campo = campoId ? document.getElementById(campoId) : null;
  if (!campo) return;

  const vaiMostrar = campo.type === "password";
  campo.type = vaiMostrar ? "text" : "password";
  botao.textContent = vaiMostrar ? "🙈" : "👁";
  botao.setAttribute("aria-label", vaiMostrar ? "Ocultar senha" : "Mostrar senha");
  botao.setAttribute("title", vaiMostrar ? "Ocultar senha" : "Mostrar senha");
}

async function recuperarSenha() {
  ocultarAlerta();

  const email = campoEmail.value.trim();
  if (!email) {
    mostrarAlerta("Digite seu e-mail no campo acima para receber o link de recuperação.");
    campoEmail.focus();
    return;
  }

  botaoRecuperarSenha.disabled = true;
  botaoRecuperarSenha.textContent = "Enviando link...";

  try {
    await sendPasswordResetEmail(auth, email);
    mostrarAlerta("Enviamos um link de recuperação para esse e-mail. Verifique também a caixa de spam.", "sucesso");
  } catch (erro) {
    console.error(erro);
    mostrarAlerta("Não foi possível enviar o link de recuperação. Confira se o e-mail está correto.");
  } finally {
    botaoRecuperarSenha.disabled = false;
    botaoRecuperarSenha.textContent = "Esqueci minha senha";
  }
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
  botaoEntrar.textContent = "Entrando...";

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
    botaoEntrar.textContent = "Entrar no sistema";
  }
}

if (formularioLogin) {
  formularioLogin.addEventListener("submit", entrar);

  $$('[data-alternar-senha]').forEach((botao) => {
    botao.addEventListener("click", () => alternarVisibilidadeSenha(botao));
  });

  if (botaoRecuperarSenha) {
    botaoRecuperarSenha.addEventListener("click", recuperarSenha);
  }

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) return;
    const perfil = await buscarPerfil(usuario.uid);
    if (perfil && perfil.ativo !== false) {
      window.location.href = "painel.html";
    }
  });
}
