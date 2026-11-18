import { Fragment, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { createSeed } from "@/lib/erp/seed";
import { useErp } from "@/lib/erp/store";
import { useSession } from "@/lib/erp/session";

// Environnement jsdom : APIs utilisées par Recharts / Radix
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  // Le shell HTML (balises <html>, feuilles de style) n'a pas sa place dans jsdom
  const root = routeTree.options as { shellComponent?: unknown; head?: unknown };
  root.shellComponent = ({ children }: { children: ReactNode }) => <Fragment>{children}</Fragment>;
  root.head = undefined;
});

afterEach(() => cleanup());

const seed = createSeed();
const ids = {
  client: seed.clients.find((c) => c.commercialId === "u-youssef")!.id,
  devis: seed.devis.find((d) => d.commercialId === "u-youssef")!.id,
  devisModifiable: seed.devis.find((d) => d.commercialId === "u-youssef" && !d.commandeId)!.id,
  commande: seed.commandes.find((c) => c.commercialId === "u-youssef")!.id,
  facture: seed.factures.find((f) => f.commercialId === "u-youssef")!.id,
};

const COMMUNES = [
  "/tableau-de-bord",
  "/produits",
  "/stocks",
  "/clients",
  `/clients/${ids.client}`,
  "/devis",
  "/devis/nouveau",
  `/devis/${ids.devis}`,
  `/devis/${ids.devisModifiable}/modifier`,
  "/commandes",
  "/commandes/nouvelle",
  `/commandes/${ids.commande}`,
  "/factures",
  `/factures/${ids.facture}`,
  "/notifications",
  "/activites",
];
const ADMIN = [
  ...COMMUNES,
  "/paiements",
  "/fournisseurs",
  "/commerciaux",
  "/commerciaux/u-youssef",
  "/rapports",
  "/parametres",
];
const COMMERCIAL = [...COMMUNES, "/performances"];

async function renderAs(userId: string, path: string) {
  useErp.setState({ data: createSeed(), hydrated: true, actorId: userId });
  useSession.setState({ userId, ready: true });
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a));
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  await waitFor(() => expect(document.querySelector("main h1, main h2")).not.toBeNull(), {
    timeout: 4000,
  });
  spy.mockRestore();
  return errors;
}

describe("Toutes les pages s'affichent sans erreur", () => {
  it.each(ADMIN)("administrateur : %s", async (path) => {
    await renderAs("u-admin", path);
    expect(screen.queryByText("Cette page n'a pas pu être chargée")).toBeNull();
    expect(screen.queryByText("Page introuvable")).toBeNull();
    expect(screen.queryByText("Accès non autorisé")).toBeNull();
    expect(document.querySelector("main h1")?.textContent).toBeTruthy();
  });

  it.each(COMMERCIAL)("commercial : %s", async (path) => {
    await renderAs("u-youssef", path);
    expect(screen.queryByText("Cette page n'a pas pu être chargée")).toBeNull();
    expect(screen.queryByText("Page introuvable")).toBeNull();
    expect(screen.queryByText("Accès non autorisé")).toBeNull();
    expect(document.querySelector("main h1")?.textContent).toBeTruthy();
  });

  it.each(["/rapports", "/parametres", "/paiements", "/fournisseurs", "/commerciaux"])(
    "le commercial n'accède pas à %s",
    async (path) => {
      await renderAs("u-youssef", path);
      expect(await screen.findByText("Accès non autorisé")).toBeInTheDocument();
    },
  );
});
