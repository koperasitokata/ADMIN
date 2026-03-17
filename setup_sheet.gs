
/**
 * SETUP SCRIPT FOR GOOGLE SHEETS BACKEND
 * Copy this code into the Google Apps Script editor of your Google Sheet.
 * Then run the 'setupKoperasiSheets' function.
 */

function setupKoperasiSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = [
    {
      name: "NASABAH",
      headers: ["id nasabah", "nik", "nama", "no.hp", "pin", "foto", "latitude", "longitude", "update lokasi", "tanggal daftar"]
    },
    {
      name: "SIMPANAN",
      headers: ["id transaksi", "tanggal", "id nasabah", "setor", "tarik", "saldo", "petugas", "keterangan"]
    },
    {
      name: "PENGAJUAN_PINJAMAN",
      headers: ["id pengajuan", "tanggal", "id nasabah", "nama", "jumlah", "tenor", "petugas", "status"]
    },
    {
      name: "PINJAMAN_AKTIF",
      headers: ["id pinjaman", "tanggal acc", "id nasabah", "nama", "pokok", "bunga persen", "total hutang", "tenor", "cicilan", "sisa hutang", "status", "kolektor", "tanggal cair", "bukti cair", "qr code"]
    },
    {
      name: "ANGSURAN",
      headers: ["id bayar", "tanggal", "id pinjam", "id nasabah", "jumlah bayar", "sisa hutang", "kolektor", "bukti bayar"]
    },
    {
      name: "PETUGAS",
      headers: ["id petugas", "nama", "no hp", "password", "jabatan", "foto"]
    },
    {
      name: "PENGELUARAN",
      headers: ["tanggal", "jenis", "keterangan", "jumlah", "petugas", "bukti cair"]
    },
    {
      name: "MODAL AWAL",
      headers: ["tanggal", "keterangan", "jumlah", "admin"]
    },
    {
      name: "PEMASUKAN",
      headers: ["tanggal", "id nasabah", "keterangan", "jumlah", "petugas"]
    }
  ];

  sheets.forEach(s => {
    let sheet = ss.getSheetByName(s.name);
    if (!sheet) {
      sheet = ss.insertSheet(s.name);
    } else {
      sheet.clear();
    }
    sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  });

  // Create default admin
  const petugasSheet = ss.getSheetByName("PETUGAS");
  petugasSheet.appendRow(["ADM001", "Admin Utama", "08123456789", "123456", "Admin", "https://picsum.photos/200"]);
  
  SpreadsheetApp.getUi().alert("Koperasi Sheets successfully initialized!");
}
