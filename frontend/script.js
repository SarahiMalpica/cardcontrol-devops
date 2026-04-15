const API_URL = "/api/cards";

const cardForm = document.getElementById("cardForm");
const formMessage = document.getElementById("formMessage");
const limitsContainer = document.getElementById("limitsContainer");
const summaryBody = document.getElementById("summaryBody");

const totalLimit = document.getElementById("totalLimit");
const totalAvailable = document.getElementById("totalAvailable");

let cardsData = [];

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN"
  });
}

function cardLabel(card) {
  return `${card.cardName}(${card.bank})`;
}

function normalizeCard(card) {
  return {
    ...card,
    limit: Number(card.balance || 0)
  };
}

function getStatus(available, limit) {
  if (limit <= 0) return "sin datos";

  const usage = (limit - available) / limit;
  if (usage < 0.5) return "estable";
  if (usage < 0.8) return "atencion";
  return "alto";
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

      if (!Number.isFinite(limitValue) || limitValue < 0) {
        formMessage.textContent = "Ingresa un limite valido.";
        return;
      }

      try {
        await updateCard(id, { balance: limitValue });
        cardsData = cardsData.map((card) => (
          card.id === id ? { ...card, limit: limitValue } : card
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
        formMessage.textContent = "Tarjeta eliminada correctamente.";
        renderAll();
      } catch (error) {
        console.error(error);
        formMessage.textContent = "No se pudo eliminar la tarjeta.";
      }
    });
  });
}

function renderSummary(cards) {
  if (!cards.length) {
    summaryBody.innerHTML = "<tr><td colspan=\"4\">No hay tarjetas para mostrar.</td></tr>";
    totalLimit.textContent = money(0);
    totalAvailable.textContent = money(0);
    return;
  }

  let sumLimit = 0;
  let sumAvailable = 0;

  summaryBody.innerHTML = cards
    .map((card) => {
      const available = card.limit;
      const status = getStatus(available, card.limit);

      sumLimit += card.limit;
      sumAvailable += available;

      return `
        <tr>
          <td>${cardLabel(card)}</td>
          <td>${money(card.limit)}</td>
          <td>${money(available)}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");

  totalLimit.textContent = money(sumLimit);
  totalAvailable.textContent = money(sumAvailable);
}

function renderAll() {
  renderLimitEditor(cardsData);
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
    renderAll();
  } catch (error) {
    console.error(error);
    limitsContainer.innerHTML = "<p>Error al cargar tarjetas.</p>";
    summaryBody.innerHTML = "<tr><td colspan=\"4\">Error al cargar tarjetas.</td></tr>";
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

cardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const payload = {
    bank: document.getElementById("bank").value.trim(),
    cardName: document.getElementById("cardName").value.trim(),
    balance: Number(document.getElementById("balance").value)
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

fetchCards();
