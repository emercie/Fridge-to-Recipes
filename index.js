require("dotenv").config();

const readline = require("node:readline/promises");
const { generateRecipes } = require("./recipe-service");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function askPositiveNumber(question) {
  while (true) {
    const answer = (await rl.question(question)).trim();
    if (answer === "") return null;

    const number = Number(answer);
    if (Number.isInteger(number) && number > 0) return number;
    console.log("Please enter a positive whole number.");
  }
}

function displayRecipes(recipes) {
  recipes.forEach((recipe, index) => {
    console.log(`\n========== RECIPE ${index + 1} ==========`);
    console.log(`Title: ${recipe.title}`);
    console.log(`Cooking time: ${recipe.cookTimeMinutes} minutes`);
    console.log("\nIngredients:");
    recipe.ingredients.forEach((ingredient) => {
      const status = ingredient.missing ? "[MISSING]" : "[IN FRIDGE]";
      console.log(`- ${ingredient.amount} ${ingredient.name} ${status}`);
    });
    console.log("\nInstructions:");
    recipe.instructions.forEach((step, stepIndex) => console.log(`${stepIndex + 1}. ${step}`));
  });
}

async function main() {
  console.log("Welcome to Fridge-to-Recipes!");
  console.log("Let's find something delicious to cook!\n");

  let ingredients = [];
  while (ingredients.length === 0) {
    const answer = await rl.question("What ingredients do you have? (separate with commas): ");
    ingredients = [...new Set(answer.split(",").map((item) => item.trim()).filter(Boolean))];
    if (ingredients.length === 0) console.log("Please enter at least one ingredient.");
  }

  const dietary = (await rl.question("Any dietary restrictions? (optional): ")).trim();
  const cuisine = (await rl.question("Preferred cuisine? (optional): ")).trim();
  const maxTime = await askPositiveNumber("Maximum cooking time in minutes? (optional): ");
  const servings = await askPositiveNumber("Number of servings? (optional): ");

  console.log("\nGenerating 3 recipes using AI...");
  displayRecipes(await generateRecipes({ ingredients, dietary, cuisine, maxTime, servings }));
}

main()
  .catch((error) => {
    if (error.status === 401) console.error("Invalid API key. Check your .env file.");
    else if (error.status === 429) console.error("API rate limit or quota reached.");
    else console.error("Error:", error.message);
  })
  .finally(() => rl.close());
