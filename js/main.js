/**
 * main.js
 * ------------------------------------------------------------
 * Entry point aplikasi YN MONEY.
 * Meng-import semua modul (efek sampingnya adalah mendaftarkan
 * fungsi-fungsi ke window.*, persis seperti versi single-file).
 *
 * Render pertama TIDAK dipicu di sini lagi — sekarang dikontrol oleh
 * auth.js lewat onAuthStateChanged(): begitu status login diketahui
 * (baik user sudah login maupun belum), auth.js yang menampilkan
 * #app-shell atau #auth-screen lalu memanggil window.renderCurrentTab().
 *
 * ai-chat.js (fitur YN AI) diimpor terakhir karena tidak ada modul
 * lain yang bergantung padanya.
 *
 * Urutan import di bawah tidak memengaruhi urutan eksekusi modul
 * (ES Modules otomatis resolve dependency graph-nya), disusun
 * begini hanya supaya mudah dibaca sesuai alur aplikasi.
 * ------------------------------------------------------------
 */
import './state.js';
import './auth.js';
import './navigation.js';
import './render.js';
import './modals.js';
import './form-handlers.js';
import './crud-actions.js';
import './ai-chat.js';
