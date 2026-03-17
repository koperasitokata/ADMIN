import express from "express";
import cors from "cors";

const app = express();

// Mock Data as fallback (since Vercel filesystem is read-only)
const getInitialDB = () => ({
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
});

// In-memory DB for Vercel (will reset on cold start)
let memoryDB = getInitialDB();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(), 
    env: "vercel-serverless",
    proxy_active: !!process.env.VITE_API_URL 
  });
});

// API Routes
app.post("/api", async (req, res) => {
  const remoteUrl = process.env.VITE_API_URL;
  
  // Proxy Mode to Google Apps Script (PREFERED)
  if (remoteUrl && remoteUrl.startsWith('http')) {
    try {
      const response = await fetch(remoteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(req.body),
        redirect: 'follow'
      });
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      return res.json({ success: false, message: "Proxy Error: " + error.message });
    }
  }

  // Fallback to Memory DB (Data will NOT persist on Vercel)
  try {
    const { action, payload } = req.body || {};
    if (!action) return res.json({ success: false, message: "No action" });

    switch (action) {
      case "LOGIN": {
        const { role, identifier, password } = payload || {};
        if (role === "ADMIN" || role === "KOLEKTOR") {
          const user = memoryDB.petugas.find((u: any) => 
            (u.id_petugas === identifier || u.no_hp === identifier) && u.password === password
          );
          if (user && user.jabatan.toUpperCase() === role) return res.json({ success: true, user });
        } else {
          const user = memoryDB.nasabah.find((u: any) => u.no_hp === identifier && u.pin === password);
          if (user) return res.json({ success: true, user });
        }
        return res.json({ success: false, message: "Login gagal" });
      }

      case "GET_DASHBOARD_DATA": {
        const { role } = payload || {};
        if (role === "ADMIN") {
          return res.json({
            success: true,
            data: {
              stats: { modal: 0, pengeluaran: 0, pinjaman_aktif: 0, total_nasabah: memoryDB.nasabah.length },
              pengajuan_pending: memoryDB.pengajuan_pinjaman.filter((p: any) => p.status === "Pending"),
              jadwal_global: memoryDB.pinjaman_aktif.filter((p: any) => p.status === "Aktif"),
              nasabah_list: memoryDB.nasabah,
              petugas_list: memoryDB.petugas,
              all_loans: memoryDB.pinjaman_aktif,
              mutasi: [],
              pemasukan_list: []
            }
          });
        }
        return res.json({ success: false });
      }
      
      // ... other cases simplified for brevity in mock mode ...
      default:
        return res.json({ success: false, message: "Action not supported in Vercel Mock Mode. Please connect VITE_API_URL (Google Sheets)." });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default app;
