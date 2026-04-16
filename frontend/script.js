const API_URL = "/api/cards";
const DEBTS_STORAGE_KEY = "cardcontrol_debts_v1";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const showAllBtn = document.getElementById("showAllBtn");
const cardForm = document.getElementById("cardForm");
const formMessage = document.getElementById("formMessage");
const monthlyDebt = document.getElementById("monthlyDebt");
const activeFilter = document.getElementById("activeFilter");
const limitsContainer = document.getElementById("limitsContainer");
const summaryBody = document.getElementById("summaryBody");

const debtCardSelect = document.getElementById("debtCardSelect");
const debtMonthSelect = document.getElementById("debtMonthSelect");
const debtAmountInput = document.getElementById("debtAmountInput");
const addDebtBtn = document.getElementById("addDebtBtn");
const editDebtBtn = document.getElementById("editDebtBtn");
const cancelEditDebtBtn = document.getElementById("cancelEditDebtBtn");
const deleteDebtBtn = document.getElementById("deleteDebtBtn");
const debtFormMessage = document.getElementById("debtFormMessage");
const debtsBoards = document.getElementById("debtsBoards");

const totalLimit = document.getElementById("totalLimit");
const totalBalance = document.getElementById("totalBalance");
const totalDebt = document.getElementById("totalDebt");
const totalAvailable = document.getElementById("totalAvailable");

let cardsData = [];
let debtsData = [];
let selectedFilter = null;
let selectedDebtId = null;
let editingDebtId = null;

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN"
  });
}

function cardLabel(card) {
  return `${card.cardName}(${card.bank})`;
}

function loadDebts() {
  try {
    const raw = localStorage.getItem(DEBTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    debtsData = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("No se pudieron cargar deudas locales", error);
    debtsData = [];
  }
}

function saveDebts() {
  localStorage.setItem(DEBTS_STORAGE_KEY, JSON.stringify(debtsData));
}

function getActiveMonthYear() {
  if (selectedFilter) return selectedFilter;

  return {
    month: Number(monthSelect.value),
    year: Number(yearSelect.value)
  };
}

function normalizeCard(card) {
  return {
    ...card,
    limit: Number(card.balance || 0),
    currentBalance: Number(card.currentBalance || 0)
  };
}

function fillMonthYearSelectors() {
  monthSelect.innerHTML = monthNames
    .map((month, i) => `<option value="${i}">${month}</option>`)
    .join("");

  debtMonthSelect.innerHTML = monthNames
    .map((month, i) => `<option value="${i}">${month}</option>`)
    .join("");

  const currentYear = new Date().getFullYear();
  let yearOptions = "";
  for (let year = currentYear; year <= currentYear + 2; year += 1) {
    yearOptions += `<option value="${year}">${year}</option>`;
  }
  yearSelect.innerHTML = yearOptions;

  monthSelect.value = String(new Date().getMonth());
  debtMonthSelect.value = String(new Date().getMonth());
  yearSelect.value = String(currentYear);
}

function getStatus(available, limit) {
  if (limit <= 0) return "sin datos";

  const usage = (limit - available) / limit;
  if (usage < 0.5) return "estable";
  if (usage < 0.8) return "atencion";
  return "alto";
}

function getDebtsForCard(cardId) {
  return debtsData.filter((debt) => debt.cardId === cardId);
}

function getDebtSumForCard(cardId, month, year) {
  return debtsData
    .filter((debt) => {
      if (debt.cardId !== cardId) return false;
      if (month === undefined || year === undefined) return true;
      return debt.month === month && debt.year === year;
    })
    .reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
}

function getTotalDebtForCard(cardId) {
  return getDebtSumForCard(cardId);
}

function getCombinedBalance(card) {
  return Number(card.currentBalance || 0) + getTotalDebtForCard(card.id);
}

function fillDebtCardOptions(cards) {
  if (!cards.length) {
    debtCardSelect.innerHTML = "<option value=\"\">Sin tarjetas</option>";
    return;
  }

  debtCardSelect.innerHTML = cards
    .map((card) => `<option value="${card.id}">${cardLabel(card)}</option>`)
    .join("");
}

function resetDebtEditor() {
  editingDebtId = null;
  addDebtBtn.textContent = "Agregar deuda";
  debtAmountInput.value = "";
}

function renderLimitEditor(cards) {
  if (!cards.length) {
    limitsContainer.innerHTML = "<p>No hay tarjetas registradas.</p>";
    return;
  }

  limitsContainer.innerHTML = cards
    .map((card) => `
      <div class="limit-row" data-id="${card.id}">
        <span class="limit-card-name">${cardLabel(card)}</span>
        <input type="number" min="0" step="0.01" class="limit-input" value="${card.limit.toFixed(2)}">
        <input type="number" min="0" step="0.01" class="balance-input" value="${getCombinedBalance(card).toFixed(2)}">
        <button class="update-btn" type="button">Actualizar</button>
        <button class="delete-btn" type="button">Eliminar</button>
      </div>
    `)
    .join("");

  limitsContainer.querySelectorAll(".update-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const row = event.target.closest(".limit-row");
      const id = row.getAttribute("data-id");
      const limitValue = Number(row.querySelector(".limit-input").value);
      const balanceValue = Number(row.querySelector(".balance-input").value);
      const debtTotal = getTotalDebtForCard(id);

      if (!Number.isFinite(limitValue) || limitValue < 0 || !Number.isFinite(balanceValue) || balanceValue < 0) {
        formMessage.textContent = "Ingresa limite y saldo validos.";
        return;
      }

      const currentBalance = Math.max(0, balanceValue - debtTotal);

      try {
        await updateCard(id, { balance: limitValue, currentBalance });
        cardsData = cardsData.map((card) => (
          card.id === id ? { ...card, limit: limitValue, currentBalance } : card
        ));
        formMessage.textContent = "Tarjeta actualizada correctamente.";
        renderAll();
      } catch (error) {
        console.error(error);
        formMessage.textContent = "No se pudo actualizar la tarjeta.";
      }
    });
  });

  limitsContainer.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const row = event.target.closest(".limit-row");
      const id = row.getAttribute("data-id");
      const card = cardsData.find((item) => item.id === id);
      const cardName = card ? cardLabel(card) : "esta tarjeta";

      if (!window.confirm(`¿Seguro que quieres eliminar ${cardName}?`)) {
        return;
      }

      try {
        await deleteCard(id);
        cardsData = cardsData.filter((item) => item.id !== id);
        debtsData = debtsData.filter((debt) => debt.cardId !== id);
        saveDebts();
        selectedDebtId = null;
        resetDebtEditor();
        formMessage.textContent = "Tarjeta eliminada correctamente.";
        renderAll();
      } catch (error) {
        console.error(error);
        formMessage.textContent = "No se pudo eliminar la tarjeta.";
      }
    });
  });
}

function renderDebtsBoards(cards) {
  if (!cards.length) {
    debtsBoards.innerHTML = "<p>No hay tarjetas registradas.</p>";
    return;
  }

  debtsBoards.innerHTML = cards
    .map((card) => {
      const cardDebts = getDebtsForCard(card.id).sort((a, b) => (a.year - b.year) || (a.month - b.month));

      const listHtml = cardDebts.length
        ? `<ul class="debt-list">${cardDebts
          .map((debt) => {
            const selectedClass = debt.id === selectedDebtId ? "selected" : "";
            const label = `${monthNames[debt.month]} ${debt.year}`;
            return `<li class="debt-item ${selectedClass}" data-debt-id="${debt.id}">${label} | ${money(debt.amount)}</li>`;
          })
          .join("")}</ul>`
        : "<p class=\"debt-empty\">Sin deudas registradas.</p>";

      const total = cardDebts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);

      return `
        <article class="debt-card-board">
          <h3>${cardLabel(card)}</h3>
          ${listHtml}
          <p class="debt-total">Total deuda: ${money(total)}</p>
        </article>
      `;
    })
    .join("");
}

function renderSummary(cards) {
  if (!cards.length) {
    summaryBody.innerHTML = "<tr><td colspan=\"6\">No hay tarjetas para mostrar.</td></tr>";
    totalLimit.textContent = money(0);
    totalBalance.textContent = money(0);
    totalDebt.textContent = money(0);
    totalAvailable.textContent = money(0);
    monthlyDebt.textContent = "Total deudas del mes: $0.00";
    return;
  }

  let sumLimit = 0;
  let sumBalance = 0;
  let sumDebt = 0;
  let sumAvailable = 0;
  const activeMonthYear = getActiveMonthYear();

  summaryBody.innerHTML = cards
    .map((card) => {
      const balance = getCombinedBalance(card);
      const debtValue = getDebtSumForCard(card.id, activeMonthYear.month, activeMonthYear.year);
      const available = card.limit - balance;
      const status = getStatus(available, card.limit);

      sumLimit += card.limit;
      sumBalance += balance;
      sumDebt += debtValue;
      sumAvailable += available;

      return `
        <tr>
          <td>${cardLabel(card)}</td>
          <td>${money(card.limit)}</td>
          <td>${money(balance)}</td>
          <td>${money(debtValue)}</td>
          <td>${money(available)}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");

  const monthlyDebtValue = cards.reduce(
    (sum, card) => sum + getDebtSumForCard(card.id, activeMonthYear.month, activeMonthYear.year),
    0
  );

  totalLimit.textContent = money(sumLimit);
  totalBalance.textContent = money(sumBalance);
  totalDebt.textContent = money(sumDebt);
  totalAvailable.textContent = money(sumAvailable);
  monthlyDebt.textContent = `Total deudas del mes: ${money(monthlyDebtValue)}`;
}

function renderFilterLabel() {
  if (!selectedFilter) {
    activeFilter.textContent = "Mes activo: sin filtro";
    return;
  }

  activeFilter.textContent = `Mes activo: ${monthNames[selectedFilter.month]} ${selectedFilter.year}`;
}

function renderAll() {
  renderFilterLabel();
  fillDebtCardOptions(cardsData);
  renderLimitEditor(cardsData);
  renderDebtsBoards(cardsData);
  renderSummary(cardsData);
}

async function fetchCards() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("No se pudieron obtener las tarjetas");
    }

    const rawCards = await response.json();
    cardsData = rawCards.map(normalizeCard);

    if (cardsData.length && !cardsData.some((card) => card.id === debtCardSelect.value)) {
      debtCardSelect.value = cardsData[0].id;
    }

    renderAll();
  } catch (error) {
    console.error(error);
    limitsContainer.innerHTML = "<p>Error al cargar tarjetas.</p>";
    summaryBody.innerHTML = "<tr><td colspan=\"6\">Error al cargar tarjetas.</td></tr>";
    debtsBoards.innerHTML = "<p>Error al cargar tarjetas.</p>";
  }
}

async function createCard(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar la tarjeta");
  }
}

async function updateCard(cardId, payload) {
  const response = await fetch(`${API_URL}/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("No se pudo actualizar la tarjeta");
  }
}

async function deleteCard(cardId) {
  const response = await fetch(`${API_URL}/${cardId}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("No se pudo eliminar la tarjeta");
  }
}

function createDebt() {
  if (!cardsData.length) {
    debtFormMessage.textContent = "Primero agrega al menos una tarjeta.";
    return;
  }

  const amount = Number(debtAmountInput.value);
  const cardId = debtCardSelect.value;
  const month = Number(debtMonthSelect.value);
  const year = Number(yearSelect.value || new Date().getFullYear());

  if (!cardId || !Number.isFinite(amount) || amount <= 0) {
    debtFormMessage.textContent = "Completa tarjeta, mes y monto valido.";
    return;
  }

  if (editingDebtId) {
    debtsData = debtsData.map((debt) => {
      if (debt.id !== editingDebtId) return debt;
      return { ...debt, cardId, month, year, amount };
    });
    debtFormMessage.textContent = "Deuda actualizada.";
  } else {
    debtsData.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cardId,
      month,
      year,
      amount
    });
    debtFormMessage.textContent = "Deuda agregada.";
  }

  saveDebts();
  selectedFilter = { month, year };
  monthSelect.value = String(month);
  yearSelect.value = String(year);
  resetDebtEditor();
  renderAll();
}

function prepareEditDebt() {
  if (!selectedDebtId) {
    debtFormMessage.textContent = "Selecciona una deuda para editar.";
    return;
  }

  const debt = debtsData.find((item) => item.id === selectedDebtId);
  if (!debt) {
    debtFormMessage.textContent = "No se encontro la deuda seleccionada.";
    return;
  }

  editingDebtId = debt.id;
  debtCardSelect.value = debt.cardId;
  debtMonthSelect.value = String(debt.month);
  yearSelect.value = String(debt.year);
  debtAmountInput.value = String(debt.amount);
  addDebtBtn.textContent = "Guardar cambios";
  debtFormMessage.textContent = "Editando deuda seleccionada.";
}

function cancelDebtEdit() {
  resetDebtEditor();
  debtFormMessage.textContent = "Edicion cancelada.";
}

function deleteSelectedDebt() {
  if (!selectedDebtId) {
    debtFormMessage.textContent = "Selecciona una deuda para eliminar.";
    return;
  }

  debtsData = debtsData.filter((item) => item.id !== selectedDebtId);
  selectedDebtId = null;

  if (editingDebtId) {
    editingDebtId = null;
    addDebtBtn.textContent = "Agregar deuda";
  }

  saveDebts();
  debtFormMessage.textContent = "Deuda eliminada.";
  renderAll();
}

applyFilterBtn.addEventListener("click", () => {
  selectedFilter = {
    month: Number(monthSelect.value),
    year: Number(yearSelect.value)
  };
  renderAll();
});

showAllBtn.addEventListener("click", () => {
  selectedFilter = null;
  renderAll();
});

cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const payload = {
    bank: document.getElementById("bank").value.trim(),
    cardName: document.getElementById("cardName").value.trim(),
    balance: Number(document.getElementById("balance").value),
    currentBalance: Number(document.getElementById("currentBalance").value)
  };

  try {
    await createCard(payload);
    cardForm.reset();
    formMessage.textContent = "Tarjeta guardada correctamente.";
    await fetchCards();
  } catch (error) {
    console.error(error);
    formMessage.textContent = "No se pudo guardar la tarjeta.";
  }
});

addDebtBtn.addEventListener("click", createDebt);
editDebtBtn.addEventListener("click", prepareEditDebt);
cancelEditDebtBtn.addEventListener("click", cancelDebtEdit);
deleteDebtBtn.addEventListener("click", deleteSelectedDebt);

debtsBoards.addEventListener("click", (event) => {
  const item = event.target.closest(".debt-item");
  if (!item) return;
  selectedDebtId = item.getAttribute("data-debt-id");
  renderDebtsBoards(cardsData);
});

fillMonthYearSelectors();
loadDebts();
fetchCards();
