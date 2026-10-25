require("dotenv").config();

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { generateRecipes } = require("./recipe-service");

const publicDirectory = path.join(__dirname, "public");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};
const maxRequestBytes = 16 * 1024;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bodyBytes = 0;
    let bodyTooLarge = false;

    request.on("data", (chunk) => {
      if (bodyTooLarge) return;

      bodyBytes += chunk.length;
      if (bodyBytes > maxRequestBytes) {
        bodyTooLarge = true;
        chunks.length = 0;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => {
      if (bodyTooLarge) return;

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "POST" && requestUrl.pathname === "/api/recipes") {
    try {
      const preferences = await readJson(request);
      const recipes = await generateRecipes(preferences);
      sendJson(response, 200, { recipes });
    } catch (error) {
      const upstreamFailure = error.status === 401 || error.status === 429 || error.status >= 500;
      const status = upstreamFailure ? 502 : (Number.isInteger(error.status) ? error.status : 400);
      const message = upstreamFailure
        ? "Recipe generation is temporarily unavailable. Please try again later."
        : error.message;
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403);
    response.end();
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Fridge to Recipes is running at http://localhost:${port}`));
