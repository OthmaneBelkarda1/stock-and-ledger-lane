import marbreBlanc from "@/assets/tiles/marbre-blanc.jpg";
import betonAnthracite from "@/assets/tiles/beton-anthracite.jpg";
import boisChene from "@/assets/tiles/bois-chene.jpg";
import zelligeVert from "@/assets/tiles/zellige-vert.jpg";
import terrazzoBeige from "@/assets/tiles/terrazzo-beige.jpg";
import faienceBleue from "@/assets/tiles/faience-bleue.jpg";
import travertinBeige from "@/assets/tiles/travertin-beige.jpg";
import exterieurGris from "@/assets/tiles/exterieur-gris.jpg";
import marbreNoir from "@/assets/tiles/marbre-noir.jpg";
import mosaiqueHexagone from "@/assets/tiles/mosaique-hexagone.jpg";
import accessoires from "@/assets/tiles/accessoires.jpg";

export const IMAGE_LIBRARY: Record<string, { src: string; label: string }> = {
  "marbre-blanc": { src: marbreBlanc, label: "Marbre blanc" },
  "beton-anthracite": { src: betonAnthracite, label: "Béton anthracite" },
  "bois-chene": { src: boisChene, label: "Bois chêne" },
  "zellige-vert": { src: zelligeVert, label: "Zellige vert" },
  "terrazzo-beige": { src: terrazzoBeige, label: "Terrazzo beige" },
  "faience-bleue": { src: faienceBleue, label: "Faïence bleue" },
  "travertin-beige": { src: travertinBeige, label: "Travertin beige" },
  "exterieur-gris": { src: exterieurGris, label: "Pierre grise extérieure" },
  "marbre-noir": { src: marbreNoir, label: "Marbre noir" },
  "mosaique-hexagone": { src: mosaiqueHexagone, label: "Mosaïque hexagonale" },
  accessoires: { src: accessoires, label: "Accessoires" },
};

export const productImage = (key: string) =>
  key?.startsWith("data:") ? key : (IMAGE_LIBRARY[key]?.src ?? IMAGE_LIBRARY["marbre-blanc"].src);
