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

// ── AI Meal Analysis ──────────────────────────────────
function handleImage(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const img = document.getElementById('prevImg');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('aiCard').classList.remove('show');
    document.getElementById('lowConf').classList.remove('show');
    document.getElementById('aiLoad').style.display = 'block';
    // Compress image before sending
    const compressed = await compressImage(e.target.result);
    await analyzeImage(compressed);
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1024;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.src = dataUrl;
  });
}

async function analyzeImage(b64) {
  const apiKey = localStorage.getItem('ht_apikey') || '';
  if (!apiKey) {
    document.getElementById('aiLoad').style.display = 'none';
    alert('請先在「餐點」頁面上方設定 Anthropic API Key');
    return;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: `你是一位專業的台灣營養師，請仔細觀察這張食物照片。

分析步驟：
1. 先描述你看到的食物外觀特徵（顏色、形狀、烹調方式）
2. 根據外觀特徵辨識食物，不要猜測
3. 估算每種食物的份量與熱量（以台灣常見份量為準）

辨識規則：
- 看到白色/淡色片狀魚肉、魚刺、魚皮 → 辨識為魚（不要說成雞肉）
- 看到有骨頭豬肉 → 辨識為排骨
- 看到深色整塊醬汁肉 → 描述肉的形狀判斷種類
- confidence：1.0=非常確定，0.8=大致確定，0.6=不確定

只回傳 JSON，不加 markdown 或說明文字：
{"foods":[{"name":"食物名稱","calories":數字,"confidence":信心分數,"desc":"外觀一句描述"},...],"total":總熱量整數,"suggestion":"針對這餐的具體減重建議（繁體中文，20字內）","overall_confidence":整體信心分數}` }
          ]
        }]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const txt = data.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
    showResult(JSON.parse(txt));
  } catch (err) {
    console.error('AI error:', err);
    showFallback(err.message);
  }
}

function showResult(r) {
  document.getElementById('aiLoad').style.display = 'none';
  aiResult = r;
  pendingCal = r.total;
  if (r.overall_confidence < 0.75) document.getElementById('lowConf').classList.add('show');
  renderFoodList();
  document.getElementById('aiTotal').textContent = r.total + ' kcal';
  document.getElementById('aiNote').textContent  = '💡 ' + r.suggestion;
  document.getElementById('aiCard').classList.add('show');
}

function renderFoodList() {
  document.getElementById('foodList').innerHTML = aiResult.foods.map((f, i) => `
    <div class="food-item">
      <div class="food-name-wrap">
        <span class="food-name" onclick="editFood(${i})" title="點擊修改">${f.name}</span>
        ${f.confidence < 0.75 ? '<span class="food-conf-warn">⚠ 不確定</span>' : ''}
        <span class="food-desc">${f.desc || ''}</span>
      </div>
      <span class="food-kcal" id="fcal-${i}">${f.calories} kcal</span>
    </div>`).join('');
}

function editFood(idx) {
  const f = aiResult.foods[idx];
  const wrap = document.querySelectorAll('.food-item')[idx];
  wrap.querySelector('.food-name-wrap').innerHTML = `
    <input type="text"   id="en-${idx}" value="${f.name}"     style="border:0.5px solid #93C5FD;border-radius:4px;padding:3px 7px;font-size:13px;width:120px;margin-right:4px">
    <input type="number" id="ec-${idx}" value="${f.calories}" style="border:0.5px solid #93C5FD;border-radius:4px;padding:3px 7px;font-size:13px;width:66px" inputmode="numeric">
    <button onclick="saveFood(${idx})" style="background:var(--blue-600);color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;margin-left:4px">存</button>`;
}

function saveFood(idx) {
  const newName = document.getElementById('en-' + idx).value;
  const newCal  = parseInt(document.getElementById('ec-' + idx).value) || 0;
  aiResult.foods[idx].name     = newName;
  aiResult.foods[idx].calories = newCal;
  aiResult.total = aiResult.foods.reduce((a, f) => a + f.calories, 0);
  pendingCal = aiResult.total;
  document.getElementById('aiTotal').textContent = aiResult.total + ' kcal';
  renderFoodList();
}

function showFallback(msg) {
  document.getElementById('aiLoad').style.display = 'none';
  aiResult = {
    foods: [
      { name: '主菜（請修改）', calories: 350, confidence: 0.5, desc: '點擊上方食物名稱修改' },
      { name: '白飯',           calories: 280, confidence: 0.9, desc: '約一碗' },
      { name: '配菜（請修改）', calories: 120, confidence: 0.5, desc: '點擊上方食物名稱修改' }
    ],
    total: 750, suggestion: '請確認食物名稱後再記錄。', overall_confidence: 0.5
  };
  document.getElementById('lowConf').classList.add('show');
  document.getElementById('lowConf').innerHTML = `<i class="ti ti-alert-circle"></i> AI 分析失敗（${msg || '請確認 API Key'}），已顯示預設數值，請手動修改`;
  showResult(aiResult);
}

function addMealToLog() {
  if (pendingCal > 0) {
    S.calories += pendingCal;
    saveState(); updateDash();
    showPage('dashboard');
    pendingCal = 0;
  }
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

  loadApiKey();

  // Restore goals to settings inputs
  document.getElementById('calGoal').value   = S.calGoal;
  document.getElementById('waterGoal').value = S.waterGoal;
  document.getElementById('wtGoal').value    = S.wtGoal;

  // Restore today's logs
  renderWaterLog();
  renderWeightLog();
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
