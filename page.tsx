import ConverterClient from "./components/converter-client";
import { FileSpreadsheet } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Convertisseur TXT → Excel</h1>
              <p className="text-xs text-gray-500">Importez vos fichiers texte et obtenez un Excel en un clic</p>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ConverterClient />
      </div>
      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-400">
        Convertisseur TXT → Excel · Tous droits réservés
      </footer>
    </main>
  );
}
