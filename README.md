# 🌱 LadangAlir

App pengurusan ladang dengan **conveyor cropping** — jadual penanaman bertingkat untuk tuaian berterusan.

## Cara Deploy ke GitHub Pages (langkah demi langkah)

### 1. Buat repo GitHub baharu
- Pergi [github.com/new](https://github.com/new)
- Nama repo: `ladangalir` (mesti sama dengan nilai `base` dalam `vite.config.js`)
- Visibility: Public
- Klik **Create repository**

### 2. Upload fail projek ini
```bash
# Dalam folder projek ini
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/ladangalir.git
git push -u origin main
```
Gantikan `USERNAME` dengan username GitHub anda.

### 3. Aktifkan GitHub Pages
- Pergi ke repo → **Settings** → **Pages**
- Di bawah **Build and deployment**, tukar Source kepada **GitHub Actions**
- Klik Save

### 4. Tunggu deploy selesai
- Pergi ke tab **Actions** — anda akan nampak workflow `Deploy LadangAlir ke GitHub Pages` sedang berjalan
- Selepas ~2 minit, app anda live di:
  ```
  https://USERNAME.github.io/ladangalir/
  ```

---

### Kalau nak tukar nama repo
Edit `vite.config.js` baris ini:
```js
base: '/ladangalir/',  // ← tukar kepada nama repo anda
```

### Nak guna domain sendiri?
1. Beli domain (cth: dari Exabytes, Namecheap)
2. Dalam repo → Settings → Pages → Custom domain → masukkan domain anda
3. Tambah fail `public/CNAME` dengan kandungan nama domain anda:
   ```
   ladangalir.com
   ```

---

## Jalankan secara lokal
```bash
npm install
npm run dev
```
Buka http://localhost:5173/ladangalir/
