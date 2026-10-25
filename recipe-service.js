const OpenAI = require("openai");

const recipeSchema = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          cookTimeMinutes: { type: "integer" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: { type: "string" },
                missing: { type: "boolean" }
              },
              required: ["name", "amount", "missing"],
              additionalProperties: false
            }
          },
          instructions: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["title", "cookTimeMinutes", "ingredients", "instructions"],
        additionalProperties: false
      }
    }
  },
  required: ["recipes"],
  additionalProperties: false
};

function validatePreferences(preferences) {
  if (!preferences || !Array.isArray(preferences.ingredients)) {
    throw new Error("Enter at least one ingredient.");
  }

  const ingredients = [...new Set(
    preferences.ingredients
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];

  if (ingredients.length === 0) {
    throw new Error("Enter at least one ingredient.");
  }

  for (const field of ["maxTime", "servings"]) {
    const value = preferences[field];
    if (value !== null && value !== undefined &&
      (!Number.isInteger(value) || value <= 0)) {
      throw new Error(`${field === "maxTime" ? "Maximum cooking time" : "Servings"} must be a positive whole number.`);
    }
  }

  return {
    ingredients,
    dietary: typeof preferences.dietary === "string" ? preferences.dietary.trim() : "",
    cuisine: typeof preferences.cuisine === "string" ? preferences.cuisine.trim() : "",
    maxTime: preferences.maxTime ?? null,
    servings: preferences.servings ?? null
  };
}

async function generateRecipes(preferences, apiKey = process.env.OPENAI_API_KEY) {
  if (!apiKey) {
    const error = new Error("Recipe generation is not configured. Set OPENAI_API_KEY on the server.");
    error.status = 503;
    throw error;
  }

  const validated = validatePreferences(preferences);
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  const prompt = `
You are a helpful cooking assistant.

Ingredients available in the fridge:
${validated.ingredients.join(", ")}

Dietary restrictions: ${validated.dietary || "None"}
Preferred cuisine: ${validated.cuisine || "Any"}
Maximum cooking time: ${validated.maxTime ?? "No limit"} minutes
Number of servings: ${validated.servings ?? "Not specified"}

Create exactly 3 different recipes.
Prefer the ingredients available in the fridge.
Include all ingredients needed, including seasonings.
For every ingredient, state whether it is missing from the fridge.
Adapt recipes to the dietary restrictions and serving count.
Respect the maximum cooking time when provided.
Provide clear, step-by-step cooking instructions.
`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.responses.create({
        model: "gpt-5-mini",
        instructions: "Return practical, realistic recipes.",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "recipe_suggestions",
            strict: true,
            schema: recipeSchema
          }
        }
      });

      if (!response.output_text) throw new Error("AI returned an empty response.");
      const result = JSON.parse(response.output_text);

      if (!Array.isArray(result.recipes) || result.recipes.length !== 3) {
        throw new Error("AI did not return exactly 3 recipes.");
      }
      if (validated.maxTime !== null && result.recipes.some((recipe) => recipe.cookTimeMinutes > validated.maxTime)) {
        throw new Error("A recipe exceeds the cooking time limit.");
      }

      return result.recipes;
    } catch (error) {
      const temporaryError = error.status === 429 ||
        (error.status >= 500 && error.status < 600) ||
        ["APIConnectionError", "APIConnectionTimeoutError"].includes(error.name);

      if (attempt === 1 && temporaryError) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }
      throw error;
    }
  }
}

module.exports = { generateRecipes, validatePreferences };
