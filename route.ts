import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

function detectSeparator(text: string): string {
  const firstLines = text.split("\n").slice(0, 10).filter(Boolean);
  const separators = ["#", ";", ",", "\t", "|"];
  let best = "#";
  let bestCount = 0;
  for (const sep of separators) {
    const counts = firstLines.map((line: string) => (line.split(sep)?.length ?? 1) - 1);
    const avg = (counts?.reduce((a: number, b: number) => a + b, 0) ?? 0) / (counts?.length || 1);
    if (avg > bestCount) {
      bestCount = avg;
      best = sep;
    }
  }
  return best;
}

function parseFile(text: string, separator: string): string[][] {
  const lines = text.split("\n").filter((l: string) => l?.trim?.());
  return lines.map((line: string) => (line ?? "").split(separator));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntries = formData.getAll("files");

    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }

    const workbook = XLSX.utils.book_new();

    // Fusionner TOUS les fichiers dans une seule feuille.
    const allRows: string[][] = [];

    for (const entry of fileEntries) {
      if (!(entry instanceof File)) continue;

      const text = await entry.text();
      const separator = detectSeparator(text);
      const rows = parseFile(text, separator);

      if (rows.length === 0) continue;

      // Ajouter toutes les lignes du fichier, avec le nom du fichier source en 1ère colonne
      const sourceName = (entry.name ?? "fichier").replace(/\.txt$/i, "");
      for (const row of rows) {
        allRows.push([sourceName, ...row]);
      }
    }

    if (allRows.length === 0) {
      return NextResponse.json({ error: "Aucun fichier valide à convertir" }, { status: 400 });
    }

    // Déterminer le nombre max de colonnes (hors colonne source)
    const maxDataCols = Math.max(...allRows.map((r: string[]) => (r?.length ?? 0) - 1), 0);

    // En-tête : Fichier source + Col1, Col2, ...
    const header = [
      "Fichier source",
      ...Array.from({ length: maxDataCols }, (_: unknown, i: number) => `Col${i + 1}`),
    ];

    const wsData = [header, ...allRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajuster la largeur des colonnes automatiquement
    const colWidths = header.map((_: string, colIdx: number) => {
      let maxLen = 6;
      for (const row of wsData) {
        const cell = (row as string[])?.[colIdx] ?? "";
        if (String(cell).length > maxLen) maxLen = Math.min(String(cell).length, 40);
      }
      return { wch: maxLen + 2 };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, ws, "Données fusionnées");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="conversion.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error("Conversion error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Erreur interne lors de la conversion" },
      { status: 500 }
    );
  }
}
