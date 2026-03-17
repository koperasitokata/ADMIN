// @ts-nocheck
/**
 * API KOPERASI MANDIRI - STABLE VERSION 3.5
 */

function doPost(e) {
  let requestData;
  try {
    requestData = JSON.parse(e.postData.contents);
  } catch (err) {
    return createResponse({ success: false, message: "Format JSON tidak valid: " + err.toString() });
  }

  const action = requestData.action;
  const payload = requestData.payload;

  try {
    switch (action) {
      case "LOGIN": return handleLogin(payload);
      case "GET_DASHBOARD_DATA": return getDashboardData(payload);
      case "REGISTER_NASABAH": return registerNasabah(payload);
      case "AJUKAN_PINJAMAN": return ajukanPinjaman(payload);
      case "APPROVE_PINJAMAN": return approvePinjaman(payload);
      case "CAIRKAN_PINJAMAN": return cairkanPinjaman(payload);
      case "BAYAR_ANGSURAN": return bayarAngsuran(payload);
      case "INPUT_MODAL_AWAL": return inputModalAwal(payload);
      case "INPUT_PENGELUARAN": return inputPengeluaran(payload);
      case "UPDATE_NASABAH": return updateNasabah(payload);
      case "UPDATE_PETUGAS": return updatePetugas(payload);
      case "GET_MEMBER_BALANCE": return getMemberBalance(payload);
      case "CAIRKAN_SIMPANAN": return cairkanSimpanan(payload);
      case "AMBIL_TRANSPORT": return ambilTransport(payload);
      case "UPDATE_LOKASI_NASABAH": return updateLokasiNasabah(payload);
      case "UPDATE_PROFILE_PHOTO": return updateProfilePhoto(payload);
      case "UPDATE_VALIDASI_SETORAN": return updateValidasiSetoran(payload);
      case "GET_VALIDASI_SETORAN": return getValidasiSetoran(payload);
      default: return createResponse({ success: false, message: "Aksi " + action + " tidak ditemukan" });
    }
  } catch (error) {
    return createResponse({ success: false, message: "Server Error: " + error.toString() });
  }
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/\s+/g, '_').replace(/\.+/g, '_').replace(/\//g, '_').replace(/\.hp/g, '_hp');
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(h => normalizeHeader(h));
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) { 
      obj[headers[j]] = values[i][j]; 
    }
    result.push(obj);
  }
  return result;
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getMemberBalance(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SIMPANAN");
  const data = getSheetData(sheet);
  const userSimpanan = data.filter(s => String(s.id_nasabah) === String(payload.id_nasabah));
  const balance = userSimpanan.reduce((acc, cur) => acc + (cleanNumber(cur.setor) - cleanNumber(cur.tarik)), 0);
  return createResponse({ success: true, balance: balance });
}

function handleLogin(payload) {
  const { role, identifier, password } = payload;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cleanInput = String(identifier || "").replace(/[^0-9]/g, '');
  const inputPWD = String(password || "").trim();
  
  if (role === "ADMIN" || role === "KOLEKTOR") {
    const sheet = ss.getSheetByName("PETUGAS");
    const data = getSheetData(sheet);
    const user = data.find(u => {
      const dbID = String(u.id_petugas || "").trim().toLowerCase();
      const dbHP = String(u.no_hp || "").replace(/[^0-9]/g, '');
      return (dbID === String(identifier).toLowerCase() || dbHP === cleanInput) && String(u.password) === inputPWD;
    });
    if (user && String(user.jabatan).toUpperCase() === role.toUpperCase()) return createResponse({ success: true, user: user });
  } else {
    const sheet = ss.getSheetByName("NASABAH");
    const data = getSheetData(sheet);
    const user = data.find(u => {
      const dbHP = String(u.no_hp || "").replace(/[^0-9]/g, '');
      return dbHP === cleanInput && String(u.pin) === inputPWD;
    });
    if (user) return createResponse({ success: true, user: user });
  }
  return createResponse({ success: false, message: "Kredensial tidak valid." });
}

function getDashboardData(payload) {
  const { role, id_user } = payload;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const results = {};
  
  if (role === "ADMIN") {
    results.stats = {
      modal: sumColumn(ss.getSheetByName("MODAL AWAL"), "jumlah"),
      pengeluaran: sumColumn(ss.getSheetByName("PENGELUARAN"), "jumlah"),
      pinjaman_aktif: sumColumn(ss.getSheetByName("PINJAMAN_AKTIF"), "pokok"),
      total_nasabah: Math.max(0, ss.getSheetByName("NASABAH").getLastRow() - 1)
    };
    results.pengajuan_pending = getSheetData(ss.getSheetByName("PENGAJUAN_PINJAMAN")).filter(p => p.status === "Pending");
    const allLoansData = getSheetData(ss.getSheetByName("PINJAMAN_AKTIF"));
    results.all_loans = allLoansData;
    results.jadwal_global = allLoansData.filter(p => p.status === "Aktif");
    results.nasabah_list = getSheetData(ss.getSheetByName("NASABAH"));
    results.petugas_list = getSheetData(ss.getSheetByName("PETUGAS"));
    
// TAMBAHKAN BARIS INI AGAR MUTASI LENGKAP:
    results.angsuran = getSheetData(ss.getSheetByName("ANGSURAN"));
    results.simpanan = getSheetData(ss.getSheetByName("SIMPANAN"));
    results.pengeluaran = getSheetData(ss.getSheetByName("PENGELUARAN"));
    results.pemasukan = getSheetData(ss.getSheetByName("PEMASUKAN"));
    results.modal = getSheetData(ss.getSheetByName("MODAL AWAL"));
  

    // MUTASI HARIAN
    const mutations = [];
    const angsuran = getSheetData(ss.getSheetByName("ANGSURAN"));
    const pengeluaran = getSheetData(ss.getSheetByName("PENGELUARAN"));
    const modal = getSheetData(ss.getSheetByName("MODAL AWAL"));
    const simpanan = getSheetData(ss.getSheetByName("SIMPANAN"));
    const pinjaman = getSheetData(ss.getSheetByName("PINJAMAN_AKTIF"));

    angsuran.forEach(d => mutations.push({...d, tipe: 'Angsuran', nominal: d.jumlah_bayar, ket: 'Bayar Angsuran ' + d.id_pinjam}));
    pengeluaran.forEach(d => mutations.push({...d, tipe: 'Pengeluaran', nominal: d.jumlah, ket: d.jenis + ': ' + d.keterangan}));
    modal.forEach(d => mutations.push({...d, tipe: 'Setoran Modal', nominal: d.jumlah, ket: d.keterangan}));
    simpanan.forEach(d => mutations.push({...d, tipe: d.setor > 0 ? 'Simpanan' : 'Tarik Simpanan', nominal: d.setor > 0 ? d.setor : d.tarik, ket: d.keterangan}));
    pinjaman.forEach(d => mutations.push({...d, tipe: 'Pencairan', nominal: d.pokok, ket: 'Pencairan Pinjaman ' + d.nama}));

    results.mutasi = mutations.sort((a, b) => new Date(b.tanggal || b.tanggal_acc || b.tanggal_cair) - new Date(a.tanggal || a.tanggal_acc || a.tanggal_cair));
  } else if (role === "KOLEKTOR") {
    results.nasabah_list = getSheetData(ss.getSheetByName("NASABAH"));
    results.pengajuan_approved = getSheetData(ss.getSheetByName("PENGAJUAN_PINJAMAN")).filter(p => p.status === "Approved");
    results.penagihan_list = getSheetData(ss.getSheetByName("PINJAMAN_AKTIF")).filter(p => p.status === "Aktif");
    const simpananData = getSheetData(ss.getSheetByName("SIMPANAN"));
    results.nasabah_list = results.nasabah_list.map(n => {
      const balance = simpananData.filter(s => String(s.id_nasabah) === String(n.id_nasabah)).reduce((acc, cur) => acc + (cleanNumber(cur.setor) - cleanNumber(cur.tarik)), 0);
      return { ...n, saldo_simpanan: balance };
    });
  } else {
    results.simpanan = getSheetData(ss.getSheetByName("SIMPANAN")).filter(s => String(s.id_nasabah) === String(id_user));
    results.pinjaman = getSheetData(ss.getSheetByName("PINJAMAN_AKTIF")).filter(p => String(p.id_nasabah) === String(id_user));
  }
  return createResponse({ success: true, data: results });
}

function sumColumn(sheet, headerName) {
  if (!sheet) return 0;
  const data = getSheetData(sheet);
  const key = normalizeHeader(headerName);
  return data.reduce((acc, cur) => acc + cleanNumber(cur[key]), 0);
}

function registerNasabah(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("NASABAH");
  const id = "NSB" + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([id, payload.nik, payload.nama, payload.no_hp, payload.pin, "", payload.latitude, payload.longitude, new Date(), new Date()]);
  return createResponse({ success: true, id_nasabah: id });
}

function updateLokasiNasabah(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("NASABAH");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  
  const idCol = headers.indexOf("id_nasabah");
  const latCol = headers.indexOf("latitude");
  const lngCol = headers.indexOf("longitude");
  const upCol = headers.indexOf("update_lokasi");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(payload.id_nasabah)) {
      sheet.getRange(i + 1, latCol + 1).setValue(payload.latitude);
      sheet.getRange(i + 1, lngCol + 1).setValue(payload.longitude);
      sheet.getRange(i + 1, upCol + 1).setValue(new Date());
      return createResponse({ success: true });
    }
  }
  return createResponse({ success: false, message: "Nasabah tidak ditemukan" });
}

function ajukanPinjaman(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PENGAJUAN_PINJAMAN");
  const id = "REQ" + new Date().getTime();
  sheet.appendRow([id, new Date(), payload.id_nasabah, payload.nama, payload.jumlah, payload.tenor, payload.petugas, "Pending"]);
  return createResponse({ success: true });
}

function approvePinjaman(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pengajuanSheet = ss.getSheetByName("PENGAJUAN_PINJAMAN");
  const rows = pengajuanSheet.getDataRange().getValues();
  const headers = rows[0].map(h => normalizeHeader(h));
  const idCol = headers.indexOf("id_pengajuan");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol]) === payload.id_pengajuan) {
      pengajuanSheet.getRange(i + 1, headers.indexOf("status") + 1).setValue("Approved");
      return createResponse({ success: true });
    }
  }
  return createResponse({ success: false });
}

function cairkanPinjaman(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pengajuanSheet = ss.getSheetByName("PENGAJUAN_PINJAMAN");
  const aktifSheet = ss.getSheetByName("PINJAMAN_AKTIF");
  const pemasukanSheet = ss.getSheetByName("PEMASUKAN") || ss.getSheetByName("pemasukan") || ss.getSheetByName("Pemasukan");
  const simpananSheet = ss.getSheetByName("SIMPANAN");
  
  const pData = getSheetData(pengajuanSheet).find(p => String(p.id_pengajuan) === String(payload.id_pengajuan));
  if (pData) {
    const amount = cleanNumber(pData.jumlah);
    const tenor = cleanNumber(pData.tenor);
    let bungaPersen = 20;
    if (amount === 300000) bungaPersen = 33.33;
    else if (amount === 400000) bungaPersen = 25;

    const totalHutang = amount + (amount * bungaPersen / 100);
    const cicilan = Math.ceil(totalHutang / (tenor || 1));
    const id = "CTR" + new Date().getTime();
    
    if (pemasukanSheet) {
      pemasukanSheet.appendRow([new Date(), pData.id_nasabah, "Admin Cair 5%", amount * 0.05, payload.petugas]);
    }
    
    if (payload.potongSimpanan && simpananSheet) {
      simpananSheet.appendRow(["SV" + id, new Date(), pData.id_nasabah, amount * 0.05, 0, amount * 0.05, payload.petugas, "Simp Wajib Cair"]);
    }
    
    aktifSheet.appendRow([id, new Date(), pData.id_nasabah, pData.nama, amount, bungaPersen, totalHutang, tenor, cicilan, totalHutang, "Aktif", payload.petugas, new Date(), payload.fotoBukti, id]);
    
    const rows = pengajuanSheet.getDataRange().getValues();
    const idCol = rows[0].map(h => normalizeHeader(h)).indexOf("id_pengajuan");
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idCol]) === payload.id_pengajuan) {
        pengajuanSheet.getRange(i + 1, rows[0].map(h => normalizeHeader(h)).indexOf("status") + 1).setValue("Disbursed");
        break;
      }
    }
    return createResponse({ success: true });
  }
  return createResponse({ success: false });
}

function bayarAngsuran(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getSheetByName("PINJAMAN_AKTIF");
  const angsuranSheet = ss.getSheetByName("ANGSURAN");
  const simpananSheet = ss.getSheetByName("SIMPANAN");
  
  const data = activeSheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  const idCol = headers.indexOf("id_pinjaman");
  const sisaCol = headers.indexOf("sisa_hutang");
  const statusCol = headers.indexOf("status");
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === String(payload.id_pinjam).trim()) {
      if (payload.pakaiSimpanan && payload.jumlahSimpananDiterapkan > 0) {
        simpananSheet.appendRow(["WDR" + new Date().getTime(), new Date(), payload.id_nasabah, 0, payload.jumlahSimpananDiterapkan, 0, payload.petugas, "Potong Angsuran"]);
      }
      const newSisa = Math.max(0, cleanNumber(data[i][sisaCol]) - cleanNumber(payload.jumlah));
      activeSheet.getRange(i + 1, sisaCol + 1).setValue(newSisa);
      if (newSisa <= 0) activeSheet.getRange(i + 1, statusCol + 1).setValue("Lunas");
      angsuranSheet.appendRow(["PAY" + new Date().getTime(), new Date(), payload.id_pinjam, payload.id_nasabah, payload.jumlah, newSisa, payload.petugas, payload.fotoBayar]);
      return createResponse({ success: true });
    }
  }
  return createResponse({ success: false });
}

function inputModalAwal(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("MODAL AWAL");
  sheet.appendRow([new Date(), payload.keterangan, payload.jumlah, payload.admin]);
  return createResponse({ success: true });
}

function inputPengeluaran(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PENGELUARAN");
  sheet.appendRow([new Date(), payload.jenis, payload.keterangan, payload.jumlah, payload.petugas, payload.bukti_cair]);
  return createResponse({ success: true });
}

function updateNasabah(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("NASABAH");
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  
  const idCol = headers.indexOf("id_nasabah");
  const nikCol = headers.indexOf("nik");
  const namaCol = headers.indexOf("nama");
  const hpCol = headers.indexOf("no_hp");
  const pinCol = headers.indexOf("pin");

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(payload.old_id)) {
      if (idCol !== -1) sheet.getRange(i + 1, idCol + 1).setValue(payload.id_nasabah);
      if (nikCol !== -1) sheet.getRange(i + 1, nikCol + 1).setValue(payload.nik);
      if (namaCol !== -1) sheet.getRange(i + 1, namaCol + 1).setValue(payload.nama);
      if (hpCol !== -1) sheet.getRange(i + 1, hpCol + 1).setValue(payload.no_hp);
      if (pinCol !== -1) sheet.getRange(i + 1, pinCol + 1).setValue(payload.pin);
      return createResponse({ success: true });
    }
  }
  return createResponse({ success: false });
}

function updatePetugas(payload) {
  return createResponse({ success: true });
}

function cairkanSimpanan(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const simpananSheet = ss.getSheetByName("SIMPANAN");
  const pengeluaranSheet = ss.getSheetByName("PENGELUARAN");
  simpananSheet.appendRow(["WDR_CASH" + new Date().getTime(), new Date(), payload.id_nasabah, 0, payload.jumlah, 0, payload.petugas, "Cair Tunai"]);
  if (pengeluaranSheet) pengeluaranSheet.appendRow([new Date(), "Cair Simpanan", "Cair " + payload.nama, payload.jumlah, payload.petugas, payload.fotoBukti]);
  return createResponse({ success: true });
}

function ambilTransport(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PENGELUARAN");
  if (!sheet) return createResponse({ success: false, message: "Sheet PENGELUARAN tidak ditemukan" });
  
  const data = getSheetData(sheet);
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const alreadyTaken = data.find(d => {
    if (!d.tanggal || d.jenis !== "Uang Transport") return false;
    const dDate = new Date(d.tanggal);
    dDate.setHours(0,0,0,0);
    return String(d.petugas) === String(payload.petugas) && dDate.getTime() === today.getTime();
  });
  
  if (alreadyTaken) {
    return createResponse({ success: false, message: "Anda sudah mengambil uang transport hari ini." });
  }
  
  sheet.appendRow([new Date(), "Uang Transport", "Transport Harian Kolektor", 50000, payload.petugas, payload.fotoBukti || "Tidak Ada Foto"]);
  return createResponse({ success: true, message: "Berhasil! Uang transport Rp 50.000 telah diinput ke pengeluaran." });
}

function updateProfilePhoto(payload) {
  const { role, id_user } = payload;
  let { foto } = payload;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = (role === "NASABAH") ? "NASABAH" : "PETUGAS";
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return createResponse({ success: false, message: "Sheet " + sheetName + " tidak ditemukan" });
  
  // Safety Truncate: Google Sheets limit is 50,000. We truncate at 45,000 to be safe.
  if (foto && foto.length > 45000) {
    foto = foto.substring(0, 45000);
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  
  const idKey = (role === "NASABAH") ? "id_nasabah" : "id_petugas";
  const idCol = headers.indexOf(idKey);
  const fotoCol = headers.indexOf("foto");

  if (idCol === -1 || fotoCol === -1) return createResponse({ success: false, message: "Kolom ID atau Foto tidak ditemukan" });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).toLowerCase() === String(id_user).toLowerCase()) {
      sheet.getRange(i + 1, fotoCol + 1).setValue(foto);
      return createResponse({ success: true, message: "Foto profil berhasil diperbarui" });
    }
  }
  return createResponse({ success: false, message: "User tidak ditemukan di database" });
}

function createResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNGSI DOGET UNTUK MENGAMBIL DATA DENGAN NAMA SHEET ASLI (HURUF BESAR)
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToFetch = [
    "NASABAH", 
    "PETUGAS", 
    "PENGAJUAN_PINJAMAN", 
    "PINJAMAN_AKTIF", 
    "ANGSURAN", 
    "SIMPANAN", 
    "PENGELUARAN", 
    "PEMASUKAN", 
    "MODAL AWAL"
  ];
  
  const results = {};
  
  sheetsToFetch.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      // Menggunakan nama asli sheet (HURUF BESAR) sebagai key
      results[name] = getSheetData(sheet);
    }
  });

  // Gabungkan data untuk mutasi agar aplikasi bisa menampilkan riwayat lengkap
  const allMutations = [];
  if (results["ANGSURAN"]) results["ANGSURAN"].forEach(function(d) { allMutations.push(Object.assign({}, d, {tipe: 'Angsuran', source: 'ANGSURAN'})); });
  if (results["PENGELUARAN"]) results["PENGELUARAN"].forEach(function(d) { allMutations.push(Object.assign({}, d, {tipe: 'Pengeluaran', source: 'PENGELUARAN'})); });
  if (results["PEMASUKAN"]) results["PEMASUKAN"].forEach(function(d) { allMutations.push(Object.assign({}, d, {tipe: 'Pemasukan', source: 'PEMASUKAN'})); });
  if (results["SIMPANAN"]) results["SIMPANAN"].forEach(function(d) { allMutations.push(Object.assign({}, d, {tipe: 'Simpanan', source: 'SIMPANAN'})); });
  if (results["MODAL AWAL"]) results["MODAL AWAL"].forEach(function(d) { allMutations.push(Object.assign({}, d, {tipe: 'Modal', source: 'MODAL AWAL'})); });
  
  results["mutasi"] = allMutations;

  return ContentService.createTextOutput(JSON.stringify({ 
    success: true, 
    data: results 
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateValidasiSetoran(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("VALIDASI_SETORAN");
  if (!sheet) return createResponse({ success: false, message: "Sheet VALIDASI_SETORAN tidak ditemukan" });
  
  const id = payload.id || "VAL" + new Date().getTime();
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeHeader(h));
  const idCol = headers.indexOf("id");
  
  const rowData = [
    id,
    payload.tanggal || new Date(),
    payload.id_petugas,
    payload.nama_kolektor,
    payload.total_tagihan_sistem,
    payload.total_setoran_fisik,
    payload.selisih,
    payload.status_validasi,
    payload.status_penyelesaian,
    payload.keterangan_admin,
    payload.bukti_foto
  ];

  if (payload.id) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(payload.id)) {
        sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        return createResponse({ success: true, message: "Validasi diperbarui" });
      }
    }
  }
  
  sheet.appendRow(rowData);
  return createResponse({ success: true, message: "Validasi disimpan" });
}

function getValidasiSetoran(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("VALIDASI_SETORAN");
  if (!sheet) return createResponse({ success: true, data: [] });
  const data = getSheetData(sheet);
  
  if (payload.id_petugas) {
    return createResponse({ success: true, data: data.filter(d => String(d.id_petugas) === String(payload.id_petugas)) });
  }
  
  return createResponse({ success: true, data: data });
}
