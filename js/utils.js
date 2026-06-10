import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-init.js";

export const $ = (seletor, contexto = document) => contexto.querySelector(seletor);
export const $$ = (seletor, contexto = document) => Array.from(contexto.querySelectorAll(seletor));

export function protegerTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatarNumero(valor, casas = 1) {
  const numero = Number(valor || 0);
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

export function normalizarNota(valor) {
  const numero = Number(String(valor ?? "").replace(",", "."));
  if (Number.isNaN(numero)) return 0;
  if (numero < 0) return 0;
  if (numero > 10) return 10;
  return numero;
}

export function calcularMedia(nota1, nota2, nota3) {
  const n1 = normalizarNota(nota1);
  const n2 = normalizarNota(nota2);
  const n3 = normalizarNota(nota3);
  return Number(((n1 + n2 + n3) / 3).toFixed(1));
}

export function calcularSituacao(media) {
  return Number(media) >= 7 ? "aprovado" : "reprovado";
}

export function calcularPercentual(media) {
  return Number((Number(media || 0) * 10).toFixed(1));
}

export function textoSituacao(situacao) {
  const mapa = {
    cursando: "Cursando",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
    trancado: "Trancado",
    dependencia: "Dependência",
    cancelada: "Cancelada"
  };
  return mapa[situacao] || "Não informado";
}

export function classeSituacao(situacao) {
  const mapa = {
    cursando: "badge-info",
    aprovado: "badge-success",
    reprovado: "badge-danger",
    trancado: "badge-muted",
    dependencia: "badge-warning",
    cancelada: "badge-danger"
  };
  return mapa[situacao] || "badge-muted";
}

export function mostrarMensagem(texto, tipo = "sucesso") {
  const area = $("#mensagens");
  if (!area) return alert(texto);

  const item = document.createElement("div");
  item.className = `toast toast-${tipo}`;
  item.textContent = texto;
  area.appendChild(item);

  setTimeout(() => {
    item.classList.add("sumindo");
    setTimeout(() => item.remove(), 300);
  }, 3500);
}

export function mostrarCarregando(container, texto = "Carregando informações...") {
  container.innerHTML = `
    <div class="estado-vazio">
      <div class="spinner"></div>
      <p>${protegerTexto(texto)}</p>
    </div>
  `;
}

export function estadoVazio(titulo, texto = "") {
  return `
    <div class="estado-vazio">
      <strong>${protegerTexto(titulo)}</strong>
      ${texto ? `<p>${protegerTexto(texto)}</p>` : ""}
    </div>
  `;
}

export async function buscarTodos(nomeColecao, campoOrdenacao = null) {
  const ref = collection(db, nomeColecao);
  const consulta = campoOrdenacao ? query(ref, orderBy(campoOrdenacao)) : query(ref);
  const snap = await getDocs(consulta);
  return snap.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export async function buscarPorCampo(nomeColecao, campo, operador, valor) {
  const ref = collection(db, nomeColecao);
  const snap = await getDocs(query(ref, where(campo, operador, valor)));
  return snap.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
}

export async function buscarDocumento(nomeColecao, id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, nomeColecao, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function preencherSelect(select, itens, textoPadrao, valorCampo = "id", textoCampo = "nome") {
  select.innerHTML = `<option value="">${protegerTexto(textoPadrao)}</option>`;
  itens.forEach((item) => {
    const option = document.createElement("option");
    option.value = item[valorCampo];
    option.textContent = item[textoCampo] || item.nome || item.email || item.id;
    select.appendChild(option);
  });
}

export function montarTabela(cabecalhos, linhasHtml) {
  if (!linhasHtml || linhasHtml.length === 0) {
    return estadoVazio("Nenhum registro encontrado.");
  }

  return `
    <div class="tabela-responsiva">
      <table>
        <thead>
          <tr>${cabecalhos.map((cab) => `<th>${protegerTexto(cab)}</th>`).join("")}</tr>
        </thead>
        <tbody>${linhasHtml.join("")}</tbody>
      </table>
    </div>
  `;
}

export function gerarIdLegivel(prefixo, texto = "") {
  const base = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${prefixo}_${base || Date.now()}`;
}
