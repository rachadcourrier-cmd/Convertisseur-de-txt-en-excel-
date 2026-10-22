"use client";

import React, { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Plus,
  X,
} from "lucide-react";

interface FileEntry {
  id: string;
  file: File;
  name: string;
  status: "pending" | "converting" | "done" | "error";
  lines: number;
  separator: string;
  preview: string[][];
  errorMsg?: string;
}

export default function ConverterClient() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [converting, setConverting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const detectSeparator = (text: string): string => {
    const firstLines = text.split("\n").slice(0, 5).filter(Boolean);
    const separators = ["#", ";", ",", "\t", "|"];
    let best = "#";
    let bestCount = 0;
    for (const sep of separators) {
      const counts = firstLines.map((line) => (line.split(sep)?.length ?? 1) - 1);
      const avg = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
      if (avg > bestCount) {
        bestCount = avg;
        best = sep;
      }
    }
    return best;
  };

  const readFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e?.target?.result as string) ?? "");
      reader.onerror = () => reject(new Error("Impossible de lire le fichier"));
      reader.readAsText(file);
    });
  };

  const processFiles = useCallback(async (newFiles: File[]) => {
    const txtFiles = newFiles.filter((f) => f.name.toLowerCase().endsWith(".txt"));
    if (txtFiles.length === 0) {
      toast.error("Veuillez sélectionner des fichiers .txt");
      return;
    }

    const entries: FileEntry[] = [];
    for (const file of txtFiles) {
      try {
        const text = await readFile(file);
        const sep = detectSeparator(text);
        const allLines = text.split("\n").filter((l) => l.trim());
        const preview = allLines.slice(0, 6).map((line) => line.split(sep));
        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          status: "pending",
          lines: allLines.length,
          separator: sep === "\t" ? "TAB" : sep,
          preview,
        });
      } catch {
        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          status: "error",
          lines: 0,
          separator: "?",
          preview: [],
          errorMsg: "Impossible de lire le fichier",
        });
      }
    }
    setFiles((prev) => [...prev, ...entries]);
    toast.success(`${entries.length} fichier(s) ajouté(s)`);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(Array.from(e.target.files ?? []));
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFiles]
  );

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const clearAll = () => setFiles([]);

  const convertAll = async () => {
    const pending = files.filter((f) => f.status === "pending" || f.status === "error");
    if (pending.length === 0) {
      toast.info("Aucun fichier à convertir");
      return;
    }

    setConverting(true);
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "pending" || f.status === "error" ? { ...f, status: "converting" as const } : f
      )
    );

    try {
      const formData = new FormData();
      for (const entry of pending) formData.append("files", entry.file);

      const res = await fetch("/api/convert", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? "Erreur lors de la conversion");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "conversion.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFiles((prev) =>
        prev.map((f) => (f.status === "converting" ? { ...f, status: "done" as const } : f))
      );
      toast.success("Conversion terminée ! Fichier Excel téléchargé.");
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "converting" ? { ...f, status: "error" as const, errorMsg: err?.message } : f
        )
      );
      toast.error(err?.message ?? "Erreur lors de la conversion");
    } finally {
      setConverting(false);
    }
  };

  const downloadSingle = async (entry: FileEntry) => {
    setDownloading(true);
    try {
      const formData = new FormData();
      formData.append("files", entry.file);
      const res = await fetch("/api/convert", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Erreur");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.name.replace(/\.txt$/i, "")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${entry.name} converti et téléchargé`);
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  };

  const sepLabel = (s: string) => {
    if (s === "TAB") return "Tabulation";
    if (s === ",") return "Virgule";
    if (s === ";") return "Point-virgule";
    if (s === "|") return "Pipe";
    return s;
  };

  const statusBadge = (status: string) => {
    const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-gray-100 text-gray-700`}>En attente</span>;
      case "converting":
        return <span className={`${base} bg-yellow-100 text-yellow-700 animate-pulse`}>Conversion…</span>;
      case "done":
        return <span className={`${base} bg-green-100 text-green-700`}>Converti ✓</span>;
      case "error":
        return <span className={`${base} bg-red-100 text-red-700`}>Erreur</span>;
      default:
        return null;
    }
  };

  const hasPending = files.some((f) => f.status === "pending" || f.status === "error");

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-all ${
            dragOver
              ? "border-primary bg-green-50 scale-[1.01]"
              : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
          }`}
        >
          <div className={`rounded-full p-4 ${dragOver ? "bg-green-100" : "bg-gray-100"}`}>
            <Upload className={`h-8 w-8 ${dragOver ? "text-primary" : "text-gray-400"}`} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">
              Glissez-déposez vos fichiers <span className="text-primary">.txt</span> ici
            </p>
            <p className="mt-1 text-sm text-gray-500">ou cliquez pour parcourir · Plusieurs fichiers acceptés</p>
          </div>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Sélectionner des fichiers
          </button>
          <input ref={inputRef} type="file" accept=".txt" multiple className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      {/* Files list */}
      {files.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Fichiers importés</h2>
              <p className="text-sm text-gray-500">
                {files.length} fichier(s) · Toutes les lignes seront fusionnées dans une seule feuille Excel
              </p>
            </div>
            <button
              onClick={clearAll}
              disabled={converting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Tout effacer
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">Fichier</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Lignes</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Séparateur</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Statut</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{entry.lines}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 text-xs">
                        {sepLabel(entry.separator)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(entry.status)}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setPreviewFile(entry)} className="rounded p-1.5 hover:bg-gray-100" title="Aperçu">
                          <Eye className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => downloadSingle(entry)}
                          disabled={converting || downloading}
                          className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
                          title="Télécharger ce fichier seul"
                        >
                          <Download className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => removeFile(entry.id)}
                          disabled={converting}
                          className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-50"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center border-t border-gray-200 px-6 py-4">
            <button
              onClick={convertAll}
              disabled={converting || !hasPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {converting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Conversion en cours…
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-5 w-5" /> Convertir et télécharger en Excel
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewFile(null)}>
          <div
            className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Eye className="h-5 w-5" /> Aperçu : {previewFile.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Premières lignes · Séparateur : {sepLabel(previewFile.separator)}
                </p>
              </div>
              <button onClick={() => setPreviewFile(null)} className="rounded p-1.5 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs text-gray-400">#</th>
                    {(previewFile.preview[0] ?? []).map((_, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        Col{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewFile.preview.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="whitespace-nowrap px-3 py-2">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
