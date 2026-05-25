// HealthTrack — app.js

// ── State & localStorage ──────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('ht_state') || '{}');
    const dayData = saved[TODAY] || {};
    return {
      calories:   dayData.calories   || 0,
      water:      dayData.water       || 0,
      weights:    dayData.weights     || [],
      waterLogs:  dayData.waterLogs   || [],
      exLogs:     dayData.exLogs      || [],
      sleepLogs:  dayData.sleepLogs   || [],
      mood:       dayData.mood        || null,
      // goals persist across days
      calGoal:    saved.calGoal   || 1800,
      waterGoal:  saved.waterGoal || 2000,
      wtGoal:     saved.wtGoal    || 65,
      // all-time weight history for chart
      allWeights: saved.allWeights || [],
    };
  } catch { return defaultState(); }
}

function defaultState() {
  return { calories: 0, water: 0, weights: [], waterLogs: [], exLogs: [],
           sleepLogs: [], mood: null, calGoal: 1800, waterGoal: 2000, wtGoal: 65, allWeights: [] };
}

function saveState() {
  try {
    const existing = JSON.parse(localStorage.getItem('ht_state') || '{}');
    existing[TODAY] = {
      calories: S.calories, water: S.water, weights: S.weights,
      waterLogs: S.waterLogs, exLogs: S.exLogs, sleepLogs: S.sleepLogs, mood: S.mood,
    };
    existing.calGoal    = S.calGoal;
    existing.waterGoal  = S.waterGoal;
    existing.wtGoal     = S.wtGoal;
    existing.allWeights = S.allWeights;
    localStorage.setItem('ht_state', JSON.stringify(existing));
  } catch(e) { console.warn('Storage error', e); }
}

let S = loadState();
let pendingCal = 0;
let aiResult = null;
let weightChart = null;

// ── Navigation ────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  const idx = { dashboard: 0, meal: 1, log: 2, settings: 3 }[id];
  document.querySelectorAll('.nav-tab')[idx].classList.add('active');
  window.scrollTo(0, 0);
}

// ── API Key ───────────────────────────────────────────
function loadApiKey() {
  const key = localStorage.getItem('ht_apikey') || '';
  if (key) {
    document.getElementById('apiKeyInput').value = key;
    document.getElementById('apiKeyStatus').style.display = 'block';
  }
  return key;
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('sk-')) {
    alert('請輸入有效的 API Key（以 sk- 開頭）');
    return;
  }
  localStorage.setItem('ht_apikey', key);
  document.getElementById('apiKeyStatus').style.display = 'block';
  document.getElementById('apiKeyStatus').textContent = '✓ API Key 已儲存';
}

// ── Dashboard ─────────────────────────────────────────
function updateDash() {
  document.getElementById('stat-cal').textContent   = S.calories;
  document.getElementById('stat-water').textContent = S.water;

  const cp = Math.min(100, Math.round(S.calories / S.calGoal * 100));
  const wp = Math.min(100, Math.round(S.water    / S.waterGoal * 100));

  document.getElementById('prog-cal').style.width   = cp + '%';
  document.getElementById('prog-water').style.width = wp + '%';
  document.getElementById('prog-cal-val').textContent   = S.calories + ' / ' + S.calGoal   + ' kcal';
  document.getElementById('prog-water-val').textContent = S.water    + ' / ' + S.waterGoal + ' ml';

  const calDiff = S.calGoal - S.calories;
  const cs = document.getElementById('stat-cal-sub');
  cs.textContent  = calDiff > 0 ? '還可以吃 ' + calDiff + ' kcal' : '超標 ' + Math.abs(calDiff) + ' kcal';
  cs.className    = 'stat-sub ' + (calDiff >= 0 ? 'good' : 'bad');

  const wDiff = S.waterGoal - S.water;
  const ws = document.getElementById('stat-water-sub');
  ws.textContent = wDiff > 0 ? '還需 ' + wDiff + ' ml' : '已達目標！';
  ws.className   = 'stat-sub ' + (wDiff <= 0 ? 'good' : 'warn');

  document.getElementById('stat-weight-sub').textContent =
    S.allWeights.length ? '目標 ' + S.wtGoal + ' kg' : '目標 ' + S.wtGoal + ' kg';

  if (S.weights.length) {
    document.getElementById('stat-weight').textContent = S.weights[S.weights.length - 1].val;
  }
}

function updateGoals() {
  S.calGoal   = parseInt(document.getElementById('calGoal').value)   || 1800;
  S.waterGoal = parseInt(document.getElementById('waterGoal').value) || 2000;
  S.wtGoal    = parseFloat(document.getElementById('wtGoal').value)  || 65;
  saveState();
  updateDash();
}

// ── Quick water from dashboard ────────────────────────
function quickWater(ml) {
  S.water += ml;
  S.waterLogs.push({ t: now(), v: ml });
  saveState(); updateDash();
}

// ── Water log ─────────────────────────────────────────
function logWater() {
  const v = parseInt(document.getElementById('waterInput').value) || 0;
  if (!v) return;
  S.water += v;
  S.waterLogs.push({ t: now(), v });
  document.getElementById('waterInput').value = '250';
  saveState(); updateDash(); renderWaterLog();
}
function presetWater(ml) {
  S.water += ml;
  S.waterLogs.push({ t: now(), v: ml });
  saveState(); updateDash(); renderWaterLog();
}
function renderWaterLog() {
  document.getElementById('waterLog').innerHTML =
    S.waterLogs.slice(-5).reverse()
      .map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">+${e.v} ml</span></div>`)
      .join('');
}

// ── Weight log ────────────────────────────────────────
function logWeight() {
  const v = parseFloat(document.getElementById('weightInput').value);
  if (!v) return;
  const entry = { t: now(), val: v, date: TODAY };
  S.weights.push(entry);
  // keep all-time history (last 30 entries)
  S.allWeights.push(entry);
  if (S.allWeights.length > 30) S.allWeights = S.allWeights.slice(-30);
  document.getElementById('weightInput').value = '';
  document.getElementById('stat-weight').textContent = v;
  saveState(); updateDash(); renderWeightLog(); updateChart();
}
function renderWeightLog() {
  document.getElementById('weightLog').innerHTML =
    S.weights.slice(-5).reverse()
      .map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">${e.val} kg</span></div>`)
      .join('');
}

// ── Exercise log ──────────────────────────────────────
function logEx() {
  const v = document.getElementById('exInput').value.trim();
  if (!v) return;
  S.exLogs.push({ t: now(), v });
  document.getElementById('exInput').value = '';
  saveState();
  document.getElementById('exLog').innerHTML =
    S.exLogs.slice(-5).reverse()
      .map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">${e.v}</span></div>`)
      .join('');
}

// ── Sleep log ─────────────────────────────────────────
function logSleep() {
  const v = parseFloat(document.getElementById('sleepInput').value);
  if (!v) return;
  S.sleepLogs.push({ t: now(), v });
  document.getElementById('sleepInput').value = '';
  document.getElementById('stat-sleep').textContent = v;
  const sub = document.getElementById('stat-sleep-sub');
  sub.textContent = v >= 7 && v <= 9 ? '睡眠良好 ✓' : (v < 7 ? '睡眠不足' : '睡眠偏多');
  sub.className   = 'stat-sub ' + (v >= 7 && v <= 9 ? 'good' : 'warn');
  saveState();
  document.getElementById('sleepLog').innerHTML =
    S.sleepLogs.slice(-5).reverse()
      .map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">${e.v} hr</span></div>`)
      .join('');
}

// ── Mood ──────────────────────────────────────────────
function selMood(btn, emoji, label) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  S.mood = { emoji, label };
  document.getElementById('moodStatus').textContent = '今日心情：' + emoji + ' ' + label + ' 已記錄';
  saveState();
}

// ── Paste & Parse AI Response ────────────────────────
function copyPrompt() {
  const text = document.getElementById('promptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.innerHTML = '<i class="ti ti-check"></i> 已複製！';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = '<i class="ti ti-copy"></i> 複製提示語';
      btn.classList.remove('copied');
    }, 2000);
  });
}

function parseAIResponse() {
  const text = document.getElementById('aiPasteInput').value.trim();
  if (!text) { alert('請先貼上 Claude 的回覆！'); return; }

  const foods = [];
  let total = 0;

  // Parse lines like "- 雞腿飯：650 kcal" or "雞腿飯 650kcal" or "雞腿飯(650)"
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip total line — we'll sum ourselves
    if (/總計|total|合計/i.test(trimmed)) continue;

    // Match number in line
    const numMatch = trimmed.match(/(\d+)\s*(?:kcal|卡|大卡|cal)?/i);
    if (!numMatch) continue;

    const cal = parseInt(numMatch[1]);
    if (cal < 5 || cal > 3000) continue; // filter out noise

    // Extract food name: remove bullets, colons, numbers, units
    let name = trimmed
      .replace(/^[-•*]\s*/, '')
      .replace(/[：:]\s*\d+.*$/, '')
      .replace(/\d+\s*(?:kcal|卡|大卡|cal)?/gi, '')
      .replace(/[()（）\[\]]/g, '')
      .trim();

    if (!name) name = '食物';
    foods.push({ name, cal });
    total += cal;
  }

  // If nothing parsed, try to find any number as total
  if (!foods.length) {
    const nums = text.match(/\d+/g);
    if (nums) {
      total = parseInt(nums[nums.length - 1]);
      foods.push({ name: '餐點（自動偵測）', cal: total });
    }
  }

  if (!foods.length) { alert('無法解析內容，請確認格式或直接輸入數字。'); return; }

  // Render parsed result
  window._parsedFoods = foods;
  window._parsedTotal = total;

  document.getElementById('parsedList').innerHTML = foods.map((f, i) => `
    <div class="food-item">
      <span>${f.name}</span>
      <span class="food-kcal" id="pcal-${i}" onclick="editParsed(${i})" style="cursor:pointer;border-bottom:1px dashed #93C5FD" title="點擊修改">${f.cal} kcal</span>
    </div>`).join('');
  document.getElementById('parsedTotal').textContent = total + ' kcal';
  document.getElementById('parsedCard').classList.add('show');
  document.getElementById('parsedCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function editParsed(idx) {
  const el = document.getElementById('pcal-' + idx);
  const old = window._parsedFoods[idx].cal;
  el.outerHTML = `<span><input type="number" id="pedit-${idx}" value="${old}" style="width:60px;border:0.5px solid #93C5FD;border-radius:4px;padding:2px 6px;font-size:13px" inputmode="numeric"> kcal <button onclick="saveParsed(${idx})" style="background:#2563EB;color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px">存</button></span>`;
}

function saveParsed(idx) {
  const newCal = parseInt(document.getElementById('pedit-' + idx).value) || 0;
  window._parsedFoods[idx].cal = newCal;
  window._parsedTotal = window._parsedFoods.reduce((a, f) => a + f.cal, 0);
  document.getElementById('parsedTotal').textContent = window._parsedTotal + ' kcal';
  document.getElementById('parsedList').innerHTML = window._parsedFoods.map((f, i) => `
    <div class="food-item">
      <span>${f.name}</span>
      <span class="food-kcal" id="pcal-${i}" onclick="editParsed(${i})" style="cursor:pointer;border-bottom:1px dashed #93C5FD" title="點擊修改">${f.cal} kcal</span>
    </div>`).join('');
}

function addParsedMeal() {
  if (!window._parsedFoods || !window._parsedFoods.length) { alert('請先解析 AI 回覆！'); return; }
  const name = document.getElementById('mealNameInput').value.trim() || '餐點';
  const total = window._parsedTotal;
  S.calories += total;
  if (!S.mealLogs) S.mealLogs = [];
  S.mealLogs.push({ t: now(), name, cal: total, foods: window._parsedFoods });
  saveState(); updateDash(); renderMealLog();
  // Reset
  document.getElementById('aiPasteInput').value = '';
  document.getElementById('mealNameInput').value = '';
  document.getElementById('parsedCard').classList.remove('show');
  window._parsedFoods = null;
  // Feedback
  const btn = document.querySelector('#parsedCard .full-btn');
  showPage('dashboard');
}

function addManualMeal() {
  const cal = parseInt(document.getElementById('mealCalInput') && document.getElementById('mealCalInput').value);
  const name = document.getElementById('mealNameInput') && document.getElementById('mealNameInput').value.trim() || '餐點';
  if (!cal || cal <= 0) { alert('請先輸入卡路里數字！'); return; }
  S.calories += cal;
  if (!S.mealLogs) S.mealLogs = [];
  S.mealLogs.push({ t: now(), name, cal });
  saveState(); updateDash(); renderMealLog();
}

function renderMealLog() {
  const el = document.getElementById('mealLog');
  if (!S.mealLogs || !S.mealLogs.length) {
    el.innerHTML = '<p style="font-size:13px;color:#94A3B8;text-align:center;padding:8px">尚未記錄任何餐點</p>';
    return;
  }
  el.innerHTML = S.mealLogs.slice(-8).reverse().map(e => `
    <div class="log-ent"><span>${e.t} ${e.name}</span><span class="log-v">${e.cal} kcal</span></div>
    ${e.foods ? e.foods.map(f => `<div class="log-ent" style="padding-left:12px;opacity:0.6"><span>　${f.name}</span><span>${f.cal} kcal</span></div>`).join('') : ''}
  `).join('');
}

// ── Chart ─────────────────────────────────────────────
function updateChart() {
  const recent = S.allWeights.slice(-7);
  const labels = recent.map(w => w.date ? w.date.slice(5) : w.t);
  const data   = recent.map(w => w.val);

  if (!data.length) {
    const base = S.wtGoal + 3;
    const mockLabels = Array.from({length:7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return (d.getMonth()+1) + '/' + d.getDate();
    });
    const mockData = [base+0.5,base+0.3,base+0.1,base+0.4,base-0.1,base+0.1,base];
    drawChart(mockLabels, mockData);
    return;
  }
  drawChart(labels, data);
}

function drawChart(labels, data) {
  if (weightChart) { weightChart.data.labels = labels; weightChart.data.datasets[0].data = data; weightChart.update(); return; }
  weightChart = new Chart(document.getElementById('weightChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '體重',
        data,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37,99,235,0.07)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2563EB',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ── Data management ───────────────────────────────────
function clearToday() {
  if (!confirm('確定清除今日所有記錄？')) return;
  S.calories = 0; S.water = 0; S.weights = []; S.waterLogs = [];
  S.exLogs = []; S.sleepLogs = []; S.mood = null;
  saveState(); updateDash();
  renderWaterLog(); renderWeightLog();
  ['exLog','sleepLog'].forEach(id => document.getElementById(id).innerHTML = '');
  document.getElementById('moodStatus').textContent = '';
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('sel'));
}

function clearAll() {
  if (!confirm('確定清除所有資料？此操作無法復原！')) return;
  localStorage.removeItem('ht_state');
  localStorage.removeItem('ht_apikey');
  location.reload();
}

// ── Helpers ───────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

// ── Init ──────────────────────────────────────────────
function init() {
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  // Restore goals to settings inputs
  document.getElementById('calGoal').value   = S.calGoal;
  document.getElementById('waterGoal').value = S.waterGoal;
  document.getElementById('wtGoal').value    = S.wtGoal;

  // Restore today's logs
  renderWaterLog();
  renderWeightLog();
  renderMealLog();
  if (S.exLogs.length) {
    document.getElementById('exLog').innerHTML =
      S.exLogs.slice(-5).reverse().map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">${e.v}</span></div>`).join('');
  }
  if (S.sleepLogs.length) {
    document.getElementById('sleepLog').innerHTML =
      S.sleepLogs.slice(-5).reverse().map(e => `<div class="log-ent"><span>${e.t}</span><span class="log-v">${e.v} hr</span></div>`).join('');
    const last = S.sleepLogs[S.sleepLogs.length - 1].v;
    document.getElementById('stat-sleep').textContent = last;
    const sub = document.getElementById('stat-sleep-sub');
    sub.textContent = last >= 7 && last <= 9 ? '睡眠良好 ✓' : (last < 7 ? '睡眠不足' : '睡眠偏多');
    sub.className   = 'stat-sub ' + (last >= 7 && last <= 9 ? 'good' : 'warn');
  }
  if (S.mood) {
    document.getElementById('moodStatus').textContent = '今日心情：' + S.mood.emoji + ' ' + S.mood.label + ' 已記錄';
  }
  if (S.weights.length) {
    document.getElementById('stat-weight').textContent = S.weights[S.weights.length - 1].val;
  }

  updateDash();
  updateChart();
}

document.addEventListener('DOMContentLoaded', init);
