import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { COLECOES } from "./colecoes.js";
import { $, protegerTexto } from "./utils.js";

const formularioLogin = $("#form-login");
const campoEmail = $("#email");
const campoSenha = $("#senha");
const botaoEntrar = $("#botao-entrar");
const alerta = $("#alerta-login");

function mostrarAlerta(mensagem) {
  if (!alerta) return;
  alerta.innerHTML = protegerTexto(mensagem);
  alerta.hidden = false;
}

function ocultarAlerta() {
  if (!alerta) return;
  alerta.hidden = true;
  alerta.textContent = "";
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

  onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) return;
    const perfil = await buscarPerfil(usuario.uid);
    if (perfil && perfil.ativo !== false) {
      window.location.href = "painel.html";
    }
  });
}
