
export enum UserRole {
  NASABAH = 'NASABAH',
  KOLEKTOR = 'KOLEKTOR',
  ADMIN = 'ADMIN'
}

export interface Nasabah {
  id_nasabah: string;
  nik: string;
  nama: string;
  no_hp: string;
  pin: string;
  foto: string;
  latitude: number;
  longitude: number;
  update_lokasi: string;
  tanggal_daftar: string;
}

export interface Simpanan {
  id_transaksi: string;
  tanggal: string;
  id_nasabah: string;
  setor: number;
  tarik: number;
  saldo: number;
  petugas: string;
  keterangan: string;
}

export interface PengajuanPinjaman {
  id_pengajuan: string;
  tanggal: string;
  id_nasabah: string;
  nama: string;
  jumlah: number;
  tenor: number;
  petugas: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Disbursed';
}

export interface PinjamanAktif {
  id_pinjaman: string;
  tanggal_acc: string;
  id_nasabah: string;
  nama: string;
  pokok: number;
  bunga_persen: number;
  total_hutang: number;
  tenor: number;
  cicilan: number;
  sisa_hutang: number;
  status: 'Aktif' | 'Lunas' | 'Macet';
  kolektor: string;
  tanggal_cair: string;
  bukti_cair: string;
  qr_code: string;
}

export interface Angsuran {
  id_bayar: string;
  tanggal: string;
  id_pinjam: string;
  id_nasabah: string;
  jumlah_bayar: number;
  sisa_hutang: number;
  kolektor: string;
  bukti_bayar: string;
}

export interface Petugas {
  id_petugas: string;
  nama: string;
  no_hp: string;
  password: string;
  jabatan: 'Admin' | 'Kolektor';
  foto: string;
}

export interface Pengeluaran {
  tanggal: string;
  jenis: string;
  keterangan: string;
  jumlah: number;
  petugas: string;
}

export interface ModalAwal {
  tanggal: string;
  keterangan: string;
  jumlah: number;
  admin: string;
}

export interface AuthState {
  user: Nasabah | Petugas | null;
  role: UserRole | null;
}
