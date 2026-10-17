/**
 * Debt Resolution Thailand - Core Application Logic
 * เครื่องมือวางแผนและจัดการหนี้สินอย่างเป็นระบบ
 */

// --- Security Utility ---
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// AESTHETIC TOAST & CONFIRM DIALOG SYSTEM
// (Zero native browser alerts - 100% luxury custom UI)
// ==========================================
window.showToast = function(message, type = 'success', title = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-item';

  let iconName = 'check-circle';
  let iconColor = 'text-emerald-500';
  if (type === 'error') {
    iconName = 'alert-circle';
    iconColor = 'text-rose-500';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    iconColor = 'text-amber-500';
  } else if (type === 'info') {
    iconName = 'info';
    iconColor = 'text-blue-500';
  }

  toast.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${iconColor}">
      <i data-lucide="${iconName}" class="w-4 h-4"></i>
    </div>
    <div class="flex-1 min-w-0 pr-1">
      ${title ? `<div class="font-bold text-xs leading-tight mb-0.5">${escapeHtml(title)}</div>` : ''}
      <div class="text-xs opacity-90 leading-relaxed">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    </div>
    <button onclick="this.parentElement.remove()" class="p-1 opacity-50 hover:opacity-100 rounded-lg transition-opacity text-slate-400">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Auto remove after 3.8s
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 250);
  }, 3800);
};

let pendingConfirmCallback = null;

window.showConfirmModal = function({ title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', icon = 'help-circle', isDanger = false, onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }

  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const iconEl = document.getElementById('confirm-icon');
  const iconBg = document.getElementById('confirm-icon-bg');
  const okBtn = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (titleEl) titleEl.textContent = title || 'ยืนยันการดำเนินการ';
  if (msgEl) msgEl.textContent = message || '';
  if (okBtn) okBtn.textContent = confirmText;
  if (cancelBtn) cancelBtn.textContent = cancelText;

  if (isDanger) {
    if (iconBg) iconBg.className = 'w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm';
    if (iconEl) iconEl.setAttribute('data-lucide', 'alert-triangle');
    if (okBtn) okBtn.className = 'w-full py-2.5 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-md shadow-rose-500/20';
  } else {
    if (iconBg) iconBg.className = 'w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm';
    if (iconEl) iconEl.setAttribute('data-lucide', icon);
    if (okBtn) okBtn.className = 'w-full py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-500/20';
  }

  pendingConfirmCallback = onConfirm;
  modal.classList.remove('hidden');
  lucide.createIcons();

  okBtn.onclick = () => {
    modal.classList.add('hidden');
    if (pendingConfirmCallback) {
      pendingConfirmCallback();
      pendingConfirmCallback = null;
    }
  };
};

window.closeConfirmModal = function() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.classList.add('hidden');
  pendingConfirmCallback = null;
};

// --- Default Sample Debts ---
const SAMPLE_DEBTS = [
  { id: '1', name: 'บัตรเครดิต KBank', type: 'credit_card', balance: 45000, rate: 16, minPay: 2500, strategy: 'snowball' },
  { id: '2', name: 'บัตรกดเงินสด Speedy Cash', type: 'cash_card', balance: 68000, rate: 25, minPay: 3500, strategy: 'avalanche' },
  { id: '3', name: 'สินเชื่อส่วนบุคคล UOB i-Cash', type: 'personal_loan', balance: 120000, rate: 20, minPay: 4800, strategy: 'consolidation' }
];

// --- Application State ---
let debts = [];
let currentStrategy = 'snowball'; // 'snowball' or 'avalanche'
let debtChart = null;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadDebtsFromStorage();
  initDtiCalculator();
  initDebtPlanner();
  initFilters();
  initEmergencyChecklist();
  if (typeof updateSupabaseStatusUI === 'function') {
    updateSupabaseStatusUI();
  }
  lucide.createIcons();
});

// ==========================================
// 1. DTI & DEBT HEALTH CHECK
// ==========================================
function initDtiCalculator() {
  const form = document.getElementById('dti-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculateDti();
  });

  // Also auto-calculate on input change for smooth UX
  ['income-input', 'debt-pay-input', 'delinquency-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateDti);
  });
}

function calculateDti() {
  const income = parseFloat(document.getElementById('income-input').value) || 0;
  const debtPay = parseFloat(document.getElementById('debt-pay-input').value) || 0;
  const status = document.getElementById('delinquency-status').value;

  const resultContainer = document.getElementById('dti-result-card');
  if (income <= 0) {
    if (resultContainer) resultContainer.classList.add('hidden');
    return;
  }

  const dti = ((debtPay / income) * 100).toFixed(1);
  const remaining = income - debtPay;

  if (resultContainer) resultContainer.classList.remove('hidden');

  const dtiScoreEl = document.getElementById('dti-score');
  const dtiRemainingEl = document.getElementById('dti-remaining');
  const dtiProgressBar = document.getElementById('dti-progress-bar');
  const dtiBadge = document.getElementById('dti-badge');
  const dtiAdviceEl = document.getElementById('dti-advice');

  if (dtiScoreEl) dtiScoreEl.textContent = `${dti}%`;
  if (dtiRemainingEl) dtiRemainingEl.textContent = `${remaining.toLocaleString('th-TH')} บาท`;

  // Determine Level
  let level = 'good';
  let badgeText = 'ระดับปกติ (ปลอดภัย)';
  let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  let barColor = 'bg-emerald-500';
  let advice = '';

  if (status === 'over90' || status === 'sued') {
    level = 'critical';
    badgeText = 'ระดับวิกฤต (ต้องการความช่วยเหลือด่วน)';
    badgeColor = 'bg-red-100 text-red-800 border-red-300';
    barColor = 'bg-red-600';
    advice = `
      <div class="space-y-2">
        <p class="font-semibold text-red-900">⚠️ คำแนะนำเร่งด่วนสำหรับคุณ:</p>
        <ul class="list-disc pl-5 space-y-1 text-slate-700">
          <li><strong>หนี้ค้างเกิน 90 วัน (NPL):</strong> มีสิทธิ์เข้าร่วมโครงการ <strong>คลินิกแก้หนี้ by SAM (โทร 1443)</strong> ปรับดอกเบี้ยเหลือเพียง 3-5% ผ่อนยาวได้ถึง 10 ปี</li>
          <li><strong>หากมีหมายศาล:</strong> <u>อย่าหนีศาลเด็ดขาด</u> ไปตามนัดเพื่อใช้สิทธิ์ไกล่เกลี่ยข้อพิพาท ศาลพร้อมเป็นคนกลางช่วยคุยข้อตกลงที่ผ่อนไหว</li>
          <li><strong>สิทธิการอายัดเงินเดือน:</strong> กฎหมายคุ้มครองให้ต้องเหลือเงินเดือนใช้อย่างน้อย 20,000 บาท/เดือน หากเงินเดือนไม่ถึง 20,000 บาท เจ้าหนี้อายัดไม่ได้</li>
        </ul>
      </div>
    `;
  } else if (dti < 30) {
    level = 'good';
    badgeText = 'สถานะปลอดภัย (Excellent)';
    badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    barColor = 'bg-emerald-500';
    advice = `
      <p class="text-slate-700">
        ภาระหนี้ของคุณอยู่ในเกณฑ์ดีมาก ไม่เกิน 30% ของรายได้ ทำให้มีความคล่องตัวสูง แนะนำให้รักษาความมีวินัยทางการเงิน เก็บเงินสำรองฉุกเฉิน 3-6 เท่าของค่าใช้จ่าย และเร่งโปะเงินต้นเพื่อประหยัดดอกเบี้ย
      </p>
    `;
  } else if (dti >= 30 && dti < 45) {
    level = 'moderate';
    badgeText = 'เริ่มตึงตัว (Caution)';
    badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
    barColor = 'bg-amber-500';
    advice = `
      <p class="text-slate-700">
        ภาระหนี้เริ่มกินสัดส่วนรายได้ แนะนำให้ <strong>หยุดก่อหนี้ใหม่ทุกชนิด</strong> จดบันทึกรายรับ-รายจ่ายเพื่อตัดค่าใช้จ่ายฟุ่มเฟือย และใช้เครื่องมือ <em>Snowball / Avalanche</em> ด้านล่างเพื่อเร่งปิดหนี้ย่อยทีละก้อน
      </p>
    `;
  } else if (dti >= 45 && dti < 60) {
    level = 'high';
    badgeText = 'ระดับเสี่ยงสูง (High Risk)';
    badgeColor = 'bg-orange-100 text-orange-800 border-orange-300';
    barColor = 'bg-orange-500';
    advice = `
      <div class="space-y-2">
        <p class="font-semibold text-orange-900">🚨 สัญญาณเตือนภัยทางการเงิน:</p>
        <p class="text-slate-700">
          เงินเกือบครึ่งหนึ่งหมดไปกับการผ่อนหนี้ อาจเริ่มเกิดการหมุนเงินหรือกดบัตรโน้นมาจ่ายบัตรนี้ ซึ่งจะทำให้ดอกเบี้ยบานปลาย แนะนำให้:
        </p>
        <ul class="list-disc pl-5 space-y-1 text-slate-700">
          <li>ติดต่อธนาคารเจ้าหนี้ทันทีเพื่อขอ <strong>รวมหนี้ (Debt Consolidation)</strong> หรือปรับเป็นสินเชื่อเงินกู้ระยะยาว</li>
          <li>หยุดจ่ายขั้นต่ำโดยการหมุนเงิน เพราะดอกเบี้ยบัตรเครดิตสูงถึง 16-25% ต่อปี</li>
          <li>ยื่นคำขอที่ <strong>ทางด่วนแก้หนี้ (แบงก์ชาติ โทร 1213)</strong></li>
        </ul>
      </div>
    `;
  } else {
    level = 'critical';
    badgeText = 'ระดับวิกฤต (Crisis Level)';
    badgeColor = 'bg-red-100 text-red-800 border-red-300';
    barColor = 'bg-red-600';
    advice = `
      <div class="space-y-2">
        <p class="font-semibold text-red-900">🚨 ต้องเข้าสู่กระบวนการปฐมพยาบาลหนี้ทันที:</p>
        <p class="text-slate-700">
          ภาระหนี้เกิน 60% ของรายได้ เสี่ยงต่อการผิดนัดชำระอย่างรุนแรง คุณไม่ควรแบกรับไว้คนเดียว แนะนำให้เข้าสู่ช่องทางช่วยเหลือของรัฐทันที:
        </p>
        <ul class="list-disc pl-5 space-y-1 text-slate-700">
          <li>ปรึกษา <strong>คลินิกแก้หนี้ (โทร 1443)</strong> หรือ <strong>ศคง. แบงก์ชาติ (โทร 1213)</strong></li>
          <li>เปิดอกคุยกับสถาบันการเงินเพื่อทำ <strong>สัญญาปรับโครงสร้างหนี้ (TDR)</strong> เพื่อขอยืดระยะเวลาและลดยอดผ่อนต่อเดือน</li>
        </ul>
      </div>
    `;
  }

  // Update styles
  if (dtiBadge) {
    dtiBadge.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`;
    dtiBadge.textContent = badgeText;
  }
  if (dtiProgressBar) {
    const widthPercent = Math.min(dti, 100);
    dtiProgressBar.style.width = `${widthPercent}%`;
    dtiProgressBar.className = `h-2.5 rounded-full transition-all duration-500 ${barColor}`;
  }
  if (dtiAdviceEl) {
    dtiAdviceEl.innerHTML = advice;
  }
}

// ==========================================
// 2. DEBT REPAYMENT PLANNER (SNOWBALL vs AVALANCHE)
// ==========================================
function getDebtStorageKey() {
  if (currentUser && currentUser.email) {
    return `user_debts_${currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  return 'user_debts_guest';
}

function loadDebtsFromStorage() {
  const key = getDebtStorageKey();
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        debts = parsed;
        return;
      }
    } catch (e) {}
  }

  // Check legacy key user_debts_v1: only migrate if user created actual custom debts (not the hardcoded sample debts)
  const legacySaved = localStorage.getItem('user_debts_v1');
  if (legacySaved) {
    try {
      const legacy = JSON.parse(legacySaved);
      const isSample = Array.isArray(legacy) && legacy.length === 3 &&
        legacy.some(d => d.name && (d.name.includes('KBank') || d.name.includes('Speedy Cash')));
      if (Array.isArray(legacy) && !isSample && legacy.length > 0) {
        debts = legacy;
        saveDebtsToStorage();
        return;
      }
    } catch (e) {}
  }

  // Default is clean & empty for every member!
  debts = [];
}

function saveDebtsToStorage() {
  const key = getDebtStorageKey();
  localStorage.setItem(key, JSON.stringify(debts));
  if (!currentUser) {
    localStorage.setItem('user_debts_v1', JSON.stringify(debts));
  }

  // Auto-sync to Supabase Cloud if configured and user is logged in
  if (currentUser && currentUser.email && typeof syncDebtsToCloud === 'function' && typeof isSupabaseConfigured === 'function') {
    if (isSupabaseConfigured()) {
      syncDebtsToCloud(currentUser.email, debts).catch(err => {
        console.warn('Background Supabase sync error:', err);
      });
    }
  }
}

// ==========================================
// SUPABASE MODAL & CLOUD SYNC HANDLERS
// ==========================================
window.openSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  if (!modal) return;

  const urlInput = document.getElementById('supabase-modal-url');
  const keyInput = document.getElementById('supabase-modal-key');
  const manualBox = document.getElementById('supabase-manual-sync-box');

  const currentUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || localStorage.getItem('supabase_project_url') || '';
  const currentKey = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.anonKey) || localStorage.getItem('supabase_anon_key') || '';

  if (urlInput) urlInput.value = currentUrl;
  if (keyInput) keyInput.value = currentKey;

  updateSupabaseStatusUI();

  if (manualBox) {
    if (currentUrl && currentKey) {
      manualBox.classList.remove('hidden');
    } else {
      manualBox.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  lucide.createIcons();
};

window.closeSupabaseModal = function() {
  const modal = document.getElementById('supabase-modal');
  if (modal) modal.classList.add('hidden');
};

function updateSupabaseStatusUI() {
  const isConfigured = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
  const dot = document.getElementById('supabase-status-dot');
  const text = document.getElementById('supabase-status-text');
  const badge = document.getElementById('supabase-status-badge');
  const navBtn = document.getElementById('supabase-nav-btn');

  if (dot && text && badge) {
    if (isConfigured) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
      text.textContent = 'เชื่อมต่อ Supabase Cloud สำเร็จ (Auto-Sync พร้อมใช้งาน)';
      text.className = 'font-bold text-emerald-700 dark:text-emerald-400';
      badge.textContent = 'Cloud Connected';
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
      text.textContent = 'ยังไม่ได้เชื่อมต่อ (บันทึกลงเครื่อง LocalStorage เท่านั้น)';
      text.className = 'font-medium text-slate-600 dark:text-slate-300';
      badge.textContent = 'Local-Only';
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  }

  if (navBtn) {
    if (isConfigured) {
      navBtn.classList.add('border-emerald-500', 'text-emerald-600');
    }
  }
}

window.handleSaveSupabaseConfig = async function(e) {
  if (e) e.preventDefault();
  const urlInput = document.getElementById('supabase-modal-url');
  const keyInput = document.getElementById('supabase-modal-key');

  const url = urlInput ? urlInput.value.trim() : '';
  const key = keyInput ? keyInput.value.trim() : '';

  if (!url || !key) {
    showToast('กรุณากรอกทั้ง Project URL และ anon public key', 'warning');
    return;
  }

  localStorage.setItem('supabase_project_url', url);
  localStorage.setItem('supabase_anon_key', key);

  if (window.SUPABASE_CONFIG) {
    window.SUPABASE_CONFIG.url = url;
    window.SUPABASE_CONFIG.anonKey = key;
  }
  if (typeof supabaseClient !== 'undefined') {
    supabaseClient = null; // force re-instantiation
  }

  updateSupabaseStatusUI();
  showToast('บันทึกการตั้งค่า Supabase เรียบร้อยแล้ว!', 'success', '☁️ เชื่อมต่อคลาวด์');

  // If user is logged in, offer to sync right away
  if (currentUser && currentUser.email) {
    showToast('กำลังตรวจสอบและซิงก์ข้อมูลกับ Supabase...', 'info');
    await handleManualCloudSync();
  }

  closeSupabaseModal();
};

window.handleClearSupabaseConfig = function() {
  localStorage.removeItem('supabase_project_url');
  localStorage.removeItem('supabase_anon_key');
  if (window.SUPABASE_CONFIG) {
    window.SUPABASE_CONFIG.url = '';
    window.SUPABASE_CONFIG.anonKey = '';
  }
  const urlInput = document.getElementById('supabase-modal-url');
  const keyInput = document.getElementById('supabase-modal-key');
  if (urlInput) urlInput.value = '';
  if (keyInput) keyInput.value = '';
  updateSupabaseStatusUI();
  showToast('ล้างการตั้งค่า Supabase คลาวด์เรียบร้อยแล้ว', 'info');
};

window.handleManualCloudSync = async function() {
  if (!currentUser || !currentUser.email) {
    showToast('กรุณาเข้าสู่ระบบก่อนซิงก์ข้อมูลขึ้นคลาวด์', 'warning');
    return;
  }

  if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
    showToast('กรุณาใส่ Project URL และ anon public key ให้เรียบร้อยก่อน', 'warning');
    return;
  }

  try {
    // 1. Try to fetch from cloud first to check if cloud already has debts
    const cloudDebts = await fetchDebtsFromCloud(currentUser.email);
    if (cloudDebts && cloudDebts.length > 0 && debts.length === 0) {
      debts = cloudDebts;
      const key = getDebtStorageKey();
      localStorage.setItem(key, JSON.stringify(debts));
      renderDebtList();
      calculateRepaymentPlan();
      showToast(`ดึงข้อมูล ${debts.length} สัญญาจาก Supabase Cloud ลงเครื่องเรียบร้อย!`, 'success', '☁️ Cloud Sync');
      return;
    }

    // 2. Otherwise upload local debts to cloud
    const ok = await syncDebtsToCloud(currentUser.email, debts);
    if (ok) {
      showToast(`ซิงก์ข้อมูลหนี้ ${debts.length} สัญญาขึ้น Supabase Cloud สำเร็จ!`, 'success', '☁️ ซิงก์เรียบร้อย');
    } else {
      showToast('ไม่สามารถซิงก์ข้อมูลขึ้น Supabase ได้ กรุณาตรวจสอบตาราง user_debts และสิทธิ์ RLS', 'error');
    }
  } catch (err) {
    console.error('Manual sync error:', err);
    showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase', 'error');
  }
};

// --- Debt Type and Strategy Presets ---
window.applyDebtPreset = function(type) {
  const typeSelect = document.getElementById('new-debt-type');
  const nameInput = document.getElementById('new-debt-name');
  const rateInput = document.getElementById('new-debt-rate');
  const stratSelect = document.getElementById('new-debt-strategy');

  if (typeSelect) typeSelect.value = type;

  if (type === 'credit_card') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น บัตรเครดิต KBank / KTC / Central';
    if (rateInput) rateInput.value = '16';
    if (stratSelect) stratSelect.value = 'avalanche';
  } else if (type === 'cash_card') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น บัตรกดเงินสด Flash / Speedy Cash / Umay+';
    if (rateInput) rateInput.value = '25';
    if (stratSelect) stratSelect.value = 'avalanche';
  } else if (type === 'personal_loan') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น สินเชื่อบุคคล SCB Speedy / K-Personal';
    if (rateInput) rateInput.value = '20';
    if (stratSelect) stratSelect.value = 'consolidation';
  } else if (type === 'auto_loan') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น สินเชื่อรถยนต์ กรุงศรีออโต้ / ทิสโก้';
    if (rateInput) rateInput.value = '6';
    if (stratSelect) stratSelect.value = 'tdr';
  } else if (type === 'home_loan') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น สินเชื่อบ้าน ธอส. / ออมสิน';
    if (rateInput) rateInput.value = '4.5';
    if (stratSelect) stratSelect.value = 'snowball';
  } else if (type === 'informal_loan') {
    if (nameInput && !nameInput.value) nameInput.placeholder = 'เช่น กู้ยืมคนรู้จัก / หนี้นอกระบบ';
    if (rateInput) rateInput.value = '120';
    if (stratSelect) stratSelect.value = 'snowball';
  }
  updateDebtLivePreview();
  if (nameInput) nameInput.focus();
};

window.onDebtTypeSelectChange = function(type) {
  window.applyDebtPreset(type);
};

window.updateDebtLivePreview = function() {
  const balance = parseFloat(document.getElementById('new-debt-balance')?.value) || 0;
  const rate = parseFloat(document.getElementById('new-debt-rate')?.value) || 0;
  const minPay = parseFloat(document.getElementById('new-debt-minpay')?.value) || 0;
  const previewEl = document.getElementById('debt-live-preview');

  if (!previewEl) return;

  if (balance <= 0 || rate <= 0) {
    previewEl.classList.add('hidden');
    return;
  }

  previewEl.classList.remove('hidden');
  const annualInterest = Math.round(balance * (rate / 100));
  const monthlyInterest = Math.round(annualInterest / 12);
  const principalPaid = Math.max(0, minPay - monthlyInterest);

  let note = '';
  if (minPay > 0) {
    if (minPay <= monthlyInterest) {
      note = `<div class="mt-1 text-rose-600 dark:text-rose-400 font-bold">⚠️ เตือน: ยอดที่จ่าย (${minPay.toLocaleString('th-TH')} บ.) ไม่พอดอกเบี้ยรายเดือน (${monthlyInterest.toLocaleString('th-TH')} บ.) เงินต้นจะไม่ลดลงเลย!</div>`;
    } else {
      note = `<div class="mt-1 text-slate-600 dark:text-slate-300">จ่าย ${minPay.toLocaleString('th-TH')} บ./เดือน ➔ ตัดดอกเบี้ย <strong class="text-rose-600 dark:text-rose-400 font-bold">${monthlyInterest.toLocaleString('th-TH')} บ.</strong> และตัดเงินต้นจริง <strong class="text-emerald-600 dark:text-emerald-400 font-bold">${principalPaid.toLocaleString('th-TH')} บ.</strong></div>`;
    }
  }

  previewEl.innerHTML = `
    <div class="flex items-center justify-between font-semibold">
      <span class="text-slate-700 dark:text-slate-300">ดอกเบี้ยต่อปีโดยประมาณ:</span>
      <span class="text-rose-600 dark:text-rose-400 font-extrabold text-xs sm:text-sm">~${annualInterest.toLocaleString('th-TH')} บาท/ปี (~${monthlyInterest.toLocaleString('th-TH')} บ./เดือน)</span>
    </div>
    ${note}
  `;
};

function getDebtTypeInfo(type) {
  switch (type) {
    case 'credit_card':
      return { label: 'บัตรเครดิต', icon: 'credit-card', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
    case 'cash_card':
      return { label: 'บัตรกดเงินสด', icon: 'zap', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
    case 'personal_loan':
      return { label: 'สินเชื่อส่วนบุคคล', icon: 'user', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
    case 'auto_loan':
      return { label: 'สินเชื่อรถยนต์', icon: 'car', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
    case 'home_loan':
      return { label: 'สินเชื่อบ้าน', icon: 'home', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    case 'informal_loan':
      return { label: 'หนี้นอกระบบ', icon: 'alert-triangle', color: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border-red-200 dark:border-red-800' };
    default:
      return { label: 'หนี้ทั่วไป', icon: 'file-text', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' };
  }
}

function getStrategyInfo(strategy, debt) {
  const annualInterest = Math.round(debt.balance * (debt.rate / 100));

  switch (strategy) {
    case 'snowball':
      return {
        badge: '❄️ สูตร Snowball (เน้นปิดเร็ว)',
        badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        advice: `ยอดหนี้ <strong>${debt.balance.toLocaleString('th-TH')} บาท</strong> หากเป็นก้อนเล็กสุด ควรทุ่มเงินพิเศษโปะปิดให้จบเป็นอันดับ 1 เพื่อสร้างกำลังใจและปลดภาระทางใจเร็วที่สุด`
      };
    case 'avalanche':
      return {
        badge: '⚡ สูตร Avalanche (หยุดดอกแพง)',
        badgeColor: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        advice: `ดอกเบี้ยสูง <strong>${debt.rate}% ต่อปี</strong> (จ่ายทิ้ง ~${annualInterest.toLocaleString('th-TH')} บ./ปี) แนะนำเร่งโปะปิดเป็นก้อนแรก หรือรีไฟแนนซ์เพื่อหยุดดอกเบี้ยไม่ให้บานปลาย`
      };
    case 'consolidation':
      return {
        badge: '🔄 รวมหนี้ก้อนเดียว (Consolidation)',
        badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        advice: `เหมาะสำหรับนำยอดหนี้ไปรวมกับสินเชื่อบ้านหรือสินเชื่อรวมหนี้ก้อนเดียว ดอกเบี้ยจะลดลงเหลือ 6-8% และช่วยลดค่างวดต่อเดือนลงได้ถึง 40-60% โดยไม่เสียประวัติบูโร`
      };
    case 'tdr':
      return {
        badge: '🤝 ปรับโครงสร้างหนี้ (TDR)',
        badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        advice: `ติดต่อธนาคารเจ้าหนี้ขอยืดระยะเวลาผ่อนชำระ (เช่น จาก 2 ปีเป็น 5 ปี) หรือขอเปลี่ยนยอดบัตรหมุนเวียนเป็นเงินกู้ผ่อนงวด ค่างวดต่อเดือนจะลดลงทันที`
      };
    case 'haircut':
      return {
        badge: '✂️ ขอส่วนลดปิดจบ (Hair-cut)',
        badgeColor: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        advice: `สำหรับหนี้ที่ค้างชำระเกิน 90 วันหรือ NPL สามารถเก็บเงินก้อนแล้วเจรจาขอปิดจบงวดเดียว โดยขอลดเงินต้นและยกเว้นดอกเบี้ยค้างได้ 30-50%`
      };
    default:
      return {
        badge: '💡 ผ่อนชำระตามแผน',
        badgeColor: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        advice: `จ่ายค่างวดสม่ำเสมอ ${debt.minPay.toLocaleString('th-TH')} บ./เดือน พร้อมทยอยโปะเพิ่มเมื่อมีรายได้เสริม`
      };
  }
}

function initDebtPlanner() {
  renderDebtList();
  calculateRepaymentPlan();

  // Add Debt Form
  const addForm = document.getElementById('add-debt-form');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('new-debt-type')?.value || 'credit_card';
      const name = document.getElementById('new-debt-name')?.value.trim();
      const balance = parseFloat(document.getElementById('new-debt-balance')?.value) || 0;
      const rate = parseFloat(document.getElementById('new-debt-rate')?.value) || 0;
      const minPay = parseFloat(document.getElementById('new-debt-minpay')?.value) || 0;
      const strategy = document.getElementById('new-debt-strategy')?.value || 'snowball';

      if (!name || balance <= 0 || minPay <= 0) {
        showToast('กรุณากรอกชื่อหนี้ ยอดเงินคงเหลือ และยอดจ่ายเดือนล่าสุดให้ครบถ้วน', 'warning');
        return;
      }

      debts.push({
        id: Date.now().toString(),
        type,
        name,
        balance,
        rate,
        minPay,
        strategy
      });

      saveDebtsToStorage();
      renderDebtList();
      calculateRepaymentPlan();
      showToast(`บันทึกหนี้ "${name}" ในแผนการผ่อนแล้ว`, 'success', '➕ เพิ่มหนี้สำเร็จ');

      // Reset fields
      document.getElementById('new-debt-name').value = '';
      document.getElementById('new-debt-balance').value = '';
      document.getElementById('new-debt-rate').value = '16';
      document.getElementById('new-debt-minpay').value = '';
      updateDebtLivePreview();
    });
  }

  // Load sample debts button
  const loadSampleBtn = document.getElementById('load-sample-debts-btn');
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      window.loadSampleDebtsAction();
    });
  }

window.loadSampleDebtsAction = function() {
  debts = JSON.parse(JSON.stringify(SAMPLE_DEBTS));
  saveDebtsToStorage();
  renderDebtList();
  calculateRepaymentPlan();
  showToast('โหลดรายการหนี้ตัวอย่าง 3 สัญญาเรียบร้อยแล้ว', 'info');
};

  // Clear debts button
  const clearDebtsBtn = document.getElementById('clear-debts-btn');
  if (clearDebtsBtn) {
    clearDebtsBtn.addEventListener('click', () => {
      showConfirmModal({
        title: 'ล้างรายการหนี้ทั้งหมด',
        message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการหนี้ทั้งหมดออกจากอุปกรณ์?',
        confirmText: 'ล้างข้อมูลหนี้',
        cancelText: 'ยกเลิก',
        isDanger: true,
        onConfirm: () => {
          debts = [];
          saveDebtsToStorage();
          renderDebtList();
          calculateRepaymentPlan();
          showToast('ล้างรายการหนี้ทั้งหมดเรียบร้อยแล้ว', 'info');
        }
      });
    });
  }

  // Extra monthly payment slider
  const extraSlider = document.getElementById('extra-payment-slider');
  const extraInput = document.getElementById('extra-payment-input');
  if (extraSlider && extraInput) {
    extraSlider.addEventListener('input', (e) => {
      extraInput.value = e.target.value;
      calculateRepaymentPlan();
    });
    extraInput.addEventListener('input', (e) => {
      extraSlider.value = e.target.value || 0;
      calculateRepaymentPlan();
    });
  }

  // Strategy tabs
  const snowballBtn = document.getElementById('strat-snowball-btn');
  const avalancheBtn = document.getElementById('strat-avalanche-btn');

  if (snowballBtn && avalancheBtn) {
    snowballBtn.addEventListener('click', () => {
      currentStrategy = 'snowball';
      snowballBtn.classList.add('active');
      avalancheBtn.classList.remove('active');
      calculateRepaymentPlan();
    });

    avalancheBtn.addEventListener('click', () => {
      currentStrategy = 'avalanche';
      avalancheBtn.classList.add('active');
      snowballBtn.classList.remove('active');
      calculateRepaymentPlan();
    });
  }

  // Celebrate button
  const celebrateBtn = document.getElementById('celebrate-btn');
  if (celebrateBtn) {
    celebrateBtn.addEventListener('click', triggerCelebration);
  }
}

function renderDebtList() {
  const container = document.getElementById('debt-items-list');
  const totalCountEl = document.getElementById('debt-total-count');
  const totalBalanceEl = document.getElementById('debt-total-balance');
  const totalMinPayEl = document.getElementById('debt-total-minpay');
  const totalInterestEl = document.getElementById('debt-total-interest-year');

  if (!container) return;

  if (debts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-800/40 dark:to-slate-800/80 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm">
        <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
          <i data-lucide="plus-circle" class="w-7 h-7"></i>
        </div>
        <h4 class="text-base font-bold text-slate-800 dark:text-white mb-1">
          ยังไม่มีรายการหนี้ในระบบ (รอข้อมูลจริงของคุณ)
        </h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed mb-4">
          กรุณาเพิ่มรายการหนี้จริงของคุณผ่านแบบฟอร์มด้านบน (เช่น บัตรเครดิต สินเชื่อส่วนบุคคล บัตรกดเงินสด) เพื่อให้ระบบเริ่มประมวลผล วิเคราะห์ดอกเบี้ย และวางแผนปิดหนี้ที่คุ้มค่าที่สุดสำหรับคุณ
        </p>
        <div class="flex items-center justify-center gap-2 flex-wrap">
          <button type="button" onclick="document.getElementById('new-debt-name')?.focus(); document.getElementById('add-debt-card')?.scrollIntoView({behavior: 'smooth', block: 'center'});" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>เพิ่มรายการหนี้แรกของคุณ</span>
          </button>
          <button type="button" onclick="loadSampleDebtsAction()" class="px-3.5 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all">
            ทดลองดูข้อมูลตัวอย่าง
          </button>
        </div>
      </div>
    `;
    if (totalCountEl) totalCountEl.textContent = '0 สัญญาหนี้';
    if (totalBalanceEl) totalBalanceEl.textContent = '0 บาท';
    if (totalMinPayEl) totalMinPayEl.textContent = '0 บาท/เดือน';
    if (totalInterestEl) totalInterestEl.textContent = '0 บาท/ปี';
    const urgentBox = document.getElementById('debt-urgent-action-box');
    if (urgentBox) {
      urgentBox.classList.add('hidden');
      urgentBox.innerHTML = '';
    }
    lucide.createIcons();
    return;
  }

  let totalBal = 0;
  let totalMin = 0;
  let totalAnnualInterest = 0;

  let html = '';
  debts.forEach((debt, index) => {
    totalBal += debt.balance;
    totalMin += debt.minPay;
    const debtAnnualInterest = Math.round(debt.balance * (debt.rate / 100));
    const debtMonthlyInterest = Math.round(debtAnnualInterest / 12);
    totalAnnualInterest += debtAnnualInterest;

    const typeInfo = getDebtTypeInfo(debt.type);
    const stratInfo = getStrategyInfo(debt.strategy || 'snowball', debt);

    html += `
      <div class="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm transition-all group">
        
        <!-- Header Row -->
        <div class="flex items-start justify-between gap-3 mb-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
              #${index + 1}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-slate-900 dark:text-white text-sm md:text-base truncate">${escapeHtml(debt.name)}</span>
                <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeInfo.color}">
                  <i data-lucide="${typeInfo.icon}" class="w-3 h-3"></i>
                  <span>${typeInfo.label}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            <div class="text-right">
              <div class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">${debt.balance.toLocaleString('th-TH')} บ.</div>
              <div class="text-[10px] text-slate-400">ยอดหนี้คงเหลือ</div>
            </div>
            <button onclick="removeDebt('${debt.id}')" title="ลบรายการนี้" class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ml-1">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Details Row (Monthly Pay & Annual Interest) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs mb-3">
          <div class="flex items-center justify-between sm:justify-start sm:gap-2">
            <span class="text-slate-500 dark:text-slate-400">ยอดจ่ายเดือนล่าสุด:</span>
            <strong class="text-slate-800 dark:text-slate-200">${debt.minPay.toLocaleString('th-TH')} บาท/เดือน</strong>
          </div>
          <div class="flex items-center justify-between sm:justify-start sm:gap-2">
            <span class="text-slate-500 dark:text-slate-400">ดอกเบี้ย (${debt.rate}%/ปี):</span>
            <strong class="text-rose-600 dark:text-rose-400">~${debtAnnualInterest.toLocaleString('th-TH')} บ./ปี (~${debtMonthlyInterest.toLocaleString('th-TH')} บ./ด.)</strong>
          </div>
        </div>

        <!-- Strategy & How to payoff Box -->
        <div class="p-2.5 rounded-xl border ${stratInfo.badgeColor} text-xs">
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold flex items-center gap-1">${stratInfo.badge}</span>
            <span class="text-[10px] opacity-75">แนวทางปิดหนี้</span>
          </div>
          <div class="leading-relaxed opacity-90">${stratInfo.advice}</div>
        </div>

      </div>
    `;
  });

  container.innerHTML = html;

  const totalMonthlyInterest = Math.round(totalAnnualInterest / 12);
  if (totalCountEl) totalCountEl.textContent = `${debts.length} สัญญาหนี้`;
  if (totalBalanceEl) totalBalanceEl.textContent = `${totalBal.toLocaleString('th-TH')} บาท`;
  if (totalMinPayEl) totalMinPayEl.textContent = `${totalMin.toLocaleString('th-TH')} บาท/เดือน`;
  if (totalInterestEl) totalInterestEl.textContent = `~${totalAnnualInterest.toLocaleString('th-TH')} บาท/ปี (~${totalMonthlyInterest.toLocaleString('th-TH')} บ./เดือน)`;

  renderDebtActionSummary(totalBal, totalMin, totalAnnualInterest);
  lucide.createIcons();
}

function renderDebtActionSummary(totalBal, totalMin, totalAnnualInterest) {
  const box = document.getElementById('debt-urgent-action-box');
  if (!box) return;

  if (debts.length === 0 || totalBal <= 0) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  box.classList.remove('hidden');

  // 1. Consolidated Loan: 48 months at 7.5% per annum reducing balance
  const r_cons = 0.075 / 12;
  const n_cons = 48;
  const pmt_cons = Math.round(totalBal * (r_cons * Math.pow(1 + r_cons, n_cons)) / (Math.pow(1 + r_cons, n_cons) - 1));
  const savings_cons = Math.max(0, totalMin - pmt_cons);

  // 2. SAM Debt Clinic: 120 months at 4.0% per annum
  const r_sam = 0.04 / 12;
  const n_sam = 120;
  const pmt_sam = Math.round(totalBal * (r_sam * Math.pow(1 + r_sam, n_sam)) / (Math.pow(1 + r_sam, n_sam) - 1));
  const savings_sam = Math.max(0, totalMin - pmt_sam);

  // 3. Find highest rate debt and smallest balance debt
  const sortedByRate = [...debts].sort((a, b) => b.rate - a.rate);
  const highestRateDebt = sortedByRate[0];

  const sortedByBal = [...debts].sort((a, b) => a.balance - b.balance);
  const smallestDebt = sortedByBal[0];

  const burdenRate = ((totalMin / totalBal) * 100).toFixed(1);
  const isHighBurden = totalMin >= 20000 || parseFloat(burdenRate) >= 10;

  box.innerHTML = `
    <div class="bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-900 p-4 sm:p-5 rounded-2xl border border-amber-500/50 text-xs shadow-xl space-y-4">
      
      <!-- Urgency Banner -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <span class="p-2 rounded-xl ${isHighBurden ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'} shrink-0 mt-0.5">
            <i data-lucide="${isHighBurden ? 'alert-triangle' : 'help-circle'}" class="w-5 h-5"></i>
          </span>
          <div>
            <div class="font-extrabold ${isHighBurden ? 'text-rose-300' : 'text-amber-300'} text-sm sm:text-base flex items-center gap-1.5 flex-wrap">
              <span>ข้อสรุปภาระหนี้: ต้องจ่ายเดือนละ ${totalMin.toLocaleString('th-TH')} บาท</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isHighBurden ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-900'}">
                ${isHighBurden ? 'ภาระตึงตัวสูงมาก ⚠️' : 'ต้องวางแผนด่วน'}
              </span>
            </div>
            <p class="text-slate-300 text-[11px] sm:text-xs mt-1 leading-relaxed">
              คุณมีหนี้รวม <strong>${debts.length} สัญญา (${totalBal.toLocaleString('th-TH')} บาท)</strong> ต้องจ่ายเดือนละ <strong class="text-white font-bold">${totalMin.toLocaleString('th-TH')} บ./เดือน</strong> โดยในยอดนี้มีดอกเบี้ยกินเปล่าถึง <strong class="text-rose-400 font-bold">~${totalAnnualInterest.toLocaleString('th-TH')} บาท/ปี</strong> (~${Math.round(totalAnnualInterest / 12).toLocaleString('th-TH')} บ./ด.)
            </p>
          </div>
        </div>
      </div>

      <!-- Action Plan Steps -->
      <div class="space-y-2.5 pt-2 border-t border-slate-800">
        <div class="font-extrabold text-amber-200 text-xs flex items-center gap-1.5">
          <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
          <span>ต้องรีบทำอย่างไรต่อดี? (3 ทางเลือกแก้ปัญหาที่ดีที่สุด):</span>
        </div>

        <!-- Option 1: Debt Consolidation -->
        <div class="p-3.5 rounded-xl bg-slate-800/90 border border-blue-500/40 hover:border-blue-400 transition-all space-y-1.5">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <span class="font-bold text-blue-300 text-xs flex items-center gap-1.5">
              <span>ทางเลือกที่ 1: "รวมหนี้ก้อนเดียว" (Debt Consolidation)</span>
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ลดยอดผ่อนได้ทันที
            </span>
          </div>
          <p class="text-slate-300 text-[11px] leading-relaxed">
            หากคุณยังมีประวัติชำระปกติ แนะนำให้<strong>รวมหนี้ ${debts.length} สัญญานี้เป็นก้อนเดียว</strong> ดอกเบี้ยจะลดลงเหลือ 6-8% และ<strong>ค่างวดจะลดจาก ${totalMin.toLocaleString('th-TH')} บ./ด. เหลือเพียงประมาณ ~${pmt_cons.toLocaleString('th-TH')} บ./เดือน</strong> (ช่วยปลดภาระได้ทันทีกว่า <span class="text-emerald-400 font-bold">${savings_cons.toLocaleString('th-TH')} บาท/เดือน</span> โดยไม่เสียเครดิตบูโร!)
          </p>
          <div class="pt-1 flex items-center gap-2">
            <a href="#solutions-section" class="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm">
              <span>ดูข้อมูลรวมหนี้ & สถาบันการเงินที่รับ</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </a>
          </div>
        </div>

        <!-- Option 2: SAM Debt Clinic / TDR -->
        <div class="p-3.5 rounded-xl bg-slate-800/90 border border-emerald-500/40 hover:border-emerald-400 transition-all space-y-1.5">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <span class="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
              <span>ทางเลือกที่ 2: ถ้าเริ่มจ่าย ${totalMin.toLocaleString('th-TH')} บ./ด. ไม่ไหวแล้ว ➔ "คลินิกแก้หนี้ SAM"</span>
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ดอกเบี้ย 3-5% ผ่อน 10 ปี
            </span>
          </div>
          <p class="text-slate-300 text-[11px] leading-relaxed">
            หากเป็นหนี้บัตรเครดิต/สินเชื่อบุคคลและเริ่มผ่อนต่อไม่ไหว อย่าปล่อยให้ถูกฟ้องร้อง ให้เตรียมใช้สิทธิ์ <strong>คลินิกแก้หนี้ by SAM</strong> ซึ่งรวมหนี้เสียดอกเบี้ยต่ำเพียง 3-5% ผ่อนยาว 10 ปี <strong>ค่างวดจะลดเหลือเพียงประมาณ ~${pmt_sam.toLocaleString('th-TH')} บ./เดือน</strong> เท่านั้น
          </p>
          <div class="pt-1 flex items-center gap-2">
            <a href="#solutions-section" class="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 rounded-lg transition-colors">
              <span>ดูเงื่อนไขคลินิกแก้หนี้ SAM</span>
              <i data-lucide="arrow-right" class="w-3 h-3"></i>
            </a>
          </div>
        </div>

        <!-- Option 3: Payoff Sequence -->
        <div class="p-3.5 rounded-xl bg-slate-800/90 border border-indigo-500/40 hover:border-indigo-400 transition-all space-y-1.5">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <span class="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
              <span>ทางเลือกที่ 3: ถ้าจะทยอยปิดหนี้เอง ➔ ควรปิดก้อนไหนก่อน?</span>
            </span>
          </div>
          <p class="text-slate-300 text-[11px] leading-relaxed">
            ${highestRateDebt ? `• <strong>เพื่อหยุดดอกแพงสุด:</strong> ทุ่มโปะปิดก้อน "<strong>${escapeHtml(highestRateDebt.name)}</strong>" (ดอกเบี้ย ${highestRateDebt.rate}% สูงสุดในรายการหนี้ของคุณ)<br>` : ''}
            ${smallestDebt ? `• <strong>เพื่อปลดภาระใจเร็วสุด:</strong> ทุ่มโปะปิดก้อน "<strong>${escapeHtml(smallestDebt.name)}</strong>" (ยอดคงเหลือ ${smallestDebt.balance.toLocaleString('th-TH')} บ. น้อยที่สุด)` : ''}
          </p>
          <div class="pt-1 flex items-center gap-2">
            <button type="button" onclick="document.getElementById('plan-priority-order')?.scrollIntoView({behavior: 'smooth', block: 'center'});" class="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold text-indigo-300 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 rounded-lg transition-colors">
              <span>ดูแผนจัดลำดับปิดหนี้ทีละก้อน (Snowball vs Avalanche)</span>
              <i data-lucide="chevron-down" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Critical Warning -->
        <div class="p-3 rounded-xl bg-rose-950/50 border border-rose-900/80 text-[11px] text-rose-200 flex items-start gap-2">
          <i data-lucide="shield-alert" class="w-4 h-4 text-rose-400 shrink-0 mt-0.5"></i>
          <div>
            <strong class="font-bold text-rose-100">ข้อห้ามเด็ดขาดในสถานการณ์นี้:</strong> ห้ามกดเงินสดจากบัตรหนึ่งมาจ่ายอีกบัตรหนึ่ง และห้ามกู้นอกระบบมาโปะเด็ดขาด เพราะจะทำให้หนี้ ${totalBal.toLocaleString('th-TH')} บ. ลุกลามกลายเป็นหลักล้านอย่างรวดเร็ว
          </div>
        </div>

      </div>

    </div>
  `;

  lucide.createIcons();
}

window.removeDebt = function(id) {
  debts = debts.filter(d => d.id !== id);
  saveDebtsToStorage();
  renderDebtList();
  calculateRepaymentPlan();
};

function calculateRepaymentPlan() {
  const chartEmptyEl = document.getElementById('debt-chart-empty');
  if (debts.length === 0) {
    if (chartEmptyEl) chartEmptyEl.classList.remove('hidden');
    updatePlanSummaryUI(0, 0, 0, 0, []);
    renderChart([], []);
    return;
  }
  if (chartEmptyEl) chartEmptyEl.classList.add('hidden');

  const extraMonthly = parseFloat(document.getElementById('extra-payment-input')?.value) || 0;

  // Run Baseline (Paying only minimum payments)
  const baseSim = simulatePayoff(debts, 'minimum', 0);

  // Run Selected Strategy (Snowball or Avalanche with Extra Payment)
  const stratSim = simulatePayoff(debts, currentStrategy, extraMonthly);

  // Run Alternate Strategy for Comparison
  const altStrategy = currentStrategy === 'snowball' ? 'avalanche' : 'snowball';
  const altSim = simulatePayoff(debts, altStrategy, extraMonthly);

  const interestSaved = Math.max(0, baseSim.totalInterest - stratSim.totalInterest);
  const monthsSaved = Math.max(0, baseSim.totalMonths - stratSim.totalMonths);

  updatePlanSummaryUI(stratSim.totalMonths, stratSim.totalInterest, interestSaved, monthsSaved, stratSim.priorityOrder);
  renderChart(baseSim.timeline, stratSim.timeline);
}

/**
 * Payoff simulation engine
 */
function simulatePayoff(debtList, strategy, extraPay) {
  // Deep clone
  let currentDebts = debtList.map(d => ({ ...d }));

  // Sort order according to strategy
  if (strategy === 'snowball') {
    // Smallest balance first
    currentDebts.sort((a, b) => a.balance - b.balance);
  } else if (strategy === 'avalanche') {
    // Highest interest rate first
    currentDebts.sort((a, b) => b.rate - a.rate);
  }

  const priorityOrder = currentDebts.map(d => ({ ...d }));

  let totalInterest = 0;
  let months = 0;
  const maxMonths = 360; // 30 years safety cutoff
  const timeline = [];

  // Initial balance recorded
  let totalBal = currentDebts.reduce((sum, d) => sum + d.balance, 0);
  timeline.push({ month: 0, balance: Math.round(totalBal) });

  let snowballedAmount = 0; // Cumulative freed-up minimum payments

  while (currentDebts.some(d => d.balance > 0) && months < maxMonths) {
    months++;
    let availableExtra = extraPay + snowballedAmount;

    // 1. Accrue monthly interest for each active debt
    for (let d of currentDebts) {
      if (d.balance > 0) {
        const monthlyRate = (d.rate / 100) / 12;
        const interest = d.balance * monthlyRate;
        d.balance += interest;
        totalInterest += interest;
      }
    }

    // 2. Pay minimums
    for (let d of currentDebts) {
      if (d.balance > 0) {
        const pay = Math.min(d.balance, d.minPay);
        d.balance -= pay;
      }
    }

    // 3. Apply available extra + freed up payments to target debt
    if (strategy !== 'minimum') {
      for (let d of currentDebts) {
        if (d.balance > 0 && availableExtra > 0) {
          const pay = Math.min(d.balance, availableExtra);
          d.balance -= pay;
          availableExtra -= pay;
        }
      }
    }

    // 4. Check for debts paid off in this month to roll their min payments into next month
    snowballedAmount = 0;
    for (let d of currentDebts) {
      if (d.balance <= 0.01) {
        d.balance = 0;
        snowballedAmount += d.minPay;
      }
    }

    totalBal = currentDebts.reduce((sum, d) => sum + d.balance, 0);
    // Record timeline every month or quarterly for chart
    if (months % 1 === 0 || totalBal === 0) {
      timeline.push({ month: months, balance: Math.max(0, Math.round(totalBal)) });
    }
  }

  return {
    totalMonths: months,
    totalInterest: Math.round(totalInterest),
    priorityOrder,
    timeline
  };
}

function updatePlanSummaryUI(totalMonths, totalInterest, interestSaved, monthsSaved, priorityOrder) {
  const timeEl = document.getElementById('plan-total-time');
  const interestEl = document.getElementById('plan-total-interest');
  const savedInterestEl = document.getElementById('plan-saved-interest');
  const savedTimeEl = document.getElementById('plan-saved-time');
  const orderList = document.getElementById('plan-priority-order');

  if (timeEl) {
    const years = Math.floor(totalMonths / 12);
    const remMonths = totalMonths % 12;
    let timeStr = '';
    if (years > 0) timeStr += `${years} ปี `;
    timeStr += `${remMonths} เดือน`;
    timeEl.textContent = totalMonths > 0 ? timeStr : '-';
  }

  if (interestEl) {
    interestEl.textContent = totalMonths > 0 ? `${totalInterest.toLocaleString('th-TH')} บาท` : '-';
  }

  if (savedInterestEl) {
    savedInterestEl.textContent = interestSaved > 0 ? `ประหยัดได้ ${interestSaved.toLocaleString('th-TH')} บาท` : (totalMonths > 0 ? 'จ่ายตามยอดปกติ' : 'รอข้อมูลหนี้');
  }

  if (savedTimeEl) {
    const sYears = Math.floor(monthsSaved / 12);
    const sMonths = monthsSaved % 12;
    let sStr = '';
    if (sYears > 0) sStr += `${sYears} ปี `;
    if (sMonths > 0) sStr += `${sMonths} เดือน`;
    savedTimeEl.textContent = monthsSaved > 0 ? `เร็วขึ้น ${sStr}` : (totalMonths > 0 ? 'ไม่มีเวลาลดลง' : 'รอข้อมูลหนี้');
  }

  if (orderList) {
    if (priorityOrder.length === 0) {
      orderList.innerHTML = `
        <div class="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <p class="font-semibold text-slate-600 dark:text-slate-300">ยังไม่มีรายการหนี้ในคิว</p>
          <p class="text-[11px] mt-0.5">เมื่อคุณเพิ่มรายการหนี้จริง ระบบจะจัดอันดับก้อนที่ควรปิดก่อนให้คุณทันที</p>
        </div>
      `;
      return;
    }

    let html = '';
    priorityOrder.forEach((item, idx) => {
      const isTarget = idx === 0;
      html += `
        <div class="flex items-center justify-between p-3 rounded-xl border ${isTarget ? 'bg-blue-50/70 border-blue-200 ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200'}">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isTarget ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}">
              ${idx + 1}
            </span>
            <div>
              <div class="font-semibold text-sm text-slate-900">${escapeHtml(item.name)}</div>
              <div class="text-xs text-slate-500">ยอดคงเหลือ: ${item.balance.toLocaleString('th-TH')} บ. | ดอกเบี้ย ${item.rate}%</div>
            </div>
          </div>
          <div>
            ${isTarget ? '<span class="text-xs font-semibold px-2 py-0.5 bg-blue-600 text-white rounded-md">เป้าหมายแรก 🔥</span>' : '<span class="text-xs text-slate-400">คิวถัดไป</span>'}
          </div>
        </div>
      `;
    });
    orderList.innerHTML = html;
  }
}

function renderChart(baseTimeline, stratTimeline) {
  const canvas = document.getElementById('debt-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  if (debtChart) {
    debtChart.destroy();
  }

  if (baseTimeline.length === 0 || stratTimeline.length === 0) {
    return;
  }

  // Find max length for common labels
  const maxPoints = Math.max(baseTimeline.length, stratTimeline.length);
  const labels = [];
  const baseData = [];
  const stratData = [];

  for (let i = 0; i < maxPoints; i++) {
    const month = i;
    labels.push(`เดือนที่ ${month}`);
    baseData.push(baseTimeline[i] ? baseTimeline[i].balance : 0);
    stratData.push(stratTimeline[i] ? stratTimeline[i].balance : 0);
  }

  const isDark = document.documentElement.classList.contains('dark');
  const labelColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  debtChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'จ่ายขั้นต่ำอย่างเดียว (ยอดหนี้ลดยาก ดอกเบี้ยสะสม)',
          data: baseData,
          borderColor: '#ef4444',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: `ใช้กลยุทธ์ ${currentStrategy === 'snowball' ? 'Snowball (บอลหิมะ)' : 'Avalanche (หิมะถล่ม)'} + เงินโปะพิเศษ`,
          data: stratData,
          borderColor: '#3b82f6',
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 99, 235, 0.1)',
          fill: true,
          pointRadius: 0,
          borderWidth: 3,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'Noto Sans Thai', sans-serif", size: 12 },
            color: labelColor,
            boxWidth: 14,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString('th-TH')} บาท`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 8, font: { family: "'Noto Sans Thai', sans-serif" }, color: labelColor }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            callback: function(value) {
              return value >= 1000 ? (value / 1000).toLocaleString() + 'k บ.' : value + ' บ.';
            },
            font: { family: "'Noto Sans Thai', sans-serif" },
            color: labelColor
          }
        }
      }
    }
  });
}

// Celebration effect
function triggerCelebration() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  } else {
    alert('🎉 ยอดเยี่ยมมาก! ทุกก้าวเล็กๆ คือก้าวสำคัญสู่อิสรภาพทางการเงิน!');
  }
}

// ==========================================
// 3. SOLUTIONS FILTER & TABS
// ==========================================
function initFilters() {
  const filterBtns = document.querySelectorAll('.solution-filter-btn');
  const cards = document.querySelectorAll('.solution-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
      filterBtns.forEach(b => b.classList.add('bg-white', 'text-slate-700'));
      btn.classList.remove('bg-white', 'text-slate-700');
      btn.classList.add('bg-blue-600', 'text-white');

      const filter = btn.getAttribute('data-filter');

      cards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// ==========================================
// 4. EMERGENCY CHECKLIST INTERACTIVE
// ==========================================
function initEmergencyChecklist() {
  const checkboxes = document.querySelectorAll('.emergency-step-checkbox');
  const progressBar = document.getElementById('emergency-progress-bar');
  const countEl = document.getElementById('emergency-completed-count');

  function updateChecklist() {
    let checkedCount = 0;
    checkboxes.forEach(cb => {
      if (cb.checked) checkedCount++;
    });

    const percent = (checkedCount / checkboxes.length) * 100;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (countEl) countEl.textContent = `${checkedCount}/${checkboxes.length} สเต็ป`;

    if (checkedCount === checkboxes.length) {
      triggerCelebration();
    }
  }

  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateChecklist);
  });
}

// ==========================================
// 5. COPY TO CLIPBOARD HELPER
// ==========================================
window.copyScript = function(elementId, btnElement) {
  const textEl = document.getElementById(elementId);
  if (!textEl) return;

  const text = textEl.innerText || textEl.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `
      <i data-lucide="check" class="w-4 h-4 inline mr-1 text-emerald-600"></i>
      <span class="text-emerald-700 dark:text-emerald-400 font-semibold">คัดลอกแล้ว!</span>
    `;
    lucide.createIcons();
    showToast('คัดลอกบทพูดลงในคลิปบอร์ดแล้ว นำไปใช้อ่านเจรจาได้ทันที', 'success', '📋 คัดลอกสำเร็จ');
    setTimeout(() => {
      btnElement.innerHTML = originalText;
      lucide.createIcons();
    }, 2500);
  }).catch(err => {
    showToast('ไม่สามารถคัดลอกข้อความได้อัตโนมัติ กรุณากดเลือกและคัดลอกเอง', 'warning');
  });
};

// ==========================================
// 6. PRINT / EXPORT PLAN HELPER
// ==========================================
window.printDebtPlan = function() {
  window.print();
};

// ==========================================
// 6.1 THEME MANAGEMENT (DARK & LIGHT MODE)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('app_theme');
  const userTheme = (currentUser && currentUser.theme) ? currentUser.theme : null;
  const preferred = userTheme || savedTheme;

  if (preferred === 'dark' || (!preferred && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon();
}

window.toggleTheme = function() {
  const isDark = document.documentElement.classList.toggle('dark');
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('app_theme', theme);
  
  if (currentUser) {
    currentUser.theme = theme;
    localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
  }
  
  updateThemeIcon();
  if (debtChart) {
    calculateRepaymentPlan(); // Redraw chart with matching dark/light colors
  }
};

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    lucide.createIcons();
  }
}

// ==========================================
// 7. USER AUTHENTICATION & MEMBERSHIP SYSTEM
// ==========================================
let currentUser = null;

function initAuthSystem() {
  // Load session
  const storedUser = localStorage.getItem('debt_user_session');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      // Sync user's saved theme preference
      if (currentUser.theme) {
        localStorage.setItem('app_theme', currentUser.theme);
        initTheme();
      }
    } catch (e) {
      currentUser = null;
    }
  }

  updateAuthUI();

  // Auth Form Handlers
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');

  if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value.trim();
      const password = document.getElementById('signin-password').value;

      if (!email || !password) {
        showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'warning');
        return;
      }

      const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

      // Check registered users or create login session
      currentUser = {
        name: email.split('@')[0] || 'สมาชิก',
        email: email,
        tier: 'free',
        theme: activeTheme,
        joinedAt: new Date().toLocaleDateString('th-TH')
      };

      localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showToast(`ยินดีต้อนรับคุณ ${currentUser.name} เข้าสู่ระบบเรียบร้อย`, 'success', '✨ เข้าสู่ระบบสำเร็จ');
      lucide.createIcons();
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const phone = document.getElementById('signup-phone').value.trim();

      if (!name || !email) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'warning');
        return;
      }

      const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';

      currentUser = {
        name,
        email,
        phone,
        tier: 'free',
        theme: activeTheme,
        joinedAt: new Date().toLocaleDateString('th-TH')
      };

      localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showToast(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${currentUser.name}`, 'success', '🎉 สมาชิกใหม่');
      triggerCelebration();
      lucide.createIcons();
    });
  }

  // Direct Google Sign-In Form Handler (Real User Data)
  const googleDirectForm = document.getElementById('google-direct-form');
  if (googleDirectForm) {
    googleDirectForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('google-direct-email').value.trim();
      let name = document.getElementById('google-direct-name').value.trim();
      if (!email) return;
      if (!name) {
        name = email.split('@')[0];
      }
      saveGoogleUserSession(name, email, name.charAt(0).toUpperCase());
      showToast(`ยินดีต้อนรับคุณ ${name} เข้าสู่ระบบด้วย Google เรียบร้อยแล้ว`, 'success', '✨ เข้าสู่ระบบสำเร็จ');
    });
  }

  // Auto-init Google GIS if library is ready
  window.addEventListener('load', () => {
    initGoogleGIS();
  });
}

// ==========================================
// 7.1 GOOGLE SIGN-IN HANDLERS & REAL GIS OAUTH
// ==========================================
function decodeJwtResponse(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode Google JWT:', err);
    return null;
  }
}

window.handleGoogleCredentialResponse = function(response) {
  try {
    if (!response || !response.credential) {
      console.warn('No credential received in Google response');
      return;
    }
    const data = decodeJwtResponse(response.credential);
    if (!data) {
      showToast('ไม่สามารถอ่านข้อมูลบัญชี Google ได้ กรุณาลองใหม่อีกครั้ง', 'error');
      return;
    }

    const name = data.name || data.given_name || data.email.split('@')[0];
    const email = data.email;
    const avatar = data.picture || name.charAt(0).toUpperCase();

    saveGoogleUserSession(name, email, avatar);
    closeGoogleModal();
    showToast(`ยินดีต้อนรับคุณ ${name} (${email}) เข้าสู่ระบบเรียบร้อย`, 'success', '🎉 เข้าสู่ระบบสำเร็จ');
  } catch (err) {
    console.error('Error in handleGoogleCredentialResponse:', err);
    closeGoogleModal();
  }
};

function initGoogleGIS() {
  const clientId = localStorage.getItem('google_oauth_client_id');
  const section = document.getElementById('google-official-btn-section');
  const wrapper = document.getElementById('google-official-btn-wrapper');
  const inputEl = document.getElementById('google-client-id-input');

  if (inputEl && clientId) {
    inputEl.value = clientId;
  }

  if (!clientId || typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    if (section) section.classList.add('hidden');
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: window.handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    if (wrapper) {
      wrapper.innerHTML = '';
      google.accounts.id.renderButton(wrapper, {
        theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 280
      });
      if (section) section.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('Google Identity Services initialization notice:', err);
  }
}

window.saveGoogleClientId = function() {
  const input = document.getElementById('google-client-id-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    localStorage.removeItem('google_oauth_client_id');
    showToast('ล้างการตั้งค่า Client ID เรียบร้อย', 'info');
    initGoogleGIS();
    return;
  }

  localStorage.setItem('google_oauth_client_id', val);
  initGoogleGIS();
  showToast('เชื่อมต่อ Google สำเร็จ! แตะปุ่มด้านบนเพื่อเข้าสู่ระบบ', 'success', '🔑 เชื่อมต่อ Google API');
};

const DEFAULT_GOOGLE_ACCOUNTS = [
  {
    name: 'Natshow No Limit',
    email: 'natmeshow@gmail.com',
    avatar: 'N'
  }
];

function getSavedGoogleAccounts() {
  try {
    const raw = localStorage.getItem('debt_saved_google_users');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_GOOGLE_ACCOUNTS;
}

window.renderGoogleModalUI = function() {
  const container = document.getElementById('google-saved-accounts-list');
  if (!container) return;

  const accounts = getSavedGoogleAccounts();
  container.innerHTML = accounts.map(acc => {
    const hasPhoto = acc.avatar && acc.avatar.startsWith('http');
    const avatarContent = hasPhoto 
      ? `<img src="${escapeHtml(acc.avatar)}" alt="${escapeHtml(acc.name)}" class="w-full h-full object-cover">`
      : `<span class="text-sm font-bold">${escapeHtml(acc.avatar || acc.name.charAt(0).toUpperCase())}</span>`;
    
    return `
      <button type="button" onclick="selectGoogleAccount('${escapeHtml(acc.name)}', '${escapeHtml(acc.email)}', '${escapeHtml(acc.avatar || 'G')}')" class="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/80 dark:hover:border-blue-400 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-slate-750 transition-all text-left group shadow-sm active:scale-[0.99]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full ${hasPhoto ? '' : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white'} flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            ${avatarContent}
          </div>
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${escapeHtml(acc.name)}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${escapeHtml(acc.email)}</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 shrink-0">
          <span class="text-[11px] font-semibold hidden xs:inline">1 คลิก</span>
          <i data-lucide="chevron-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform"></i>
        </div>
      </button>
    `;
  }).join('');
};

window.toggleGoogleAnotherAccount = function() {
  const box = document.getElementById('google-another-account-box');
  if (box) {
    box.classList.toggle('hidden');
    if (!box.classList.contains('hidden')) {
      const emailInput = document.getElementById('google-direct-email');
      if (emailInput) emailInput.focus();
    }
  }
};

window.handleGoogleSignIn = function() {
  closeAuthModal();
  const googleModal = document.getElementById('google-picker-modal');
  if (googleModal) {
    renderGoogleModalUI();
    googleModal.classList.remove('hidden');
    initGoogleGIS();
    lucide.createIcons();
  }
};

window.closeGoogleModal = function() {
  const googleModal = document.getElementById('google-picker-modal');
  if (googleModal) {
    googleModal.classList.add('hidden');
  }
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.classList.add('hidden');
  }
};

function saveGoogleUserSession(name, email, avatar) {
  try {
    const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    currentUser = {
      name: name,
      email: email,
      avatar: avatar || name.charAt(0).toUpperCase(),
      provider: 'google',
      tier: 'free',
      theme: activeTheme,
      joinedAt: new Date().toLocaleDateString('th-TH')
    };

    localStorage.setItem('debt_user_session', JSON.stringify(currentUser));

    // Save into recent Google accounts list
    let savedList = getSavedGoogleAccounts();
    const existingIdx = savedList.findIndex(acc => acc.email.toLowerCase() === email.toLowerCase());
    if (existingIdx >= 0) {
      savedList[existingIdx] = { name, email, avatar: currentUser.avatar };
    } else {
      savedList.unshift({ name, email, avatar: currentUser.avatar });
    }
    localStorage.setItem('debt_saved_google_users', JSON.stringify(savedList.slice(0, 5)));

    updateAuthUI();
  } catch (err) {
    console.error('Error saving user session:', err);
  } finally {
    closeGoogleModal();
    closeMobileMenu();
  }
  try {
    triggerCelebration();
  } catch (e) {}
}

window.selectGoogleAccount = function(name, email, initial) {
  saveGoogleUserSession(name, email, initial);
  showToast(`ยินดีต้อนรับคุณ ${name} (${email}) เข้าสู่ระบบด้วย Google สำเร็จ!`, 'success', '✨ เข้าสู่ระบบสำเร็จ');
};

function updateAuthUI() {
  const authBtnGroup = document.getElementById('auth-btn-group');
  const userProfileBadge = document.getElementById('user-profile-badge');
  const mobileQuickAuth = document.getElementById('mobile-quick-auth');
  const drawerAuthBox = document.getElementById('drawer-auth-box');
  const userNameEl = document.getElementById('user-display-name');
  const userTierEl = document.getElementById('user-tier-badge');
  const userAvatarEl = document.getElementById('user-avatar-circle');

  if (!authBtnGroup || !userProfileBadge) return;

  if (currentUser) {
    authBtnGroup.className = 'hidden';
    if (mobileQuickAuth) mobileQuickAuth.className = 'hidden';
    userProfileBadge.className = 'flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 dark:bg-slate-800/90 pl-1.5 pr-2 sm:pl-2 sm:pr-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0';
    if (userNameEl) userNameEl.textContent = currentUser.name;
    
    // Avatar display (supports real Google profile picture URL)
    if (userAvatarEl) {
      if (currentUser.provider === 'google' && currentUser.avatar && currentUser.avatar.startsWith('http')) {
        userAvatarEl.innerHTML = `<img src="${escapeHtml(currentUser.avatar)}" alt="${escapeHtml(currentUser.name)}" class="w-full h-full rounded-full object-cover">`;
        userAvatarEl.className = 'w-6 h-6 rounded-full overflow-hidden shrink-0 shadow-sm border border-slate-200 dark:border-slate-700';
      } else if (currentUser.provider === 'google') {
        userAvatarEl.innerHTML = `<span class="text-[11px] font-extrabold">${escapeHtml(currentUser.avatar || 'G')}</span>`;
        userAvatarEl.className = 'w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-sm';
      } else {
        userAvatarEl.innerHTML = `<i data-lucide="user" class="w-3.5 h-3.5"></i>`;
        userAvatarEl.className = 'w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center';
      }
    }

    if (userTierEl) {
      if (currentUser.tier === 'pro') {
        userTierEl.textContent = 'PRO MEMBER';
        userTierEl.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded badge-pro';
      } else {
        userTierEl.textContent = currentUser.provider === 'google' ? 'GOOGLE FREE' : 'FREE TIER';
        userTierEl.className = 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
      }
    }

    // Drawer Auth Box - Logged In View
    if (drawerAuthBox) {
      const avatarHtml = (currentUser.avatar && currentUser.avatar.startsWith('http'))
        ? `<img src="${escapeHtml(currentUser.avatar)}" alt="${escapeHtml(currentUser.name)}" class="w-11 h-11 rounded-full object-cover shrink-0 shadow-md border-2 border-white dark:border-slate-700">`
        : `<div class="w-11 h-11 rounded-full ${currentUser.provider === 'google' ? 'bg-gradient-to-tr from-blue-600 to-indigo-600' : 'bg-blue-600'} text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-md">
            ${escapeHtml(currentUser.avatar || currentUser.name.charAt(0).toUpperCase())}
          </div>`;

      drawerAuthBox.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            ${avatarHtml}
            <div class="min-w-0">
              <div class="font-bold text-slate-900 dark:text-white text-sm truncate">${escapeHtml(currentUser.name)}</div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${escapeHtml(currentUser.email || 'สมาชิกในระบบ')}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${currentUser.tier === 'pro' ? 'badge-pro text-white shadow-sm' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}">
            ${currentUser.tier === 'pro' ? 'PRO VIP' : (currentUser.provider === 'google' ? 'GOOGLE FREE' : 'FREE TIER')}
          </span>
        </div>
        
        <div class="grid ${currentUser.tier === 'pro' ? 'grid-cols-1' : 'grid-cols-2'} gap-2 pt-1">
          ${currentUser.tier !== 'pro' ? `
            <button onclick="upgradeToPro(); closeMobileMenu();" class="py-2 px-3 text-xs font-bold text-amber-900 dark:text-amber-200 bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-950/60 dark:to-amber-900/40 hover:from-amber-200 hover:to-amber-300 rounded-xl border border-amber-300 dark:border-amber-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm">
              <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"></i>
              <span>รับ PRO ฟรี</span>
            </button>
          ` : ''}
          <button onclick="logoutUser(); closeMobileMenu();" class="py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-900/40 flex items-center justify-center gap-1.5 transition-colors active:scale-95">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      `;
    }

    lucide.createIcons();
  } else {
    authBtnGroup.className = 'hidden md:flex items-center gap-1.5 shrink-0';
    if (mobileQuickAuth) mobileQuickAuth.className = 'flex md:hidden items-center gap-1.5 shrink-0';
    userProfileBadge.className = 'hidden';
    userProfileBadge.classList.remove('flex');

    // Drawer Auth Box - Logged Out View
    if (drawerAuthBox) {
      drawerAuthBox.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <i data-lucide="user-circle" class="w-4 h-4 text-blue-600 dark:text-blue-400"></i>
            เข้าสู่ระบบเพื่อบันทึกข้อมูลหนี้
          </span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">ฟรี 100%</span>
        </div>
        <button onclick="handleGoogleSignIn(); closeMobileMenu();" class="w-full py-2.5 px-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-100 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm transition-all flex items-center justify-center gap-2 mb-2 active:scale-[0.98]">
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>เข้าสู่ระบบด้วย Google 1-คลิก</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openAuthModal('signin'); closeMobileMenu();" class="py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 text-center hover:bg-slate-50 transition-colors">
            เข้าสู่ระบบ
          </button>
          <button onclick="openAuthModal('signup'); closeMobileMenu();" class="py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm text-center transition-colors">
            สมัครสมาชิก
          </button>
        </div>
      `;
    }
  }

  // Reload debt records for the active member or guest
  loadDebtsFromStorage();
  renderDebtList();
  calculateRepaymentPlan();
}

// Mobile Drawer Controls
window.toggleMobileMenu = function() {
  const drawer = document.getElementById('mobile-drawer');
  if (!drawer) return;
  const isHidden = drawer.classList.contains('hidden');
  if (isHidden) {
    drawer.classList.remove('hidden');
  } else {
    drawer.classList.add('hidden');
  }
  lucide.createIcons();
};

window.closeMobileMenu = function() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) {
    drawer.classList.add('hidden');
  }
};

window.openAuthModal = function(tab = 'signin') {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  switchAuthTab(tab);
};

window.closeAuthModal = function() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
};

window.switchAuthTab = function(tab) {
  const signinTab = document.getElementById('tab-btn-signin');
  const signupTab = document.getElementById('tab-btn-signup');
  const signinView = document.getElementById('view-signin');
  const signupView = document.getElementById('view-signup');

  if (!signinTab || !signupTab || !signinView || !signupView) return;

  if (tab === 'signin') {
    signinTab.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 shadow-sm';
    signupTab.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
    signinView.classList.remove('hidden');
    signupView.classList.add('hidden');
  } else {
    signupTab.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 shadow-sm';
    signinTab.className = 'flex-1 py-2 text-xs font-semibold rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
    signupView.classList.remove('hidden');
    signinView.classList.add('hidden');
  }
};

window.logoutUser = function() {
  showConfirmModal({
    title: 'ออกจากระบบ',
    message: 'คุณต้องการออกจากระบบ "ปลดหนี้ มีทางออก" ใช่หรือไม่?',
    confirmText: 'ออกจากระบบ',
    cancelText: 'ยกเลิก',
    isDanger: true,
    onConfirm: () => {
      localStorage.removeItem('debt_user_session');
      currentUser = null;
      updateAuthUI();
      showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
    }
  });
};

window.upgradeToPro = function() {
  if (!currentUser) {
    showToast('กรุณาสมัครสมาชิกหรือเข้าสู่ระบบก่อนอัปเกรดเป็นสมาชิก Pro', 'warning');
    openAuthModal('signup');
    return;
  }
  
  showConfirmModal({
    title: 'อัปเกรดเป็นสมาชิก PRO ฟรี',
    message: 'ยินดีต้อนรับสู่ช่วงเปิดตัว! ปลดล็อกรายงานวิเคราะห์เชิงลึกและเครื่องมือติดตามหนี้อัตโนมัติฟรีทันที',
    confirmText: 'รับสิทธิ์ PRO ฟรี',
    cancelText: 'ไว้คราวหน้า',
    icon: 'crown',
    onConfirm: () => {
      currentUser.tier = 'pro';
      localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
      updateAuthUI();
      triggerCelebration();
      showToast('ยินดีด้วยครับ! บัญชีของคุณได้รับการอัปเกรดเป็น PRO เรียบร้อยแล้ว', 'success', '🎉 อัปเกรดสำเร็จ');
    }
  });
};

// ==========================================
// 8. DEBT STAGE DIAGNOSTICS & PATHWAYS MATRIX
// ==========================================
const STAGE_DATA = {
  stage1: {
    title: 'ขั้นที่ 1: หนี้ปกติ / เริ่มตึงตัวเล็กน้อย (Normal)',
    code: 'เครดิตบูโร สถานะ 10 (ปกติ 100%)',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: 'shield-check',
    creditDesc: '🟢 เครดิตยังสะอาด 100% กู้หรือรีไฟแนนซ์กับธนาคารอื่นได้เต็มที่',
    summary: 'คุณยังมีประวัติการชำระที่ดีเยี่ยม นี่คือช่วงเวลาทองในการแก้ปัญหาโดย "ไม่เสียเครดิต" รีบลงมือก่อนที่จะเริ่มค้างชำระ',
    options: [
      {
        title: 'การรวมหนี้ (Debt Consolidation)',
        creditImpact: '🟢 ไม่เสียเครดิตบูโร (ยังเป็นสถานะปกติ)',
        detail: 'รวบรวมหนี้บัตรเครดิตและสินเชื่อดอกเบี้ยสูง 16-25% ไปรวมกับสินเชื่อบ้านหรือขอกู้สินเชื่อรวมหนี้ก้อนเดียว ดอกเบี้ยจะลดลงเหลือ 6-8% ต่อปี ช่วยลดค่างวดต่อเดือนได้ทันที 40-60%',
        howTo: 'ติดต่อธนาคารที่มีสินเชื่อบ้านเดิมอยู่ หรือธนาคารที่เปิดโครงการรวมหนี้ แจ้งขอทำ "สินเชื่อรวมหนี้"'
      },
      {
        title: 'รีไฟแนนซ์ (Refinance) สินเชื่อหรือบัตร',
        creditImpact: '🟢 ไม่เสียเครดิตบูโร',
        detail: 'ย้ายหนี้ไปธนาคารใหม่ที่ให้โปรโมชั่นดอกเบี้ยต่ำ เช่น สินเชื่อโอนหนี้ดอกเบี้ยพิเศษ 9.99% หรือ 12% ต่อปีใน 1-2 ปีแรก',
        howTo: 'เปรียบเทียบข้อเสนอสินเชื่อบุคคลที่มีโปรโมชั่นย้ายหนี้'
      },
      {
        title: 'ใช้สูตร Snowball หรือ Avalanche โปะเงินต้น',
        creditImpact: '🟢 ไม่เสียเครดิตบูโร',
        detail: 'ปรับพฤติกรรมทางการเงิน ตัดค่าใช้จ่ายที่ไม่จำเป็น 10-20% แล้วนำเงินก้อนนี้มาทุ่มโปะหนี้ก้อนเล็กสุด (Snowball) เพื่อลดจำนวนสัญญาให้เหลือน้อยลง',
        howTo: 'ใช้เครื่องมือคำนวณด้านล่างเพื่อวางแผนลำดับการโปะ'
      }
    ]
  },
  stage2: {
    title: 'ขั้นที่ 2: เริ่มค้างชำระ 1 - 30 วัน (Special Mention: SM)',
    code: 'เครดิตบูโร ยังไม่เป็น NPL (มีบันทึกเตือนล่าช้า)',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: 'alert-triangle',
    creditDesc: '🟡 เครดิตเริ่มมีรอยสะดุดเล็กน้อย แต่ยังไม่ถูกตัดเป็นหนี้เสีย ควรรีบติดต่อธนาคารทันที',
    summary: 'เริ่มมีสัญญาณเตือนภัยชัดเจน หากปล่อยให้เกิน 90 วัน จะกลายเป็นหนี้เสีย NPL ทันที ต้องรีบเจรจาเชิงรุก',
    options: [
      {
        title: 'ขอปรับโครงสร้างหนี้เชิงป้องกัน (Pre-emptive TDR)',
        creditImpact: '🟡 มีบันทึกประวัติปรับโครงสร้าง แต่ไม่ถูกจัดเป็น NPL',
        detail: 'ติดต่อธนาคารเจ้าหนี้ขอยืดระยะเวลาผ่อน (เช่น จาก 2 ปี เป็น 5 ปี) หรือขอเปลี่ยนยอดบัตรหมุนเวียนให้เป็นเงินกู้ผ่อนชำระแบบงวด (Term Loan) อัตราดอกเบี้ยจะลดลงและค่างวดลดลงเกินครึ่ง',
        howTo: 'โทรหา Call Center ธนาคาร แจ้งว่า "ต้องการเข้าร่วมมาตรการช่วยเหลือลูกหนี้ขอยืดระยะเวลาผ่อนชำระ"'
      },
      {
        title: 'ขอพักชำระเงินต้นชั่วคราว (Grace Period)',
        creditImpact: '🟡 อยู่ในมาตรการช่วยเหลือของธนาคาร',
        detail: 'ขอจ่ายเฉพาะดอกเบี้ยเป็นเวลา 3 - 6 เดือน เพื่อให้คุณมีเวลาตั้งหลัก หางานเสริม หรือรวบรวมเงินก้อน',
        howTo: 'เตรียมหลักฐานความจำเป็น เช่น สลิปเงินเดือนที่ลดลง หรือค่าใช้จ่ายฉุกเฉินไปแสดงกับธนาคาร'
      }
    ]
  },
  stage3: {
    title: 'ขั้นที่ 3: ค้างชำระ 31 - 90 วัน (Substandard)',
    code: 'เครดิตบูโร ค้างชำระเกิน 1-2 เดือน (ใกล้หลุด NPL)',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: 'alert-octagon',
    creditDesc: '🟠 ประวัติการชำระเริ่มติดขัด ธนาคารจะเริ่มโทรทวงถามอย่างจริงจัง',
    summary: 'อยู่ในจุดเปลี่ยนสำคัญ คุณยังมีโอกาสสุดท้ายในการเจรจาปรับปรุงโครงสร้างหนี้กับธนาคารก่อนจะถูกส่งเป็น NPL และถูกคิดเบี้ยปรับอัตราสูงสุด',
    options: [
      {
        title: 'ยื่นคำขอที่ "ทางด่วนแก้หนี้" ธนาคารแห่งประเทศไทย (โทร 1213)',
        creditImpact: '🟡 เจรจาหาข้อยุติก่อนถูกฟ้อง',
        detail: 'หากติดต่อธนาคารสาขาแล้วไม่ได้เงื่อนไขที่ผ่อนไหว ทางด่วนแก้หนี้ของแบงก์ชาติจะช่วยประสานส่งเรื่องตรงถึงฝ่ายนโยบายของธนาคาร เพื่ออนุมัติเงื่อนไขผ่อนปรนพิเศษ',
        howTo: 'กรอกคำขอออนไลน์ที่ bot.or.th หรือโทร 1213 แจ้งเลขที่บัญชีและยอดหนี้'
      },
      {
        title: 'คัดแยกทรัพย์สินและตัดใจปิดหนี้ดอกเบี้ยสูงสุด',
        creditImpact: '🟢 ช่วยหยุดความเสียหายของเครดิตในอนาคต',
        detail: 'สำรวจทรัพย์สินที่พอจะเปลี่ยนเป็นเงินสดได้ (ทองคำ, รถ, ของสะสม) นำมาตัดปิดยอดหนี้บัตรกดเงินสดที่คิดดอกเบี้ย 25% ทิ้งทันที',
        howTo: 'เลือกปิดหนี้ที่มีดอกเบี้ยและเบี้ยปรับแพงที่สุดก่อน'
      }
    ]
  },
  stage4: {
    title: 'ขั้นที่ 4: เป็นหนี้เสียแล้ว (NPL - ค้างชำระเกิน 90 วัน)',
    code: 'เครดิตบูโร สถานะ 20 หรือ 21 (หนี้เสียค้างชำระ)',
    badge: 'bg-red-100 text-red-800 border-red-300',
    icon: 'flame',
    creditDesc: '🔴 เครดิตเสียไปแล้ว 100% แต่เป็น "สิทธิ์ทอง" ในการเข้าโครงการแก้หนี้พิเศษที่ดอกเบี้ยถูกที่สุด!',
    summary: 'จำไว้ให้ขึ้นใจ: "เมื่อเครดิตเสียไปแล้ว คุณไม่ต้องกลัวเสียเครดิตซ้ำ!" สิทธิประโยชน์ของคนที่เป็น NPL คือการได้รับส่วนลดหนี้และอัตราดอกเบี้ยที่ถูกที่สุดอย่างไม่น่าเชื่อ',
    options: [
      {
        title: 'เข้าร่วมโครงการ "คลินิกแก้หนี้ by SAM" (โทร 1443)',
        creditImpact: '🔴 สถานะบูโรเป็น NPL อยู่แล้ว แต่เมื่อผ่อนจบจะเปลี่ยนเป็นปิดบัญชี',
        detail: 'โครงการของแบงก์ชาติสำหรับหนี้เสียบัตรเครดิต บัตรกดเงินสด สินเชื่อส่วนบุคคลที่ไม่มีหลักประกัน จะรวมหนี้ทุกธนาคารมาไว้ที่เดียว และลดดอกเบี้ยเหลือเพียง 3 - 5% ต่อปีเท่านั้น! ผ่อนยาวได้ถึง 10 ปี ค่างวดจะเหลือเพียงหลักร้อยถึงพันบาทต้นๆ',
        howTo: 'สมัครผ่านเว็บไซต์ debtclinicbysam.com หรือโทร 1443 (ต้องเป็นหนี้เสียเกิน 90 วัน)'
      },
      {
        title: 'เจรจาขอปิดยอดงวดเดียว (Hair-cut Discount 30-70%)',
        creditImpact: '🔴 บูโรเปลี่ยนเป็นสถานะ 11 (ปิดบัญชีแล้ว)',
        detail: 'เมื่อหนี้ค้างนาน ธนาคารหรือบริษัทบริหารสินทรัพย์มักต้องการปิดบัญชี หากคุณสามารถรวบรวมเงินก้อนได้ส่วนหนึ่ง สามารถเจรจาขอลดเงินต้นและตัดดอกเบี้ยทิ้งได้ถึง 30-70%',
        howTo: 'ใช้บทพูดสคริปต์ Hair-cut ในเว็บนี้ และ "ต้องได้รับหนังสือยืนยันยอดปิดบัญชีก่อนโอนเงินทุกครั้ง"'
      }
    ]
  },
  stage5: {
    title: 'ขั้นที่ 5: มีหมายศาล / มีคำพิพากษาบังคับคดี',
    code: 'กระบวนการยุติธรรม / บังคับคดี',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
    icon: 'scale',
    creditDesc: '⚖️ อยู่ในชั้นศาล กฎหมายคุ้มครองการดำรงชีพอย่างเต็มที่',
    summary: 'อย่าหนีศาลเด็ดขาด! การไปศาลไม่ใช่เรื่องน่ากลัว ศาลยุติธรรมมีศูนย์ไกล่เกลี่ยที่ทำหน้าที่ช่วยลูกหนี้ตัดดอกเบี้ยและเบี้ยปรับที่ไม่เป็นธรรมออกไป',
    options: [
      {
        title: 'ไปศาลเพื่อเข้าสู่ "ศูนย์ไกล่เกลี่ยข้อพิพาท"',
        creditImpact: '⚖️ ทำสัญญาประนีประนอมยอมความตามคำพิพากษา',
        detail: 'ในวันนัดศาล แจ้งเจ้าหน้าที่ว่าขอเข้าห้องไกล่เกลี่ย ผู้ประนีประนอมจะช่วยคุยให้ธนาคารลดดอกเบี้ยและกำหนดค่างวดใหม่ตามกำลังที่คุณจ่ายไหวจริง (มักผ่อนได้ 3-5 ปีแบบไม่มีดอกเบี้ยเพิ่ม)',
        howTo: 'ไปตามวันและเวลาในหมายศาล พร้อมหลักฐานรายรับรายจ่าย ไม่ต้องจ้างทนายความก็ไกล่เกลี่ยได้ฟรี'
      },
      {
        title: 'ใช้สิทธิความคุ้มครอง "กฎหมายห้ามอายัดเงินเดือนเกินเกณฑ์"',
        creditImpact: '🛡️ กฎหมายคุ้มครองการดำรงชีพ',
        detail: 'ตามประมวลกฎหมายวิธีพิจารณาความแพ่ง มาตรา 302 หากเงินเดือนของคุณไม่เกิน 20,000 บาท เจ้าหนี้ไม่สามารถอายัดเงินเดือนได้เลยแม้แต่บาทเดียว! หากเงินเดือนเกิน 20,000 บาท จะอายัดได้เฉพาะส่วนที่เกิน และต้องมีเงินเหลือให้คุณกินใช้อย่างน้อย 20,000 บาทเสมอ',
        howTo: 'หากถูกสั่งอายัดผิดพลาด ให้ยื่นคำร้องต่อเจ้าพนักงานบังคับคดีเพื่อขอลดหย่อน'
      }
    ]
  }
};

function initStageDiagnostic() {
  const form = document.getElementById('stage-diagnostic-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    evaluateDebtStage();
  });
}

function evaluateDebtStage() {
  const overdueVal = document.getElementById('diag-overdue').value;
  const cashFlowVal = document.getElementById('diag-cashflow').value;
  const assetVal = document.getElementById('diag-asset').value;

  let calculatedStage = 'stage1';

  if (overdueVal === 'court') {
    calculatedStage = 'stage5';
  } else if (overdueVal === 'npl') {
    calculatedStage = 'stage4';
  } else if (overdueVal === 'late_31_90' || (overdueVal === 'late_1_30' && cashFlowVal === 'stopped')) {
    calculatedStage = 'stage3';
  } else if (overdueVal === 'late_1_30' || cashFlowVal === 'tight') {
    calculatedStage = 'stage2';
  } else {
    calculatedStage = 'stage1';
  }

  renderStageResult(STAGE_DATA[calculatedStage]);
}

function renderStageResult(data) {
  const resultCard = document.getElementById('stage-result-card');
  if (!resultCard) return;

  resultCard.classList.remove('hidden');

  const titleEl = document.getElementById('stage-result-title');
  const badgeEl = document.getElementById('stage-result-badge');
  const creditEl = document.getElementById('stage-result-credit');
  const summaryEl = document.getElementById('stage-result-summary');
  const optionsContainer = document.getElementById('stage-options-container');

  if (titleEl) titleEl.textContent = data.title;
  if (badgeEl) {
    badgeEl.className = `inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${data.badge}`;
    badgeEl.textContent = data.code;
  }
  if (creditEl) creditEl.innerHTML = data.creditDesc;
  if (summaryEl) summaryEl.textContent = data.summary;

  if (optionsContainer) {
    let html = '';
    data.options.forEach((opt, idx) => {
      html += `
        <div class="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <h5 class="font-bold text-slate-900 text-base flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
              <span>${escapeHtml(opt.title)}</span>
            </h5>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 w-fit">
              ${escapeHtml(opt.creditImpact)}
            </span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed mb-3">
            ${escapeHtml(opt.detail)}
          </p>
          <div class="p-3 bg-blue-50/70 rounded-xl text-xs text-blue-900 font-medium">
            <strong>วิธีดำเนินการ:</strong> ${escapeHtml(opt.howTo)}
          </div>
        </div>
      `;
    });
    optionsContainer.innerHTML = html;
  }

  // Smooth scroll to result
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  lucide.createIcons();
}

// Update DOMContentLoaded to register new subsystems
document.addEventListener('DOMContentLoaded', () => {
  initAuthSystem();
  initStageDiagnostic();
});
