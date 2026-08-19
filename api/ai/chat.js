/**
 * api/ai/chat.js
 * ------------------------------------------------------------
 * Vercel Serverless Function — backend untuk YN AI.
 *
 * Alur keamanan:
 *   1. Frontend mengirim Firebase ID Token melalui:
 *      Authorization: Bearer <token>
 *   2. Token diverifikasi melalui Firebase Identity Toolkit.
 *   3. UID hasil verifikasi dicocokkan dengan clientUserId.
 *   4. OPENAI_API_KEY hanya berada di server/Vercel Environment
 *      Variables dan tidak pernah dikirim ke frontend.
 *
 * Function ini TIDAK menulis ke Firestore.
 * Function ini hanya membuat draft terstruktur dari bahasa natural.
 * Penyimpanan tetap dilakukan frontend setelah user melakukan
 * konfirmasi.
 * ------------------------------------------------------------
 */

// ============================================================
// CONFIG
// ============================================================

const FIREBASE_API_KEY =
    process.env.FIREBASE_API_KEY ||
    "AIzaSyBKoe4dYdqtpXtLSmCF6QrMdh-JGoYW3A8";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const OPENAI_MODEL = "gpt-4o-mini";

// ============================================================
// KATEGORI YN WALLET
// ============================================================

const EXPENSE_CATEGORIES = [
    "Makanan",
    "Transportasi",
    "Belanja",
    "Tagihan",
    "Rumah",
    "Pendidikan",
    "Hiburan",
    "Kesehatan",
    "Skincare",
    "Kebutuhan pribadi",
    "Kebutuhan toko",
    "Lainnya"
];

const INCOME_CATEGORIES = [
    "Gaji Guru",
    "Toko",
    "Freelance",
    "Invitasi",
    "Affiliate",
    "Bonus",
    "Lainnya"
];

// ============================================================
// MAIN HANDLER
// ============================================================

module.exports = async function handler(req, res) {

    // --------------------------------------------------------
    // 0. METHOD CHECK
    // --------------------------------------------------------

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            ok: false,
            error: "Method not allowed"
        });
    }

    // --------------------------------------------------------
    // 1. OPENAI CONFIG CHECK
    // --------------------------------------------------------

    if (!OPENAI_API_KEY) {
        console.error(
            "[YN AI] OPENAI_API_KEY belum tersedia di environment."
        );

        return res.status(500).json({
            ok: false,
            error: "YN AI belum dikonfigurasi di server. Hubungi admin."
        });
    }

    // Safe diagnostic.
    // Hanya menunjukkan apakah key tersedia.
    // TIDAK pernah mencetak API key.
    console.log(
        "[YN AI] OpenAI API key configured:",
        Boolean(OPENAI_API_KEY)
    );

    // --------------------------------------------------------
    // 2. FIREBASE ID TOKEN
    // --------------------------------------------------------

    const authHeader = req.headers.authorization || "";

    const idToken = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;

    if (!idToken) {
        return res.status(401).json({
            ok: false,
            error: "Sesi tidak valid, silakan login ulang."
        });
    }

    // --------------------------------------------------------
    // 3. VERIFY FIREBASE ID TOKEN
    // --------------------------------------------------------

    let verifiedUid = null;

    try {

        const firebaseLookupUrl =
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;

        const lookupRes = await fetch(
            firebaseLookupUrl,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    idToken
                })
            }
        );

        const lookupData = await lookupRes.json();

        if (
            !lookupRes.ok ||
            !lookupData.users ||
            !lookupData.users[0] ||
            !lookupData.users[0].localId
        ) {

            console.error(
                "[YN AI] Firebase token verification failed:",
                lookupRes.status,
                lookupData?.error?.message || "Unknown Firebase error"
            );

            return res.status(401).json({
                ok: false,
                error: "Sesi tidak valid, silakan login ulang."
            });
        }

        verifiedUid = lookupData.users[0].localId;

    } catch (err) {

        console.error(
            "[YN AI] Firebase token verification error:",
            err?.message || err
        );

        return res.status(401).json({
            ok: false,
            error: "Sesi tidak valid, silakan login ulang."
        });
    }

    // --------------------------------------------------------
    // 4. READ REQUEST BODY
    // --------------------------------------------------------

    const body = req.body || {};

    const {
        message,
        history,
        context,
        clientUserId
    } = body;

    // --------------------------------------------------------
    // 5. VALIDATE MESSAGE
    // --------------------------------------------------------

    if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
    ) {

        return res.status(400).json({
            ok: false,
            error: "Pesan kosong."
        });
    }

    // --------------------------------------------------------
    // 6. UID MATCH
    // --------------------------------------------------------

    if (clientUserId !== verifiedUid) {

        console.error(
            "[YN AI] UID mismatch."
        );

        return res.status(403).json({
            ok: false,
            error: "Akses ditolak."
        });
    }

    // --------------------------------------------------------
    // 7. SAFE CONTEXT
    // --------------------------------------------------------

    const safeContext = {
        today:
            context &&
            context.today
                ? context.today
                : new Date().toISOString().slice(0, 10),

        accounts:
            context &&
            Array.isArray(context.accounts)
                ? context.accounts
                : [],

        goals:
            context &&
            Array.isArray(context.goals)
                ? context.goals
                : [],

        financialSummary:
            context &&
            context.financialSummary
                ? context.financialSummary
                : null
    };

    // Batasi history supaya request tetap kecil.
    const safeHistory =
        Array.isArray(history)
            ? history.slice(-8)
            : [];

    // --------------------------------------------------------
    // 8. SYSTEM PROMPT
    // --------------------------------------------------------

    const systemPrompt =
        buildSystemPrompt(safeContext);

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },

        ...safeHistory
            .filter(
                (item) =>
                    item &&
                    (
                        item.role === "user" ||
                        item.role === "assistant"
                    ) &&
                    typeof item.content === "string"
            )
            .map(
                (item) => ({
                    role: item.role,
                    content: item.content
                })
            ),

        {
            role: "user",
            content: message.trim()
        }
    ];

    // --------------------------------------------------------
    // 9. OPENAI REQUEST
    // --------------------------------------------------------

    try {

        console.log(
            "[YN AI] Sending request to OpenAI:",
            {
                model: OPENAI_MODEL,
                messageLength: message.length,
                historyLength: safeHistory.length
            }
        );

        const aiRes = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },

                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    temperature: 0.2,
                    response_format: {
                        type: "json_object"
                    },
                    messages
                })
            }
        );

        // ----------------------------------------------------
        // 10. HANDLE OPENAI ERROR
        // ----------------------------------------------------

        if (!aiRes.ok) {

            let errorData = null;
            let errorText = "";

            try {
                errorData = await aiRes.json();
            } catch {
                try {
                    errorText = await aiRes.text();
                } catch {
                    errorText = "";
                }
            }

            const openAIError =
                errorData?.error || {};

            console.error(
                "[YN AI] OpenAI API error:",
                {
                    status: aiRes.status,
                    type: openAIError.type || null,
                    code: openAIError.code || null,
                    message: openAIError.message || errorText || null,
                    model: OPENAI_MODEL
                }
            );

            // Jangan pernah mengirim detail secret ke frontend.
            return res.status(502).json({
                ok: false,
                error: "YN AI sedang mengalami gangguan. Coba beberapa saat lagi.",
                debug:
                    process.env.NODE_ENV === "production"
                        ? undefined
                        : {
                            stage: "openai",
                            status: aiRes.status,
                            type: openAIError.type || null,
                            code: openAIError.code || null
                        }
            });
        }

        // ----------------------------------------------------
        // 11. PARSE OPENAI RESPONSE
        // ----------------------------------------------------

        const aiData = await aiRes.json();

        const rawText =
            aiData?.choices?.[0]?.message?.content || "";

        if (!rawText) {

            console.error(
                "[YN AI] OpenAI returned empty content."
            );

            return res.status(200).json({
                ok: true,

                data: {
                    intent: "clarification",

                    answer:
                        "Maaf, aku belum mendapat jawaban dari AI. Coba kirim lagi ya.",

                    requires_confirmation: false
                }
            });
        }

        // ----------------------------------------------------
        // 12. PARSE JSON
        // ----------------------------------------------------

        let parsed;

        try {

            parsed = JSON.parse(rawText);

        } catch (parseErr) {

            console.error(
                "[YN AI] Failed to parse OpenAI JSON:",
                {
                    error: parseErr?.message || parseErr
                }
            );

            return res.status(200).json({
                ok: true,

                data: {
                    intent: "clarification",

                    answer:
                        'Maaf, aku belum bisa memahami itu. Coba tulis seperti "beli makan 25 ribu pakai cash".',

                    requires_confirmation: false
                }
            });
        }

        // ----------------------------------------------------
        // 13. SUCCESS
        // ----------------------------------------------------

        return res.status(200).json({
            ok: true,
            data: parsed
        });

    } catch (err) {

        console.error(
            "[YN AI] Handler error:",
            {
                message: err?.message || String(err),
                name: err?.name || null
            }
        );

        return res.status(500).json({
            ok: false,
            error: "YN AI sedang mengalami gangguan. Coba beberapa saat lagi."
        });
    }
};

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt(ctx) {

    const accountNames =
        ctx.accounts
            .map((account) => account?.name)
            .filter(Boolean);

    const goalList =
        ctx.goals
            .map(
                (goal) =>
                    `${goal?.id || ""}:${goal?.name || ""}`
            )
            .filter(
                (value) => value !== ":"
            );

    return `
Kamu adalah YN AI, asisten keuangan pribadi di aplikasi YN WALLET.

Kamu berbicara Bahasa Indonesia sehari-hari, ramah, singkat, dan Gen Z tetapi tetap sopan.

TUGAS UTAMA:

1. Mengubah bahasa natural user menjadi DRAFT transaksi/goal terstruktur.
2. Menjawab pertanyaan finansial berdasarkan ringkasan keuangan yang diberikan.
3. Kamu TIDAK PERNAH menyimpan data ke database.
4. User harus mengonfirmasi draft terlebih dahulu.

DATA USER:

Tanggal hari ini:
${ctx.today}

Akun/aset yang tersedia:
${
    accountNames.length
        ? accountNames.join(", ")
        : "(belum ada akun tersimpan)"
}

Goal yang sudah ada:
${
    goalList.length
        ? goalList.join(", ")
        : "(belum ada goal)"
}

Ringkasan keuangan:
${
    ctx.financialSummary
        ? JSON.stringify(ctx.financialSummary)
        : "(tidak tersedia)"
}

KATEGORI EXPENSE YANG VALID:

${EXPENSE_CATEGORIES.join(", ")}

KATEGORI INCOME YANG VALID:

${INCOME_CATEGORIES.join(", ")}

Jika kategori tidak jelas atau tidak cocok, gunakan "Lainnya".

ATURAN PENTING:

1. Jika user menyebut akun yang TIDAK ADA dalam daftar akun user, jangan menganggapnya valid.

2. Jangan pernah menebak akun.

Jika akun tidak disebutkan:
"account": null

dan masukkan:
"account"

ke dalam missing_fields.

3. Jangan pernah menebak nominal.

Jika nominal tidak jelas, gunakan intent clarification.

4. Bedakan:

expense
= uang keluar untuk kebutuhan.

income
= uang masuk / pendapatan.

transfer
= perpindahan uang antar akun milik sendiri dan tidak mengubah net worth.

goal_contribution
= uang dialokasikan dari akun ke goal yang sudah ada.

5. Untuk goal_contribution, cari goalId berdasarkan daftar goal yang tersedia.

Jika goal tidak ditemukan, jelaskan bahwa goal tersebut belum ada.

6. Untuk goal baru:

Gunakan intent:
"create_goal"

Jangan langsung menyimpan goal.

Hitung:
estimated_monthly_saving =
target dibagi jumlah bulan sampai deadline.

Bulatkan hasilnya.

7. Pahami tanggal natural seperti:

"hari ini"
"kemarin"
"tanggal 15"
"bulan lalu"

Gunakan tanggal hari ini sebagai referensi:

${ctx.today}

Hasil tanggal harus:

YYYY-MM-DD

Jika ambigu, gunakan clarification.

8. Untuk financial_question:

Gunakan HANYA data financialSummary.

Jangan mengarang angka.

9. Jangan memberikan rekomendasi investasi berisiko.

10. Percakapan dapat menggunakan histori sebelumnya.

Contoh:

AI:
"Akun mana yang dipakai?"

User:
"cash"

Pahami "cash" sebagai jawaban terhadap pertanyaan sebelumnya jika histori mendukung.

FORMAT OUTPUT:

WAJIB JSON VALID.

JANGAN menggunakan Markdown.

JANGAN memberikan teks di luar JSON.

UNTUK TRANSAKSI:

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
  "missing_fields": [],
  "confidence": number,
  "reply": string
}

UNTUK GOAL BARU:

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

UNTUK PERTANYAAN FINANSIAL:

{
  "intent": "financial_question",
  "answer": string,
  "requires_confirmation": false
}

UNTUK KLARIFIKASI:

{
  "intent": "clarification",
  "answer": string,
  "requires_confirmation": false
}

"reply" dan "answer" harus Bahasa Indonesia santai, singkat, maksimal 2 kalimat.

Jangan pernah membalas selain JSON valid.
`;
}