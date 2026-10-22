"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, FileText, Download, X, FileSpreadsheet, Loader2 } from "lucide-react";

function detectSeparator(text: string): string {
  const firstLines = text.split("\n").slice(0, 10).filter(Boolean);
  const separators = ["#", ";", ",", "\t", "|"];
  let best = "#";
  let bestCount = 0;
  for (const sep of separators) {
    const counts = firstLines.map((line) => (line.split(sep)?.length ?? 1) - 1);
    const avg = (counts?.reduce((a, b) => a + b, 0) ?? 0) / (counts?.length || 1);
    if (avg > bestCount) {
      bestCount = avg;
      best = sep;
    }
  }
  return best;
}

function parseFile(text: string, separator: string): string[][] {
  const lines = text.split("\n").filter((l) => l?.trim?.());
  return lines.map((line) => (line ?? "").split(separator));
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const txts = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".txt")
    );
    if (txts.length === 0) {
      toast.error("Veuillez sélectionner des fichiers .txt");
      return;
    }
    setFiles((prev) => {
      const names = new Set(prev.map((p) => p.name));
      const merged = [...prev];
      for (const f of txts) if (!names.has(f.name)) merged.push(f);
      return merged;
    });
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function convert() {
    if (files.length === 0) {
      toast.error("Ajoutez au moins un fichier .txt");
      return;
    }
    setLoading(true);
    try {
      const allRows: string[][] = [];
      for (const file of files) {
        const text = await file.text();
        const separator = detectSeparator(text);
        const rows = parseFile(text, separator);
        if (rows.length === 0) continue;
        const sourceName = (file.name ?? "fichier").replace(/\.txt$/i, "");
        for (const row of rows) allRows.push([sourceName, ...row]);
      }
      if (allRows.length === 0) {
        toast.error("Aucune donnée valide à convertir");
        setLoading(false);
        return;
      }
      const maxDataCols = Math.max(
        ...allRows.map((r) => (r?.length ?? 0) - 1),
        0
      );
      const header = [
        "Fichier source",
        ...Array.from({ length: maxDataCols }, (_, i) => `Col${i + 1}`),
      ];
      const wsData = [header, ...allRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const colWidths = header.map((_, colIdx) => {
        let maxLen = 6;
        for (const row of wsData) {
          const cell = (row as string[])?.[colIdx] ?? "";
          if (String(cell).length > maxLen)
            maxLen = Math.min(String(cell).length, 40);
        }
        return { wch: maxLen + 2 };
      });
      ws["!cols"] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Données fusionnées");
      XLSX.writeFile(wb, "conversion.xlsx");
      toast.success("Fichier Excel généré !");
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de la conversion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mb-4">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Convertisseur TXT → Excel
          </h1>
          <p className="text-gray-500 mt-2">
            Déposez vos fichiers .txt : ils seront fusionnés dans un seul fichier
            Excel.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
            dragging
              ? "border-emerald-500 bg-emerald-50"
              : "border-gray-300 bg-white hover:border-emerald-400"
          }`}
        >
          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <p className="font-medium">Glissez vos fichiers .txt ici</p>
          <p className="text-sm text-gray-500">ou cliquez pour parcourir</p>
          <input
            ref={inputRef}
            type="file"
            accept=".txt"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-2">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3"
              >
                <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="flex-1 truncate text-sm">{f.name}</span>
                <span className="text-xs text-gray-400">
                  {(f.size / 1024).toFixed(1)} Ko
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.name);
                  }}
                  className="text-gray-400 hover:text-red-500"
                  aria-label="Retirer le fichier"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={convert}
          disabled={loading || files.length === 0}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-medium py-3 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {loading ? "Conversion..." : "Convertir en Excel"}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Vos fichiers ne quittent pas votre navigateur.
        </p>
      </div>
    </main>
  );
}
