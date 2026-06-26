# NeonBoard 📍🔥

Aplikasi papan memo/pengumuman real-time sederhana yang dibangun dengan teknologi web standar (HTML, CSS, dan Javascript murni) serta didukung oleh database real-time cloud **Firebase Cloud Firestore**.

Aplikasi ini menggunakan modul Firebase Web SDK v10 dan dirancang dengan antarmuka **Glassmorphism Gelap Premium** yang responsif baik di desktop maupun ponsel pintar.

---

## ✨ Fitur Utama

1. **Real-time Synced Message Board**: Pengguna dapat melihat penambahan memo baru secara instan di layar mereka tanpa perlu memuat ulang (refresh) halaman.
2. **Kustomisasi Warna Memo**: Tersedia pilihan warna memo pastel neon yang dinamis (Biru, Merah Muda, Oranye, dan Hijau).
3. **Setup Database Dinamis**: Tidak memerlukan konfigurasi kunci API secara hardcode di dalam file JS. Konfigurasi Firebase dapat dimasukkan secara langsung di layar pengaturan aplikasi web dan disimpan dengan aman menggunakan `localStorage`.
4. **Desain Modern Premium**: Dilengkapi dengan animasi gradasi latar belakang dan tata letak grid yang rapi.

---

## 📂 Struktur Folder Proyek

* `index.html` - Kerangka utama aplikasi dan form input memo.
* `style.css` - Desain tampilan dengan efek blur kaca, pendaran neon, serta warna kartu.
* `app.js` - Logika inisialisasi Firebase Firestore, sinkronisasi data real-time, dan fungsi tambah memo.

---

## 🚀 Cara Menjalankan Aplikasi Secara Lokal

Anda dapat menjalankan web server lokal di folder proyek ini dengan sangat mudah:

### Menggunakan Python (Termux / Linux / macOS)
1. Buka terminal Anda dan navigasikan ke dalam folder proyek.
2. Jalankan perintah web server:
   ```bash
   python3 -m http.server 8083
   ```
3. Buka browser favorit Anda dan akses:
   ```text
   http://localhost:8083
   ```
   
---

## 🛠️ Lisensi & Kontribusi
Aplikasi ini dibuat secara terbuka untuk dipelajari oleh pemula. Silakan fork, modifikasi, dan kembangkan fitur-fitur baru lainnya!
