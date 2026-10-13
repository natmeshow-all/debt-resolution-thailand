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

  debtChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'จ่ายขั้นต่ำอย่างเดียว (ยอดหนี้ลดยาก ดอกเบี้ยสะสม)',
          data: baseData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderDash: [5, 5],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2
        },
        {
          label: `ใช้กลยุทธ์ ${currentStrategy === 'snowball' ? 'Snowball (บอลหิมะ)' : 'Avalanche (หิมะถล่ม)'} + เงินโปะพิเศษ`,
          data: stratData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
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
          ticks: { maxTicksLimit: 8, font: { family: "'Noto Sans Thai', sans-serif" } }
        },
        y: {
          ticks: {
            callback: function(value) {
              return value >= 1000 ? (value / 1000).toLocaleString() + 'k บ.' : value + ' บ.';
            },
            font: { family: "'Noto Sans Thai', sans-serif" }
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

// Helper: Escape HTML
function escapeHtml(string) {
  const div = document.createElement('div');
  div.textContent = string;
  return div.innerHTML;
}
