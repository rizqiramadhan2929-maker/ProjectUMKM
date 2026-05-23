import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Transaction, ShortcutWidget, ReconciliationRecord, ChangeSuggestion } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database initialized with beautiful operational data
let transactions: Transaction[] = [
  {
    id: "tx-1",
    timestamp: new Date(Date.now() - 3600000 * 8).toISOString(), // 8 hours ago
    description: "Belanja Sayuran & Bumbu Dapur Pasar",
    amount: 125000,
    type: "expense",
    category: "Bahan Baku",
    isDraft: false,
    source: "manual",
  },
  {
    id: "tx-2",
    timestamp: new Date(Date.now() - 3600000 * 6.5).toISOString(), // 6.5 hours ago
    description: "Pendapatan Makan Siang Rombongan Kantor",
    amount: 450000,
    type: "income",
    category: "Penjualan",
    isDraft: false,
    source: "manual",
  },
  {
    id: "tx-3",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    description: "LPG 3 kg Melati Jaya",
    amount: 22000,
    type: "expense",
    category: "Gas, Listrik & Air",
    isDraft: false,
    source: "shortcut",
  },
  {
    id: "tx-4",
    timestamp: new Date(Date.now() - 3600000 * 3.5).toISOString(), // 3.5 hours ago
    description: "Draft kas keluar cepat (belum selesai)",
    amount: 35000,
    type: "expense",
    category: "Belum Dikategorikan",
    isDraft: true,
    source: "numpad_draft",
  },
  {
    id: "tx-5",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    description: "Bayar uang sampah warga",
    amount: 10000,
    type: "expense",
    category: "Keamanan & Kebersihan",
    isDraft: false,
    source: "chat_bot",
  },
  {
    id: "tx-6",
    timestamp: new Date(Date.now() - 360000 * 15).toISOString(), // 15 mins ago
    description: "Kresek hitam ukuran besar",
    amount: 15000,
    type: "expense",
    category: "Kemasan & Wadah",
    isDraft: false,
    source: "chat_bot",
  }
];

let shortcuts: ShortcutWidget[] = [
  { id: "sc-1", label: "Retribusi Keamanan", amount: 2000, type: "expense", category: "Keamanan & Kebersihan" },
  { id: "sc-2", label: "Gas LPG 3 Kg", amount: 22000, type: "expense", category: "Gas, Listrik & Air" },
  { id: "sc-3", label: "Es Batu Kristal", amount: 10000, type: "expense", category: "Bahan Baku" },
  { id: "sc-4", label: "Kresek Pembungkus", amount: 5000, type: "expense", category: "Kemasan & Wadah" },
  { id: "sc-5", label: "Bensin Kurir", amount: 10000, type: "expense", category: "Transportasi" }
];

let reconciliations: ReconciliationRecord[] = [
  {
    id: "rec-1",
    timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    expectedBalance: 338000,
    actualBalance: 338000,
    discrepancy: 0,
    status: "match",
    denom100k: 2,
    denom50k: 2,
    denom20k: 1,
    denom10k: 1,
    denom5k: 1,
    denom2k: 1,
    denom1k: 1,
    denomCoin: 0
  }
];

// Fallback smart parser using pattern matching & Indonesian merchant slang rules
function parseWithRegex(text: string): { description: string, amount: number, type: 'income' | 'expense', category: string } {
  const cleanText = text.toLowerCase().trim();
  
  // Look for rupiah numbers which can look like 15rb, 15k, 1.5jt, 15.000, 15000
  let amount = 0;
  // Regex matches digits with trailing optional slang units
  const numRegex = /(\d+[\d.,]*)\s*(rb|k|jt|juta|ribu)?/gi;
  const matches = [...cleanText.matchAll(numRegex)];
  
  let fullMatchStr = '';
  
  for (const m of matches) {
    const rawVal = m[1].replace(/[.,]/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      let currentMult = 1;
      const suffix = (m[2] || '').toLowerCase();
      if (suffix === 'rb' || suffix === 'ribu') {
        currentMult = 1000;
      } else if (suffix === 'k') {
        currentMult = 1000;
      } else if (suffix === 'jt' || suffix === 'juta') {
        currentMult = 1000000;
      } else if (num < 1000 && num >= 1) {
        // If it looks like '15' in 'es batu 15', and is followed by no unit but context is rupiah,
        // we can assume it's in thousands if it is very small.
        currentMult = 1000;
      }
      
      const computed = num * currentMult;
      if (computed > amount) {
        amount = computed;
        fullMatchStr = m[0];
      }
    }
  }
  
  // Extract text description without the pricing segment
  let description = text;
  if (fullMatchStr) {
    // Remove the match
    const escaped = fullMatchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    description = text.replace(new RegExp(escaped, 'gi'), '').trim();
  }
  
  // Remove trailing/leading trash punctuation
  description = description.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
  if (!description) {
    description = "Belanja Tanpa Judul";
  }
  
  // Capitalize first letter
  description = description.charAt(0).toUpperCase() + description.slice(1);
  
  // Guess category is expense by default, check if we found sales statements
  let type: 'income' | 'expense' = 'expense';
  const incomeKeywords = ['penerimaan', 'pendapatan', 'laku', 'omset', 'penjualan', 'masuk', 'terima', 'income', 'jual'];
  if (incomeKeywords.some(keyword => cleanText.includes(keyword))) {
    type = 'income';
  }
  
  // Guess Category
  let category = 'Operasional Toko';
  if (cleanText.includes('sayur') || cleanText.includes('daging') || cleanText.includes('bumbu') || cleanText.includes('beras') || cleanText.includes('es batu') || cleanText.includes('telur') || cleanText.includes('makan')) {
    category = 'Bahan Baku';
  } else if (cleanText.includes('kresek') || cleanText.includes('cup') || cleanText.includes('plastik') || cleanText.includes('mika') || cleanText.includes('kotak')) {
    category = 'Kemasan & Wadah';
  } else if (cleanText.includes('lpg') || cleanText.includes('listrik') || cleanText.includes('air') || cleanText.includes('wifi') || cleanText.includes('pulsa')) {
    category = 'Gas, Listrik & Air';
  } else if (cleanText.includes('sampah') || cleanText.includes('keamanan') || cleanText.includes('kebersihan') || cleanText.includes('iuran')) {
    category = 'Keamanan & Kebersihan';
  } else if (cleanText.includes('ojek') || cleanText.includes('bensin') || cleanText.includes('sewa motor') || cleanText.includes('kurir') || cleanText.includes('ongkir')) {
    category = 'Transportasi';
  } else if (cleanText.includes('sewa') || cleanText.includes('lapak') || cleanText.includes('kontrakan')) {
    category = 'Sewa Tempat';
  } else if (type === 'income') {
    category = 'Penjualan';
  }
  
  return {
    description,
    amount: amount || 10000,
    type,
    category
  };
}

// Lazy load Gemini Client to be extremely safe against key validation crashes on boot
let cachedGeminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (cachedGeminiClient) return cachedGeminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("⚠️ GEMINI_API_KEY is not configured or holds default placeholder. AI parsing will fall back to rule-based regex parser.");
    return null;
  }
  try {
    cachedGeminiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    return cachedGeminiClient;
  } catch (err) {
    console.error("❌ Failed to initialize GoogleGenAI client:", err);
    return null;
  }
}

// ---------------------- API REST ENDPOINTS ----------------------

// 1. Transactions Ledger API
app.get("/api/transactions", (req, res) => {
  res.json({ success: true, count: transactions.length, data: transactions });
});

app.post("/api/transactions", (req, res) => {
  const { description, amount, type, category, source, isDraft } = req.body;
  
  if (!description || !amount) {
    return res.status(400).json({ success: false, message: "Deskripsi dan total nominal uang wajib diisi." });
  }

  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    timestamp: new Date().toISOString(),
    description,
    amount: Number(amount),
    type: type || 'expense',
    category: category || 'Lain-lain',
    isDraft: !!isDraft,
    source: source || 'manual'
  };

  transactions.unshift(newTx);
  res.status(201).json({ success: true, data: newTx });
});

// Draft fast insert (numpad)
app.post("/api/transactions/quick", (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(Number(amount))) {
    return res.status(400).json({ success: false, message: "Nominal uang yang dicatat tidak valid." });
  }

  const newDraft: Transaction = {
    id: `tx-${Date.now()}`,
    timestamp: new Date().toISOString(),
    description: "Draft pengeluaran cepat (numpad)",
    amount: Number(amount),
    type: "expense",
    category: "Belum Dikategorikan",
    isDraft: true,
    source: "numpad_draft"
  };

  transactions.unshift(newDraft);
  res.status(201).json({ success: true, data: newDraft });
});

// Complete or save draft
app.patch("/api/transactions/:id", (req, res) => {
  const { id } = req.params;
  const { description, category, amount, isDraft } = req.body;

  const idx = transactions.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Draft tidak ditemukan." });
  }

  transactions[idx] = {
    ...transactions[idx],
    description: description !== undefined ? description : transactions[idx].description,
    category: category !== undefined ? category : transactions[idx].category,
    amount: amount !== undefined ? Number(amount) : transactions[idx].amount,
    isDraft: isDraft !== undefined ? !!isDraft : false // default is to unlock as saved transaction
  };

  res.json({ success: true, data: transactions[idx] });
});

app.delete("/api/transactions/:id", (req, res) => {
  const { id } = req.params;
  const initialCount = transactions.length;
  transactions = transactions.filter(t => t.id !== id);
  
  if (transactions.length === initialCount) {
    return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan." });
  }
  
  res.json({ success: true, message: "Transaksi berhasil dihapus." });
});


// 2. Shortcut Widgets API
app.get("/api/shortcuts", (req, res) => {
  res.json({ success: true, data: shortcuts });
});

app.post("/api/shortcuts", (req, res) => {
  const { label, amount, type, category } = req.body;
  if (!label || !amount) {
    return res.status(400).json({ success: false, message: "Label dan nominal shortcut wajib diisi." });
  }

  const newShortcut: ShortcutWidget = {
    id: `sc-${Date.now()}`,
    label,
    amount: Number(amount),
    type: type || 'expense',
    category: category || 'Operasional Toko'
  };

  shortcuts.push(newShortcut);
  res.status(201).json({ success: true, data: newShortcut });
});

app.delete("/api/shortcuts/:id", (req, res) => {
  const { id } = req.params;
  shortcuts = shortcuts.filter(s => s.id !== id);
  res.json({ success: true, message: "Shortcut dihapus" });
});


// 3. Cash Reconciliation API
app.get("/api/reconciliation", (req, res) => {
  res.json({ success: true, data: reconciliations });
});

app.post("/api/reconciliation", (req, res) => {
  const { expectedBalance, actualBalance, bills } = req.body;
  const discrepancy = Number(actualBalance) - Number(expectedBalance);
  
  let status: 'match' | 'surplus' | 'short' = 'match';
  if (discrepancy > 0) status = 'surplus';
  if (discrepancy < 0) status = 'short';

  const newRecon: ReconciliationRecord = {
    id: `rec-${Date.now()}`,
    timestamp: new Date().toISOString(),
    expectedBalance: Number(expectedBalance),
    actualBalance: Number(actualBalance),
    discrepancy,
    status,
    denom100k: bills.denom100k || 0,
    denom50k: bills.denom50k || 0,
    denom20k: bills.denom20k || 0,
    denom10k: bills.denom10k || 0,
    denom5k: bills.denom5k || 0,
    denom2k: bills.denom2k || 0,
    denom1k: bills.denom1k || 0,
    denomCoin: bills.denomCoin || 0
  };

  reconciliations.unshift(newRecon);
  res.status(201).json({ success: true, data: newRecon });
});


// 4. Smart NLP parsing API backed by Gemini or Fallback RegEx
app.post("/api/ai/parse", async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim() === "") {
    return res.status(400).json({ success: false, message: "Ketik teks transaksi untuk diproses." });
  }

  console.log(`[AI Parser] Processing text: "${text}"`);
  
  const ai = getGeminiClient();
  if (!ai) {
    // Run rule-based regex fallback
    const parsed = parseWithRegex(text);
    return res.json({
      success: true,
      data: parsed,
      isFallback: true,
      message: "Menggunakan parser cerdas offline (Regex Fallback)."
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Parse input transaksi kas UMKM berikut menjadi JSON objek yang valid.
Input teks: "${text}"

Ketentuan:
1. Ekstrak deskripsi barang/jasanya secara ringkas, tanpa nominal harganya (contoh "Kresek hitam 15rb" menjadi "Kresek hitam ukuran besar").
2. Cari nominal uangnya secara cerdas. Konversi singkatan kasual pedagang Indonesia:
   - "k" atau "rb" berarti ribu (contoh: 15rb -> 15000, 10k -> 10000, 150 -> jika dalam konteks harga warung bisa 150000 atau biarkan jika 150 rupiah).
   - "jt" atau "juta" berarti juta (contoh: 1.5jt -> 1500000).
   - hilangkan separator titik/koma jika itu nominal ribuan (contoh: 15.000 -> 15000).
3. Tentukan jenis transaksi ("type"): "expense" (pengeluaran) atau "income" (pendapatan/pemasukan). Jika tidak disebutkan eksplisit, secara default asumsikan sebagai "expense" kecuali ada indikasi kuat penjualan/pendapatan.
4. Tentukan kategori singkat ("category") yang logis sesuai jenis bisnis UMKM warung makan/pasar, contoh kategori standard: "Bahan Baku", "Kemasan & Wadah", "Gas, Listrik & Air", "Keamanan & Kebersihan", "Sewa Tempat", "Transportasi", "Peralatan Baru", "Gaji Karyawan", "Penjualan", atau "Lainnya".

Format respon HARUS berupa JSON murni dengan struktur persis seperti ini:
{
  "description": "Nama barang/transaksi bersih tanpa harga",
  "amount": 15000,
  "type": "expense" or "income",
  "category": "Kategori Logis"
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            type: { 
              type: Type.STRING,
              description: "Must be 'expense' or 'income'"
            },
            category: { type: Type.STRING }
          },
          required: ["description", "amount", "type", "category"]
        }
      }
    });

    const textResponse = response.text ? response.text.trim() : "";
    const cleanedJson = JSON.parse(textResponse);
    
    // Safety corrections
    if (cleanedJson.type !== 'income' && cleanedJson.type !== 'expense') {
      cleanedJson.type = 'expense';
    }
    cleanedJson.amount = Number(cleanedJson.amount) || 10000;
    
    // Capitalize description
    if (cleanedJson.description) {
      cleanedJson.description = cleanedJson.description.charAt(0).toUpperCase() + cleanedJson.description.slice(1);
    }

    return res.json({
      success: true,
      data: cleanedJson,
      isFallback: false
    });
  } catch (error: any) {
    console.error("❌ Gemini parsing failed, running regex fallback. Error:", error);
    const parsed = parseWithRegex(text);
    return res.json({
      success: true,
      data: parsed,
      isFallback: true,
      errorDetails: error.message,
      message: "Gemini error. Menggunakan parser lokal cadangan."
    });
  }
});


// 5. Estimation of Tomorrow's Cash Coin Drawer needs (Pecahan Receh) API
app.post("/api/ai/estimate-change", async (req, res) => {
  const ai = getGeminiClient();
  const defaultSuggestions: ChangeSuggestion[] = [
    { denom: "Koin Rp500", value: 500, count: 20, reason: "Membantu kembalian nominal ganjil Rp500 untuk pembulatan kecil." },
    { denom: "Koin Rp1.000", value: 1000, count: 20, reason: "Kembalian paling sering digunakan untuk nominal bulat es teh, parkir, dsb." },
    { denom: "Kertas Rp2.000", value: 2000, count: 40, reason: "Sangat krusial untuk transaksi kelipatan kecil warung makan bernilai tanggung." },
    { denom: "Kertas Rp5.000", value: 5000, count: 30, reason: "Kembalian standar untuk pecahan dua puluh ribuan yang bayar makanan biasa." },
    { denom: "Kertas Rp10.000", value: 10000, count: 10, reason: "Untuk kembalian pembayaran pecahan besar seratus ribuan secara cepat." }
  ];

  const totalCalculated = defaultSuggestions.reduce((acc, current) => acc + (current.value * current.count), 0);

  if (!ai) {
    return res.json({
      success: true,
      data: {
        id: `est-${Date.now()}`,
        timestamp: new Date().toISOString(),
        totalNeeded: totalCalculated,
        suggestions: defaultSuggestions,
        aiAnalysis: "Analisis offline: Berdasarkan volume penjualan soto & es kelapa sedang ramai, amankan pasokan kertas Rp2.000 dan koin seribuan agar kasir tidak terhenti melayani antrean."
      },
      isFallback: true
    });
  }

  try {
    const recentTxList = transactions.slice(0, 20); // Last 20 logs
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analisis transaksi warung makan / kaki lima berikut dan berikan rekomendasi inventori pecahan uang receh kembalian (pecahan Rp500, Rp1.000, Rp2.000, Rp5.000, Rp10.000, Rp20.000) yang harus disiapkan di kasir untuk mengawali operasional besok pagi agar laci kasir lancar tanpa repot nuker uang kembalian.
Daftar transaksi kas terbaru: ${JSON.stringify(recentTxList)}

Format respon HARUS berupa JSON murni dengan struktur persis seperti ini:
{
  "totalNeeded": <total_jumlah_receh_disarankan>,
  "suggestions": [
    {
      "denom": "Koin Rp500" | "Koin Rp1.000" | "Kertas Rp2.000" | "Kertas Rp5.000" | "Kertas Rp10.000" | "Kertas Rp20.000",
      "value": 500 | 1000 | 2000 | 5000 | 10000 | 20000,
      "count": <jumlah_lembar_atau_keping_yang_sesuai_masuk_akal>,
      "reason": "Alasan bernada taktis bisnis kenapa pecahan ini penting disiapkan"
    }
  ],
  "aiAnalysis": "Analisis perilaku pecahan pembayaran konsumen didasarkan pada sisa transaksi di atas (maksutnya, jika sisa kas banyak ganjil, butuh receh porsi berapa. Tulis 2 kalimat persuasif)."
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalNeeded: { type: Type.INTEGER },
            aiAnalysis: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  denom: { type: Type.STRING },
                  value: { type: Type.INTEGER },
                  count: { type: Type.INTEGER },
                  reason: { type: Type.STRING }
                },
                required: ["denom", "value", "count", "reason"]
              }
            }
          },
          required: ["totalNeeded", "aiAnalysis", "suggestions"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    return res.json({
      success: true,
      data: {
        id: `est-${Date.now()}`,
        timestamp: new Date().toISOString(),
        totalNeeded: parsedJson.totalNeeded || totalCalculated,
        suggestions: parsedJson.suggestions || defaultSuggestions,
        aiAnalysis: parsedJson.aiAnalysis || "Analisis laci kasir: Dominasi transaksi makan di bawah Rp50.000 memerlukan uang kasir cadangan pecahan Rp2.000 dan Rp5.000 lebih banyak."
      },
      isFallback: false
    });
  } catch (error: any) {
    console.error("❌ Gemini change float forecasting failed, using rule-based default. Error:", error);
    return res.json({
      success: true,
      data: {
        id: `est-${Date.now()}`,
        timestamp: new Date().toISOString(),
        totalNeeded: totalCalculated,
        suggestions: defaultSuggestions,
        aiAnalysis: "Analisis offline (Fallback): Volatilitas nominal sisa kas menyarankan Anda untuk menyiapkan setidaknya 40 lembar uang Rp2.000 dan 20 lembar uang Rp5.000 pagi ini."
      },
      isFallback: true,
      errorDetails: error.message
    });
  }
});


// -------------------- VITE SERVING MIDDLEWARE --------------------

async function serveApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static files serving loaded from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartUMKM Server running fully-loaded on port ${PORT}`);
  });
}

serveApp().catch(err => {
  console.error("Critical error starting server:", err);
});
