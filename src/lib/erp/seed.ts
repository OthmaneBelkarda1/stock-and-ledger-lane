import { DIMENSIONS_DEFAUT } from "./constants";
import { cartonsCommande, prixUnitaire, STATUTS_RESERVANTS, totaux, round2 } from "./calc";
import type {
  Activite,
  Client,
  Commande,
  CommandeStatut,
  Depot,
  Devis,
  DevisStatut,
  ErpData,
  Facture,
  LigneDoc,
  Lot,
  ModePaiement,
  Movement,
  Notification,
  Paiement,
  Product,
  Supplier,
  Unite,
  User,
} from "./types";

export const DATA_VERSION = 3;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(now = new Date()): ErpData {
  const rnd = mulberry32(20261118);
  const ri = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
  const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const daysAgo = (d: number, h = ri(8, 18), m = ri(0, 59)) => {
    const x = new Date(now);
    x.setDate(x.getDate() - d);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const addDays = (iso: string, d: number) => {
    const x = new Date(iso);
    x.setDate(x.getDate() + d);
    return x.toISOString();
  };

  /* ---------- Utilisateurs ---------- */
  const users: User[] = [
    {
      id: "u-admin",
      nom: "Administrateur",
      email: "admin@demo.ma",
      motDePasse: "Admin123!",
      role: "admin",
      telephone: "+212 6 61 00 00 01",
      dateRecrutement: daysAgo(1400),
      actif: true,
      objectifMensuel: 0,
    },
    {
      id: "u-youssef",
      nom: "Youssef Amrani",
      email: "commercial@demo.ma",
      motDePasse: "Commercial123!",
      role: "commercial",
      telephone: "+212 6 61 24 58 12",
      dateRecrutement: daysAgo(980),
      actif: true,
      objectifMensuel: 150000,
    },
    {
      id: "u-imane",
      nom: "Imane Tazi",
      email: "imane.tazi@demo.ma",
      motDePasse: "Commercial123!",
      role: "commercial",
      telephone: "+212 6 62 37 90 45",
      dateRecrutement: daysAgo(720),
      actif: true,
      objectifMensuel: 160000,
    },
    {
      id: "u-karim",
      nom: "Karim Benjelloun",
      email: "karim.benjelloun@demo.ma",
      motDePasse: "Commercial123!",
      role: "commercial",
      telephone: "+212 6 70 11 82 36",
      dateRecrutement: daysAgo(410),
      actif: true,
      objectifMensuel: 140000,
    },
  ];
  const commerciaux = users.filter((u) => u.role === "commercial");

  /* ---------- Dépôts ---------- */
  const depots: Depot[] = [
    {
      id: "d-casa",
      nom: "Dépôt principal",
      ville: "Casablanca",
      adresse: "Zone industrielle Aïn Sebaâ",
    },
    {
      id: "d-temara",
      nom: "Dépôt Témara",
      ville: "Témara",
      adresse: "Route de Rabat, zone d'activités",
    },
    { id: "d-showroom", nom: "Showroom", ville: "Casablanca", adresse: "Boulevard d'Anfa" },
  ];

  /* ---------- Fournisseurs ---------- */
  const suppliers: Supplier[] = [
    {
      id: "f-iberica",
      nom: "Ibérica Gres SL",
      contact: "Javier Morales",
      telephone: "+34 964 52 18 40",
      email: "export@iberica-gres.es",
      adresse: "Polígono Industrial, Castellón",
      ville: "Castellón",
      pays: "Espagne",
    },
    {
      id: "f-toscana",
      nom: "Ceramica Toscana SRL",
      contact: "Giulia Ferri",
      telephone: "+39 0536 81 22 70",
      email: "sales@ceramica-toscana.it",
      adresse: "Via Emilia, Sassuolo",
      ville: "Sassuolo",
      pays: "Italie",
    },
    {
      id: "f-atlas",
      nom: "Céramique Atlas SARL",
      contact: "Hicham Ouazzani",
      telephone: "+212 5 22 66 41 90",
      email: "commercial@ceramique-atlas.ma",
      adresse: "Zone industrielle Sapino",
      ville: "Casablanca",
      pays: "Maroc",
    },
    {
      id: "f-zellige",
      nom: "Coopérative Zellige de Fès",
      contact: "Abdelhak Fassi",
      telephone: "+212 5 35 64 12 77",
      email: "contact@zellige-fes.ma",
      adresse: "Quartier Ain Nokbi",
      ville: "Fès",
      pays: "Maroc",
    },
    {
      id: "f-pro",
      nom: "Pose Pro Distribution",
      contact: "Samir Bouzid",
      telephone: "+212 5 37 29 55 10",
      email: "ventes@posepro.ma",
      adresse: "Zone industrielle Takadoum",
      ville: "Rabat",
      pays: "Maroc",
    },
  ];

  /* ---------- Produits ---------- */
  type PDef = [
    string,
    Product["categorie"],
    string,
    Product["finition"],
    string,
    number,
    number,
    number,
    string,
    string,
    string,
    string,
    string,
    number,
  ];
  // nom, catégorie, dimension, finition, image, prix m², m²/carton, pièces/carton, couleur, matière, marque, collection, fournisseur, seuil
  const defs: PDef[] = [
    [
      "Calacatta Oro Poli",
      "Grès cérame",
      "60 × 120 cm",
      "Poli",
      "marbre-blanc",
      289,
      1.44,
      2,
      "Blanc veiné or",
      "Grès cérame rectifié",
      "Toscana",
      "Marmi",
      "f-toscana",
      40,
    ],
    [
      "Statuario Grand Format",
      "Grès cérame",
      "120 × 120 cm",
      "Poli",
      "marbre-blanc",
      420,
      1.44,
      1,
      "Blanc statuaire",
      "Grès cérame rectifié",
      "Toscana",
      "Marmi XL",
      "f-toscana",
      30,
    ],
    [
      "Nero Marquina",
      "Marbre",
      "60 × 60 cm",
      "Poli",
      "marbre-noir",
      650,
      1.08,
      3,
      "Noir veiné blanc",
      "Marbre naturel",
      "Ibérica",
      "Piedra Noble",
      "f-iberica",
      25,
    ],
    [
      "Carrare Blanc Naturel",
      "Marbre",
      "30 × 60 cm",
      "Poli",
      "marbre-blanc",
      540,
      1.08,
      6,
      "Blanc gris",
      "Marbre naturel",
      "Toscana",
      "Classici",
      "f-toscana",
      25,
    ],
    [
      "Béton Urbain Anthracite",
      "Carrelage intérieur",
      "60 × 60 cm",
      "Mat",
      "beton-anthracite",
      165,
      1.44,
      4,
      "Anthracite",
      "Grès émaillé",
      "Atlas",
      "Urbain",
      "f-atlas",
      60,
    ],
    [
      "Béton Urbain Anthracite XL",
      "Grès cérame",
      "80 × 80 cm",
      "Mat",
      "beton-anthracite",
      215,
      1.28,
      2,
      "Anthracite",
      "Grès cérame pleine masse",
      "Ibérica",
      "Urbain",
      "f-iberica",
      40,
    ],
    [
      "Chêne Naturel Parquet",
      "Carrelage intérieur",
      "20 × 120 cm",
      "Structuré",
      "bois-chene",
      189,
      1.44,
      6,
      "Chêne miel",
      "Grès cérame",
      "Ibérica",
      "Bosque",
      "f-iberica",
      50,
    ],
    [
      "Travertin Romain",
      "Carrelage intérieur",
      "60 × 60 cm",
      "Mat",
      "travertin-beige",
      175,
      1.44,
      4,
      "Beige",
      "Grès émaillé",
      "Atlas",
      "Pietra",
      "f-atlas",
      50,
    ],
    [
      "Travertin Terrasse Antidérapant",
      "Carrelage extérieur",
      "60 × 60 cm",
      "Antidérapant",
      "travertin-beige",
      195,
      1.44,
      4,
      "Beige sable",
      "Grès cérame R11",
      "Atlas",
      "Pietra Outdoor",
      "f-atlas",
      40,
    ],
    [
      "Pierre Grise Terrasse",
      "Carrelage extérieur",
      "45 × 45 cm",
      "Antidérapant",
      "exterieur-gris",
      129,
      1.62,
      8,
      "Gris perle",
      "Grès cérame R11",
      "Atlas",
      "Roca",
      "f-atlas",
      60,
    ],
    [
      "Pierre Grise Plage Piscine",
      "Carrelage extérieur",
      "30 × 30 cm",
      "Antidérapant",
      "exterieur-gris",
      145,
      1.08,
      12,
      "Gris clair",
      "Grès cérame R12",
      "Ibérica",
      "Roca",
      "f-iberica",
      40,
    ],
    [
      "Terrazzo Sable",
      "Grès cérame",
      "60 × 60 cm",
      "Mat",
      "terrazzo-beige",
      235,
      1.44,
      4,
      "Sable multicolore",
      "Grès cérame",
      "Toscana",
      "Venezia",
      "f-toscana",
      35,
    ],
    [
      "Terrazzo Sable Poli",
      "Grès cérame",
      "80 × 80 cm",
      "Poli",
      "terrazzo-beige",
      265,
      1.28,
      2,
      "Sable multicolore",
      "Grès cérame",
      "Toscana",
      "Venezia",
      "f-toscana",
      30,
    ],
    [
      "Faïence Bleu Majorelle",
      "Faïence",
      "30 × 60 cm",
      "Brillant",
      "faience-bleue",
      145,
      1.44,
      8,
      "Bleu Majorelle",
      "Pâte blanche",
      "Atlas",
      "Médina",
      "f-atlas",
      45,
    ],
    [
      "Faïence Bleu Indigo",
      "Faïence",
      "30 × 30 cm",
      "Brillant",
      "faience-bleue",
      119,
      1.08,
      12,
      "Bleu indigo",
      "Pâte blanche",
      "Atlas",
      "Médina",
      "f-atlas",
      40,
    ],
    [
      "Zellige Émeraude Artisanal",
      "Mosaïque",
      "10 × 10 cm",
      "Brillant",
      "zellige-vert",
      690,
      0.5,
      50,
      "Vert émeraude",
      "Terre cuite émaillée",
      "Zellige de Fès",
      "Tradition",
      "f-zellige",
      20,
    ],
    [
      "Mosaïque Hexagonale Perle",
      "Mosaïque",
      "30 × 30 cm",
      "Mat",
      "mosaique-hexagone",
      310,
      0.9,
      10,
      "Blanc et gris",
      "Porcelaine",
      "Ibérica",
      "Hexa",
      "f-iberica",
      25,
    ],
    [
      "Kit profilés aluminium",
      "Accessoires",
      "Barre 2,50 m",
      "Structuré",
      "accessoires",
      0,
      0,
      25,
      "Aluminium brossé",
      "Aluminium",
      "Pose Pro",
      "Finition",
      "f-pro",
      15,
    ],
    [
      "Joint époxy 5 kg",
      "Accessoires",
      "Seau 5 kg",
      "Mat",
      "accessoires",
      0,
      0,
      4,
      "Gris ciment",
      "Résine époxy",
      "Pose Pro",
      "Finition",
      "f-pro",
      20,
    ],
  ];
  const accessoirePrix: Record<string, number> = {
    "Kit profilés aluminium": 1450,
    "Joint époxy 5 kg": 1280,
  };
  const products: Product[] = defs.map((d, i) => {
    const [
      nom,
      categorie,
      dimension,
      finition,
      image,
      prixM2,
      m2,
      pcs,
      couleur,
      matiere,
      marque,
      collection,
      fournisseurId,
      seuilMin,
    ] = d;
    const prixCarton = categorie === "Accessoires" ? accessoirePrix[nom] : round2(prixM2 * m2);
    return {
      id: `p-${i + 1}`,
      image,
      nom,
      sku: `${categorie.slice(0, 3).toUpperCase().replace("È", "E").replace("Ï", "I")}-${String(1000 + i * 7)}`,
      marque,
      collection,
      categorie,
      dimension,
      couleur,
      finition,
      matiere,
      prixM2,
      prixCarton,
      m2ParCarton: m2,
      piecesParCarton: pcs,
      seuilMin,
      fournisseurId,
      description: `${nom} — ${matiere.toLowerCase()} au format ${dimension}, finition ${finition.toLowerCase()}. Idéal pour les projets résidentiels et professionnels haut de gamme.`,
      dateCreation: daysAgo(400 - i * 5),
    };
  });
  const tiles = products.filter((p) => p.categorie !== "Accessoires");
  const accessoiresP = products.filter((p) => p.categorie === "Accessoires");

  /* ---------- Clients ---------- */
  type CDef = [string, Client["type"], string, string, string];
  const cdefs: CDef[] = [
    [
      "Résidences Al Manar SARL",
      "Promoteur immobilier",
      "Casablanca",
      "Bd Ghandi, Maârif",
      "u-youssef",
    ],
    [
      "Atelier d'architecture Lamrani",
      "Architecte",
      "Rabat",
      "Avenue Mohammed VI, Souissi",
      "u-imane",
    ],
    ["Hôtel Riad Zitoun", "Entreprise", "Marrakech", "Derb Zitoun, Médina", "u-karim"],
    ["Bâtiment Moderne du Souss", "Entrepreneur", "Agadir", "Quartier industriel Anza", "u-karim"],
    ["Mohamed Alaoui", "Particulier", "Témara", "Hay Al Fath, Témara", "u-imane"],
    ["Comptoir Céramique de Fès", "Revendeur", "Fès", "Route d'Imouzzer", "u-karim"],
    [
      "Groupe Immobilier Nour",
      "Promoteur immobilier",
      "Tanger",
      "Boulevard Mohammed V",
      "u-youssef",
    ],
    ["Salma Berrada", "Particulier", "Casablanca", "Californie, rue des Orchidées", "u-youssef"],
    ["Studio Design Benkirane", "Architecte", "Casablanca", "Rue Ibnou Majid, Racine", "u-youssef"],
    ["Travaux Publics Chraibi", "Entrepreneur", "Salé", "Zone Technopolis", "u-imane"],
    ["Clinique Les Orangers", "Entreprise", "Rabat", "Agdal, avenue de France", "u-imane"],
    ["Rachid El Fassi", "Particulier", "Fès", "Route d'Ain Chkef", "u-karim"],
    ["Dépôt Carrelage Atlantique", "Revendeur", "Salé", "Hay Karima", "u-imane"],
    [
      "Villas Palmeraie Prestige",
      "Promoteur immobilier",
      "Marrakech",
      "Route de Fès, Palmeraie",
      "u-karim",
    ],
    ["Construction Idrissi & Fils", "Entrepreneur", "Casablanca", "Sidi Maârouf", "u-youssef"],
    ["Leila Bennis", "Particulier", "Tanger", "Malabata", "u-youssef"],
  ];
  const clients: Client[] = cdefs.map(([nom, type, ville, adresse, commercialId], i) => {
    const slug = nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .split(".")
      .slice(0, 2)
      .join(".");
    return {
      id: `c-${i + 1}`,
      nom,
      type,
      ville,
      adresse,
      commercialId,
      telephone: `+212 6 ${ri(10, 79)} ${ri(10, 99)} ${ri(10, 99)} ${ri(10, 99)}`,
      email: type === "Particulier" ? `${slug}@gmail.com` : `contact@${slug.replace(".", "-")}.ma`,
      dateCreation: daysAgo(i < 13 ? 380 - i * 9 : 20 - (i - 13) * 6),
      ice:
        type === "Particulier"
          ? undefined
          : String(ri(100000, 999999)) + String(ri(100000000, 999999999)),
    };
  });

  /* ---------- Commandes ---------- */
  const settingsTVA = 20;
  const commandes: Commande[] = [];
  const factures: Facture[] = [];
  const paiements: Paiement[] = [];
  const movements: Movement[] = [];
  let seqCmd = 0;
  let seqFac = 0;
  let seqPai = 0;
  const num = (prefix: string, iso: string, seq: number) =>
    `${prefix}-${new Date(iso).getFullYear()}-${String(seq).padStart(4, "0")}`;

  const makeLignes = (clientType: Client["type"]): LigneDoc[] => {
    const n = ri(1, clientType === "Particulier" ? 2 : 3);
    const used = new Set<string>();
    const lignes: LigneDoc[] = [];
    for (let k = 0; k < n; k++) {
      let p = pick(tiles);
      while (used.has(p.id)) p = pick(tiles);
      used.add(p.id);
      const big =
        clientType === "Promoteur immobilier" ||
        clientType === "Entrepreneur" ||
        clientType === "Revendeur";
      const unite: Unite = rnd() < 0.7 ? "carton" : "m2";
      const cartons = big ? ri(30, 110) : ri(12, 45);
      const quantite = unite === "carton" ? cartons : round2(cartons * p.m2ParCarton);
      lignes.push({
        id: `l-${k}-${ri(1000, 9999)}`,
        productId: p.id,
        designation: `${p.nom} ${p.dimension}`,
        unite,
        quantite,
        prixUnitaire: prixUnitaire(p, unite),
        remise: big ? pick([0, 5, 5, 8, 10]) : pick([0, 0, 3, 5]),
      });
    }
    if (rnd() < 0.3) {
      const a = pick(accessoiresP);
      lignes.push({
        id: `l-acc-${ri(1000, 9999)}`,
        productId: a.id,
        designation: a.nom,
        unite: "carton",
        quantite: ri(1, 4),
        prixUnitaire: a.prixCarton,
        remise: 0,
      });
    }
    return lignes;
  };

  const modes: ModePaiement[] = ["virement", "virement", "cheque", "especes", "carte"];
  const addPaiement = (f: Facture, montant: number, date: string) => {
    seqPai++;
    paiements.push({
      id: `pay-${seqPai}`,
      numero: num("PAI", date, seqPai),
      factureId: f.id,
      clientId: f.clientId,
      date,
      montant: round2(montant),
      mode: pick(modes),
      reference: `REF-${ri(100000, 999999)}`,
      note: "",
      userId: "u-admin",
    });
  };

  // Ordres de grandeur : ~11 commandes/mois, croissance progressive
  const dayOfMonth = now.getDate();
  const startDays = 365;
  const orderDays: number[] = [];
  for (let m = 11; m >= 0; m--) {
    const count =
      m === 0
        ? Math.max(4, Math.round((dayOfMonth / 30) * 12) + 2)
        : Math.round(8 + (11 - m) * 0.35 + ri(0, 2));
    for (let k = 0; k < count; k++) {
      const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const maxDay =
        m === 0 ? dayOfMonth : new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      const d = new Date(base.getFullYear(), base.getMonth(), ri(1, maxDay));
      const diff = Math.round((now.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff <= startDays) orderDays.push(diff);
    }
  }
  orderDays.push(0, 0, 1); // ventes du jour et d'hier
  orderDays.sort((a, b) => b - a);

  for (const ago of orderDays) {
    const pool = clients.filter(
      (c) => new Date(c.dateCreation).getTime() < now.getTime() - ago * 86400000,
    );
    const client = pick(pool.length ? pool : clients);
    const date = daysAgo(ago);
    let statut: CommandeStatut = "livree";
    if (ago <= 2)
      statut = pick(["en_attente", "confirmee", "confirmee", "en_attente"] as CommandeStatut[]);
    else if (ago <= 7)
      statut = pick(["confirmee", "en_preparation", "prete", "livree"] as CommandeStatut[]);
    else if (ago <= 14)
      statut = pick(["en_preparation", "prete", "livree", "livree"] as CommandeStatut[]);
    else if (rnd() < 0.05) statut = "annulee";
    seqCmd++;
    const c: Commande = {
      id: `cmd-${seqCmd}`,
      numero: num("CMD", date, seqCmd),
      clientId: client.id,
      commercialId: client.commercialId,
      date,
      dateLivraison: addDays(date, ri(3, 10)),
      statut,
      lignes: makeLignes(client.type),
      tauxTVA: settingsTVA,
      remiseGlobale: 0,
      notes: "",
      depotId: rnd() < 0.75 ? "d-casa" : "d-temara",
      stockDeduit: statut === "livree",
      dateConfirmation:
        statut === "en_attente" || statut === "annulee" ? undefined : addDays(date, 0),
    };
    commandes.push(c);

    if (STATUTS_RESERVANTS.includes(statut)) {
      for (const l of c.lignes) {
        movements.push({
          id: `mv-r-${c.id}-${l.id}`,
          date: c.dateConfirmation!,
          productId: l.productId,
          type: "reservation",
          quantite: cartonsCommande({ products }, { lignes: [l] })[l.productId] ?? 0,
          unite: "carton",
          depotId: c.depotId,
          userId: c.commercialId,
          motif: `Réservation pour la commande ${c.numero}`,
          commandeId: c.id,
        });
      }
    }

    if (statut === "livree" || (statut === "prete" && rnd() < 0.5)) {
      const livraison =
        statut === "livree" ? (ago > 10 ? c.dateLivraison : daysAgo(Math.max(0, ago - 2))) : date;
      if (statut === "livree") {
        c.dateLivraison = livraison;
        const ct = cartonsCommande({ products }, c);
        for (const [pid, q] of Object.entries(ct)) {
          movements.push({
            id: `mv-s-${c.id}-${pid}`,
            date: livraison,
            productId: pid,
            type: "sortie",
            quantite: q,
            unite: "carton",
            depotId: c.depotId,
            userId: "u-admin",
            motif: `Livraison de la commande ${c.numero}`,
            commandeId: c.id,
          });
        }
      }
      seqFac++;
      const fdate = statut === "livree" ? livraison : date;
      const f: Facture = {
        id: `fac-${seqFac}`,
        numero: num("FAC", fdate, seqFac),
        commandeId: c.id,
        clientId: c.clientId,
        commercialId: c.commercialId,
        date: fdate,
        echeance: addDays(fdate, 30),
        lignes: c.lignes,
        tauxTVA: c.tauxTVA,
        remiseGlobale: c.remiseGlobale,
        notes: "",
      };
      c.factureId = f.id;
      factures.push(f);
      const ttc = totaux(f).ttc;
      const fAgo = Math.round((now.getTime() - new Date(fdate).getTime()) / 86400000);
      const r = rnd();
      if (fAgo > 60) {
        if (r < 0.9) addPaiement(f, ttc, addDays(fdate, ri(2, 25)));
        else addPaiement(f, ttc * 0.5, addDays(fdate, ri(2, 20)));
      } else if (fAgo > 15) {
        if (r < 0.55) addPaiement(f, ttc, addDays(fdate, ri(1, Math.min(14, fAgo))));
        else if (r < 0.85)
          addPaiement(f, ttc * pick([0.3, 0.4, 0.5]), addDays(fdate, ri(1, Math.min(10, fAgo))));
      } else if (r < 0.35) {
        addPaiement(f, ttc * pick([0.3, 0.5]), addDays(fdate, Math.min(1, fAgo)));
      }
    }
  }

  /* ---------- Devis ---------- */
  const devis: Devis[] = [];
  const devisStatuts: DevisStatut[] = [
    "brouillon",
    "envoye",
    "envoye",
    "envoye",
    "accepte",
    "accepte",
    "accepte",
    "refuse",
    "expire",
    "envoye",
    "brouillon",
    "accepte",
    "envoye",
    "refuse",
    "envoye",
  ];
  devisStatuts.forEach((statut, i) => {
    const ago = statut === "expire" ? 48 : statut === "brouillon" ? ri(0, 3) : ri(2, 40);
    const date = daysAgo(ago);
    let lignes: LigneDoc[];
    let clientId: string;
    let commercialId: string;
    let commandeId: string | undefined;
    if (statut === "accepte") {
      const c = commandes.filter(
        (x) =>
          !x.devisId &&
          Math.round((now.getTime() - new Date(x.date).getTime()) / 86400000) < 40 &&
          x.statut !== "annulee",
      )[i % 6];
      if (c) {
        lignes = c.lignes;
        clientId = c.clientId;
        commercialId = c.commercialId;
        commandeId = c.id;
      } else {
        const cl = pick(clients);
        lignes = makeLignes(cl.type);
        clientId = cl.id;
        commercialId = cl.commercialId;
      }
    } else {
      const cl = pick(clients);
      lignes = makeLignes(cl.type);
      clientId = cl.id;
      commercialId = cl.commercialId;
    }
    const d: Devis = {
      id: `dev-${i + 1}`,
      numero: num("DEV", date, i + 1),
      clientId,
      commercialId,
      date: commandeId
        ? addDays(commandes.find((c) => c.id === commandeId)!.date, -ri(2, 6))
        : date,
      validite: addDays(date, 30),
      statut,
      lignes,
      tauxTVA: settingsTVA,
      remiseGlobale: 0,
      notes: "Délai de livraison : 5 à 7 jours ouvrables selon disponibilité.",
      commandeId,
    };
    if (statut === "expire") d.validite = addDays(date, 30);
    if (commandeId) commandes.find((c) => c.id === commandeId)!.devisId = d.id;
    devis.push(d);
  });
  devis.sort((a, b) => a.date.localeCompare(b.date));
  devis.forEach((d, i) => (d.numero = num("DEV", d.date, i + 1)));

  /* ---------- Stocks & lots ---------- */
  const reserveOf = (pid: string) =>
    commandes
      .filter((c) => STATUTS_RESERVANTS.includes(c.statut) && !c.stockDeduit)
      .reduce((s, c) => s + (cartonsCommande({ products }, c, pid)[pid] || 0), 0);
  // Disponibilités cibles : 1 rupture et 7 produits sous le seuil
  const cibles: Record<string, number> = {
    "p-2": 0,
    "p-3": 12,
    "p-7": 31,
    "p-11": 18,
    "p-13": 14,
    "p-16": 9,
    "p-17": 11,
    "p-19": 6,
  };
  const lots: Lot[] = [];
  const calibres = ["C1", "C2", "C3"];
  const tonalites = ["T01", "T02", "T03", "T04"];
  products.forEach((p, i) => {
    const reserve = reserveOf(p.id);
    const dispo = cibles[p.id] ?? ri(p.seuilMin + 60, p.seuilMin + 380);
    const total = reserve + dispo;
    if (total <= 0) return;
    const casa = Math.round(total * 0.7);
    const temara = total - casa;
    const parts: [string, number][] = [
      ["d-casa", casa],
      ["d-temara", temara],
    ];
    parts.forEach(([depotId, q], k) => {
      if (q <= 0) return;
      const entree = daysAgo(ri(15, 120));
      const lotNum = `L${new Date(entree).getFullYear().toString().slice(2)}${String(ri(1, 52)).padStart(2, "0")}-${String(100 + i * 3 + k)}`;
      const lot: Lot = {
        id: `lot-${p.id}-${depotId}`,
        productId: p.id,
        depotId,
        numero: lotNum,
        calibre: p.categorie === "Accessoires" ? "—" : pick(calibres),
        tonalite: p.categorie === "Accessoires" ? "—" : pick(tonalites),
        refFabrication: `RF-${ri(10000, 99999)}`,
        cartons: q,
        dateEntree: entree,
      };
      lots.push(lot);
      movements.push({
        id: `mv-e-${lot.id}`,
        date: entree,
        productId: p.id,
        type: "entree",
        quantite: q + (k === 0 ? ri(40, 160) : ri(10, 60)),
        unite: "carton",
        depotId,
        userId: "u-admin",
        motif: "Réception fournisseur",
        fournisseurId: p.fournisseurId,
        lot: lotNum,
      });
    });
  });
  // Approvisionnements historiques
  for (let k = 0; k < 18; k++) {
    const p = pick(tiles);
    movements.push({
      id: `mv-h-${k}`,
      date: daysAgo(ri(130, 360)),
      productId: p.id,
      type: "entree",
      quantite: ri(80, 300),
      unite: "carton",
      depotId: rnd() < 0.7 ? "d-casa" : "d-temara",
      userId: "u-admin",
      motif: "Réception fournisseur",
      fournisseurId: p.fournisseurId,
      lot: `L${ri(24, 25)}${String(ri(1, 52)).padStart(2, "0")}-${ri(100, 199)}`,
    });
  }
  movements.push({
    id: "mv-t-1",
    date: daysAgo(9),
    productId: "p-5",
    type: "transfert",
    quantite: 40,
    unite: "carton",
    depotId: "d-casa",
    depotDestId: "d-temara",
    userId: "u-admin",
    motif: "Rééquilibrage des dépôts",
  });
  movements.sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- Notifications & activités ---------- */
  const recentCmd = [...commandes].reverse();
  const notifications: Notification[] = [
    {
      id: "n-1",
      date: daysAgo(0, now.getHours(), Math.max(0, now.getMinutes() - 12)),
      titre: "Nouvelle commande créée",
      message: `Commande ${recentCmd[0].numero} enregistrée.`,
      niveau: "info",
      lu: false,
      cible: "admin",
      lien: `/commandes/${recentCmd[0].id}`,
    },
    {
      id: "n-2",
      date: daysAgo(0, Math.max(8, now.getHours() - 2)),
      titre: "Produit en rupture",
      message: "Statuario Grand Format 120 × 120 cm n'est plus disponible.",
      niveau: "critique",
      lu: false,
      cible: "tous",
      lien: "/stocks",
    },
    {
      id: "n-3",
      date: daysAgo(1),
      titre: "Stock faible",
      message: "Nero Marquina 60 × 60 cm est passé sous le seuil minimal.",
      niveau: "alerte",
      lu: false,
      cible: "admin",
      lien: "/stocks",
    },
    {
      id: "n-4",
      date: daysAgo(1),
      titre: "Devis accepté",
      message: `Le devis ${devis.find((d) => d.statut === "accepte")?.numero} a été accepté par le client.`,
      niveau: "succes",
      lu: false,
      cible: "u-youssef",
      lien: "/devis",
    },
    {
      id: "n-5",
      date: daysAgo(2),
      titre: "Paiement reçu",
      message: "Un règlement par virement a été enregistré.",
      niveau: "succes",
      lu: true,
      cible: "admin",
      lien: "/paiements",
    },
    {
      id: "n-6",
      date: daysAgo(3),
      titre: "Facture impayée",
      message: "Plusieurs factures arrivent à échéance cette semaine.",
      niveau: "alerte",
      lu: false,
      cible: "admin",
      lien: "/factures",
    },
    {
      id: "n-7",
      date: daysAgo(4),
      titre: "Nouveau client ajouté",
      message: `${clients[15].nom} a été ajouté au portefeuille.`,
      niveau: "info",
      lu: true,
      cible: "u-youssef",
      lien: `/clients/${clients[15].id}`,
    },
    {
      id: "n-8",
      date: daysAgo(5),
      titre: "Objectif commercial atteint",
      message: "Imane Tazi a atteint 100 % de son objectif du mois précédent.",
      niveau: "succes",
      lu: true,
      cible: "admin",
    },
    {
      id: "n-9",
      date: daysAgo(2),
      titre: "Rappel de relance",
      message: "Pensez à relancer vos devis envoyés depuis plus de 7 jours.",
      niveau: "info",
      lu: false,
      cible: "u-youssef",
      lien: "/devis",
    },
    {
      id: "n-10",
      date: daysAgo(6),
      titre: "Stock faible",
      message: "Mosaïque Hexagonale Perle est passée sous le seuil minimal.",
      niveau: "alerte",
      lu: true,
      cible: "tous",
      lien: "/stocks",
    },
  ];

  const activites: Activite[] = [];
  const pushAct = (date: string, userId: string, action: string, description: string) =>
    activites.push({ id: `a-${activites.length + 1}`, date, userId, action, description });
  recentCmd
    .slice(0, 10)
    .forEach((c) =>
      pushAct(c.date, c.commercialId, "Commande", `Création de la commande ${c.numero}`),
    );
  devis
    .slice(-6)
    .forEach((d) => pushAct(d.date, d.commercialId, "Devis", `Création du devis ${d.numero}`));
  paiements
    .slice(-6)
    .forEach((p) =>
      pushAct(
        p.date,
        "u-admin",
        "Paiement",
        `Encaissement de ${round2(p.montant).toLocaleString("fr-FR")} DH`,
      ),
    );
  pushAct(daysAgo(4), "u-youssef", "Client", `Ajout du client ${clients[15].nom}`);
  pushAct(daysAgo(9), "u-admin", "Stock", "Transfert de 40 cartons Casablanca → Témara");
  activites.sort((a, b) => b.date.localeCompare(a.date));

  return {
    version: DATA_VERSION,
    users,
    products,
    depots,
    lots,
    movements,
    clients,
    suppliers,
    devis,
    commandes,
    factures,
    paiements,
    notifications,
    activites,
    dimensions: [...DIMENSIONS_DEFAUT, "20 × 120 cm", "10 × 10 cm"],
    settings: {
      societe: {
        nom: "Votre Société",
        slogan: "Céramique & carrelage",
        adresse: "Adresse de la société",
        ville: "Casablanca",
        telephone: "+212 5 22 00 00 00",
        email: "contact@votre-societe.ma",
        siteWeb: "www.votre-societe.ma",
        ice: "000000000000000",
        rc: "000000",
        if: "00000000",
        patente: "00000000",
        banque: "Banque à compléter",
        rib: "000 000 0000000000000000 00",
      },
      devise: "MAD",
      tauxTVA: settingsTVA,
      remiseMax: 15,
      conditionsPaiement:
        "Paiement à 30 jours date de facture. 30 % d'acompte à la commande pour les particuliers.",
      validiteDevisJours: 30,
      prefixes: { devis: "DEV", commande: "CMD", facture: "FAC", paiement: "PAI" },
      compteurs: { devis: devis.length, commande: seqCmd, facture: seqFac, paiement: seqPai },
    },
  };
}
