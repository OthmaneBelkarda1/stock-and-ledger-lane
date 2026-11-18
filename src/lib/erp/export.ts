/** Génère un PDF A4 à partir d'un élément HTML (aperçu du document). */
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.92);
  let y = 0;
  pdf.addImage(img, "JPEG", 0, 0, pageW, imgH);
  y += pageH;
  while (y < imgH - 1) {
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, -y, pageW, imgH);
    y += pageH;
  }
  pdf.save(filename);
}

/** Exporte des lignes au format Excel (.xlsx). */
export async function exportXlsx(
  sheets: { name: string; rows: Record<string, string | number>[] }[],
  filename: string,
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(
      s.rows.length ? s.rows : [{ Information: "Aucune donnée" }],
    );
    const cols = Object.keys(s.rows[0] ?? { Information: "" }).map((k) => ({
      wch: Math.max(12, k.length + 2),
    }));
    ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
