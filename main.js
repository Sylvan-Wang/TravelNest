// ===== Supabase Auth (Email) =====
const SUPABASE_URL = "https://pvzvmgledurzuropbdnb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2enZtZ2xlZHVyenVyb3BiZG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTU4MTMsImV4cCI6MjA3OTY3MTgxM30.n7qENK8bGv0qY3LP1vrodjgyz1zyymP9bzpm52cUsv0";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const authOverlay = document.getElementById("auth-overlay");
const btnCloseAuth = document.getElementById("btn-close-auth");

const loginForm = document.getElementById("auth-login-form");
const loginEmail = document.getElementById("auth-login-email");
const loginPwd = document.getElementById("auth-login-password");
const loginErr = document.getElementById("auth-login-error");

const regForm = document.getElementById("auth-register-form");
const regEmail = document.getElementById("auth-reg-email");
const regPwd = document.getElementById("auth-reg-password");
const regPwd2 = document.getElementById("auth-reg-password2");
const regErr = document.getElementById("auth-register-error");

const btnGoogle = document.getElementById("btn-auth-google");

// sidebar user area
const userAvatar = document.getElementById("user-avatar");
const userNameLabel = document.getElementById("user-name-label");
const userMetaLabel = document.getElementById("user-meta-label");

// open / close overlay
function openAuthOverlay() {
  if (!authOverlay) return;
  authOverlay.classList.remove("hidden");
  if (loginErr) loginErr.textContent = "";
  if (regErr) regErr.textContent = "";
}

function closeAuthOverlay() {
  if (!authOverlay) return;
  authOverlay.classList.add("hidden");
}

btnCloseAuth?.addEventListener("click", closeAuthOverlay);

// click user area -> open auth
userAvatar?.addEventListener("click", openAuthOverlay);
userNameLabel?.addEventListener("click", openAuthOverlay);
userMetaLabel?.addEventListener("click", openAuthOverlay);

// tabs switch (login/register)
(function bindAuthTabs() {
  if (!authOverlay) return;
  const tabs = authOverlay.querySelectorAll(".auth-tabs .tab");
  const panels = authOverlay.querySelectorAll(".tab-panels .tab-panel");
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const target = tabBtn.getAttribute("data-tab"); // login / register

      tabs.forEach((t) => t.classList.remove("tab--active"));
      tabBtn.classList.add("tab--active");

      panels.forEach((p) => p.classList.remove("tab-panel--active"));
      const panel = authOverlay.querySelector(`#tab-${target}`);
      panel?.classList.add("tab-panel--active");

      if (loginErr) loginErr.textContent = "";
      if (regErr) regErr.textContent = "";
    });
  });
})();

// email login
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (loginErr) loginErr.textContent = "";

  const email = (loginEmail?.value || "").trim();
  const password = (loginPwd?.value || "").trim();

  if (!email || !password) {
    if (loginErr) loginErr.textContent = "请输入邮箱和密码";
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (loginErr) loginErr.textContent = error.message;
    return;
  }

  closeAuthOverlay();
});

// email register
regForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (regErr) regErr.textContent = "";

  const email = (regEmail?.value || "").trim();
  const password = (regPwd?.value || "").trim();
  const password2 = (regPwd2?.value || "").trim();

  if (!email || !password || !password2) {
    if (regErr) regErr.textContent = "请完整填写邮箱与密码";
    return;
  }
  if (password.length < 8) {
    if (regErr) regErr.textContent = "密码至少 8 位";
    return;
  }
  if (password !== password2) {
    if (regErr) regErr.textContent = "两次输入的密码不一致";
    return;
  }

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    if (regErr) regErr.textContent = error.message;
    return;
  }

  closeAuthOverlay();
});

// google oauth (optional)
btnGoogle?.addEventListener("click", async () => {
  const redirectTo = window.location.origin + window.location.pathname;

  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error && loginErr) loginErr.textContent = error.message;
});

// session -> update sidebar UI
function setUserUI(session) {
  if (!userNameLabel || !userMetaLabel || !userAvatar) return;

  if (session?.user) {
    const email = session.user.email || "已登录";
    userNameLabel.textContent = email;
    userMetaLabel.textContent = "已登录";
    userAvatar.textContent = (email[0] || "U").toUpperCase();
  } else {
    userNameLabel.textContent = "未登录";
    userMetaLabel.textContent = "点击右侧进入个人中心";
    userAvatar.textContent = "U";
  }
}

(async function bootAuth() {
  const { data } = await sb.auth.getSession();
  setUserUI(data?.session);

  sb.auth.onAuthStateChange((_event, session) => {
    setUserUI(session);
  });
})();


// ============== 常量 & 全局状态 ==============

const STORAGE_KEY = "TN_TRIPS_V2";
const USER_KEY = "TN_USER_V1";
const LOG_KEY = "TN_LOGS_V1";

let trips = [];
let currentTripId = null;

let userProfile = {
  name: "",
  loggedIn: false,
  currencySymbol: "¥",
  defaultOnboarding: null,
};

let logs = []; // { id, tripId, tripTitle, type, version, createdAt }

// Trip 结构：
// meta: { title, origin, companions, destinations[], days, timeTightness, budgetLevel, pace, currencySymbol, plan: { id, distribution } }
// segments: { transport, stays }
// attractions: [{ city, name, type, tags[], desc }]
// dayPlan: [{ dayIndex, city, items: [{ type, city, title, time, note, extra? }] }]
// version: number

// 冷启动流程临时状态
const flowState = {
  basic: { origin: "", companions: "" },
  trip: {
    destinations: [],
    randomDestinations: false,
    days: null,
    timeTightness: "",
    budgetLevel: "",
    pace: "",
    currencySymbol: "¥",
  },
  plan: {
    options: [],
    chosenIndex: null,
  },
  swipe: {
    cards: [],
    index: 0,
    kept: [],
  },
};

let currentStep = 1;
const TOTAL_STEPS = 4;

// ============== Storage 工具 ==============

function genId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 6)
  );
}

function loadTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    trips = raw ? JSON.parse(raw) : [];
  } catch {
    trips = [];
  }
}

function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

function loadUserProfile() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) userProfile = { ...userProfile, ...JSON.parse(raw) };
  } catch {}
}

function saveUserProfile() {
  localStorage.setItem(USER_KEY, JSON.stringify(userProfile));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    logs = raw ? JSON.parse(raw) : [];
  } catch {
    logs = [];
  }
}

function saveLogs() {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function findTrip(id) {
  return trips.find((t) => t.id === id) || null;
}

// ============== 主界面渲染 ==============


function renderTripList() {
  const listEl = document.getElementById("trip-list");
  const emptyHint = document.getElementById("trip-empty-hint");
  listEl.innerHTML = "";

  if (!trips.length) {
    emptyHint.style.display = "block";
    return;
  }
  emptyHint.style.display = "none";

  trips
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((trip) => {
      const li = document.createElement("li");
      li.className = "trip-item";
      if (trip.id === currentTripId) li.classList.add("trip-item--active");
      li.dataset.tripId = trip.id;

      const meta = trip.meta || {};
      const title =
        meta.title ||
        (meta.destinations && meta.destinations.join(" / ")) ||
        "未命名行程";
      const daysStr = meta.days ? `${meta.days} 天` : "天数未定";

      li.innerHTML = `
        <div class="trip-item-title">${title}</div>
        <div class="trip-item-meta">${daysStr} · ${formatBudgetMeta(meta)}</div>
      `;

      li.addEventListener("click", () => {
        currentTripId = trip.id;
        renderTripList();
        renderTripDetail(trip.id);
      });

      listEl.appendChild(li);
    });
}

function formatBudgetMeta(meta) {
  const level = meta.budgetLevel;
  const symbol = meta.currencySymbol || userProfile.currencySymbol || "¥";
  if (!level) return "预算未定";
  const count = level === "tight" ? 1 : level === "medium" ? 2 : 3;
  return symbol.repeat(count);
}

function renderTripDetail(tripId) {
  const detailEmpty = document.getElementById("detail-empty");
  const detail = document.getElementById("trip-detail");
  const trip = findTrip(tripId);

  if (!trip) {
    detailEmpty.style.display = "block";
    detail.classList.add("hidden");
    return;
  }

  detailEmpty.style.display = "none";
  detail.classList.remove("hidden");

  const meta = trip.meta || {};
  const titleEl = document.getElementById("trip-title");
  const metaTextEl = document.getElementById("trip-meta-text");

  const paceMap = { chill: "佛系慢游", balanced: "节奏适中", intense: "高效打卡" };
  const compMap = {
    solo: "一个人",
    friends: "朋友",
    family: "家人",
    partner: "伴侣",
  };

  const title =
    meta.title ||
    (meta.destinations && meta.destinations.length
      ? meta.destinations.join(" / ")
      : "未命名行程");

  titleEl.textContent = title;

  const budgetStr = formatBudgetMeta(meta);
  metaTextEl.textContent = `${meta.days ? meta.days + " 天 · " : ""}${budgetStr} · ${
    paceMap[meta.pace] || "节奏未定"
  } · ${compMap[meta.companions] || "同行人未定"}${
    trip.version ? ` · v${trip.version}` : ""
  }`;

  document.getElementById("ov-origin").textContent = meta.origin || "——";
  document.getElementById("ov-dests").textContent =
    meta.destinations && meta.destinations.length
      ? meta.destinations.join(" / ")
      : "——";
  document.getElementById("ov-days").textContent = meta.days
    ? `${meta.days} 天`
    : "——";
  document.getElementById("ov-budget").textContent =
    formatBudgetMeta(meta) || "——";
  document.getElementById("ov-pace").textContent =
    paceMap[meta.pace] || "——";
  document.getElementById("ov-companions").textContent =
    compMap[meta.companions] || "——";

  document.getElementById("ov-notes").value = trip.notes || "";
  document.getElementById("tp-text").value = trip.segments?.transport || "";
  document.getElementById("st-text").value = trip.segments?.stays || "";

  ensureDayPlan(trip);
  renderAttractions(trip);
  renderGeneratedDayPlan(trip);
  renderTypeSpecificDayPlans(trip);
  setupDetailAutoSave(trip);
}

// 景点列表（原始卡片结果）
function renderAttractions(trip) {
  const atListEl = document.getElementById("at-list");
  atListEl.innerHTML = "";
  const attractions = trip.attractions || [];

  if (!attractions.length) {
    const p = document.createElement("p");
    p.className = "hint-text";
    p.textContent =
      "当前行程还没有景点。可以通过上方按钮重新走一次卡片选择流程。";
    atListEl.appendChild(p);
    return;
  }

  attractions.forEach((a) => {
    const item = document.createElement("div");
    item.className = "at-item";

    const header = document.createElement("div");
    header.className = "at-item-header";
    header.innerHTML = `
      <div>
        <div class="at-item-name">${a.name}</div>
        <div class="at-item-city">${a.city} · ${a.type || ""}</div>
      </div>
      <div class="at-item-tags">${(a.tags || []).join(" · ")}</div>
    `;

    const textarea = document.createElement("textarea");
    textarea.className = "textarea";
    textarea.rows = 3;
    textarea.value = a.desc || "";
    textarea.addEventListener("input", () => {
      a.desc = textarea.value;
      saveTrips();
    });

    item.appendChild(header);
    item.appendChild(textarea);
    atListEl.appendChild(item);
  });
}

// ============== DayPlan 生成 & 渲染 ==============

function ensureDayPlan(trip) {
  const meta = trip.meta || {};
  const days = meta.days || 0;
  if (!days) return;
  if (!trip.dayPlan || trip.dayPlan.length !== days) {
    trip.dayPlan = buildDayPlanFromTrip(trip);
    saveTrips();
  }
}

function buildFallbackDistribution(days, dests) {
  const cities = dests && dests.length ? dests : ["示例城市"];
  const n = cities.length;
  const result = cities.map((c) => ({ city: c, days: 0 }));
  let base = Math.floor(days / n);
  let leftover = days % n;
  for (let i = 0; i < n; i++) {
    result[i].days = base + (leftover > 0 ? 1 : 0);
    leftover--;
    if (leftover < 0) leftover = 0;
  }
  return result;
}

function buildDayPlanFromTrip(trip) {
  const meta = trip.meta || {};
  const days = meta.days || 3;
  const attractions = trip.attractions || [];
  const distribution =
    meta.plan?.distribution ||
    buildFallbackDistribution(days, meta.destinations || []);

  const dayCities = [];
  distribution.forEach((d) => {
    for (let i = 0; i < d.days; i++) {
      if (dayCities.length < days) dayCities.push(d.city);
    }
  });
  while (dayCities.length < days) {
    dayCities.push(
      dayCities[dayCities.length - 1] ||
        (meta.destinations && meta.destinations[0]) ||
        "未定城市"
    );
  }

  const poiByCity = {};
  attractions.forEach((p) => {
    if (!poiByCity[p.city]) poiByCity[p.city] = [];
    poiByCity[p.city].push(p);
  });

  const dayPlan = [];
  for (let i = 0; i < days; i++) {
    const city = dayCities[i];
    const items = [];

    if (i > 0 && dayCities[i - 1] !== city) {
      items.push({
        type: "transit",
        city: `${dayCities[i - 1]} → ${city}`,
        title: "跨城移动（预留半天交通）",
        time: "09:00",
        note: "建议预留半天时间用于城市间交通（火车 / 飞机 / 大巴等）。",
      });
    }

    const cityPois = poiByCity[city] || [];
    const takePoi = (defaultTitle, defaultNote) => {
      if (cityPois.length) {
        const p = cityPois.shift();
        return {
          type: "poi",
          city,
          title: p.name,
          time: "",
          note: p.desc || defaultNote || "",
          extra: { poiType: p.type, tags: p.tags || [] },
        };
      }
      return {
        type: "poi",
        city,
        title: defaultTitle,
        time: "",
        note: defaultNote || "",
      };
    };

    items.push(
      takePoi("白天景点待定", "可由 AI 或你后续补充具体景点。")
    );

    items.push({
      type: "meal",
      city,
      title: "用餐安排（午 / 晚）",
      time: "",
      note: "餐厅待定，可结合预算与口味由 AI 或你补充。",
    });

    if (cityPois.length) {
      items.push(
        takePoi("下午景点待定", "可由 AI 或你后续调整。")
      );
    } else {
      items.push({
        type: "break",
        city,
        title: "自由活动 / 休息",
        time: "",
        note: "可在当地随意逛逛，或留白休息。",
      });
    }

    items.push({
      type: "stay",
      city,
      title: `住宿 · ${city}`,
      time: "",
      note: "酒店待定，可在住宿 tab 里补充具体酒店信息。",
    });

    dayPlan.push({ dayIndex: i + 1, city, items });
  }

  return dayPlan;
}

function renderGeneratedDayPlan(trip) {
  const container = document.getElementById("ov-days-generated");
  container.innerHTML = "";

  const days = trip.meta?.days || 0;
  const dayPlan = trip.dayPlan || [];

  if (!days) {
    const p = document.createElement("p");
    p.className = "hint-text";
    p.textContent = "还没有设置天数，因此暂时无法生成 Day by Day 行程。";
    container.appendChild(p);
    return;
  }

  if (!dayPlan.length) {
    const p = document.createElement("p");
    p.className = "hint-text";
    p.textContent = "行程还没有生成 Day by Day 结构。可以重新走一遍卡片流程。";
    container.appendChild(p);
    return;
  }

  renderDayPlan(container, dayPlan, "all");
}

function renderTypeSpecificDayPlans(trip) {
  const dayPlan = trip.dayPlan || [];

  const tpContainer = document.getElementById("tp-dayplan");
  tpContainer.innerHTML = "";
  renderDayPlan(tpContainer, dayPlan, "transit");

  const stContainer = document.getElementById("st-dayplan");
  stContainer.innerHTML = "";
  renderDayPlan(stContainer, dayPlan, "stay");

  const atContainer = document.getElementById("at-dayplan");
  atContainer.innerHTML = "";
  renderDayPlan(atContainer, dayPlan, "poi");
}

function renderDayPlan(container, dayPlan, filterType) {
  if (!dayPlan || !dayPlan.length) return;

  dayPlan.forEach((d, dayIdx) => {
    const block = document.createElement("div");
    block.className = "day-block";

    let title = `Day ${d.dayIndex || dayIdx + 1}`;
    if (d.city) title += " · " + d.city;

    const h3 = document.createElement("h3");
    h3.textContent = title;
    block.appendChild(h3);

    const items = d.items || [];
    let visibleCount = 0;

    items.forEach((item) => {
      if (filterType !== "all" && item.type !== filterType) return;
      visibleCount++;

      const row = document.createElement("div");
      row.className = "day-item-row";

      const timeWrap = document.createElement("div");
      timeWrap.className = "day-item-time";
      const timeInput = document.createElement("input");
      timeInput.type = "text";
      timeInput.placeholder = "HH:MM";
      timeInput.value = item.time || "";
      timeInput.addEventListener("input", () => {
        item.time = timeInput.value;
        saveTrips();
      });
      timeWrap.appendChild(timeInput);

      const badge = document.createElement("span");
      badge.className = "day-item-badge " + typeToClass(item.type);
      badge.textContent = typeToLabel(item.type);

      const text = document.createElement("span");
      const cityPart = item.city ? `${item.city} · ` : "";
      text.textContent = cityPart + (item.title || "");

      row.appendChild(timeWrap);
      row.appendChild(badge);
      row.appendChild(text);
      block.appendChild(row);
    });

    if (!visibleCount) {
      const row = document.createElement("div");
      row.className = "day-item-row";
      const note = document.createElement("span");
      note.textContent = "这一类型在当天没有安排。";
      row.appendChild(note);
      block.appendChild(row);
    }

    container.appendChild(block);
  });
}

function typeToClass(type) {
  if (type === "poi") return "type-poi";
  if (type === "meal") return "type-meal";
  if (type === "stay") return "type-stay";
  if (type === "transit") return "type-transit";
  if (type === "break") return "type-break";
  return "";
}

function typeToLabel(type) {
  if (type === "poi") return "🚶 景点";
  if (type === "meal") return "🍽 吃饭";
  if (type === "stay") return "🛏 住宿";
  if (type === "transit") return "🚆 交通";
  if (type === "break") return "☕ 休息";
  return "";
}

// 详情页自动保存 / 导出
function setupDetailAutoSave(trip) {
  const notesEl = document.getElementById("ov-notes");
  const tpEl = document.getElementById("tp-text");
  const stEl = document.getElementById("st-text");

  notesEl.oninput = () => {
    trip.notes = notesEl.value;
    saveTrips();
  };
  tpEl.oninput = () => {
    trip.segments = trip.segments || {};
    trip.segments.transport = tpEl.value;
    saveTrips();
  };
  stEl.oninput = () => {
    trip.segments = trip.segments || {};
    trip.segments.stays = stEl.value;
    saveTrips();
  };

  document.getElementById("btn-export-word").onclick = () =>
    exportTripWord(trip);
  document.getElementById("btn-export-excel").onclick = () =>
    exportTripExcel(trip);
  document.getElementById("btn-regenerate-poi").onclick = () => {
    openPlanner("replan", trip);
  };
}

// 导出 Word（.doc，HTML 格式，Word 可直接打开）
function exportTripWord(trip) {
  ensureDayPlan(trip);
  const meta = trip.meta || {};
  const dayPlan = trip.dayPlan || [];
  const title =
    meta.title ||
    (meta.destinations && meta.destinations.join(" / ")) ||
    "行程";

  let html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
</head>
<body>
<h1>${title}</h1>
<p>出发城市：${meta.origin || ""}</p>
<p>目的地：${(meta.destinations || []).join(" / ")}</p>
<p>天数：${meta.days || ""}</p>
<p>预算：${formatBudgetMeta(meta)}</p>
<hr/>
`;

  dayPlan.forEach((d, idx) => {
    html += `<h2>Day ${d.dayIndex || idx + 1} · ${d.city || ""}</h2>`;
    html += `<table border="1" cellspacing="0" cellpadding="4">
      <tr>
        <th>时间</th>
        <th>类型</th>
        <th>标题</th>
        <th>说明</th>
      </tr>`;
    (d.items || []).forEach((item) => {
      html += `<tr>
        <td>${item.time || ""}</td>
        <td>${typeToLabel(item.type)}</td>
        <td>${item.city ? item.city + " · " : ""}${item.title || ""}</td>
        <td>${item.note || ""}</td>
      </tr>`;
    });
    html += `</table><br/>`;
  });

  html += `</body></html>`;

  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 导出 Excel（CSV，Excel 可直接打开）
function exportTripExcel(trip) {
  ensureDayPlan(trip);
  const meta = trip.meta || {};
  const dayPlan = trip.dayPlan || [];
  const title =
    meta.title ||
    (meta.destinations && meta.destinations.join(" / ")) ||
    "行程";

  let csv = "Day,City,Time,Type,Title,Note\n";
  dayPlan.forEach((d, idx) => {
    (d.items || []).forEach((item) => {
      const day = d.dayIndex || idx + 1;
      const city = (item.city || "").replace(/,/g, " ");
      const time = (item.time || "").replace(/,/g, " ");
      const type = typeToLabel(item.type).replace(/,/g, " ");
      const titleText =
        ((item.city ? item.city + " · " : "") + (item.title || "")).replace(
          /,/g,
          " "
        );
      const note = (item.note || "").replace(/\r?\n/g, " ").replace(/,/g, " ");
      csv += `${day},${city},${time},${type},${titleText},${note}\n`;
    });
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============== Overlay / 冷启动 / 计划 / Swipe ==============

function resetFlowStateFromTrip(trip) {
  flowState.basic = { origin: "", companions: "" };
  flowState.trip = {
    destinations: [],
    randomDestinations: false,
    days: null,
    timeTightness: "",
    budgetLevel: "",
    pace: "",
    currencySymbol: userProfile.currencySymbol || "¥",
  };
  flowState.plan = { options: [], chosenIndex: null };
  flowState.swipe = { cards: [], index: 0, kept: [] };

  if (trip) {
    const m = trip.meta || {};
    flowState.basic.origin = m.origin || "";
    flowState.basic.companions = m.companions || "";
    flowState.trip.destinations = (m.destinations || []).slice();
    flowState.trip.randomDestinations = false;
    flowState.trip.days = m.days || null;
    flowState.trip.timeTightness = m.timeTightness || "";
    flowState.trip.budgetLevel = m.budgetLevel || "";
    flowState.trip.pace = m.pace || "";
    flowState.trip.currencySymbol =
      m.currencySymbol || userProfile.currencySymbol || "¥";
  } else if (userProfile.defaultOnboarding) {
    const d = userProfile.defaultOnboarding;
    flowState.basic.origin = d.origin || "";
    flowState.basic.companions = d.companions || "";
    flowState.trip.days = d.days || null;
    flowState.trip.budgetLevel = d.budgetLevel || "";
    flowState.trip.pace = d.pace || "";
    flowState.trip.currencySymbol =
      userProfile.currencySymbol || flowState.trip.currencySymbol;
  }
}

function openPlanner(mode = "new", trip = null) {
  const overlay = document.getElementById("planner-overlay");
  overlay.classList.remove("hidden");

  document.getElementById("planner-title").textContent =
    mode === "new"
      ? "新建行程 · 冷启动"
      : "重新规划景点（只影响景点 & Day Plan，不改备注和文本）";

  resetFlowStateFromTrip(mode === "replan" ? trip : null);

  setupOnboardingUI();
  currentStep = 1;
  renderWizardStep();
  showPlannerStep("onboarding");

  document.getElementById("btn-close-planner").onclick = () => {
    overlay.classList.add("hidden");
  };
}

function showPlannerStep(name) {
  const onboarding = document.getElementById("planner-step-onboarding");
  const plan = document.getElementById("planner-step-plan");
  const swipe = document.getElementById("planner-step-swipe");
  onboarding.classList.add("hidden");
  plan.classList.add("hidden");
  swipe.classList.add("hidden");
  if (name === "onboarding") onboarding.classList.remove("hidden");
  if (name === "plan") plan.classList.remove("hidden");
  if (name === "swipe") swipe.classList.remove("hidden");
}

function setupOnboardingUI() {
  setupChipGroup("ob-companions-row", (value) => {
    flowState.basic.companions = value;
  });

  setupDestinationStep();

  setupChipGroup("ob-time-row", (v) => {
    flowState.trip.timeTightness = v;
  });

  setupChipGroup("ob-budget-row", (v) => {
    flowState.trip.budgetLevel = v;
    updateOnboardingSummary();
  });
  setupChipGroup("ob-pace-row", (v) => {
    flowState.trip.pace = v;
    updateOnboardingSummary();
  });

  const originInput = document.getElementById("ob-origin");
  originInput.value = flowState.basic.origin || "";
  originInput.oninput = () => {
    flowState.basic.origin = originInput.value.trim();
    updateOnboardingSummary();
  };

  const daysInput = document.getElementById("ob-days");
  daysInput.value = flowState.trip.days || "";
  daysInput.oninput = () => {
    const v = parseInt(daysInput.value, 10);
    flowState.trip.days = Number.isNaN(v) ? null : v;
    updateOnboardingSummary();
  };

  const curSelect = document.getElementById("ob-currency");
  curSelect.value =
    flowState.trip.currencySymbol || userProfile.currencySymbol || "¥";
  curSelect.onchange = () => {
    flowState.trip.currencySymbol = curSelect.value;
    updateOnboardingSummary();
  };

  document.getElementById("btn-wizard-back").onclick = handleWizardBack;
  document.getElementById("btn-wizard-next").onclick = handleWizardNext;
  document.getElementById("btn-to-plan").onclick = () => {
    if (!validateCurrentStep()) return;
    generatePlanOptions();
    renderPlanOptions();
    showPlannerStep("plan");
  };

  initChipsFromState();
  initDestsFromState();
  updateOnboardingSummary();
}

function setupChipGroup(containerId, onChange) {
  const container = document.getElementById(containerId);
  const chips = container.querySelectorAll(".chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      onChange && onChange(chip.dataset.value);
    });
  });
}

function initChipsFromState() {
  const map = {
    "ob-companions-row": flowState.basic.companions,
    "ob-time-row": flowState.trip.timeTightness,
    "ob-budget-row": flowState.trip.budgetLevel,
    "ob-pace-row": flowState.trip.pace,
  };
  Object.entries(map).forEach(([id, value]) => {
    const row = document.getElementById(id);
    if (!row || !value) return;
    row.querySelectorAll(".chip").forEach((chip) => {
      if (chip.dataset.value === value) chip.classList.add("chip--active");
      else chip.classList.remove("chip--active");
    });
  });
}

function setupDestinationStep() {
  const tagsContainer = document.getElementById("ob-dest-tags");
  const tags = tagsContainer.querySelectorAll(".tag");
  const destListEl = document.getElementById("ob-dest-list");
  const randomCheckbox = document.getElementById("ob-random-dest");
  const addBtn = document.getElementById("btn-add-dest");
  const destInput = document.getElementById("ob-dest-input");

  function renderSelected() {
    destListEl.innerHTML = "";
    flowState.trip.destinations.forEach((city) => {
      const pill = document.createElement("div");
      pill.className = "selected-pill";
      pill.innerHTML = `<span>${city}</span><span class="remove">×</span>`;
      pill.querySelector(".remove").onclick = () => {
        flowState.trip.destinations = flowState.trip.destinations.filter(
          (c) => c !== city
        );
        const btn = Array.from(tags).find((b) => b.dataset.city === city);
        if (btn) btn.classList.remove("tag--active");
        renderSelected();
        updateOnboardingSummary();
      };
      destListEl.appendChild(pill);
    });
  }

  tags.forEach((tag) => {
    tag.onclick = () => {
      const city = tag.dataset.city;
      const exists = flowState.trip.destinations.includes(city);
      if (exists) {
        flowState.trip.destinations = flowState.trip.destinations.filter(
          (c) => c !== city
        );
        tag.classList.remove("tag--active");
      } else {
        flowState.trip.destinations.push(city);
        tag.classList.add("tag--active");
      }
      renderSelected();
      updateOnboardingSummary();
    };
  });

  addBtn.onclick = () => {
    const city = destInput.value.trim();
    if (!city) return;
    if (!flowState.trip.destinations.includes(city)) {
      flowState.trip.destinations.push(city);
    }
    destInput.value = "";
    renderSelected();
    updateOnboardingSummary();
  };

  randomCheckbox.checked = flowState.trip.randomDestinations;
  randomCheckbox.onchange = () => {
    flowState.trip.randomDestinations = randomCheckbox.checked;
    updateOnboardingSummary();
  };

  renderSelected();
  initDestsFromState();
}

function initDestsFromState() {
  const tagsContainer = document.getElementById("ob-dest-tags");
  const tags = tagsContainer.querySelectorAll(".tag");
  tags.forEach((t) => {
    if (flowState.trip.destinations.includes(t.dataset.city)) {
      t.classList.add("tag--active");
    } else {
      t.classList.remove("tag--active");
    }
  });
}

function renderWizardStep() {
  const label = document.getElementById("wizard-step-label");
  const title = document.getElementById("wizard-step-title");
  const steps = document.querySelectorAll(".wizard-step");
  const btnNext = document.getElementById("btn-wizard-next");
  const btnToPlan = document.getElementById("btn-to-plan");
  const error = document.getElementById("wizard-error");

  label.textContent = `${currentStep} / ${TOTAL_STEPS}`;
  error.textContent = "";

  steps.forEach((stepEl) => {
    const s = Number(stepEl.dataset.step);
    stepEl.classList.toggle("hidden", s !== currentStep);
  });

  if (currentStep === 1) title.textContent = "了解一下这趟出行的基本信息";
  else if (currentStep === 2) title.textContent = "你大概想去哪些城市？";
  else if (currentStep === 3) title.textContent = "时间和天数";
  else if (currentStep === 4) {
    title.textContent = "预算和节奏";
    updateOnboardingSummary();
  }

  document.getElementById("btn-wizard-back").disabled = currentStep === 1;

  if (currentStep < TOTAL_STEPS) {
    btnNext.classList.remove("hidden");
    btnToPlan.classList.add("hidden");
  } else {
    btnNext.classList.add("hidden");
    btnToPlan.classList.remove("hidden");
  }
}

function validateCurrentStep() {
  const err = document.getElementById("wizard-error");
  err.textContent = "";

  if (currentStep === 1) {
    if (!flowState.basic.origin) {
      err.textContent = "先随便写一个出发城市吧～";
      return false;
    }
    if (!flowState.basic.companions) {
      err.textContent = "选一下这趟是和谁一起，会影响后面的建议。";
      return false;
    }
  } else if (currentStep === 2) {
    if (
      !flowState.trip.destinations.length &&
      !flowState.trip.randomDestinations
    ) {
      err.textContent = "至少选一个目的地，或者勾选「随机分配城市」。";
      return false;
    }
  } else if (currentStep === 3) {
    if (!flowState.trip.days || flowState.trip.days <= 0) {
      err.textContent = "大致几天也可以先随便填一个，比如 3~14。";
      return false;
    }
    if (!flowState.trip.timeTightness) {
      err.textContent = "时间宽不宽松也选一下。";
      return false;
    }
  } else if (currentStep === 4) {
    if (!flowState.trip.budgetLevel || !flowState.trip.pace) {
      err.textContent = "预算和节奏尽量都点一下～";
      return false;
    }
  }
  return true;
}

function handleWizardNext() {
  if (!validateCurrentStep()) return;
  if (currentStep < TOTAL_STEPS) {
    currentStep += 1;
    renderWizardStep();
  }
}

function handleWizardBack() {
  if (currentStep > 1) {
    currentStep -= 1;
    renderWizardStep();
  }
}

function updateOnboardingSummary() {
  const originEl = document.getElementById("ob-summary-origin");
  const destsEl = document.getElementById("ob-summary-dests");
  const daysEl = document.getElementById("ob-summary-days");
  const bpEl = document.getElementById("ob-summary-budget-pace");

  originEl.textContent = flowState.basic.origin || "还没填";

  if (flowState.trip.destinations.length) {
    destsEl.textContent = flowState.trip.destinations.join(" / ");
  } else if (flowState.trip.randomDestinations) {
    destsEl.textContent = "交给系统随机分配";
  } else {
    destsEl.textContent = "还没选";
  }

  daysEl.textContent = flowState.trip.days
    ? `${flowState.trip.days} 天`
    : "——";

  const symbol =
    flowState.trip.currencySymbol ||
    userProfile.currencySymbol ||
    "¥";
  const level = flowState.trip.budgetLevel;
  const count = !level
    ? 0
    : level === "tight"
    ? 1
    : level === "medium"
    ? 2
    : 3;
  const budgetStr = count ? symbol.repeat(count) : "预算未定";

  const paceMap = {
    chill: "佛系慢游",
    balanced: "节奏适中",
    intense: "高效打卡",
  };
  const p = paceMap[flowState.trip.pace] || "节奏未定";

  bpEl.textContent = `${budgetStr} · ${p}`;
}

// ============== 计划候选 ==============

function humanBudget() {
  const symbol =
    flowState.trip.currencySymbol ||
    userProfile.currencySymbol ||
    "¥";
  const level = flowState.trip.budgetLevel;
  if (!level) return "预算一般";
  const count = level === "tight" ? 1 : level === "medium" ? 2 : 3;
  return symbol.repeat(count);
}

function distributeDays(days, cities, mode) {
  const n = cities.length || 1;
  const result = cities.map((c) => ({ city: c, days: 0 }));
  if (mode === "deep-main") {
    let remain = days;
    result[0].days = Math.max(2, Math.round(days * 0.6));
    remain -= result[0].days;
    for (let i = 1; i < n && remain > 0; i++) {
      const d = i === n - 1 ? remain : Math.min(2, remain);
      result[i].days = d;
      remain -= d;
    }
  } else if (mode === "balanced-multi") {
    let base = Math.floor(days / n);
    let leftover = days % n;
    for (let i = 0; i < n; i++) {
      result[i].days = base + (leftover > 0 ? 1 : 0);
      leftover--;
      if (leftover < 0) leftover = 0;
    }
  } else {
    let remain = days;
    result[0].days = Math.max(1, Math.ceil(days * 0.4));
    remain -= result[0].days;
    for (let i = 1; i < n && remain > 0; i++) {
      const d = i === n - 1 ? remain : Math.max(1, Math.floor(remain / (n - i)));
      result[i].days = d;
      remain -= d;
    }
  }
  return result;
}

function generatePlanOptions() {
  const days = flowState.trip.days || 3;
  let cities = flowState.trip.destinations.slice();
  if (!cities.length || flowState.trip.randomDestinations) {
    cities = ["东京", "大阪", "京都"].slice(0, Math.min(days, 3));
  }

  const companions = flowState.basic.companions;
  const pace = flowState.trip.pace;
  const destDisplay = cities.join(" / ");

  const paceText =
    pace === "chill"
      ? "节奏偏慢，每天保留发呆/散步时间。"
      : pace === "balanced"
      ? "节奏适中，每天 1–2 个主活动。"
      : "节奏偏快，覆盖尽量多的点。";

  const compText =
    companions === "solo"
      ? "更偏向独处体验和街区小店。"
      : companions === "friends"
      ? "适合和朋友边走边聊的节奏。"
      : companions === "family"
      ? "照顾到家人，不安排太多夜间活动。"
      : companions === "partner"
      ? "强调氛围和视野，适合情侣旅行。"
      : "";

  const options = [];

  options.push({
    id: "deep-main",
    title: "方案 A · 主城深度游",
    badge: "推荐",
    tags: [`重点放在 ${cities[0]}`, "减少酒店更换"],
    desc: `大部分时间待在 ${cities[0]}，只在 1–2 天安排短途。${paceText}`,
    meta: `${destDisplay} · ${days} 天 · ${humanBudget()} · ${compText}`,
    distribution: distributeDays(days, cities, "deep-main"),
  });

  options.push({
    id: "balanced-multi",
    title: "方案 B · 多城均衡探索",
    badge: "多体验",
    tags: ["城市之间比较均衡", "适合第一次来"],
    desc: `把天数在 ${destDisplay} 之间比较均匀地分配，保证每个城市都有完整体验。${paceText}`,
    meta: `${destDisplay} · ${days} 天 · ${humanBudget()} · ${compText}`,
    distribution: distributeDays(days, cities, "balanced-multi"),
  });

  options.push({
    id: "fast-scan",
    title: "方案 C · 高效打卡",
    badge: "高能量",
    tags: ["覆盖面尽量大", "适合补遗憾"],
    desc: `在不透支体力的前提下，把标志性景点尽量串起来。${paceText}`,
    meta: `${destDisplay} · ${days} 天 · ${humanBudget()} · 更适合已经来过一次。`,
    distribution: distributeDays(days, cities, "fast-scan"),
  });

  flowState.plan.options = options;
  flowState.plan.chosenIndex = 0;
}

function renderPlanOptions() {
  const list = document.getElementById("plan-list");
  const err = document.getElementById("plan-error");
  list.innerHTML = "";
  err.textContent = "";

  flowState.plan.options.forEach((opt, idx) => {
    const div = document.createElement("div");
    div.className = "plan-item";
    if (idx === flowState.plan.chosenIndex)
      div.classList.add("plan-item--selected");
    div.innerHTML = `
      <div class="plan-item-title">${opt.title}</div>
      <div class="plan-item-tags">${opt.distribution
        .map((d) => `${d.city} ${d.days}天`)
        .join(" · ")}</div>
      <div class="plan-item-desc">${opt.desc}</div>
      <div class="plan-item-meta">${opt.meta}</div>
      <div class="plan-item-badge">${opt.badge}</div>
    `;
    div.onclick = () => {
      flowState.plan.chosenIndex = idx;
      renderPlanOptions();
    };
    list.appendChild(div);
  });

  document.getElementById("btn-plan-back").onclick = () => {
    showPlannerStep("onboarding");
  };

  document.getElementById("btn-plan-next").onclick = () => {
    if (flowState.plan.chosenIndex == null) {
      err.textContent = "先随便选一个你更喜欢的方案～";
      return;
    }
    prepareSwipeCards();
    setupSwipeUI();
    showPlannerStep("swipe");
  };
}

// ============== Swipe 卡片（mock，可接 AI） ==============

const POI_DB = {
  东京: [
    {
      name: "浅草寺 & 雷门",
      type: "文化景点",
      tags: ["文化 / 历史", "人气高"],
      desc: "经典东京起手式，适合第一天熟悉节奏，顺便吃仲见世商店街的小吃。",
    },
    {
      name: "涩谷十字路口 & 忠犬八公",
      type: "城市街区",
      tags: ["城市氛围", "轻体力"],
      desc: "世界上最忙的十字路口之一，适合晚上感受城市的能量。",
    },
  ],
  大阪: [
    {
      name: "道顿堀 & 心斋桥",
      type: "美食街区",
      tags: ["美食 / 夜生活"],
      desc: "章鱼烧、蟹道乐、串炸，吃吃逛逛的好去处。",
    },
  ],
  京都: [
    {
      name: "伏见稻荷大社",
      type: "神社",
      tags: ["文化 / 历史", "轻徒步"],
      desc: "经典红色鸟居走廊，体力范围内可以往山上多走一点。",
    },
  ],
  首尔: [
    {
      name: "弘大街区",
      type: "街区",
      tags: ["年轻氛围", "咖啡馆"],
      desc: "独立小店、街头表演和咖啡馆聚集地。",
    },
  ],
  巴黎: [
    {
      name: "卢浮宫",
      type: "博物馆",
      tags: ["艺术 / 历史"],
      desc: "至少预留半天，随意逛也能有很多收获。",
    },
  ],
  布拉格: [
    {
      name: "查理大桥 & 老城广场",
      type: "老城区",
      tags: ["中世纪氛围", "步行友好"],
      desc: "桥 + 广场 + 小巷的组合，非常适合慢慢走。",
    },
  ],
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepareSwipeCards() {
  const chosen = flowState.plan.options[flowState.plan.chosenIndex];
  const cities = chosen.distribution.map((d) => d.city);
  let cards = [];

  cities.forEach((city) => {
    const list = POI_DB[city] || [];
    list.forEach((poi) => cards.push({ city, ...poi }));
  });

  if (!cards.length) {
    cards = [
      {
        city: "示例城市",
        name: "示例景点",
        type: "景点",
        tags: ["示例"],
        desc: "这里是示例景点。未来会由 AI + 数据平台生成真实候选卡片。",
      },
    ];
  }

  cards = shuffle(cards).slice(0, 12);

  flowState.swipe.cards = cards;
  flowState.swipe.index = 0;
  flowState.swipe.kept = [];
}

function setupSwipeUI() {
  renderCurrentSwipeCard();

  const likeBtn = document.getElementById("btn-swipe-like");
  const dislikeBtn = document.getElementById("btn-swipe-dislike");
  const finishBtn = document.getElementById("btn-swipe-finish");
  const cardEl = document.getElementById("swipe-card");

  let dragging = false;
  let startX = 0;
  let currentX = 0;

  function handleStart(x) {
    dragging = true;
    startX = x;
    currentX = x;
    cardEl.classList.add("dragging");
  }
  function handleMove(x) {
    if (!dragging) return;
    currentX = x;
    const dx = currentX - startX;
    const rot = dx * 0.05;
    cardEl.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  }
  function handleEnd() {
    if (!dragging) return;
    dragging = false;
    cardEl.classList.remove("dragging");
    const dx = currentX - startX;
    const threshold = 80;
    if (dx > threshold) triggerSwipe(true);
    else if (dx < -threshold) triggerSwipe(false);
    else cardEl.style.transform = "translateX(-50%)";
  }

  cardEl.onmousedown = (e) => handleStart(e.clientX);
  window.onmousemove = (e) => handleMove(e.clientX);
  window.onmouseup = handleEnd;

  cardEl.ontouchstart = (e) => handleStart(e.touches[0].clientX);
  cardEl.ontouchmove = (e) => handleMove(e.touches[0].clientX);
  cardEl.ontouchend = handleEnd;

  likeBtn.onclick = () => triggerSwipe(true);
  dislikeBtn.onclick = () => triggerSwipe(false);
  finishBtn.onclick = () => finalizeTripFromFlow();
}

function renderCurrentSwipeCard() {
  const cardEl = document.getElementById("swipe-card");
  const counterEl = document.getElementById("swipe-counter");
  const { cards, index } = flowState.swipe;

  if (index >= cards.length) {
    cardEl.innerHTML =
      '<p class="step-intro">卡片已经刷完啦，可以点击下方按钮生成并保存行程。</p>';
    counterEl.textContent = `卡片 ${cards.length} / ${cards.length}`;
    return;
  }

  const c = cards[index];
  counterEl.textContent = `卡片 ${index + 1} / ${cards.length}`;

  cardEl.style.transform = "translateX(-50%)";
  cardEl.innerHTML = `
    <div class="poi-card-city">${c.city} · ${c.type}</div>
    <div class="poi-card-title">${c.name}</div>
    <div class="poi-card-tags">
      ${(c.tags || []).map((t) => `<span class="poi-card-tag">${t}</span>`).join("")}
    </div>
    <div class="poi-card-desc">${c.desc}</div>
  `;
}

function triggerSwipe(keep) {
  const cardEl = document.getElementById("swipe-card");
  const { cards, index } = flowState.swipe;
  if (index >= cards.length) {
    finalizeTripFromFlow();
    return;
  }

  if (keep) {
    cardEl.classList.add("swipe-right");
    flowState.swipe.kept.push(cards[index]);
  } else {
    cardEl.classList.add("swipe-left");
  }

  cardEl.addEventListener(
    "transitionend",
    () => {
      cardEl.classList.remove("swipe-right", "swipe-left");
      flowState.swipe.index += 1;
      renderCurrentSwipeCard();
    },
    { once: true }
  );
}

// ============== 从 flowState 生成 / 更新 Trip + 日志 ==============

function finalizeTripFromFlow() {
  const overlay = document.getElementById("planner-overlay");
  const kept = flowState.swipe.kept.length
    ? flowState.swipe.kept
    : flowState.swipe.cards.slice(0, (flowState.trip.days || 3) * 2);

  const chosenPlan = flowState.plan.options[flowState.plan.chosenIndex];

  const meta = {
    origin: flowState.basic.origin,
    companions: flowState.basic.companions,
    destinations: flowState.trip.destinations.slice(),
    days: flowState.trip.days,
    timeTightness: flowState.trip.timeTightness,
    budgetLevel: flowState.trip.budgetLevel,
    pace: flowState.trip.pace,
    currencySymbol:
      flowState.trip.currencySymbol ||
      userProfile.currencySymbol ||
      "¥",
    plan: {
      id: chosenPlan.id,
      distribution: chosenPlan.distribution,
    },
  };
  if (!meta.destinations.length && flowState.trip.randomDestinations) {
    meta.destinations = chosenPlan.distribution.map((d) => d.city);
  }

  const title = meta.destinations.length
    ? `${meta.destinations.join(" / ")} · ${meta.days || ""} 天`
    : "未命名行程";

  const isReplan =
    currentTripId &&
    overlay.querySelector("#planner-title").textContent.includes("重新规划");

  if (isReplan) {
    const trip = findTrip(currentTripId);
    if (trip) {
      trip.attractions = kept;
      trip.meta = { ...trip.meta, ...meta, title };
      trip.dayPlan = buildDayPlanFromTrip(trip);
      trip.version = (trip.version || 1) + 1;

      saveTrips();
      pushLog("replan", trip);
      renderTripDetail(trip.id);
    }
  } else {
    const trip = {
      id: genId("trip"),
      createdAt: new Date().toISOString(),
      meta: { ...meta, title },
      notes: "",
      segments: { transport: "", stays: "" },
      attractions: kept,
      version: 1,
    };
    trip.dayPlan = buildDayPlanFromTrip(trip);
    trips.push(trip);
    saveTrips();
    pushLog("create", trip);
    currentTripId = trip.id;
    renderTripList();
    renderTripDetail(trip.id);
  }

  overlay.classList.add("hidden");
}

function pushLog(type, trip) {
  const entry = {
    id: genId("log"),
    tripId: trip.id,
    tripTitle: trip.meta?.title || "未命名行程",
    type,
    version: trip.version || 1,
    createdAt: new Date().toISOString(),
  };
  logs.push(entry);
  saveLogs();
  renderUserLogs();
}

// ============== Tabs & 用户中心 ==============



function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("tab--active"));
      panels.forEach((p) => p.classList.remove("tab-panel--active"));
      tab.classList.add("tab--active");
      document
        .getElementById(`tab-${name}`)
        .classList.add("tab-panel--active");
    });
  });
}

function renderUserSummary() {
  const avatar = document.getElementById("user-avatar");
  const nameLabel = document.getElementById("user-name-label");
  const metaLabel = document.getElementById("user-meta-label");

  if (userProfile.loggedIn && userProfile.name) {
    nameLabel.textContent = userProfile.name;
    metaLabel.textContent = "点击头像查看个人资料和生成日志";
    avatar.textContent = userProfile.name.slice(0, 1).toUpperCase();
  } else {
    nameLabel.textContent = "未登录";
    metaLabel.textContent = "点击头像进入个人中心";
    avatar.textContent = "U";
  }
}


function renderUserOverlay() {
  const nameInput = document.getElementById("user-name");
  const curSelect = document.getElementById("user-currency");
  const defOrigin = document.getElementById("user-default-origin");
  const defComp = document.getElementById("user-default-companions");
  const defDays = document.getElementById("user-default-days");
  const defBudget = document.getElementById("user-default-budget");
  const defPace = document.getElementById("user-default-pace");

  nameInput.value = userProfile.name || "";
  curSelect.value = userProfile.currencySymbol || "¥";

  const d = userProfile.defaultOnboarding || {};
  defOrigin.value = d.origin || "";
  defComp.value = d.companions || "";
  defDays.value = d.days || "";
  defBudget.value = d.budgetLevel || "";
  defPace.value = d.pace || "";

  renderUserLogs();
}

function renderUserLogs() {
  const listEl = document.getElementById("user-log-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  if (!logs.length) {
    const p = document.createElement("p");
    p.className = "hint-text";
    p.textContent = "暂时还没有生成记录。完成一次行程规划后会出现在这里。";
    listEl.appendChild(p);
    return;
  }

  const sorted = logs
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sorted.forEach((log) => {
    const div = document.createElement("div");
    div.className = "user-log-item";
    const dateStr = new Date(log.createdAt).toLocaleString();
    div.textContent = `[${log.type === "create" ? "生成" : "重生成"}] ${
      log.tripTitle
    } · v${log.version} · ${dateStr}`;
    listEl.appendChild(div);
  });
}

function setupUserCenter() {
  // ✅ 改：用头像做入口
  const entry = document.getElementById("user-avatar");
  const overlay = document.getElementById("user-overlay");
  const btnClose = document.getElementById("btn-close-user");
  const btnSave = document.getElementById("btn-save-user");
  const errEl = document.getElementById("user-error");

  if (entry) {
    entry.onclick = () => {
      // === 检查登录状态（预备将来对接 Google Cloud） ===
      const auth = AuthStore.load(); // 从 localStorage 读 tnAuth
      const isLoggedIn = AuthStore.isLoggedIn && AuthStore.isLoggedIn(); // 安全调用

      if (!isLoggedIn || !auth) {
        // 未登录 → 打开登录 / 注册弹窗
        openAuthOverlay(); // 这一步我们下一条会写出来
        return;
      }

      // 已登录 → 打开个人中心
      renderUserOverlay();
      overlay.classList.remove("hidden");
    };
  }

// ===== 登录状态管理（AuthStore） =====
// ============ 登录 / 注册 Overlay：打开 / 关闭 ============

// 打开登录 / 注册弹窗
function openAuthOverlay() {
  const overlay = document.getElementById("auth-overlay");
  if (!overlay) {
    console.warn("auth-overlay 未找到，请确认 HTML 是否已添加");
    return;
  }
  overlay.classList.remove("hidden");
}

// 简单 email 校验
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ===== Mock 登录 / 注册（以后换成 Google Cloud / Firebase）=====

// 邮箱登录（现在只是前端假登录）
function loginWithEmail(email, password) {
  // TODO：将来这里换成真实后端 / Firebase 调用
  return {
    uid: "email-" + email,
    email,
    provider: "email",
    idToken: "mock-token-" + Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 小时后过期
  };
}

// 邮箱注册
function registerWithEmail(email, password) {
  // TODO：将来这里换成真实注册接口
  return {
    uid: "email-" + email,
    email,
    provider: "email",
    idToken: "mock-token-" + Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

// Google 登录（现在先 mock，以后换成 Google Identity）
function loginWithGoogleMock() {
  const email = "google-user@example.com";
  return {
    uid: "google-" + Date.now(),
    email,
    provider: "google",
    idToken: "mock-google-token-" + Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}

// 登录 / 注册成功后的统一处理
function handleAuthSuccess(authState) {
  // 1. 保存登录状态（为以后接 Google Cloud 预留）
  AuthStore.save(authState);

  // 2. 同步到你的轻量 userProfile（本地偏好）
  if (!window.userProfile) {
    window.userProfile = {};
  }

  const email = authState.email || "";

  // 如果还没有昵称，就用邮箱前缀当一个默认昵称
  if (!userProfile.name && email) {
    userProfile.name = email.split("@")[0];
  }
  userProfile.loggedIn = true;

  // 保存本地 profile（你原来就有这个函数）
  if (typeof saveUserProfile === "function") {
    saveUserProfile();
  }

  // 刷新左下角头像 + 文案
  if (typeof renderUserSummary === "function") {
    renderUserSummary();
  }

  // 3. 关闭登录弹窗
  closeAuthOverlay();

  // 4. 可选：自动打开个人中心，让用户看到“账号里有什么”
  const userOverlay = document.getElementById("user-overlay");
  if (userOverlay && typeof renderUserOverlay === "function") {
    renderUserOverlay();
    userOverlay.classList.remove("hidden");
  }
}


// 关闭登录 / 注册弹窗
function closeAuthOverlay() {
  const overlay = document.getElementById("auth-overlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
}

const AUTH_KEY = "tnAuth";

const AuthStore = {
  load() {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("解析 authState 失败", e);
      return null;
    }
  },
  save(state) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(AUTH_KEY);
  },
  isLoggedIn() {
    const state = this.load();
    if (!state || !state.idToken) return false;
    if (state.expiresAt && Date.now() > state.expiresAt) {
      this.clear();
      return false;
    }
    return true;
  },
};

  btnClose.onclick = () => {
    overlay.classList.add("hidden");
  };

  btnSave.onclick = () => {
    const nameInput = document.getElementById("user-name");
    const curSelect = document.getElementById("user-currency");
    const defOrigin = document.getElementById("user-default-origin");
    const defComp = document.getElementById("user-default-companions");
    const defDays = document.getElementById("user-default-days");
    const defBudget = document.getElementById("user-default-budget");
    const defPace = document.getElementById("user-default-pace");

    const name = nameInput.value.trim();
    if (!name) {
      errEl.textContent = "至少填个昵称，方便区分是谁的账号～";
      return;
    }
    errEl.textContent = "";

    userProfile.name = name;
    userProfile.loggedIn = true;
    userProfile.currencySymbol = curSelect.value || "¥";
    userProfile.defaultOnboarding = {
      origin: defOrigin.value.trim(),
      companions: defComp.value || "",
      days: defDays.value ? Number(defDays.value) : null,
      budgetLevel: defBudget.value || "",
      pace: defPace.value || "",
    };
    saveUserProfile();
    renderUserSummary();
    overlay.classList.add("hidden");
    
  };
  
}

// ============== 初始化 ==============

document.addEventListener("DOMContentLoaded", () => {
  loadTrips();
  loadUserProfile();
  loadLogs();

  renderTripList();
  renderUserSummary();
  setupTabs();
  setupUserCenter();
  setupAuthOverlay(); // ✅ 新增：绑定登录/注册弹窗的事件

  document.getElementById("btn-new-trip").onclick = () =>
    openPlanner("new", null);
});

