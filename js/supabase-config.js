/**
 * Supabase Client Configuration & Auto-Sync Module
 * สำหรับเชื่อมต่อฐานข้อมูลคลาวด์ Supabase แบบเรียลไทม์
 * 
 * วิธีใช้งาน:
 * 1. ใส่ Project URL และ anon public key ที่ได้จาก Supabase Dashboard
 * 2. หรือสามารถกรอกและบันทึกผ่านหน้าต่าง "ตั้งค่าคลาวด์ (Cloud Sync)" บนหน้าเว็บได้เช่นกัน
 */

const SUPABASE_CONFIG = {
  // ใส่ Project URL ของคุณที่นี่ (เช่น 'https://xyzcompany.supabase.co')
  url: '',

  // ใส่ anon public key ของคุณที่นี่ (เช่น 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
  anonKey: ''
};

// อ่านค่า config จาก localStorage หากผู้ใช้เคยบันทึกไว้ในเบราว์เซอร์
(function initSupabaseConfig() {
  const savedUrl = localStorage.getItem('supabase_project_url');
  const savedKey = localStorage.getItem('supabase_anon_key');
  if (savedUrl && !SUPABASE_CONFIG.url) {
    SUPABASE_CONFIG.url = savedUrl;
  }
  if (savedKey && !SUPABASE_CONFIG.anonKey) {
    SUPABASE_CONFIG.anonKey = savedKey;
  }
})();

// ตัวแปรเก็บ Instance ของ Supabase Client
let supabaseClient = null;

function getSupabaseClient() {
  const url = SUPABASE_CONFIG.url || localStorage.getItem('supabase_project_url');
  const key = SUPABASE_CONFIG.anonKey || localStorage.getItem('supabase_anon_key');

  if (!url || !key) {
    return null;
  }

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.warn('Supabase JS SDK is not loaded yet');
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = supabase.createClient(url.trim(), key.trim());
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseClient;
}

// ตรวจสอบว่าระบบเชื่อมต่อกับ Supabase อยู่หรือไม่
function isSupabaseConfigured() {
  const url = SUPABASE_CONFIG.url || localStorage.getItem('supabase_project_url');
  const key = SUPABASE_CONFIG.anonKey || localStorage.getItem('supabase_anon_key');
  return !!(url && key);
}

// ดึงข้อมูลหนี้จาก Supabase Cloud มายังเครื่อง
async function fetchDebtsFromCloud(email) {
  if (!email) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { data, error } = await client
      .from('user_debts')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      return false;
    }

    if (data && Array.isArray(data)) {
      // แปลงรูปแบบจาก DB กลับมาเป็นรูปแบบ debts ของแอป
      const mapped = data.map(row => ({
        id: row.id ? String(row.id) : ('c_' + Date.now() + Math.random().toString(36).substr(2, 4)),
        name: row.name || 'ไม่ระบุชื่อ',
        type: row.type || 'credit_card',
        balance: parseFloat(row.balance) || 0,
        rate: parseFloat(row.interest_rate !== undefined ? row.interest_rate : row.rate) || 0,
        minPay: parseFloat(row.min_payment !== undefined ? row.min_payment : row.min_pay) || 0,
        strategy: row.strategy || 'snowball',
        notes: row.notes || ''
      }));

      return mapped;
    }
  } catch (err) {
    console.error('Supabase fetch exception:', err);
  }
  return false;
}

// ซิงก์ข้อมูลหนี้ทั้งหมดขึ้นไปยัง Supabase Cloud
async function syncDebtsToCloud(email, debtsList) {
  if (!email) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // 1. ลบข้อมูลชุดเดิมของ user นี้ออกก่อน
    const { error: delError } = await client
      .from('user_debts')
      .delete()
      .eq('user_email', email);

    if (delError) {
      console.error('Supabase delete old error:', delError);
    }

    // 2. ถ้าไม่มีรายการหนี้ให้หยุดแค่นี้
    if (!debtsList || debtsList.length === 0) {
      return true;
    }

    // 3. เตรียม rows ที่ตรงกับ Schema ของ Supabase
    const rows = debtsList.map(d => ({
      user_email: email,
      name: d.name || '',
      type: d.type || 'credit_card',
      balance: Number(d.balance) || 0,
      min_payment: Number(d.minPay) || 0,
      interest_rate: Number(d.rate) || 0,
      status: 'normal',
      notes: d.strategy || ''
    }));

    const { error: insError } = await client
      .from('user_debts')
      .insert(rows);

    if (insError) {
      console.error('Supabase insert error:', insError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Supabase sync exception:', err);
    return false;
  }
}

// Export ตัวแปรและฟังก์ชันให้เรียกใช้ได้ทั่วทั้งเว็บ
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.getSupabaseClient = getSupabaseClient;
window.isSupabaseConfigured = isSupabaseConfigured;
window.fetchDebtsFromCloud = fetchDebtsFromCloud;
window.syncDebtsToCloud = syncDebtsToCloud;
