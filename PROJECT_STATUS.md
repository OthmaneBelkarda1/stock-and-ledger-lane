# Suivi d'avancement — ERP céramique (frontend de démonstration)

_Dernière mise à jour : 18/11/2026 — frontend complet, toutes vérifications au vert_

## Stack

- TanStack Start (React 19) + TanStack Router (routes fichiers dans `src/routes/`, `routeTree.gen.ts` généré)
- Tailwind CSS v4 + shadcn/ui, Recharts, jsPDF + html2canvas-pro (PDF), xlsx (exports Excel)
- Zustand + persistance `localStorage` (`src/lib/erp/store.ts`) — aucun backend, données fictives
- Vitest, ESLint + Prettier, TypeScript strict

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | admin@demo.ma | Admin123! |
| Commercial | commercial@demo.ma | Commercial123! |

Bascule admin ↔ commercial et réinitialisation des données : menu utilisateur (en haut à droite) ou Paramètres › Démonstration.
Bouton **« Guide de démo »** dans la barre supérieure : parcours guidé en 10 étapes (client → devis → commande → stock → facture → paiement).

## État des modules

| Module | État | Route(s) |
|---|---|---|
| Connexion + rôles simulés + contrôle d'accès par route | ✅ | `/`, garde dans `_erp.tsx` |
| Tableau de bord administrateur / commercial | ✅ | `/tableau-de-bord` |
| Mes performances (commercial) | ✅ | `/performances` |
| Catalogue produits (CRUD, filtres, tri, détail) | ✅ | `/produits` |
| Stocks (état, lots/calibres/tonalités, mouvements, alertes, dépôts, entrées/sorties/transferts/inventaire, convertisseur cartons ↔ m² ↔ pièces) | ✅ | `/stocks` |
| Clients / CRM (liste, fiche, historique) | ✅ | `/clients`, `/clients/$id` |
| Devis (création, modification, duplication, statuts, impression, PDF, transformation en commande) | ✅ | `/devis`, `/devis/nouveau`, `/devis/$id`, `/devis/$id/modifier` |
| Commandes (statuts, réservation/sortie de stock, bon de commande PDF, facturation) | ✅ | `/commandes`, `/commandes/nouvelle`, `/commandes/$id`, `/commandes/$id/modifier` |
| Factures (liste, détail, PDF, retards, soldes) | ✅ | `/factures`, `/factures/$id` |
| Paiements (espèces, virement, chèque, carte ; partiels) | ✅ | `/paiements` |
| Fournisseurs (coordonnées, produits, approvisionnements) | ✅ | `/fournisseurs` |
| Commerciaux (profils, objectifs, comparaisons, comptes) | ✅ | `/commerciaux`, `/commerciaux/$id` |
| Rapports (7 sections, filtres, graphiques, Excel, PDF) | ✅ | `/rapports` |
| Centre de notifications (+ « À traiter » calculé en direct) | ✅ | `/notifications` |
| Journal d'activité | ✅ | `/activites` |
| Paramètres (nom + logo de la société, TVA, numérotation, utilisateurs, réinitialisation) | ✅ | `/parametres` |

Accès commercial : tableau de bord, performances, produits, stocks (lecture seule), ses clients, ses devis, ses commandes, ses factures, notifications, son activité. Rapports, paiements, fournisseurs, commerciaux et paramètres sont réservés à l'administrateur.

## Qualité (dernière vérification)

| Vérification | Résultat |
|---|---|
| `npm run build` | ✅ |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur (12 avertissements « fast refresh » préexistants) |
| `npm test` | ✅ 52/52 — dont rendu de chaque page en admin et en commercial, contrôle d'accès, et parcours complet devis → paiement |

Note : `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` et `noPropertyAccessFromIndexSignature` ont été désactivés dans `tsconfig.json` (le reste du mode strict est conservé).
Après ajout d'une route : `node scripts/gen-routes.mjs` régénère `routeTree.gen.ts` sans build.

## Pistes restantes (optionnelles)

- [ ] Remplacer les 11 visuels de démonstration (réutilisés sur 19 produits) par les vraies photos du client (import possible depuis la fiche produit)
- [ ] Renseigner le nom, le logo et les mentions légales du client dans Paramètres avant la présentation
- [ ] Vérification visuelle finale dans le navigateur (ordinateur, tablette, smartphone)
- [ ] Production : backend, authentification réelle et permissions côté API (actuellement simulées)
