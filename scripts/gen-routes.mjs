// Régénère src/routeTree.gen.ts sans lancer de build (utile pour la vérification TypeScript).
// Usage : node scripts/gen-routes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const file = "./src/routeTree.gen.ts";
const config = getConfig(
  { routesDirectory: "./src/routes", generatedRouteTree: file, target: "react" },
  root,
);
await new Generator({ config, root }).run();

const startBlock = `
import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
`;
const src = readFileSync(file, "utf8");
if (!src.includes("declare module '@tanstack/react-start'")) writeFileSync(file, src + startBlock);
console.log("routeTree.gen.ts régénéré");
