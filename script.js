import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Configuração do Firebase (Substitua com suas chaves reais)
const firebaseConfig = {
  apiKey: "AIzaSyABZ33wIrPDGKX5u5SYNJmiyO6CCeQ1qJ8",
  authDomain: "donacotaveiculos.firebaseapp.com",
  projectId: "donacotaveiculos",
  storageBucket: "donacotaveiculos.firebasestorage.app",
  messagingSenderId: "850574353815",
  appId: "1:850574353815:web:42b2c48cdf5c93e4d850d2",
  measurementId: "G-J99RE9NKYR"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let base64Image = "";
let editandoId = null; // Variável para controlar se estamos editando um registro existente

// Função auxiliar para comprimir a imagem e evitar estourar o limite de 1MB do Firestore
function comprimirImagem(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Retorna a imagem comprimida em formato Base64 (JPEG)
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
    };
  });
}

// Controle de Abas
function switchView(viewName) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  if (viewName === "cadastrar") {
    document.getElementById("view-cadastrar").classList.add("active");
    document.getElementById("btn-tab-cadastrar").classList.add("active");
  } else if (viewName === "ver") {
    document.getElementById("view-ver").classList.add("active");
    document.getElementById("btn-tab-ver").classList.add("active");
    carregarVeiculos();
  }
}

// Atrelando os eventos dos botões de navegação inferior
document.getElementById("btn-tab-cadastrar").addEventListener("click", () => {
  // Opcional: Se quiser limpar o formulário ao clicar em cadastrar manualmente saindo do modo edição
  // limparFormulario();
  switchView("cadastrar");
});

document.getElementById("btn-tab-ver").addEventListener("click", () => {
  switchView("ver");
});

// Interação com a Câmera e Conversão Otimizada para Base64
const btnTriggerCamera = document.getElementById("btn-trigger-camera");
const cameraInput = document.getElementById("camera-input");
const previewContainer = document.getElementById("photo-preview-container");

if (btnTriggerCamera) {
  btnTriggerCamera.addEventListener("click", () => {
    cameraInput.click();
  });
}

if (cameraInput) {
  cameraInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        base64Image = await comprimirImagem(file);
        previewContainer.innerHTML = `<img src="${base64Image}" alt="Foto do veículo">`;
      } catch (error) {
        console.error("Erro ao processar imagem:", error);
        alert("Erro ao carregar a foto.");
      }
    }
  });
}

// Função para resetar o formulário e o estado de edição
function limparFormulario() {
  const formVeiculo = document.getElementById("form-veiculo");
  if (formVeiculo) formVeiculo.reset();
  previewContainer.innerHTML = `<span id="photo-placeholder">Nenhuma foto capturada</span>`;
  base64Image = "";
  editandoId = null;
  
  // Opcional: Mudar o texto do botão de envio de volta para "Cadastrar" se houver um
  const btnSubmit = document.getElementById("btn-submit-veiculo");
  if (btnSubmit) btnSubmit.innerText = "Cadastrar Veículo";
}

// Envio do Formulário para o Firestore (Salvar ou Atualizar)
const formVeiculo = document.getElementById("form-veiculo");
const loadingOverlay = document.getElementById("loading-overlay");

if (formVeiculo) {
  formVeiculo.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (loadingOverlay) loadingOverlay.style.display = "flex";

    const condutor = document.getElementById("condutor").value.trim();
    const veiculo = document.getElementById("veiculo").value.trim();
    const placa = document.getElementById("placa").value.trim().toUpperCase();
    const cor = document.getElementById("cor").value.trim();
    const observacoes = document.getElementById("observacoes").value.trim();

    try {
      const dadosVeiculo = {
        condutor,
        veiculo,
        placa,
        cor,
        observacoes,
        fotoUrl: base64Image,
      };

      if (editandoId) {
        // Se estiver editando, atualiza o documento existente
        await updateDoc(doc(db, "veiculos", editandoId), dadosVeiculo);
        alert("Veículo atualizado com sucesso!");
      } else {
        // Se for novo, adiciona com a data de criação
        dadosVeiculo.dataCriacao = serverTimestamp();
        await addDoc(collection(db, "veiculos"), dadosVeiculo);
        alert("Veículo cadastrado com sucesso!");
      }

      limparFormulario();
      switchView("ver");
    } catch (error) {
      console.error("Erro ao salvar veículo: ", error);
      alert("Erro ao salvar cadastro. A imagem pode estar muito grande ou houve falha na rede.");
    } finally {
      if (loadingOverlay) loadingOverlay.style.display = "none";
    }
  });
}

// Carregar Veículos do Firestore
let todosVeiculos = [];

async function carregarVeiculos() {
  const listaContainer = document.getElementById("lista-veiculos");
  if (!listaContainer) return;

  listaContainer.innerHTML =
    "<p style='text-align:center; color:#888;'>Carregando registros...</p>";

  try {
    const q = query(collection(db, "veiculos"), orderBy("dataCriacao", "desc"));
    const querySnapshot = await getDocs(q);

    todosVeiculos = [];
    querySnapshot.forEach((doc) => {
      todosVeiculos.push({ id: doc.id, ...doc.data() });
    });

    renderizarLista(todosVeiculos);
  } catch (error) {
    console.error("Erro ao buscar veículos: ", error);
    listaContainer.innerHTML =
      "<p style='text-align:center; color:red;'>Erro ao carregar os dados. Verifique o console.</p>";
  }
}

function renderizarLista(dados) {
  const listaContainer = document.getElementById("lista-veiculos");
  if (!listaContainer) return;

  listaContainer.innerHTML = "";

  if (dados.length === 0) {
    listaContainer.innerHTML =
      "<p style='text-align:center; color:#888;'>Nenhum veículo encontrado.</p>";
    return;
  }

  dados.forEach((item) => {
    const card = document.createElement("div");
    card.className = "vehicle-card";

    const fotoTag = item.fotoUrl
      ? `<img src="${item.fotoUrl}" alt="Foto do veículo">`
      : `<div style="height:100px; background:#eee; display:flex; align-items:center; justify-content:center; color:#999; font-size:0.8rem;">Sem foto</div>`;

    card.innerHTML = `
      ${fotoTag}
      <div class="vehicle-info">
          <h3>${item.veiculo} (${item.cor})</h3>
          <p><strong>Placa:</strong> ${item.placa}</p>
          <p><strong>Condutor:</strong> ${item.condutor}</p>
          ${item.observacoes ? `<div class="obs">Obs: ${item.observacoes}</div>` : ""}
      </div>
      <div class="card-actions">
        <button class="btn-edit" data-id="${item.id}">Editar</button>
        <button class="btn-delete" data-id="${item.id}">Deletar</button>
      </div>
    `;
    listaContainer.appendChild(card);
  });
}

// Botões de ação nos cards (edit/delete)
const listaVeiculos = document.getElementById("lista-veiculos");
if (listaVeiculos) {
  listaVeiculos.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    if (btnEdit) {
      const id = btnEdit.dataset.id;
      
      // Encontra o veículo correspondente na lista carregada
      const veiculoParaEditar = todosVeiculos.find((v) => v.id === id);
      
      if (veiculoParaEditar) {
        // Preenche os inputs do formulário com os dados atuais
        document.getElementById("condutor").value = veiculoParaEditar.condutor || "";
        document.getElementById("veiculo").value = veiculoParaEditar.veiculo || "";
        document.getElementById("placa").value = veiculoParaEditar.placa || "";
        document.getElementById("cor").value = veiculoParaEditar.cor || "";
        document.getElementById("observacoes").value = veiculoParaEditar.observacoes || "";
        
        // Trata a foto existente
        base64Image = veiculoParaEditar.fotoUrl || "";
        if (base64Image) {
          previewContainer.innerHTML = `<img src="${base64Image}" alt="Foto do veículo">`;
        } else {
          previewContainer.innerHTML = `<span id="photo-placeholder">Nenhuma foto capturada</span>`;
        }

        // Define o ID que está sendo editado
        editandoId = id;

        // Se houver um botão de submit na tela, podemos mudar o texto dele para indicar edição (Opcional)
        const btnSubmit = document.getElementById("btn-submit-veiculo");
        if (btnSubmit) btnSubmit.innerText = "Salvar Alterações";

        // Alterna para a aba de cadastro/edição
        switchView("cadastrar");
      }
      return;
    }

    const btnDelete = e.target.closest(".btn-delete");
    if (btnDelete) {
      const id = btnDelete.dataset.id;
      if (confirm("Deseja realmente excluir este veículo?")) {
        try {
          await deleteDoc(doc(db, "veiculos", id));
          await carregarVeiculos();
        } catch (err) {
          console.error("Erro ao excluir:", err);
          alert("Falha ao excluir o veículo.");
        }
      }
      return;
    }
  });
}

// Barra de Pesquisa em tempo real
const searchInput = document.getElementById("search-input");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const termo = e.target.value.toLowerCase();
    const filtrados = todosVeiculos.filter(
      (v) =>
        (v.placa && v.placa.toLowerCase().includes(termo)) ||
        (v.condutor && v.condutor.toLowerCase().includes(termo)) ||
        (v.veiculo && v.veiculo.toLowerCase().includes(termo)),
    );
    renderizarLista(filtrados);
  });
}