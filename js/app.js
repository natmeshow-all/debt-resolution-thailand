/**
 * Debt Resolution Thailand - Core Application Logic
 * เครื่องมือวางแผนและจัดการหนี้สินอย่างเป็นระบบ
 */

// --- Default Sample Debts ---
const SAMPLE_DEBTS = [
  { id: '1', name: 'บัตรเครดิต A (ช้อปปิ้ง)', balance: 45000, rate: 16, minPay: 2500 },
  { id: '2', name: 'บัตรกดเงินสด B (หมุนเงิน)', balance: 68000, rate: 25, minPay: 3500 },
  { id: '3', name: 'สินเชื่อส่วนบุคคล C', balance: 120000, rate: 18, minPay: 4800 }
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
function loadDebtsFromStorage() {
  const saved = localStorage.getItem('user_debts_v1');
  if (saved) {
    try {
      debts = JSON.parse(saved);
    } catch (e) {
      debts = [...SAMPLE_DEBTS];
    }
  } else {
    debts = [...SAMPLE_DEBTS];
  }
}

function saveDebtsToStorage() {
  localStorage.setItem('user_debts_v1', JSON.stringify(debts));
}

function initDebtPlanner() {
  renderDebtList();
  calculateRepaymentPlan();

  // Add Debt Form
  const addForm = document.getElementById('add-debt-form');
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-debt-name').value.trim();
      const balance = parseFloat(document.getElementById('new-debt-balance').value) || 0;
      const rate = parseFloat(document.getElementById('new-debt-rate').value) || 0;
      const minPay = parseFloat(document.getElementById('new-debt-minpay').value) || 0;

      if (!name || balance <= 0 || minPay <= 0) {
        alert('กรุณากรอกข้อมูลหนี้ให้ครบถ้วนและถูกต้อง');
        return;
      }

      debts.push({
        id: Date.now().toString(),
        name,
        balance,
        rate,
        minPay
      });

      saveDebtsToStorage();
      renderDebtList();
      calculateRepaymentPlan();

      // Reset fields
      document.getElementById('new-debt-name').value = '';
      document.getElementById('new-debt-balance').value = '';
      document.getElementById('new-debt-rate').value = '';
      document.getElementById('new-debt-minpay').value = '';
      
      // Close modal/form collapse if applicable
      const details = document.getElementById('add-debt-details');
      if (details) details.open = false;
    });
  }

  // Load sample debts button
  const loadSampleBtn = document.getElementById('load-sample-debts-btn');
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      debts = JSON.parse(JSON.stringify(SAMPLE_DEBTS));
      saveDebtsToStorage();
      renderDebtList();
      calculateRepaymentPlan();
    });
  }

  // Clear debts button
  const clearDebtsBtn = document.getElementById('clear-debts-btn');
  if (clearDebtsBtn) {
    clearDebtsBtn.addEventListener('click', () => {
      if (confirm('คุณต้องการล้างรายการหนี้ทั้งหมดใช่หรือไม่?')) {
        debts = [];
        saveDebtsToStorage();
        renderDebtList();
        calculateRepaymentPlan();
      }
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

  if (!container) return;

  if (debts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 text-slate-300"></i>
        <p class="font-medium text-slate-600">ยังไม่มีรายการหนี้ในระบบ</p>
        <p class="text-xs text-slate-400 mt-1">กดปุ่ม "เพิ่มหนี้" ด้านบน หรือกด "โหลดข้อมูลตัวอย่าง" เพื่อเริ่มต้นวางแผน</p>
      </div>
    `;
    if (totalCountEl) totalCountEl.textContent = '0 รายการ';
    if (totalBalanceEl) totalBalanceEl.textContent = '0 บาท';
    if (totalMinPayEl) totalMinPayEl.textContent = '0 บาท/เดือน';
    lucide.createIcons();
    return;
  }

  let totalBal = 0;
  let totalMin = 0;

  let html = '';
  debts.forEach((debt, index) => {
    totalBal += debt.balance;
    totalMin += debt.minPay;

    html += `
      <div class="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all group">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            ${index + 1}
          </div>
          <div>
            <div class="font-semibold text-slate-800 text-sm md:text-base">${escapeHtml(debt.name)}</div>
            <div class="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              <span>ดอกเบี้ย: <strong class="text-slate-700">${debt.rate}%</strong> ต่อปี</span>
              <span>•</span>
              <span>ขั้นต่ำ: <strong class="text-slate-700">${debt.minPay.toLocaleString('th-TH')}</strong> บ./เดือน</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm md:text-base font-bold text-slate-900">${debt.balance.toLocaleString('th-TH')} บ.</div>
          </div>
          <button onclick="removeDebt('${debt.id}')" title="ลบรายการนี้" class="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (totalCountEl) totalCountEl.textContent = `${debts.length} รายการ`;
  if (totalBalanceEl) totalBalanceEl.textContent = `${totalBal.toLocaleString('th-TH')} บาท`;
  if (totalMinPayEl) totalMinPayEl.textContent = `${totalMin.toLocaleString('th-TH')} บาท/เดือน`;

  lucide.createIcons();
}

window.removeDebt = function(id) {
  debts = debts.filter(d => d.id !== id);
  saveDebtsToStorage();
  renderDebtList();
  calculateRepaymentPlan();
};

function calculateRepaymentPlan() {
  if (debts.length === 0) {
    updatePlanSummaryUI(0, 0, 0, 0, []);
    renderChart([], []);
    return;
  }

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
    savedInterestEl.textContent = interestSaved > 0 ? `ประหยัดได้ ${interestSaved.toLocaleString('th-TH')} บาท` : 'จ่ายตามยอดปกติ';
  }

  if (savedTimeEl) {
    const sYears = Math.floor(monthsSaved / 12);
    const sMonths = monthsSaved % 12;
    let sStr = '';
    if (sYears > 0) sStr += `${sYears} ปี `;
    if (sMonths > 0) sStr += `${sMonths} เดือน`;
    savedTimeEl.textContent = monthsSaved > 0 ? `เร็วขึ้น ${sStr}` : 'ไม่มีเวลาลดลง';
  }

  if (orderList) {
    if (priorityOrder.length === 0) {
      orderList.innerHTML = '<p class="text-sm text-slate-400">เพิ่มรายการหนี้เพื่อดูลำดับการปลดหนี้</p>';
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
      <span class="text-emerald-700 font-semibold">คัดลอกเรียบร้อย!</span>
    `;
    lucide.createIcons();
    setTimeout(() => {
      btnElement.innerHTML = originalText;
      lucide.createIcons();
    }, 2500);
  }).catch(err => {
    alert('ไม่สามารถคัดลอกข้อความได้อัตโนมัติ กรุณากดเลือกและคัดลอกเอง');
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
        alert('กรุณากรอกอีเมลและรหัสผ่าน');
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
      alert(`ยินดีต้อนรับคุณ ${currentUser.name} เข้าสู่ระบบเรียบร้อยแล้วครับ!`);
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
        alert('กรุณากรอกข้อมูลให้ครบถ้วน');
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
      alert(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${currentUser.name}`);
      triggerCelebration();
      lucide.createIcons();
    });
  }

  // Custom Google Account Form Handler
  const customGoogleForm = document.getElementById('custom-google-form');
  if (customGoogleForm) {
    customGoogleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('custom-google-email').value.trim();
      if (!email) return;
      const name = email.split('@')[0];
      selectGoogleAccount(name, email, name.charAt(0).toUpperCase());
    });
  }
}

// ==========================================
// 7.1 GOOGLE SIGN-IN HANDLERS
// ==========================================
window.handleGoogleSignIn = function() {
  closeAuthModal();
  const googleModal = document.getElementById('google-picker-modal');
  if (googleModal) {
    googleModal.classList.remove('hidden');
    lucide.createIcons();
  }
};

window.closeGoogleModal = function() {
  const googleModal = document.getElementById('google-picker-modal');
  if (googleModal) {
    googleModal.classList.add('hidden');
  }
};

window.selectGoogleAccount = function(name, email, initial) {
  const activeTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  
  currentUser = {
    name: name,
    email: email,
    avatar: initial || name.charAt(0).toUpperCase(),
    provider: 'google',
    tier: 'free',
    theme: activeTheme,
    joinedAt: new Date().toLocaleDateString('th-TH')
  };

  localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
  updateAuthUI();
  closeGoogleModal();
  triggerCelebration();
  alert(`✨ เข้าสู่ระบบด้วย Google สำเร็จใน 1 คลิก!\nยินดีต้อนรับคุณ ${name} (${email})`);
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
    authBtnGroup.classList.add('hidden');
    if (mobileQuickAuth) mobileQuickAuth.classList.add('hidden');
    userProfileBadge.classList.remove('hidden');
    userProfileBadge.classList.add('flex');
    if (userNameEl) userNameEl.textContent = currentUser.name;
    
    // Avatar display
    if (userAvatarEl) {
      if (currentUser.provider === 'google') {
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
      drawerAuthBox.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full ${currentUser.provider === 'google' ? 'bg-gradient-to-tr from-blue-600 to-indigo-600' : 'bg-blue-600'} text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
            ${escapeHtml(currentUser.avatar || currentUser.name.charAt(0).toUpperCase())}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-slate-900 dark:text-white text-sm truncate">${escapeHtml(currentUser.name)}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${escapeHtml(currentUser.email || 'สมาชิกในระบบ')}</div>
            <div class="mt-1">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${currentUser.tier === 'pro' ? 'badge-pro text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'}">
                ${currentUser.tier === 'pro' ? 'PRO MEMBER' : (currentUser.provider === 'google' ? 'GOOGLE FREE' : 'FREE TIER')}
              </span>
            </div>
          </div>
        </div>
        <button onclick="logoutUser(); closeMobileMenu();" class="mt-3 w-full py-2 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl border border-rose-200 dark:border-rose-900/40 flex items-center justify-center gap-2 transition-colors">
          <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
          <span>ออกจากระบบ</span>
        </button>
      `;
    }

    lucide.createIcons();
  } else {
    authBtnGroup.classList.remove('hidden');
    if (mobileQuickAuth) mobileQuickAuth.classList.remove('hidden');
    userProfileBadge.classList.add('hidden');
    userProfileBadge.classList.remove('flex');

    // Drawer Auth Box - Logged Out View
    if (drawerAuthBox) {
      drawerAuthBox.innerHTML = `
        <div class="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2.5 flex items-center justify-between">
          <span>บัญชีสมาชิก</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">100% ฟรี</span>
        </div>
        <button onclick="handleGoogleSignIn(); closeMobileMenu();" class="w-full py-2 px-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-100 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm transition-all flex items-center justify-center gap-2 mb-2">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openAuthModal('signin'); closeMobileMenu();" class="py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
            เข้าสู่ระบบ
          </button>
          <button onclick="openAuthModal('signup'); closeMobileMenu();" class="py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl shadow-sm text-center">
            สมัครสมาชิก
          </button>
        </div>
      `;
    }
  }
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

  if (tab === 'signin') {
    signinTab.classList.add('border-blue-600', 'text-blue-600');
    signinTab.classList.remove('border-transparent', 'text-slate-500');
    signupTab.classList.remove('border-blue-600', 'text-blue-600');
    signupTab.classList.add('border-transparent', 'text-slate-500');
    signinView.classList.remove('hidden');
    signupView.classList.add('hidden');
  } else {
    signupTab.classList.add('border-blue-600', 'text-blue-600');
    signupTab.classList.remove('border-transparent', 'text-slate-500');
    signinTab.classList.remove('border-blue-600', 'text-blue-600');
    signinTab.classList.add('border-transparent', 'text-slate-500');
    signupView.classList.remove('hidden');
    signinView.classList.add('hidden');
  }
};

window.logoutUser = function() {
  if (confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
    localStorage.removeItem('debt_user_session');
    currentUser = null;
    updateAuthUI();
    alert('ออกจากระบบเรียบร้อยแล้ว');
  }
};

window.upgradeToPro = function() {
  if (!currentUser) {
    alert('กรุณาสมัครสมาชิกหรือเข้าสู่ระบบก่อนอัปเกรดเป็นสมาชิก Pro');
    openAuthModal('signup');
    return;
  }
  
  if (confirm('🎉 ยืนยันการสมัครสมาชิก Pro (ทดลองฟรีสำหรับช่วงเปิดตัว) เพื่อปลดล็อกรายงานวิเคราะห์เชิงลึกและเครื่องมือติดตามหนี้อัตโนมัติ?')) {
    currentUser.tier = 'pro';
    localStorage.setItem('debt_user_session', JSON.stringify(currentUser));
    updateAuthUI();
    triggerCelebration();
    alert('ยินดีด้วยครับ! บัญชีของคุณได้รับการอัปเกรดเป็น PRO เรียบร้อยแล้ว');
  }
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
