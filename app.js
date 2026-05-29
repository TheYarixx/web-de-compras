const STORAGE_KEY = "lista-compras-organizada";
const CATEGORY_NAMES_KEY = "lista-compras-categorias";

const baseCategories = [
  {
    id: "lacteos",
    name: "Lacteos",
    color: "var(--dairy)",
    words: ["leche", "queso", "yogur", "yogurt", "mantequilla", "crema", "kumis", "cuajada"],
  },
  {
    id: "verduras",
    name: "Verduras",
    color: "var(--veg)",
    words: [
      "tomate",
      "cebolla",
      "lechuga",
      "zanahoria",
      "papa",
      "pepino",
      "brocoli",
      "espinaca",
      "cilantro",
      "ajo",
      "verdura",
      "aguacate",
    ],
  },
  {
    id: "frutas",
    name: "Frutas",
    color: "var(--fruit)",
    words: ["manzana", "banano", "banana", "pera", "uva", "naranja", "limon", "mango", "fresa", "pina", "fruta"],
  },
  {
    id: "carnes",
    name: "Carnes y huevos",
    color: "#9f1239",
    words: ["pollo", "carne", "res", "cerdo", "pescado", "atun", "salmon", "huevo", "jamon", "salchicha"],
  },
  {
    id: "despensa",
    name: "Despensa",
    color: "var(--grain)",
    words: ["arroz", "pasta", "pan", "arepa", "harina", "azucar", "sal", "aceite", "cafe", "lenteja", "frijol", "garbanzo", "avena", "cereal"],
  },
  {
    id: "aseo",
    name: "Aseo",
    color: "var(--clean)",
    words: ["jabon", "detergente", "shampoo", "champu", "papel", "servilleta", "cloro", "limpiador", "crema dental", "desodorante", "aseo"],
  },
  {
    id: "hogar",
    name: "Hogar",
    color: "var(--home)",
    words: ["bolsa", "pilas", "foco", "bombillo", "vela", "aluminio", "toalla", "esponja"],
  },
  {
    id: "otros",
    name: "Otros",
    color: "#475569",
    words: [],
  },
];

let categoryNames = loadCategoryNames();
let items = loadItems();
let currentFilter = "all";

const form = document.querySelector("#itemForm");
const itemInput = document.querySelector("#itemInput");
const qtyInput = document.querySelector("#qtyInput");
const categoryList = document.querySelector("#categoryList");
const pendingCount = document.querySelector("#pendingCount");
const doneCount = document.querySelector("#doneCount");
const categoryCount = document.querySelector("#categoryCount");
const clearDone = document.querySelector("#clearDone");
const filterButtons = document.querySelectorAll(".filter-button");
const emptyTemplate = document.querySelector("#emptyTemplate");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanText(itemInput.value);
  const quantity = Math.max(1, Number(qtyInput.value) || 1);

  if (!name) return;

  const existing = items.find((item) => normalize(item.name) === normalize(name) && !item.done);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.unshift({
      id: crypto.randomUUID(),
      name,
      quantity,
      category: detectCategory(name).id,
      done: false,
      createdAt: Date.now(),
    });
  }

  itemInput.value = "";
  qtyInput.value = "1";
  itemInput.focus();
  saveAndRender();
});

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;

  const action = button.dataset.action;
  if (action === "toggle") item.done = !item.done;
  if (action === "remove") items = items.filter((entry) => entry.id !== item.id);
  if (action === "increase") item.quantity += 1;
  if (action === "decrease") {
    item.quantity -= 1;
    if (item.quantity <= 0) items = items.filter((entry) => entry.id !== item.id);
  }

  saveAndRender();
});

categoryList.addEventListener("change", (event) => {
  const target = event.target;
  const item = items.find((entry) => entry.id === target.dataset.id);

  if (target.dataset.action === "rename-item" && item) {
    const name = cleanText(target.value);
    if (name) {
      item.name = name;
      item.category = item.category || detectCategory(name).id;
    }
    saveAndRender();
  }

  if (target.dataset.action === "move-item" && item) {
    item.category = target.value;
    saveAndRender();
  }

  if (target.dataset.action === "rename-category") {
    const category = getCategoryById(target.dataset.categoryId);
    const name = cleanText(target.value);
    categoryNames[category.id] = name || category.name;
    saveCategoryNames();
    render();
  }
});

categoryList.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.matches("input[data-action]")) {
    event.preventDefault();
    event.target.blur();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((entry) => entry.classList.toggle("active", entry === button));
    render();
  });
});

clearDone.addEventListener("click", () => {
  items = items.filter((item) => !item.done);
  saveAndRender();
});

function render() {
  const visibleItems = getVisibleItems();
  const grouped = groupByCategory(visibleItems);
  const activeCategories = groupByCategory(items).length;

  pendingCount.textContent = String(items.filter((item) => !item.done).length);
  doneCount.textContent = String(items.filter((item) => item.done).length);
  categoryCount.textContent = String(activeCategories);

  categoryList.innerHTML = "";

  if (!visibleItems.length) {
    categoryList.append(emptyTemplate.content.cloneNode(true));
    return;
  }

  grouped.forEach(({ category, entries }) => {
    const card = document.createElement("article");
    card.className = "category-card";
    card.style.setProperty("--category-color", category.color);

    const pending = entries.filter((item) => !item.done).length;
    card.innerHTML = `
      <header class="category-header">
        <div class="category-title">
          <span class="category-dot" aria-hidden="true"></span>
          <input
            class="category-name-input"
            data-action="rename-category"
            data-category-id="${category.id}"
            value="${escapeHtml(getCategoryName(category.id))}"
            aria-label="Nombre de categoria ${escapeHtml(getCategoryName(category.id))}"
          />
        </div>
        <span class="category-count">${pending} falta${pending === 1 ? "" : "n"}</span>
      </header>
      <div class="items"></div>
    `;

    const list = card.querySelector(".items");
    entries
      .sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, "es"))
      .forEach((item) => list.append(createItemNode(item)));

    categoryList.append(card);
  });
}

function createItemNode(item) {
  const row = document.createElement("div");
  row.className = `shopping-item${item.done ? " done" : ""}`;
  row.innerHTML = `
    <button class="check-button" type="button" data-action="toggle" data-id="${item.id}" aria-label="Marcar ${escapeHtml(item.name)}">
      &#10003;
    </button>
    <input
      class="item-name-input"
      data-action="rename-item"
      data-id="${item.id}"
      value="${escapeHtml(item.name)}"
      aria-label="Editar producto ${escapeHtml(item.name)}"
    />
    <select class="category-select" data-action="move-item" data-id="${item.id}" aria-label="Mover ${escapeHtml(item.name)} de categoria">
      ${createCategoryOptions(item.category)}
    </select>
    <div class="quantity-control" aria-label="Cantidad de ${escapeHtml(item.name)}">
      <button type="button" data-action="decrease" data-id="${item.id}" aria-label="Restar">-</button>
      <span>${item.quantity}</span>
      <button type="button" data-action="increase" data-id="${item.id}" aria-label="Sumar">+</button>
    </div>
    <button class="delete-button" type="button" data-action="remove" data-id="${item.id}" aria-label="Eliminar ${escapeHtml(item.name)}">x</button>
  `;
  return row;
}

function groupByCategory(sourceItems) {
  return baseCategories
    .map((category) => ({
      category,
      entries: sourceItems.filter((item) => normalizeCategoryId(item.category) === category.id),
    }))
    .filter((group) => group.entries.length);
}

function detectCategory(name) {
  const text = normalize(name);
  return baseCategories.find((category) => category.words.some((word) => text.includes(normalize(word)))) || getCategoryById("otros");
}

function createCategoryOptions(selectedCategory) {
  return baseCategories
    .map((category) => {
      const selected = category.id === normalizeCategoryId(selectedCategory) ? " selected" : "";
      return `<option value="${category.id}"${selected}>${escapeHtml(getCategoryName(category.id))}</option>`;
    })
    .join("");
}

function getCategoryById(categoryId) {
  return baseCategories.find((category) => category.id === normalizeCategoryId(categoryId)) || baseCategories.at(-1);
}

function getCategoryName(categoryId) {
  const category = getCategoryById(categoryId);
  return categoryNames[category.id] || category.name;
}

function normalizeCategoryId(value) {
  const known = baseCategories.find((category) => category.id === value || category.name === value);
  if (known) return known.id;

  const byCustomName = baseCategories.find((category) => normalize(getCategoryName(category.id)) === normalize(String(value || "")));
  return byCustomName ? byCustomName.id : "otros";
}

function getVisibleItems() {
  if (currentFilter === "pending") return items.filter((item) => !item.done);
  if (currentFilter === "done") return items.filter((item) => item.done);
  return items;
}

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  render();
}

function saveCategoryNames() {
  localStorage.setItem(CATEGORY_NAMES_KEY, JSON.stringify(categoryNames));
}

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved)
      ? saved.map((item) => ({
          ...item,
          category: normalizeCategoryId(item.category),
        }))
      : [];
  } catch {
    return [];
  }
}

function loadCategoryNames() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORY_NAMES_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

render();
