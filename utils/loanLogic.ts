
export const LOAN_AMOUNTS = [300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1500000, 2000000, 2500000, 3000000];
export const TENOR_OPTIONS = [4, 12, 14, 16, 18, 20, 24];

/**
 * Menghitung bunga berdasarkan nominal pinjaman sesuai aturan koperasi
 */
export const calculateInterestRate = (amount: number): number => {
  if (amount === 300000) return 33.33;
  if (amount === 400000) return 25;
  return 20;
};

/**
 * Memeriksa apakah sebuah tanggal adalah hari kerja (Senin-Jumat)
 */
export const isWorkingDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Bukan Minggu (0) dan bukan Sabtu (6)
};

/**
 * Mencari hari kerja berikutnya
 */
export const getNextWorkingDay = (date: Date): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isWorkingDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

/**
 * Robust date parsing for various formats
 */
export const toDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  
  try {
    const s = String(val);
    const parts = s.split(/[/ :]/);
    if (parts.length >= 3) {
      // Try DD/MM/YYYY or MM/DD/YYYY
      // We assume DD/MM/YYYY for Indonesia
      const day = parseInt(parts[0]);
      const m = parseInt(parts[1]) - 1;
      const y = parseInt(parts[2]);
      const h = parseInt(parts[3] || "0");
      const min = parseInt(parts[4] || "0");
      const sec = parseInt(parts[5] || "0");
      const parsed = new Date(y, m, day, h, min, sec);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch (e) {
    console.error("Date parsing error:", e);
  }
  return new Date();
};

/**
 * Menghasilkan jadwal penagihan berdasarkan aturan tenor dan hari kerja
 */
export const generateLoanSchedule = (disbursementDate: string | Date, tenor: number) => {
  const schedule = [];
  let current = toDate(disbursementDate);
  
  // Penagihan dimulai 1 hari kerja setelah pencairan
  current = getNextWorkingDay(current);

  // Logika Interval: Dasar 20 hari kerja
  // Khusus 20x dan 24x adalah setiap hari kerja (interval 1)
  let interval = 1;
  if (tenor === 4) {
    interval = 5;
  } else if (tenor >= 20) {
    interval = 1;
  } else {
    // Distribusi tenor lain (12, 14, 16, 18) agar mendekati siklus 20 hari
    interval = Math.max(1, Math.floor(20 / tenor));
  }

  for (let i = 1; i <= tenor; i++) {
    schedule.push(new Date(current));
    
    // Lompat sebanyak interval hari kerja
    for (let j = 0; j < interval; j++) {
      current = getNextWorkingDay(current);
    }
  }
  
  return schedule;
};
