# Fridge to Recipes

A small web app that suggests three recipes based on ingredients you already have. The browser sends preferences to the local Node.js server, which keeps the OpenAI API key on the server and returns structured recipe data.

## Run the web app

1. Install the dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set your `OPENAI_API_KEY`.
3. Start the server with `npm start`.
4. Open <http://localhost:3000>.

You can set `PORT` in `.env` to use a different port. The original terminal flow is still available with `npm run start:cli`.

## API

`POST /api/recipes` accepts a JSON object with an `ingredients` array and optional `dietary`, `cuisine`, `maxTime`, and `servings` values. The optional numeric values must be positive whole numbers or `null`.

Successful responses have the shape `{ "recipes": [...] }`. Invalid input returns a JSON `error` message. The endpoint limits request bodies to 16 KB.
