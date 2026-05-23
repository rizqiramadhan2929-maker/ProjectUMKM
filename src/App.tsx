import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  Plus, 
  Trash2, 
  Smartphone, 
  Send, 
  DollarSign, 
  Coins, 
  Check, 
  AlertTriangle, 
  RefreshCw,
  Clock,
  Calendar,
  X,
  FileText,
  HelpCircle,
  HelpCircleIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, ShortcutWidget, ReconciliationRecord, ChangeFloatAdvice } from './types';
import SmartNlpInput from './components/SmartNlpInput';

export default function App() {
  // State managers
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutWidget[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Numpad draft mode state
  const [numpadValue, setNumpadValue] = useState<string>('');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  
  // WhatsApp bot simulator state
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([
    {
      id: "m-1",
      sender: 'bot',
      text: "Halo Juragan! 🙋‍♂️ Saya Bot Catat Kas otomatis. Karyawan Anda cukup ketik laporan di WA seperti 'Beli es balok 12rb' atau 'Uang parkir 2rb'. Coba demonya disini!",
      timestamp: new Date(Date.now() - 600000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Tomorrow change estimator state
  const [changeAdvice, setChangeAdvice] = useState<ChangeFloatAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState<boolean>(false);

  // Reconciliation Modal States
  const [isReconOpen, setIsReconOpen] = useState<boolean>(false);
  const [bills, setBills] = useState({
    denom100k: 0,
    denom50k: 0,
    denom20k: 0,
    denom10k: 0,
    denom5k: 0,
    denom2k: 0,
    denom1k: 0,
    denomCoin: 0
  });

  // Draft editing state (for completing draft transactions)
  const [activeEditingDraft, setActiveEditingDraft] = useState<Transaction | null>(null);
  const [editingDescription, setEditingDescription] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<string>('');
  
  // Shortcuts Custom Modal State
  const [isAddShortcutOpen, setIsAddShortcutOpen] = useState<boolean>(false);
  const [newShortcutLabel, setNewShortcutLabel] = useState<string>('');
  const [newShortcutAmount, setNewShortcutAmount] = useState<string>('');
  const [newShortcutCategory, setNewShortcutCategory] = useState<string>('Operasional Toko');

  // Interactive Toast states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Initial Fetching
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [txRes, scRes, recRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/shortcuts'),
        fetch('/api/reconciliation')
      ]);
      
      const txData = await txRes.json();
      const scData = await scRes.json();
      const recData = await recRes.json();

      if (txData.success) {
        setTransactions(txData.data);
      }
      if (scData.success) {
        setShortcuts(scData.data);
      }
      if (recData.success) {
        setReconciliations(recData.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memuat data utama dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchChangeAdvice();
  }, []);

  // Tomorrow Float Forecast Fetch
  const fetchChangeAdvice = async () => {
    try {
      setLoadingAdvice(true);
      const response = await fetch('/api/ai/estimate-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.data) {
        setChangeAdvice(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdvice(false);
    }
  };

  // Numpad keypress
  const handleNumpadPress = (num: string) => {
    if (num === 'C') {
      setNumpadValue('');
    } else if (num === '⌫') {
      setNumpadValue(prev => prev.slice(0, -1));
    } else {
      if (numpadValue.length < 9) { // Safety ceiling
        setNumpadValue(prev => prev + num);
      }
    }
  };

  // Save Fast Draft Entry from Numpad
  const handleSaveDraft = async () => {
    const numericVal = Number(numpadValue);
    if (!numericVal || isNaN(numericVal)) {
      showToast('Numpad kosong atau nominal uang tidak valid.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const response = await fetch('/api/transactions/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericVal })
      });
      const resData = await response.json();
      
      if (resData.success && resData.data) {
        setTransactions(prev => [resData.data, ...prev]);
        setNumpadValue('');
        showToast(`Draft Pengeluaran Rp ${numericVal.toLocaleString('id-ID')} masuk laci antrean.`);
        // Refresh advice since transactions list has updated
        fetchChangeAdvice();
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan draft kas cepat.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Run Custom Shortcut Entry with One Click
  const handleShortcutClick = async (sc: ShortcutWidget) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: `Rutin: ${sc.label}`,
          amount: sc.amount,
          type: sc.type,
          category: sc.category,
          source: 'shortcut',
          isDraft: false
        })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setTransactions(prev => [resData.data, ...prev]);
        showToast(`Berhasil mencatatkan shortcut rutin: ${sc.label} (Rp ${sc.amount.toLocaleString('id-ID')})`);
        fetchChangeAdvice();
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses shortcut.');
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Hapus log pencatatan kas ini?')) return;
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE'
      });
      const resData = await response.json();
      if (resData.success) {
        setTransactions(prev => prev.filter(t => t.id !== id));
        showToast('Catatan kas berhasil dihapus dari buku besar.');
        fetchChangeAdvice();
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus catatan buku kas.');
    }
  };

  // Trigger Open Complete/Unlock Draft Modal
  const openCompleteDraftModal = (tx: Transaction) => {
    setActiveEditingDraft(tx);
    setEditingDescription('');
    setEditingCategory('Bahan Baku');
  };

  // Save full description & categorization for a draft
  const handleCompleteDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingDraft) return;

    if (!editingDescription.trim()) {
      showToast('Berikan deskripsi barang sebelum menyimpan.');
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${activeEditingDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editingDescription,
          category: editingCategory,
          isDraft: false // clear draft flag
        })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setTransactions(prev => prev.map(t => t.id === activeEditingDraft.id ? resData.data : t));
        showToast(`Draft kas selesai disimpan dengan judul '${editingDescription}'!`);
        setActiveEditingDraft(null);
        fetchChangeAdvice();
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal melengkapi data draft.');
    }
  };

  // Simulated WA Chat trigger
  const handleSendWaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');

    // Append user message immediately
    const userMsg = {
      id: `m-u-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      // Post to our AI Parser on the backend
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText })
      });
      const resData = await response.json();

      if (resData.success && resData.data) {
        const parsed = resData.data;
        
        // Save parsed transaction from Chat Bot source automatically!
        const saveRes = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: parsed.description,
            amount: parsed.amount,
            type: parsed.type,
            category: parsed.category,
            source: 'chat_bot',
            isDraft: false
          })
        });
        const savedTxData = await saveRes.json();

        if (savedTxData.success && savedTxData.data) {
          setTransactions(prev => [savedTxData.data, ...prev]);

          // Bot replies confirming automatic entry
          const botReplyText = `✅ Laporan otomatis diterima, Juragan! Tercatat pengeluaran: *"${parsed.description}"* senilai *Rp ${parsed.amount.toLocaleString('id-ID')}* dimasukkan pada kategori *[${parsed.category}]*.`;
          
          setChatMessages(prev => [...prev, {
            id: `m-b-${Date.now()}`,
            sender: 'bot',
            text: botReplyText,
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            parsedTransaction: parsed
          }]);
          
          showToast(`WA Bot Auto-Save: ${parsed.description}`);
          fetchChangeAdvice();
        } else {
          throw new Error("Gagal menyimpan parsing data");
        }
      } else {
        throw new Error("Gagal parsing");
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        id: `m-b-err-${Date.now()}`,
        sender: 'bot',
        text: "❌ Format tidak terbaca atau server AI sibuk. Pastikan ada nominal seperti '10rb' atau '50k' di pesan Anda.",
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Add Custom Shortcut Action
  const handleAddShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = Number(newShortcutAmount);
    if (!newShortcutLabel.trim() || !amountVal || isNaN(amountVal)) {
      showToast('Isi label dan nominal pencatatan secara valid.');
      return;
    }

    try {
      const response = await fetch('/api/shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newShortcutLabel,
          amount: amountVal,
          type: 'expense',
          category: newShortcutCategory
        })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setShortcuts(prev => [...prev, resData.data]);
        showToast(`Shortcut '${newShortcutLabel}' sukses ditambahkan.`);
        setNewShortcutLabel('');
        setNewShortcutAmount('');
        setIsAddShortcutOpen(false);
      }
    } catch (e) {
      console.error(e);
      showToast('Gagal menambahkan shortcut.');
    }
  };

  const handleDeleteShortcut = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus tombol pintas rutin ini?')) return;
    try {
      const response = await fetch(`/api/shortcuts/${id}`, {
        method: 'DELETE'
      });
      const resData = await response.json();
      if (resData.success) {
        setShortcuts(prev => prev.filter(s => s.id !== id));
        showToast('Tombol pintas berhasil dihapus.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate stats
  const totalIncome = transactions
    .filter(t => t.type === 'income' && !t.isDraft)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // We only count actual non-draft income minus expenses for predicted cash
  const predictedCashInBox = totalIncome - totalExpense;

  // Calculate local cash drawer value from bills state
  const calculatedActualBillsAmount = 
    (bills.denom100k * 100000) +
    (bills.denom50k * 50000) +
    (bills.denom20k * 20000) +
    (bills.denom10k * 10000) +
    (bills.denom5k * 5000) +
    (bills.denom2k * 2000) +
    (bills.denom1k * 1000) +
    bills.denomCoin;

  // Submit Closure Reconciliation
  const handlePerformReconciliation = async () => {
    try {
      const response = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedBalance: predictedCashInBox,
          actualBalance: calculatedActualBillsAmount,
          bills: bills
        })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        setReconciliations(prev => [resData.data, ...prev]);
        setIsReconOpen(false);
        showToast(`Rekonsiliasi ditutup! Selisih uang kasir: Rp ${(calculatedActualBillsAmount - predictedCashInBox).toLocaleString('id-ID')}`);
        
        // Reset bills state
        setBills({
          denom100k: 0,
          denom50k: 0,
          denom20k: 0,
          denom10k: 0,
          denom5k: 0,
          denom2k: 0,
          denom1k: 0,
          denomCoin: 0
        });
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses tutup warung.');
    }
  };

  // Get source color / tag text
  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'numpad_draft':
        return <span className="bg-amber-100 hover:bg-amber-100/90 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">DRAK - Numpad Cepat</span>;
      case 'chat_bot':
        return <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">WA Bot Otomatis</span>;
      case 'shortcut':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">Tombol Pintas</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">Form Manual</span>;
    }
  };

  const lastReconResult = reconciliations[0] || null;

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans selection:bg-blue-100 antialiased relative">
      
      {/* Interactive Toast notification block */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 shadow-xl border border-slate-700/50 text-white rounded-2xl px-5 py-3.5 flex items-center gap-3.5 max-w-sm"
          >
            <div className="bg-blue-600 rounded-full p-1 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1440px] mx-auto p-4 md:p-8">
        
        {/* APP HEADER SECTION inside cohesive design */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3.5">
            <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-md text-white">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">SmartUMKM</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase">MODUL CATAT KAS</span>
              </div>
              <p className="text-slate-500 text-xs font-medium mt-0.5 flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Saturday, May 23, 2026 • Warung Berkah Abadi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200/80 shadow-3xs flex items-center gap-3 flex-grow md:flex-grow-0 justify-between md:justify-start">
              <div className="text-left">
                <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Prediksi Buku Kas</span>
                <span className="text-base font-black text-slate-900 font-mono">
                  Rp {predictedCashInBox.toLocaleString('id-ID')}
                </span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${predictedCashInBox >= 0 ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`} />
            </div>

            <button
              id="reconcile-trigger-btn"
              onClick={() => setIsReconOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-xs font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer w-full md:w-auto"
            >
              <Coins className="h-4 w-4 text-emerald-400" />
              Tutup Warung (Cocokkan Uang Laci)
            </button>
          </div>
        </header>

        {/* BENTO GRID MAIN CONTAINER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT CHUNKS (8/12 layout columns for interactive tools) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 1. TEXT NLP PARSE COMPONENT BLOCK */}
            <SmartNlpInput 
              onTransactionAdded={(newTx) => {
                setTransactions(prev => [newTx, ...prev]);
                fetchChangeAdvice();
              }}
              showSuccessToast={showToast}
            />

            {/* 2. REPETITIVE SHORTCUTS COMPONENT BLOCK */}
            <div id="shortcuts-bento-block" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Tombol Rutin Sekali Klik (Shortcut Cepat)
                  </h3>
                </div>
                <button
                  id="add-sc-modal-btn"
                  onClick={() => setIsAddShortcutOpen(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200/50 cursor-pointer transition-all"
                >
                  <Plus className="h-3 w-3" /> Tambah Rutin
                </button>
              </div>

              {shortcuts.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                  Belum ada shortcut pengeluaran berulang. Klik 'Tambah Rutin' diatas untuk membuat custom Anda!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {shortcuts.map((sc) => (
                    <div
                      key={sc.id}
                      id={`sc-item-${sc.id}`}
                      onClick={() => handleShortcutClick(sc)}
                      className="group bg-slate-50 hover:bg-blue-50/60 border border-slate-200/60 hover:border-blue-200 p-4 rounded-2xl text-left cursor-pointer transition-all relative overflow-hidden"
                    >
                      <button
                        onClick={(e) => handleDeleteShortcut(sc.id, e)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 rounded-full transition-all"
                        title="Hapus shortcut"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block truncate">
                        {sc.category}
                      </p>
                      <p className="text-sm font-bold text-slate-800 tracking-tight block truncate mt-1">
                        {sc.label}
                      </p>
                      <p className="text-xs font-mono font-bold text-blue-600 mt-0.5">
                        Rp {sc.amount.toLocaleString('id-ID')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. CORE LEDGER LISTING SECTION WITH FILTER & COMPLETING FOR DRAFTS */}
            <div id="ledger-book-block" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-400" />
                    Buku Besar Riwayat Kasir
                  </h3>
                  <p className="text-xs text-slate-500">Kombinasi catatan manual, WA, shortcut, dan draf kasar laci</p>
                </div>

                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-black px-2 py-1 align-middle">
                    Total: {transactions.length} baris
                  </span>
                </div>
              </div>

              {/* DRAFTS CRITICAL HIGHLIGHT HEADER (USER STORY 2) */}
              {transactions.some(t => t.isDraft) && (
                <div className="mb-4 bg-amber-50 rounded-2xl border border-amber-200/60 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex gap-2.5 items-start">
                    <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg mt-0.5">
                      <AlertTriangle className="h-4 w-4 text-amber-800 shrink-0" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900 font-sans">Ada Draf Cepat Laci Yang Belum Dilengkapi!</p>
                      <p className="text-[11px] text-amber-700 font-medium">Lengkapi rincian nominal draft tumpukan kasir tadi siang demi kebaikan akunting malam ini.</p>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="py-24 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto" />
                  <p className="text-slate-400 text-xs mt-3">Menghubungkan laci kasier...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-24 bg-slate-50 rounded-3xl border border-dashed border-slate-100">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Buku Kas Kosong Pagi Ini</p>
                  <p className="text-xs text-slate-400 mt-1">Gunakan Smart NLP Input atau Numpad cepat untuk mencatat transaksi.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                        <th className="py-3 px-2">Tanggal / Jam</th>
                        <th className="py-3 px-2">Keterangan Barang</th>
                        <th className="py-3 px-2">Jenis Kas</th>
                        <th className="py-3 px-2">Cara Lapor</th>
                        <th className="py-3 px-2 text-right">Nominal Saku</th>
                        <th className="py-3 px-2 text-center">Kelola</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50/50">
                      {transactions.map((tx) => {
                        const dateObj = new Date(tx.timestamp);
                        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        
                        return (
                          <motion.tr
                            key={tx.id}
                            id={`tx-row-${tx.id}`}
                            className={`hover:bg-slate-50/70 transition-all ${tx.isDraft ? 'bg-amber-50/45 animate-pulse border-l-4 border-l-amber-500' : ''}`}
                          >
                            <td className="py-3.5 px-2 font-mono text-slate-400">
                              {timeStr}
                            </td>
                            <td className="py-3.5 px-2">
                              {tx.isDraft ? (
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="text-gray-400 italic">"Belum dilengkapi (Draft Numpad)"</span>
                                  <button
                                    id={`complete-draft-${tx.id}`}
                                    onClick={() => openCompleteDraftModal(tx)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition-all"
                                  >
                                    Lengkapi Detail Draft
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800">{tx.description}</span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">{tx.category}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-2">
                              {tx.type === 'income' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold rounded-lg uppercase">
                                  <ArrowDownLeft className="h-3 w-3 text-emerald-600" /> Pemasukan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] bg-rose-50 text-rose-800 border border-rose-100 font-bold rounded-lg uppercase">
                                  <ArrowUpRight className="h-3 w-3 text-rose-600" /> Pengeluaran
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-2">
                              {getSourceBadge(tx.source)}
                            </td>
                            <td className="py-3.5 px-2 text-right font-mono font-bold text-slate-900 text-sm">
                              Rp {tx.amount.toLocaleString('id-ID')}
                            </td>
                            <td className="py-3.5 px-2 text-center">
                              <button
                                id={`del-tx-${tx.id}`}
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1 px-2 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                                title="Hapus Trx"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* LAST RECONCILIATION AUDIT BOARD AND HISTORY */}
            {reconciliations.length > 0 && (
              <div id="recon-history-block" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 bg-teal-500 rounded-full" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Log Status Rekonsiliasi Terakhir
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reconciliations.slice(0, 3).map((rec, i) => {
                    const statusColor = rec.status === 'match' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                      : rec.status === 'surplus' 
                      ? 'bg-blue-50 text-blue-800 border-blue-100' 
                      : 'bg-rose-50 text-rose-800 border-rose-100';
                    
                    const statusLabel = rec.status === 'match'
                      ? 'UANG PAS'
                      : rec.status === 'surplus'
                      ? 'UANG LEBIH'
                      : 'HILANG / SELISIH KURANG';

                    return (
                      <div key={rec.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">
                            {new Date(rec.timestamp).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} - At Tutup Warung
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Sisa di Catatan:</span>
                            <span className="font-semibold font-mono">Rp {rec.expectedBalance.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Fisik Laci Akurat:</span>
                            <span className="font-semibold font-mono">Rp {rec.actualBalance.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-800 pt-1 border-t border-slate-100 font-bold">
                            <span>Selisih Uang:</span>
                            <span className={`font-mono ${rec.discrepancy < 0 ? 'text-red-600' : rec.discrepancy > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {rec.discrepancy >= 0 ? '+' : ''}Rp {rec.discrepancy.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT CHUNKS (4/12 layout columns for fast draft, wa bots, and coin change prediction) */}
          <div className="lg:col-span-4 space-y-6">

            {/* A. NUMPAD QUICK DRAUGHT GENERATION (USER STORY 2) */}
            <div id="numpad-快速-draft-block" className="bg-slate-900 text-white rounded-[32px] p-6 shadow-xl border-4 border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              
              <div className="mb-4">
                <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" /> DRAFT JALUR CEPAT (DRAFT-MODE)
                </span>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Ketik nominal langsung, simpan draf kilat. Isikan detail barang nanti malam saat waktu lowong.
                </p>
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 text-right mb-5 border border-slate-800">
                <span className="text-3xl font-bold font-mono text-emerald-400 tracking-tighter">
                  {numpadValue ? Number(numpadValue).toLocaleString('id-ID') : '0'}
                </span>
                <p className="text-slate-500 text-[10px] mt-1 font-sans">
                  *Asumsi pengeluaran tanpa kategori akuntansi
                </p>
              </div>

              {/* 3x4 layout numpad grid buttons */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => {
                  const isUtilitySym = key === 'C' || key === '⌫';
                  return (
                    <button
                      key={key}
                      id={`numpad-key-${key}`}
                      type="button"
                      onClick={() => handleNumpadPress(key)}
                      className={`h-14 font-mono font-bold text-xl rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isUtilitySym 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/40' 
                        : 'bg-slate-850 hover:bg-slate-800 text-white shadow-3xs'
                      }`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>

              {/* Quick shortcut multipliers for fast Indonesian merchant amounts */}
              <div className="grid grid-cols-3 gap-1.5 mt-3.5">
                {[
                  { label: '+2k', val: '2000' },
                  { label: '+10k', val: '10000' },
                  { label: '+50k', val: '50000' }
                ].map((mul, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNumpadValue(prev => {
                      const computed = (Number(prev) || 0) + Number(mul.val);
                      return computed.toString();
                    })}
                    className="py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 text-[10px] font-mono rounded-lg cursor-pointer font-bold border border-slate-800"
                  >
                    {mul.label}
                  </button>
                ))}
              </div>

              <button
                id="numpad-save-draft"
                onClick={handleSaveDraft}
                disabled={isSavingDraft || !numpadValue}
                className="w-full mt-5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-sm py-4 rounded-2xl shadow-lg transition-all active:scale-98 tracking-tight uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSavingDraft ? 'Memproses...' : 'Simpan Draf Uang Keluar (Draft Mode)'}
              </button>
            </div>


            {/* B. WHATSAPP BOT CHAT SIMULATOR (USER STORY 3) */}
            <div id="wa-bot-simulator-block" className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[480px]">
              
              {/* Fake phone UI WA Header */}
              <div className="bg-emerald-700 text-white p-4 flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl text-white">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.483 8.411-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.308 1.658zm6.215-4.461l.346.205c1.114.66 2.456 1.009 3.829 1.011 5.428 0 9.845-4.417 9.848-9.847.002-2.63-1.023-5.102-2.887-6.968-1.865-1.864-4.337-2.887-6.965-2.888-5.429 0-9.846 4.417-9.849 9.847-.001 1.83.511 3.618 1.482 5.176l.226.359-1.104 4.037 4.124-1.082z"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-black tracking-tight flex items-center gap-1.5">
                    WA Bot Lapor Kasir (SmartUMKM)
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-ping" />
                  </h4>
                  <p className="text-[10px] text-emerald-200">Karyawan Lapor Instan Tanpa Install App</p>
                </div>
              </div>

              {/* Chat messages viewport */}
              <div 
                id="wa-chats-view" 
                className="flex-grow p-4 bg-[#efeae2]/80 space-y-3 overflow-y-auto font-sans flex flex-col relative"
              >
                <div className="absolute inset-0 bg-radial from-transparent to-[#efeae2]/10 pointer-events-none" />
                <div className="text-center my-1">
                  <span className="bg-white/90 text-slate-500 text-[9px] px-2 py-0.5 rounded-lg border border-slate-200/50 shadow-3xs uppercase font-semibold font-mono">Simulasi WA Bot Karyawan</span>
                </div>

                {chatMessages.map((msg) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col max-w-[85%] ${isBot ? 'self-start' : 'self-end'}`}
                    >
                      <div className={`p-3 rounded-2xl text-xs relative shadow-3xs ${isBot ? 'bg-white rounded-tl-none text-slate-800' : 'bg-[#d9fdd3] rounded-tr-none text-slate-800'}`}>
                        {!isBot && <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">KARYAWAN LAPOR</p>}
                        <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                        
                        {/* Stamp detail inside WA speech bubble */}
                        <div className="text-[9px] text-slate-400 font-mono text-right mt-1">
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {chatLoading && (
                  <div className="flex flex-col self-start max-w-[85%]">
                    <div className="p-3 bg-white rounded-2xl rounded-tl-none shadow-3xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100" />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fake WA typing box */}
              <form onSubmit={handleSendWaMessage} className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                <input
                  id="wa-chat-input"
                  type="text"
                  placeholder="Ketik pesannya di WA (misal: Sosis bakar 30rb)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 transition-all font-sans"
                />
                <button
                  id="wa-chat-send-btn"
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2.5 bg-emerald-600 active:scale-95 disabled:bg-slate-200 text-white rounded-full transition-all flex items-center justify-center cursor-pointer shadow-sm shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>


            {/* C. AI CASH COIN COUNTER ESTIMATION FOR TOMORROW (USER STORY 6) */}
            <div id="ai-coin-estimator-block" className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-indigo-50/50 to-transparent -mr-8 -mt-8 rounded-full pointer-events-none" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Coins className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Kebutuhan Pecahan Receh Besok</h3>
                    <p className="text-[10px] text-slate-400">Prediksi saku laci kasir agar tidak numpuk kembalian</p>
                  </div>
                </div>

                <button
                  id="refresh-forecast-btn"
                  onClick={fetchChangeAdvice}
                  disabled={loadingAdvice}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                  title="Hitung ulang analisa AI"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingAdvice ? 'animate-spin text-indigo-600' : ''}`} />
                </button>
              </div>

              {loadingAdvice ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mx-auto" />
                  <p className="text-slate-400 text-[10px] mt-2">Memprediksi transaksi esok...</p>
                </div>
              ) : changeAdvice ? (
                <div>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-4 italic">
                    {changeAdvice.aiAnalysis}
                  </p>

                  <div className="space-y-2">
                    {changeAdvice.suggestions.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/85 p-2.5 rounded-xl border border-slate-100 transition-all">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">{s.denom}</span>
                          <span className="text-[9px] text-slate-400 block max-w-[210px] truncate" title={s.reason}>
                            {s.reason}
                          </span>
                        </div>
                        <span className="bg-indigo-600 text-white font-black text-[10px] px-2.5 py-1 rounded-lg shrink-0 font-mono shadow-3xs">
                          {s.count} Pcs
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Modal Receh Disarankan</span>
                    <span className="text-xs font-black text-indigo-700 font-mono">
                      Rp {changeAdvice.totalNeeded.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-xs">Instruksi AI belum termuat.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER COHESIVE TRADEMARK */}
      <footer className="w-full text-center py-10 text-slate-400 text-[10px] font-medium font-mono uppercase tracking-widest mt-12 bg-white border-t border-slate-100">
        SmartUMKM © 2026 • Dirancang khusus dengan UI Bento Grid Akurasi Kas Kilat
      </footer>


      {/* MODAL 1: COMPLETE TRANSACTION DRAUGHT DETAILS (USER STORY 2) */}
      <AnimatePresence>
        {activeEditingDraft && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[32px] max-w-md w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Lengkapi Detail Rincian Draft Kas</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ubah Draft Pengeluaran menjadi Akuntansi Tercatat</p>
                </div>
                <button
                  id="close-draft-modal-btn"
                  onClick={() => setActiveEditingDraft(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-100 text-slate-800 text-xs mb-4 flex justify-between items-center">
                <span className="font-semibold uppercase text-amber-900 tracking-wider text-[10px]">Nominal Draft Keluar:</span>
                <span className="font-mono font-bold text-sm text-slate-950">
                  Rp {activeEditingDraft.amount.toLocaleString('id-ID')}
                </span>
              </div>

              <form onSubmit={handleCompleteDraft} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1.5">Rincian Deskripsi Pembelian</label>
                  <input
                    id="complete-desc-input"
                    type="text"
                    required
                    placeholder="Contoh: Belanja Minyak Goreng 2L Berkah"
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-black tracking-wider mb-1.5">Pilih Kategori Pos Kas</label>
                  <select
                    id="complete-category-select"
                    value={editingCategory}
                    onChange={(e) => setEditingCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800"
                  >
                    <option value="Bahan Baku">Bahan Baku Makanan</option>
                    <option value="Kemasan & Wadah">Kemasan & Plastik</option>
                    <option value="Gas, Listrik & Air">Gas, Listrik & Air</option>
                    <option value="Keamanan & Kebersihan">Keamanan & Kebersihan</option>
                    <option value="Transportasi">Bensin & Kurir Toko</option>
                    <option value="Operasional Toko">Operasional Umum</option>
                    <option value="Sewa Tempat">Sewa Tempat Lapak</option>
                  </select>
                </div>

                <div className="pt-3 flex gap-2 justify-end">
                  <button
                    id="complete-draft-cancel"
                    type="button"
                    onClick={() => setActiveEditingDraft(null)}
                    className="px-4 py-2.5 text-xs text-slate-500 font-bold hover:text-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    id="complete-draft-submit"
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm shadow-blue-200/50 hover:shadow transition-all"
                  >
                    Simpan Buku Kas Utama
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MODAL 2: ADD CUSTOM SHORTCUT WIDGET MODE */}
      <AnimatePresence>
        {isAddShortcutOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[32px] max-w-sm w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Buat Tombol Rutin Baru</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Sekali klik langsung rekam pengeluaran berulang</p>
                </div>
                <button
                  id="close-sc-modal"
                  onClick={() => setIsAddShortcutOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <form onSubmit={handleAddShortcut} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Nama Pengeluaran Berulang</label>
                  <input
                    id="sc-label-input"
                    type="text"
                    required
                    placeholder="Contoh: Es Batu Kristal"
                    value={newShortcutLabel}
                    onChange={(e) => setNewShortcutLabel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Nominal Rupiah (Set)</label>
                  <input
                    id="sc-amount-input"
                    type="number"
                    required
                    placeholder="Contoh: 10000"
                    value={newShortcutAmount}
                    onChange={(e) => setNewShortcutAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white text-slate-805"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Kategori Pos</label>
                  <select
                    id="sc-category-select"
                    value={newShortcutCategory}
                    onChange={(e) => setNewShortcutCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white text-slate-800"
                  >
                    <option value="Bahan Baku">Bahan Baku</option>
                    <option value="Kemasan & Wadah">Kemasan & Wadah</option>
                    <option value="Gas, Listrik & Air">Gas, Listrik & Air</option>
                    <option value="Keamanan & Kebersihan">Keamanan & Kebersihan</option>
                    <option value="Transportasi">Transportasi</option>
                    <option value="Operasional Toko">Operasional Umum</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    id="sc-form-cancel"
                    type="button"
                    onClick={() => setIsAddShortcutOpen(false)}
                    className="px-4 py-2 text-xs text-slate-500 hover:text-slate-800 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    id="sc-form-submit"
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Tambahkan Shortcut
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MODAL 3: FULL CLOSURE CASH RECONCILIATION COUNT IN DRAWER (USER STORY 5) */}
      <AnimatePresence>
        {isReconOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100 my-8"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900 tracking-tight">Cek Selisih Kasir & Tutup Buku Laci</h4>
                  <p className="text-[11px] text-slate-500">Hitung sisa uang fisik asli yang tersisa di laci kasir saat tutup toko.</p>
                </div>
                <button
                  id="close-recon-modal"
                  onClick={() => setIsReconOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Automatic accounting ledger expectation display (Expected) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-4 mb-5">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Prediksi Buku Kas</span>
                  <span className="text-base font-bold text-slate-950 font-mono">
                    Rp {predictedCashInBox.toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Fisik Terhitung</span>
                  <span className="text-base font-bold text-emerald-600 font-mono">
                    Rp {calculatedActualBillsAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-2 mb-6">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block border-b border-slate-100 pb-1.5">
                  DENOMINASI LEMBAR / KOIN YANG ADA DI LACI
                </p>

                {/* Grid inputs for Indonesian currency denominations (100k down to coin summary) */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Rp 100.000 (Lembar)', key: 'denom100k' },
                    { label: 'Rp 50.000 (Lembar)', key: 'denom50k' },
                    { label: 'Rp 20.000 (Lembar)', key: 'denom20k' },
                    { label: 'Rp 10.000 (Lembar)', key: 'denom10k' },
                    { label: 'Rp 5.000 (Lembar)', key: 'denom5k' },
                    { label: 'Rp 2.000 (Lembar)', key: 'denom2k' },
                    { label: 'Rp 1.000 (Lembar)', key: 'denom1k' },
                    { label: 'Semua Koin / Receh (Gabungan Rp)', key: 'denomCoin', isFreeVal: true }
                  ].map((currencyItem) => (
                    <div key={currencyItem.key} className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-slate-500">{currencyItem.label}</label>
                      <input
                        id={`denom-input-${currencyItem.key}`}
                        type="number"
                        min="0"
                        placeholder="0"
                        value={(bills as any)[currencyItem.key] || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setBills(prev => ({
                            ...prev,
                            [currencyItem.key]: val
                          }));
                        }}
                        className="px-3 py-2 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200/90 rounded-xl text-xs font-mono font-bold text-slate-800 transition-all text-right"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Discrepancy Live Feedback */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center mb-6">
                <div>
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selisih Uang (Fisik - Buku)</span>
                  <span className={`text-base font-extrabold font-mono ${(calculatedActualBillsAmount - predictedCashInBox) < 0 ? 'text-rose-600' : (calculatedActualBillsAmount - predictedCashInBox) > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                    {(calculatedActualBillsAmount - predictedCashInBox) >= 0 ? '+' : ''}Rp {(calculatedActualBillsAmount - predictedCashInBox).toLocaleString('id-ID')}
                  </span>
                </div>

                <div>
                  {(calculatedActualBillsAmount - predictedCashInBox) === 0 ? (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold text-[10px] px-3 py-1.5 rounded-xl uppercase flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> UANG KLOP MATCH
                    </span>
                  ) : (calculatedActualBillsAmount - predictedCashInBox) > 0 ? (
                    <span className="bg-blue-50 text-blue-800 border border-blue-100 font-bold text-[10px] px-3 py-1.5 rounded-xl uppercase">
                      💰 SURPLUS LEBIH UANG
                    </span>
                  ) : (
                    <span className="bg-rose-50 text-rose-800 border border-rose-100 font-bold text-[10px] px-3 py-1.5 rounded-xl uppercase flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> KURANG / NOTA HILANG
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-[10px] text-slate-400 font-sans mb-6">
                <p>⚠️ <strong>Catatan Penting:</strong> Sistem akan otomatis menutup buku kas harian Anda dan mengunggah status discrepancy pencatatan kas ini ke audit juragan pusat.</p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  id="recon-modal-cancel"
                  type="button"
                  onClick={() => setIsReconOpen(false)}
                  className="px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  Kembali Cek Ulang
                </button>
                <button
                  id="recon-modal-submit"
                  onClick={handlePerformReconciliation}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-emerald-200/50 transition-all flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" /> Kunci Selesai Tutup Buku
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
