const STORAGE_KEY = "pennywise-transactions";
const CATEGORIES_KEY = "pennywise-categories";
const THEME_KEY = "pennywise-theme";
const baseCategories = ["Food", "Transport", "Fun"];
const categoryStyles = {
  Food: { color: "#e47f68", icon: "◒", className: "category-food" },
  Transport: { color: "#7cabc8", icon: "↗", className: "category-transport" },
  Fun: { color: "#f2c66d", icon: "✦", className: "category-fun" },
};
const fallbackCategoryStyle = { color: "#89ae90", icon: "•", className: "category-custom" };

let transactions = loadJson(STORAGE_KEY, []);
let categories = loadJson(CATEGORIES_KEY, baseCategories);
let chart;

const form = document.querySelector("#transactionForm");
const itemNameInput = document.querySelector("#itemName");
const amountInput = document.querySelector("#amount");
const categorySelect = document.querySelector("#category");
const customCategoryInput = document.querySelector("#customCategory");
const addCategoryButton = document.querySelector("#addCategoryButton");
const formMessage = document.querySelector("#formMessage");
const transactionList = document.querySelector("#transactionList");
const totalBalance = document.querySelector("#totalBalance");
const transactionSummary = document.querySelector("#transactionSummary");
const transactionCount = document.querySelector("#transactionCount");
const sortSelect = document.querySelector("#sortSelect");
const chartEmpty = document.querySelector("#chartEmpty");
const chartLegend = document.querySelector("#chartLegend");
const themeToggle = document.querySelector("#themeToggle");

function loadJson(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) && saved.length ? saved : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

function money(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

function getCategoryStyle(category) {
  return categoryStyles[category] || fallbackCategoryStyle;
}

function renderCategories() {
  const currentCategory = categorySelect.value;
  categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  if (categories.includes(currentCategory)) categorySelect.value = currentCategory;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function renderTransactions() {
  const sortedTransactions = [...transactions];
  const sortValue = sortSelect.value;
  if (sortValue === "amount-desc") sortedTransactions.sort((a, b) => b.amount - a.amount);
  if (sortValue === "amount-asc") sortedTransactions.sort((a, b) => a.amount - b.amount);
  if (sortValue === "category") sortedTransactions.sort((a, b) => a.category.localeCompare(b.category));
  if (sortValue === "newest") sortedTransactions.sort((a, b) => b.createdAt - a.createdAt);

  transactionList.innerHTML = sortedTransactions.length
    ? sortedTransactions
        .map((transaction) => {
          const style = getCategoryStyle(transaction.category);
          return `<article class="transaction-row">
      <span class="category-icon ${style.className}" aria-hidden="true">${style.icon}</span>
      <div class="transaction-info">
        <div class="transaction-name">${escapeHtml(transaction.name)}</div>
        <div class="transaction-category">${escapeHtml(transaction.category)}</div>
      </div>
      <div class="transaction-end">
        <span class="transaction-amount">${money(transaction.amount)}</span>
        <button class="delete-button" type="button" data-delete-id="${transaction.id}" aria-label="Delete ${escapeHtml(transaction.name)}" title="Delete transaction">×</button>
      </div>
    </article>`;
        })
        .join("")
    : `<div class="empty-state"><strong>No spending logged yet</strong><span>Add your first transaction above.</span></div>`;

  totalBalance.textContent = money(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  transactionCount.textContent = transactions.length;
  transactionSummary.textContent = transactions.length === 0 ? "No transactions yet" : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"} logged`;
}

function renderChart() {
  const totals = categories.map((category) => ({ category, total: transactions.filter((transaction) => transaction.category === category).reduce((sum, transaction) => sum + transaction.amount, 0) })).filter((entry) => entry.total > 0);
  const customTotals = transactions
    .filter((transaction) => !categories.includes(transaction.category))
    .reduce((result, transaction) => {
      result[transaction.category] = (result[transaction.category] || 0) + transaction.amount;
      return result;
    }, {});
  Object.entries(customTotals).forEach(([category, total]) => totals.push({ category, total }));

  chartEmpty.hidden = totals.length > 0;
  chartLegend.innerHTML = totals
    .map((entry) => {
      const style = getCategoryStyle(entry.category);
      return `<div class="legend-item"><span class="legend-name"><span class="legend-dot" style="background:${style.color}"></span>${escapeHtml(entry.category)}</span><span class="legend-value">${money(entry.total)}</span></div>`;
    })
    .join("");

  if (typeof Chart === "undefined") return;
  if (chart) chart.destroy();
  chart = new Chart(document.querySelector("#spendingChart"), {
    type: "doughnut",
    data: {
      labels: totals.map((entry) => entry.category),
      datasets: [{ data: totals.map((entry) => entry.total), backgroundColor: totals.map((entry) => getCategoryStyle(entry.category).color), borderWidth: 0, hoverOffset: 5 }],
    },
    options: {
      cutout: "70%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${money(context.raw)}` } } },
    },
  });
}

function refresh() {
  renderTransactions();
  renderChart();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = itemNameInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categorySelect.value;
  if (!name || !amount || amount <= 0 || !category) {
    formMessage.textContent = "Please fill in the item name, amount, and category.";
    return;
  }
  transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, name, amount, category, createdAt: Date.now() });
  saveState();
  form.reset();
  formMessage.textContent = "";
  refresh();
  itemNameInput.focus();
});

addCategoryButton.addEventListener("click", () => {
  const category = customCategoryInput.value.trim();
  if (!category) {
    formMessage.textContent = "Type a category name first.";
    customCategoryInput.focus();
    return;
  }
  if (categories.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
    formMessage.textContent = "That category already exists.";
    return;
  }
  categories.push(category);
  saveState();
  renderCategories();
  categorySelect.value = category;
  customCategoryInput.value = "";
  formMessage.textContent = `“${category}” added to your categories.`;
});

transactionList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) return;
  transactions = transactions.filter((transaction) => transaction.id !== deleteButton.dataset.deleteId);
  saveState();
  refresh();
});

sortSelect.addEventListener("change", renderTransactions);

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  document.querySelector(".theme-icon").textContent = isDark ? "☾" : "☼";
  refresh();
});

if (localStorage.getItem(THEME_KEY) === "dark") {
  document.body.classList.add("dark");
  themeToggle.setAttribute("aria-label", "Switch to light mode");
  document.querySelector(".theme-icon").textContent = "☾";
}

document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
renderCategories();
refresh();
