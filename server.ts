import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import cors from "cors";

const DB_FILE = path.join(process.cwd(), "db.json");

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  const initialData = {
    petugas: [
      { id_petugas: "ADM01", nama: "Admin Tokata", no_hp: "08123456789", password: "admin", jabatan: "Admin", foto: "" }
    ],
    nasabah: [
      { id_nasabah: "NSB001", nik: "1234567890123456", nama: "Budi Santoso", no_hp: "08111111111", pin: "1234", foto: "", latitude: -6.2, longitude: 106.8, update_lokasi: new Date().toISOString(), tanggal_daftar: new Date().toISOString() },
      { id_nasabah: "NSB002", nik: "1234567890123457", nama: "Angga", no_hp: "08222222222", pin: "1234", foto: "", latitude: -6.21, longitude: 106.81, update_lokasi: new Date().toISOString(), tanggal_daftar: new Date().toISOString() }
    ],
    modal_awal: [],
    pengeluaran: [],
    pinjaman_aktif: [
      { id_pinjaman: "CTR001", tanggal_acc: new Date().toISOString(), id_nasabah: "NSB002", nama: "Angga", pokok: 500000, bunga_persen: 20, total_hutang: 600000, tenor: 10, cicilan: 60000, sisa_hutang: 0, status: "Lunas", kolektor: "ADM01", tanggal_cair: new Date().toISOString(), bukti_cair: "" },
      { id_pinjaman: "CTR002", tanggal_acc: new Date().toISOString(), id_nasabah: "NSB002", nama: "Angga", pokok: 1000000, bunga_persen: 20, total_hutang: 1200000, tenor: 10, cicilan: 120000, sisa_hutang: 1200000, status: "Aktif", kolektor: "ADM01", tanggal_cair: new Date().toISOString(), bukti_cair: "" }
    ],
    pengajuan_pinjaman: [
      { id_pengajuan: "REQ001", tanggal: new Date().toISOString(), id_nasabah: "NSB001", nama: "Budi Santoso", jumlah: 1000000, tenor: 10, petugas: "Kolektor 1", status: "Pending" }
    ],
    simpanan: [],
    angsuran: [],
    pemasukan: []
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

function getDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return {
        petugas: [], nasabah: [], modal_awal: [], pengeluaran: [], 
        pinjaman_aktif: [], pengajuan_pinjaman: [], simpanan: [], 
        angsuran: [], pemasukan: []
      };
    }
    const content = fs.readFileSync(DB_FILE, "utf-8");
    const db = JSON.parse(content);
    // Ensure all keys exist
    db.petugas = db.petugas || [];
    db.nasabah = db.nasabah || [];
    db.modal_awal = db.modal_awal || [];
    db.pengeluaran = db.pengeluaran || [];
    db.pinjaman_aktif = db.pinjaman_aktif || [];
    db.pengajuan_pinjaman = db.pengajuan_pinjaman || [];
    db.simpanan = db.simpanan || [];
    db.angsuran = db.angsuran || [];
    db.pemasukan = db.pemasukan || [];
    return db;
  } catch (e) {
    console.error("Error reading DB:", e);
    return {
      petugas: [], nasabah: [], modal_awal: [], pengeluaran: [], 
      pinjaman_aktif: [], pengajuan_pinjaman: [], simpanan: [], 
      angsuran: [], pemasukan: []
    };
  }
}

function saveDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error saving DB:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb', type: ['application/json', 'text/plain'] }));

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.post("/api", async (req, res) => {
    console.log(`[Server] Received request: ${req.body?.action}`);
    const remoteUrl = process.env.VITE_API_URL;
    
    // Jika ada URL remote, teruskan permintaan ke sana (Proxy Mode)
    if (remoteUrl && remoteUrl.startsWith('http')) {
      try {
        const bodyStr = JSON.stringify(req.body);
        const payloadSize = bodyStr.length;
        const fotoLength = req.body.payload?.foto ? req.body.payload.foto.length : 0;
        
        console.log(`[Proxy] Forwarding ${req.body.action} to GAS. Payload: ${(payloadSize / 1024).toFixed(2)} KB, Foto: ${fotoLength} chars`);
        console.log(`[Proxy] Body preview: ${bodyStr.substring(0, 150)}...`);

        const response = await fetch(remoteUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'text/plain;charset=utf-8',
            'Accept': 'application/json'
          },
          body: bodyStr,
          redirect: 'follow'
        });
        
        const text = await response.text();
        
        try {
          const data = JSON.parse(text);
          console.log(`[Proxy Success] ${req.body.action} response received`);
          return res.json(data);
        } catch (parseError) {
          console.error(`[Proxy Error] Non-JSON response for ${req.body.action}:`, text.substring(0, 1000));
          
          // Mencoba mengekstrak pesan error dari HTML Google
          let errorMsg = "Google Apps Script mengembalikan error teknis.";
          const match = text.match(/<div[^>]*class="errorMessage"[^>]*>([^<]+)<\/div>/i);
          if (match && match[1]) {
            errorMsg = `Google Script Error: ${match[1].trim()}`;
          } else if (text.includes("<!DOCTYPE") || text.includes("<html")) {
            errorMsg = "Google Apps Script mengalami crash. Ini biasanya terjadi jika data foto terlalu besar untuk disimpan di sel Spreadsheet.";
          }

          return res.json({ 
            success: false, 
            message: errorMsg,
            details: text.substring(0, 100) 
          });
        }
      } catch (error: any) {
        console.error(`[Proxy Network Error] ${req.body.action}:`, error.message);
        return res.json({ success: false, message: "Gagal menghubungi Google Script: " + error.message });
      }
    }

    try {
      const { action, payload } = req.body || {};
      if (!action) return res.json({ success: false, message: "No action provided" });
      
      const db = getDB();

      switch (action) {
        case "LOGIN": {
          const { role, identifier, password } = payload || {};
          if (role === "ADMIN" || role === "KOLEKTOR") {
            const user = db.petugas.find((u: any) => 
              (u.id_petugas === identifier || u.no_hp === identifier) && u.password === password
            );
            if (user && user.jabatan.toUpperCase() === role) {
              return res.json({ success: true, user });
            }
          } else {
            const user = db.nasabah.find((u: any) => u.no_hp === identifier && u.pin === password);
            if (user) return res.json({ success: true, user });
          }
          return res.json({ success: false, message: "Kredensial tidak valid." });
        }

        case "GET_DASHBOARD_DATA": {
          const { role, id_user } = payload || {};
          if (role === "ADMIN") {
            const stats = {
              modal: (db.modal_awal || []).reduce((acc: number, cur: any) => acc + (cur.jumlah || 0), 0),
              pengeluaran: (db.pengeluaran || []).reduce((acc: number, cur: any) => acc + (cur.jumlah || 0), 0),
              pinjaman_aktif: (db.pinjaman_aktif || []).reduce((acc: number, cur: any) => acc + (cur.pokok || 0), 0),
              total_nasabah: (db.nasabah || []).length
            };

            // Mock mutation logic for local dev
            const mutations: any[] = [];
            if (db.angsuran) db.angsuran.forEach((d: any) => mutations.push({...d, tipe: 'Angsuran', nominal: d.jumlah || d.jumlah_bayar || 0, ket: 'Bayar Angsuran ' + (d.id_pinjam || '')}));
            if (db.pengeluaran) db.pengeluaran.forEach((d: any) => mutations.push({...d, tipe: 'Pengeluaran', nominal: d.jumlah || 0, ket: (d.jenis || '') + ': ' + (d.keterangan || '')}));
            if (db.modal_awal) db.modal_awal.forEach((d: any) => mutations.push({...d, tipe: 'Setoran Modal', nominal: d.jumlah || 0, ket: d.keterangan || ''}));
            if (db.simpanan) db.simpanan.forEach((d: any) => mutations.push({...d, tipe: (d.setor || 0) > 0 ? 'Simpanan' : 'Tarik Simpanan', nominal: (d.setor || 0) > 0 ? d.setor : (d.tarik || 0), ket: d.keterangan || ''}));
            if (db.pinjaman_aktif) db.pinjaman_aktif.forEach((d: any) => mutations.push({...d, tipe: 'Pencairan', nominal: d.pokok || 0, ket: 'Pencairan Pinjaman ' + (d.nama || '')}));
            if (db.pemasukan) db.pemasukan.forEach((d: any) => mutations.push({...d, tipe: 'Pemasukan', nominal: d.jumlah || 0, ket: d.keterangan || 'Admin Cair 5%'}));

            return res.json({
              success: true,
              data: {
                stats,
                pengajuan_pending: (db.pengajuan_pinjaman || []).filter((p: any) => p.status === "Pending"),
                jadwal_global: (db.pinjaman_aktif || []).filter((p: any) => p.status === "Aktif"),
                nasabah_list: db.nasabah || [],
                petugas_list: db.petugas || [],
                all_loans: db.pinjaman_aktif || [],
                mutasi: mutations.sort((a, b) => {
                  const dateA = new Date(a.tanggal || a.tanggal_acc || a.tanggal_cair || 0).getTime();
                  const dateB = new Date(b.tanggal || b.tanggal_acc || b.tanggal_cair || 0).getTime();
                  return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                }),
                pemasukan_list: db.pemasukan || []
              }
            });
          } else if (role === "KOLEKTOR") {
            const nasabah_list = (db.nasabah || []).map((n: any) => {
              const balance = (db.simpanan || [])
                .filter((s: any) => String(s.id_nasabah) === String(n.id_nasabah))
                .reduce((acc: number, cur: any) => acc + ((cur.setor || 0) - (cur.tarik || 0)), 0);
              return { ...n, saldo_simpanan: balance };
            });
            return res.json({
              success: true,
              data: {
                nasabah_list,
                pengajuan_approved: (db.pengajuan_pinjaman || []).filter((p: any) => p.status === "Approved"),
                penagihan_list: (db.pinjaman_aktif || []).filter((p: any) => p.status === "Aktif")
              }
            });
          } else if (role === "NASABAH") {
            return res.json({
              success: true,
              data: {
                simpanan: (db.simpanan || []).filter((s: any) => s.id_nasabah === id_user),
                pinjaman: (db.pinjaman_aktif || []).filter((p: any) => p.id_nasabah === id_user)
              }
            });
          }
          return res.json({ success: false });
        }

        case "REGISTER_NASABAH": {
          const id = "NSB" + Math.floor(1000 + Math.random() * 9000);
          const newNasabah = {
            id_nasabah: id,
            ...payload,
            tanggal_daftar: new Date().toISOString(),
            update_lokasi: new Date().toISOString()
          };
          db.nasabah.push(newNasabah);
          saveDB(db);
          return res.json({ success: true, id_nasabah: id });
        }

        case "AJUKAN_PINJAMAN": {
          const id = "REQ" + new Date().getTime();
          db.pengajuan_pinjaman.push({
            id_pengajuan: id,
            tanggal: new Date().toISOString(),
            ...payload,
            status: "Pending"
          });
          saveDB(db);
          return res.json({ success: true });
        }

        case "APPROVE_PINJAMAN": {
          const idx = db.pengajuan_pinjaman.findIndex((p: any) => p.id_pengajuan === payload.id_pengajuan);
          if (idx !== -1) {
            db.pengajuan_pinjaman[idx].status = "Approved";
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "CAIRKAN_PINJAMAN": {
          const pIdx = db.pengajuan_pinjaman.findIndex((p: any) => p.id_pengajuan === payload.id_pengajuan);
          if (pIdx !== -1) {
            const pData = db.pengajuan_pinjaman[pIdx];
            const amount = Number(pData.jumlah);
            let bungaPersen = 20;
            if (amount === 300000) bungaPersen = 33.33;
            else if (amount === 400000) bungaPersen = 25;

            const totalHutang = amount + (amount * bungaPersen / 100);
            const cicilan = Math.ceil(totalHutang / pData.tenor);
            const id = "CTR" + new Date().getTime();

            db.pinjaman_aktif.push({
              id_pinjaman: id,
              tanggal_acc: new Date().toISOString(),
              id_nasabah: pData.id_nasabah,
              nama: pData.nama,
              pokok: amount,
              bunga_persen: bungaPersen,
              total_hutang: totalHutang,
              tenor: pData.tenor,
              cicilan: cicilan,
              sisa_hutang: totalHutang,
              status: "Aktif",
              kolektor: payload.petugas,
              tanggal_cair: new Date().toISOString(),
              bukti_cair: payload.fotoBukti
            });

            db.pengajuan_pinjaman[pIdx].status = "Disbursed";
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "BAYAR_ANGSURAN": {
          const idx = db.pinjaman_aktif.findIndex((p: any) => p.id_pinjam === payload.id_pinjam || p.id_pinjaman === payload.id_pinjam);
          if (idx !== -1) {
            const newSisa = Math.max(0, (db.pinjaman_aktif[idx].sisa_hutang || 0) - Number(payload.jumlah));
            db.pinjaman_aktif[idx].sisa_hutang = newSisa;
            if (newSisa <= 0) db.pinjaman_aktif[idx].status = "Lunas";
            
            db.angsuran.push({
              id_bayar: "PAY" + new Date().getTime(),
              tanggal: new Date().toISOString(),
              ...payload,
              sisa_hutang: newSisa
            });
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "INPUT_MODAL_AWAL": {
          db.modal_awal.push({
            tanggal: new Date().toISOString(),
            keterangan: payload.keterangan,
            jumlah: Number(payload.jumlah),
            admin: payload.admin
          });
          saveDB(db);
          return res.json({ success: true });
        }

        case "INPUT_PENGELUARAN": {
          db.pengeluaran.push({
            tanggal: new Date().toISOString(),
            jenis: payload.jenis,
            keterangan: payload.keterangan,
            jumlah: Number(payload.jumlah),
            petugas: payload.petugas,
            bukti_cair: payload.bukti_cair
          });
          saveDB(db);
          return res.json({ success: true });
        }

        case "GET_MEMBER_BALANCE": {
          const balance = (db.simpanan || [])
            .filter((s: any) => String(s.id_nasabah) === String(payload.id_nasabah))
            .reduce((acc: number, cur: any) => acc + ((cur.setor || 0) - (cur.tarik || 0)), 0);
          return res.json({ success: true, balance });
        }

        case "CAIRKAN_SIMPANAN": {
          db.simpanan.push({
            id_transaksi: "WDR" + new Date().getTime(),
            tanggal: new Date().toISOString(),
            id_nasabah: payload.id_nasabah,
            setor: 0,
            tarik: Number(payload.jumlah),
            petugas: payload.petugas,
            keterangan: "Cair Tunai"
          });
          saveDB(db);
          return res.json({ success: true });
        }

        case "AMBIL_TRANSPORT": {
          db.pengeluaran.push({
            tanggal: new Date().toISOString(),
            jenis: "Uang Transport",
            keterangan: "Transport Harian Kolektor",
            jumlah: 50000,
            petugas: payload.petugas,
            bukti_cair: payload.fotoBukti
          });
          saveDB(db);
          return res.json({ success: true });
        }

        case "UPDATE_LOKASI_NASABAH": {
          const idx = db.nasabah.findIndex((n: any) => n.id_nasabah === payload.id_nasabah);
          if (idx !== -1) {
            db.nasabah[idx].latitude = payload.latitude;
            db.nasabah[idx].longitude = payload.longitude;
            db.nasabah[idx].update_lokasi = new Date().toISOString();
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "UPDATE_NASABAH": {
          const idx = db.nasabah.findIndex((n: any) => n.id_nasabah === payload.old_id);
          if (idx !== -1) {
            db.nasabah[idx] = { ...db.nasabah[idx], ...payload, id_nasabah: payload.id_nasabah };
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "UPDATE_PETUGAS": {
          const idx = db.petugas.findIndex((p: any) => p.id_petugas === payload.old_id);
          if (idx !== -1) {
            db.petugas[idx] = { ...db.petugas[idx], ...payload, id_petugas: payload.id_petugas };
            saveDB(db);
            return res.json({ success: true });
          }
          return res.json({ success: false });
        }

        case "UPDATE_PROFILE_PHOTO": {
          const { role, id_user, foto } = payload;
          if (role === 'ADMIN' || role === 'KOLEKTOR') {
            const idx = db.petugas.findIndex((p: any) => p.id_petugas === id_user);
            if (idx !== -1) {
              db.petugas[idx].foto = foto;
              saveDB(db);
              return res.json({ success: true });
            }
          } else if (role === 'NASABAH') {
            const idx = db.nasabah.findIndex((n: any) => n.id_nasabah === id_user);
            if (idx !== -1) {
              db.nasabah[idx].foto = foto;
              saveDB(db);
              return res.json({ success: true });
            }
          }
          return res.json({ success: false, message: "User not found" });
        }

        default:
          return res.json({ success: false, message: "Action not implemented in mock server: " + action });
      }
    } catch (err: any) {
      console.error("API Error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
