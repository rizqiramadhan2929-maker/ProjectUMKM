import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowDownLeft, ArrowUpRight, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction } from '../types';

interface SmartNlpInputProps {
  onTransactionAdded: (tx: Transaction) => void;
  showSuccessToast: (message: string) => void;
}

export default function SmartNlpInput({ onTransactionAdded, showSuccessToast }: SmartNlpInputProps) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    isFallback?: boolean;
  } | null>(null);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setParsedResult(null);

    try {
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const resData = await response.json();
      
      if (resData.success && resData.data) {
        setParsedResult({
          ...resData.data,
          isFallback: resData.isFallback
        });
      } else {
        showSuccessToast('Gagal memproses teks. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      showSuccessToast('Gagal terhubung ke modul AI. Menggunakan parser lokal.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedResult) return;

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: parsedResult.description,
          amount: parsedResult.amount,
          type: parsedResult.type,
          category: parsedResult.category,
          source: 'manual',
          isDraft: false
        }),
      });
      const resData = await response.json();

      if (resData.success && resData.data) {
        onTransactionAdded(resData.data);
        showSuccessToast(`Berhasil mencatatkan: ${parsedResult.description}`);
        setInputText('');
        setParsedResult(null);
      }
    } catch (err) {
      console.error(err);
      showSuccessToast('Gagal menyimpan transaksi.');
    }
  };

  const templates = [
    "Kresek hitam 15rb",
    "Beli cabe bawang pasar 120 rebu",
    "Pemasukan jual nasi goreng 400k",
    "Bayar listrik toko 180.000",
  ];

  return (
    <div id="smart-nlp-card" className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 leading-tight">Catat Kilat Pakai Kalimat</h2>
          <p className="text-xs text-gray-500">Tulis biasa saja seperti curhat, biar AI menterjemahkan nominal & kategori</p>
        </div>
      </div>

      <form onSubmit={handleParse} className="relative">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            id="nlp-input-field"
            type="text"
            className="flex-1 px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-gray-800 transition-all font-sans"
            placeholder='Contoh: "Kresek hitam 15rb" atau "Laku soto 8 porsi 120k"'
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button
            id="nlp-submit-btn"
            type="submit"
            disabled={loading || !inputText.trim()}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white font-medium text-sm rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-98"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Memproses...
              </span>
            ) : (
              <>
                Proses
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Quick Text Prompts */}
      <div className="mt-3 flex flex-wrap gap-1.5 items-center">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mr-1">Rekomendasi contoh:</span>
        {templates.map((tpl, i) => (
          <button
            key={i}
            id={`nlp-tpl-${i}`}
            type="button"
            onClick={() => setInputText(tpl)}
            className="px-2.5 py-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 font-normal rounded-lg transition-all border border-gray-100 cursor-pointer"
          >
            {tpl}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {parsedResult && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            id="nlp-preview-card"
            className="mt-5 p-5 bg-slate-50 border border-slate-100 rounded-3xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-blue-100/30 to-transparent -mr-8 -mt-8 rounded-full pointer-events-none" />
            
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Hasil Tafsir AI
              </span>
              {parsedResult.isFallback && (
                <span className="text-[10px] bg-amber-50 text-amber-700 font-medium px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Metode Regex Offline
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <div>
                <span className="block text-[10px] text-gray-400 font-medium uppercase">Deskripsi Transaksi</span>
                <span className="text-sm font-semibold text-gray-900 block truncate mt-0.5">{parsedResult.description}</span>
              </div>
              
              <div>
                <span className="block text-[10px] text-gray-400 font-medium uppercase">Nominal Uang</span>
                <span className="text-base font-bold text-gray-900 font-mono mt-0.5">
                  Rp {parsedResult.amount.toLocaleString('id-ID')}
                </span>
              </div>

              <div>
                <span className="block text-[10px] text-gray-400 font-medium uppercase">Arus Kas</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {parsedResult.type === 'income' ? (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium rounded-md">
                      <ArrowDownLeft className="h-3 w-3" /> Pemasukan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-100 font-medium rounded-md">
                      <ArrowUpRight className="h-3 w-3" /> Pengeluaran
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="block text-[10px] text-gray-400 font-medium uppercase">Usulan Kategori</span>
                <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded-lg inline-block mt-0.5 shadow-3xs">
                  {parsedResult.category}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                id="nlp-btn-cancel"
                type="button"
                onClick={() => setParsedResult(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Reset
              </button>
              <button
                id="nlp-btn-confirm"
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow transition-all"
              >
                <Check className="h-3.5 w-3.5" />
                Benar, Simpan Kas Buku
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
