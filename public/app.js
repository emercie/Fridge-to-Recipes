const form = document.querySelector("#recipe-form");
const results = document.querySelector("#results");
const submitButton = form.querySelector("button[type='submit']");

function readPositiveInteger(value) {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function renderRecipes(recipes) {
  results.innerHTML = `
    <div class="results-heading"><div><p>MADE FOR YOUR FRIDGE</p><h2>Tonight's possibilities</h2></div><span class="recipe-count">${recipes.length} IDEAS</span></div>
    ${recipes.map((recipe, index) => `
      <article class="recipe-card">
        <div class="recipe-top"><div><h3>${escapeHtml(recipe.title)}</h3></div><span class="time-pill">◷ ${recipe.cookTimeMinutes} min</span></div>
        <details ${index === 0 ? "open" : ""}>
          <summary>Ingredients & method</summary>
          <ul class="ingredient-list">${recipe.ingredients.map((ingredient) => `<li class="${ingredient.missing ? "missing" : ""}">${escapeHtml(ingredient.amount)} ${escapeHtml(ingredient.name)}${ingredient.missing ? " · missing" : ""}</li>`).join("")}</ul>
          <ol>${recipe.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
        </details>
      </article>`).join("")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const rawIngredients = String(formData.get("ingredients") || "");
  const ingredients = [...new Set(rawIngredients.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
  const maxTimeInput = String(formData.get("maxTime") || "");
  const servingsInput = String(formData.get("servings") || "");
  const maxTime = readPositiveInteger(maxTimeInput);
  const servings = readPositiveInteger(servingsInput);

  if (ingredients.length === 0) {
    results.innerHTML = '<p class="status error" role="alert">Add at least one ingredient so we know where to start.</p>';
    return;
  }
  if ((maxTimeInput.trim() && maxTime === null) || (servingsInput.trim() && servings === null)) {
    results.innerHTML = '<p class="status error" role="alert">Time and servings must be positive whole numbers.</p>';
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span:first-child").textContent = "Finding good things…";
  results.setAttribute("aria-busy", "true");
  results.innerHTML = '<p class="status loading">Looking through the possibilities…</p>';

  try {
    const response = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients,
        dietary: String(formData.get("dietary") || ""),
        cuisine: String(formData.get("cuisine") || ""),
        maxTime,
        servings
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate recipes. Please try again.");
    renderRecipes(data.recipes);
  } catch (error) {
    results.innerHTML = `<p class="status error" role="alert">${escapeHtml(error.message || "Something went wrong. Please try again.")}</p>`;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span:first-child").textContent = "Find my recipes";
    results.setAttribute("aria-busy", "false");
  }
});
