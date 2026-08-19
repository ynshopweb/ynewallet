/**
 * api/ai/chat.js
 * ------------------------------------------------------------
 * Vercel Serverless Function — backend untuk YN AI.
 *
 * Alur keamanan:
 *   1. Frontend mengirim Firebase ID Token (Authorization: Bearer ...)
 *      dari user yang sedang login (window.currentUser.getIdToken()).
 *   2. Function ini memverifikasi token itu ke Firebase Identity
 *      Toolkit (server-side, jadi token tidak bisa dipalsukan dari
 *      browser) dan mendapatkan uid asli pemilik token.
 *   3. uid hasil verifikasi dicocokkan dengan clientUserId yang
 *      dikirim frontend — kalau tidak cocok, request ditolak.
 *   4. OPENAI_API_KEY HANYA ada di environment variable server ini,
 *      TIDAK PERNAH dikirim ke frontend.
 *
 * Function ini TIDAK pernah menulis ke Firestore. Ia hanya
 * mem-parsing bahasa natural menjadi draft terstruktur (JSON).
 * Penyimpanan sesungguhnya selalu dilakukan oleh frontend
 * (js/ai-chat.js -> window.saveState()) setelah user menekan
 * tombol "Simpan" / "Buat Goal", memakai auth & Firestore rules
 * yang sudah ada.
 *
 * Function ini juga TIDAK melakukan kalkulasi finansial (total
 * saldo, total pengeluaran, dsb) — angka-angka itu sudah dihitung
 * oleh frontend (js/ai-context.js) dan hanya dikirim sebagai
 * ringkasan kecil (bukan seluruh database) lewat field `context`.
 * ------------------------------------------------------------
 */

// Firebase Web API key project "ynwallet". Key ini SAMA dengan yang
// ada di js/firebase-config.js — bukan rahasia (Firebase Web API key
// memang didesain publik, keamanan sesungguhnya ada di Firestore
// Security Rules). Bisa dioverride lewat env var FIREBASE_API_KEY
// kalau suatu saat ganti project.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBKoe4dYdqtpXtLSmCF6QrMdh-JGoYW3A8";

const EXPENSE_CATEGORIES = [
    'Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Rumah', 'Pendidikan',
    'Hiburan', 'Kesehatan', 'Skincare', 'Kebutuhan pribadi', 'Kebutuhan toko', 'Lainnya'
];
const INCOME_CATEGORIES = [
    'Gaji Guru', 'Toko', 'Freelance', 'Invitasi', 'Affiliate', 'Bonus', 'Lainnya'
];

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY belum diset di environment variables.');
        return res.status(500).json({ ok: false, error: 'YN AI belum dikonfigurasi di server. Hubungi admin.' });
    }

    // --- 1) Verifikasi Firebase ID Token ---
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
    }

    let verifiedUid = null;
    try {
        const lookupRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            }
        );
        const lookupData = await lookupRes.json();
        if (!lookupRes.ok || !lookupData.users || !lookupData.users[0]) {
            return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
        }
        verifiedUid = lookupData.users[0].localId;
    } catch (err) {
        console.error('Firebase token verification error:', err);
        return res.status(401).json({ ok: false, error: 'Sesi tidak valid, silakan login ulang.' });
    }

    // --- 2) Ambil & validasi payload dari frontend ---
    const body = req.body || {};
    const { message, history, context, clientUserId } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ ok: false, error: 'Pesan kosong.' });
    }
    if (clientUserId !== verifiedUid) {
        // Defense-in-depth: uid dari token harus sama dengan uid yang diklaim frontend
        return res.status(403).json({ ok: false, error: 'Akses ditolak.' });
    }

    const safeContext = {
        today: (context && context.today) || new Date().toISOString().slice(0, 10),
        accounts: Array.isArray(context && context.accounts) ? context.accounts : [],
        goals: Array.isArray(context && context.goals) ? context.goals : [],
        financialSummary: (context && context.financialSummary) || null
    };

    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    // --- 3) Susun system prompt ---
    const systemPrompt = buildSystemPrompt(safeContext);

    // Gemini pakai role "user" / "model" (bukan "assistant" seperti OpenAI),
    // dan tidak punya role "system" di dalam `contents` — instruksi sistem
    // dikirim terpisah lewat field `system_instruction`.
    const contents = [
        ...safeHistory
            .filter(h => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
            .map(h => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }]
            })),
        { role: 'user', parts: [{ text: message }] }
    ];

    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // --- 4) Panggil Gemini ---
    try {
        const aiRes = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            console.error('Gemini API error:', aiRes.status, errText);
            return res.status(502).json({ ok: false, error: 'YN AI sedang mengalami gangguan. Coba beberapa saat lagi.' });
        }

        const aiData = await aiRes.json();

        // Gemini bisa menolak/memotong respons (mis. karena safety filter) —
        // dalam kasus itu candidates bisa kosong atau finishReason bukan "STOP".
        const candidate = aiData?.candidates?.[0];
        const rawText = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

        if (!rawText) {
            console.error('Gemini tidak mengembalikan teks. Full response:', JSON.stringify(aiData));
            return res.status(200).json({
                ok: true,
                data: {
                    intent: 'clarification',
                    answer: 'Maaf, aku belum bisa memahami itu. Coba tulis seperti: "beli makan 25 ribu pakai cash".',
                    requires_confirmation: false
                }
            });
        }

        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch (parseErr) {
            console.error('Gagal parse JSON dari Gemini:', rawText);
            return res.status(200).json({
                ok: true,
                data: {
                    intent: 'clarification',
                    answer: 'Maaf, aku belum bisa memahami itu. Coba tulis seperti: "beli makan 25 ribu pakai cash".',
                    requires_confirmation: false
                }
            });
        }

        return res.status(200).json({ ok: true, data: parsed });
    } catch (err) {
        console.error('AI chat handler error:', err);
        return res.status(500).json({ ok: false, error: 'YN AI sedang mengalami gangguan. Coba beberapa saat lagi.' });
    }
};

function buildSystemPrompt(ctx) {
    const accountNames = ctx.accounts.map(a => a.name);
    const goalList = ctx.goals.map(g => `${g.id}:${g.name}`);

    return `Kamu adalah YN AI, asisten keuangan pribadi di aplikasi YN WALLET. Kamu berbicara Bahasa Indonesia sehari-hari, ramah, singkat, dan Gen Z tapi tetap sopan.

TUGAS UTAMA kamu adalah mengubah kalimat natural dari user menjadi DRAFT terstruktur (JSON) tentang transaksi/goal, ATAU menjawab pertanyaan finansial memakai data ringkasan yang sudah disediakan. Kamu TIDAK PERNAH menyimpan apa pun ke database — kamu hanya membuat draft, user yang akan konfirmasi manual.

DATA YANG TERSEDIA UNTUK USER INI (jangan pernah mengarang di luar ini):
- Tanggal hari ini: ${ctx.today}
- Akun/aset yang tersedia: ${accountNames.length ? accountNames.join(', ') : '(belum ada akun tersimpan)'}
- Goal yang sudah ada (format id:nama): ${goalList.length ? goalList.join(', ') : '(belum ada goal)'}
- Ringkasan keuangan (sudah dihitung oleh aplikasi, JANGAN dihitung ulang, JANGAN diragukan, gunakan apa adanya kalau relevan menjawab pertanyaan): ${ctx.financialSummary ? JSON.stringify(ctx.financialSummary) : '(tidak tersedia)'}

KATEGORI EXPENSE yang valid: ${EXPENSE_CATEGORIES.join(', ')}
KATEGORI INCOME yang valid: ${INCOME_CATEGORIES.join(', ')}
Kalau kategori tidak jelas/tidak cocok, pakai "Lainnya". Jangan membuat kategori baru.

ATURAN PENTING:
1. Kalau user menyebut akun yang TIDAK ADA di daftar akun di atas, JANGAN menerimanya begitu saja sebagai akun valid — anggap "account" tetap null dan minta klarifikasi lewat missing_fields, atau kalau perlu jelaskan lewat "answer" bahwa akun itu belum terdaftar.
2. JANGAN PERNAH menebak akun kalau user tidak menyebutkannya. Masukkan "account": null dan tambahkan "account" ke missing_fields.
3. JANGAN PERNAH menebak nominal. Kalau nominal tidak disebutkan jelas (mis. "lumayan mahal"), jangan buat transaksi — pakai intent "clarification" dan tanyakan nominalnya.
4. Bedakan dengan tepat: expense (keluar uang untuk kebutuhan), income (uang masuk/gaji/pendapatan), transfer (pindah uang antar akun milik sendiri, TIDAK mempengaruhi net worth, WAJIB ada fromAccount dan toAccount berbeda), goal_contribution (uang dialokasikan dari akun ke goal yang SUDAH ADA — ini BUKAN expense dan BUKAN income).
5. Untuk goal_contribution, cari goalId dari daftar goal yang tersedia berdasarkan nama yang disebut user (gunakan pencocokan nama yang masuk akal). Kalau goal yang dimaksud tidak ditemukan di daftar, jelaskan lewat "answer" bahwa goal itu belum ada dan sarankan membuat goal baru dulu.
6. Untuk permintaan goal baru (create_goal), JANGAN langsung membuatnya — buat draft dengan estimated_monthly_saving = target dibagi jumlah bulan sampai deadline (dibulatkan), lalu user akan menekan tombol "Buat Goal" sendiri di frontend.
7. Tanggal: pahami bahasa natural ("kemarin", "tanggal 15", "bulan lalu") relatif terhadap hari ini (${ctx.today}) dan hasilkan format YYYY-MM-DD. Kalau ambigu, tanyakan lewat clarification.
8. Untuk pertanyaan finansial (financial_question), jawab HANYA berdasarkan ringkasan keuangan yang diberikan di atas. Jangan mengarang angka. Kalau data yang dibutuhkan tidak ada di ringkasan, katakan kamu belum bisa menghitungnya.
9. Jangan pernah memberi rekomendasi investasi atau keputusan finansial berisiko. Untuk pertanyaan "apakah aku bisa beli X", berikan estimasi sederhana berbasis angka yang tersedia saja, dan sebutkan itu hanya estimasi kasar.
10. Percakapan bisa berlanjut dari histori sebelumnya — misalnya kalau kamu baru saja menanyakan akun dan user membalas cuma "cash", pahami itu sebagai jawaban dari pertanyaan sebelumnya dan gabungkan dengan draft transaksi yang tadi belum lengkap.

FORMAT OUTPUT — WAJIB HANYA JSON VALID, TANPA TEKS LAIN, TANPA MARKDOWN, sesuai salah satu bentuk berikut:

Untuk transaksi (expense/income/transfer/goal_contribution):
{
  "intent": "create_transaction",
  "transaction": {
    "type": "expense" | "income" | "transfer" | "goal_contribution",
    "amount": number | null,
    "category": string | null,
    "account": string | null,
    "fromAccount": string | null,
    "toAccount": string | null,
    "goalId": string | null,
    "goalName": string | null,
    "description": string,
    "date": "YYYY-MM-DD"
  },
  "missing_fields": string[],
  "confidence": number,
  "reply": string
}

Untuk goal baru:
{
  "intent": "create_goal",
  "goal": {
    "name": string,
    "icon": string,
    "target": number,
    "deadline": "YYYY-MM-DD",
    "estimated_monthly_saving": number
  },
  "reply": string
}

Untuk pertanyaan finansial:
{
  "intent": "financial_question",
  "answer": string,
  "requires_confirmation": false
}

Untuk klarifikasi / info kurang / tidak paham:
{
  "intent": "clarification",
  "answer": string,
  "requires_confirmation": false
}

"reply" dan "answer" harus dalam Bahasa Indonesia santai, singkat (maks 2 kalimat), dan ramah. Jangan pernah membalas selain format JSON di atas.`;
}
