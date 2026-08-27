(() => {
  "use strict";

  const API = "/api";
  const TOKEN_KEY = "routinemate_token";
  const MEALS = [
    { id: "breakfast", label: "아침", emoji: "🌅" },
    { id: "lunch", label: "점심", emoji: "☀️" },
    { id: "dinner", label: "저녁", emoji: "🌙" },
  ];
  const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
  const PHOTO_MAX_DIM = 1024;
  const PHOTO_QUALITY = 0.75;

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || "",
    me: null, // { username, displayName }
    friends: [], // [{username, displayName}]
    date: todayStr(),
    photoUsernames: [], // 오늘 날짜에 사진을 올린 사용자 목록
    summaryRange: "week", // "week" | "month"
  };

  // ---------- 유틸 ----------
  function todayStr() {
    const d = new Date();
    return isoDate(d);
  }
  function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function addDays(dateStr, delta) {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + delta);
    return isoDate(d);
  }
  function weekDatesFor(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const dow = (d.getDay() + 6) % 7; // 월=0 ... 일=6
    const monday = addDays(dateStr, -dow);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  function monthDatesFor(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
    });
  }
  function friendName(username) {
    if (state.me && username === state.me.username) return state.me.displayName;
    const f = state.friends.find((x) => x.username === username);
    return f ? f.displayName : username;
  }
  function allMembers() {
    return [state.me, ...state.friends.filter((f) => f.username !== state.me.username)];
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "content-type": "application/json" }, opts.headers || {});
    if (state.token) headers.authorization = `Bearer ${state.token}`;
    const res = await fetch(`${API}${path}`, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "요청에 실패했습니다");
    return data;
  }

  // ---------- 화면 전환 ----------
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");

  function showAuth() {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
  }
  function showApp() {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    document.getElementById("me-name").textContent = state.me ? `${state.me.displayName} 님` : "";
  }

  // ---------- 로그인 / 회원가입 탭 ----------
  document.querySelectorAll("#auth-screen .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#auth-screen .tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.target;
      document.getElementById("login-form").classList.toggle("hidden", target !== "login-form");
      document.getElementById("register-form").classList.toggle("hidden", target !== "register-form");
    });
  });

  function setMsg(formId, text, ok = false) {
    const el = document.querySelector(`[data-msg-for="${formId}"]`);
    el.textContent = text;
    el.classList.toggle("success", ok);
  }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setMsg("login-form", "로그인 중...");
    try {
      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }),
      });
      state.token = data.token;
      localStorage.setItem(TOKEN_KEY, data.token);
      state.me = { username: data.username, displayName: data.displayName };
      setMsg("login-form", "");
      await bootApp();
    } catch (err) {
      setMsg("login-form", err.message);
    }
  });

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setMsg("register-form", "가입 중...");
    try {
      await api("/register", {
        method: "POST",
        body: JSON.stringify({
          username: fd.get("username"),
          password: fd.get("password"),
          displayName: fd.get("displayName"),
        }),
      });
      setMsg("register-form", "가입 완료! 로그인해주세요.", true);
      e.target.reset();
      document.querySelector('[data-target="login-form"]').click();
    } catch (err) {
      setMsg("register-form", err.message);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    try { await api("/me", { method: "DELETE" }); } catch {}
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    state.me = null;
    showAuth();
  });

  // ---------- 프로필 수정 ----------
  const profileModal = document.getElementById("profile-modal");
  const profileForm = document.getElementById("profile-form");

  function openProfileModal() {
    profileForm.reset();
    profileForm.displayName.value = state.me.displayName;
    setMsg("profile-form", "");
    profileModal.classList.remove("hidden");
  }
  function closeProfileModal() {
    profileModal.classList.add("hidden");
  }

  document.getElementById("profile-btn").addEventListener("click", openProfileModal);
  document.getElementById("profile-close").addEventListener("click", closeProfileModal);
  profileModal.addEventListener("click", (e) => {
    if (e.target === profileModal) closeProfileModal();
  });

  profileForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const displayName = fd.get("displayName").trim();
    const currentPassword = fd.get("currentPassword");
    const newPassword = fd.get("newPassword");

    if (newPassword && !currentPassword) {
      setMsg("profile-form", "비밀번호를 바꾸려면 현재 비밀번호를 입력해주세요.");
      return;
    }

    const payload = { displayName };
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    setMsg("profile-form", "저장 중...");
    try {
      const data = await api("/profile", { method: "PATCH", body: JSON.stringify(payload) });
      state.me.displayName = data.displayName;
      document.getElementById("me-name").textContent = `${state.me.displayName} 님`;
      setMsg("profile-form", "저장됐어요!", true);
      const { friends } = await api("/friends");
      state.friends = friends;
      refreshCurrentPanel();
      setTimeout(closeProfileModal, 600);
    } catch (err) {
      setMsg("profile-form", err.message);
    }
  });

  // ---------- 사진 크게 보기 모달 ----------
  const photoModal = document.getElementById("photo-modal");
  function openPhotoModal(username, date) {
    document.getElementById("photo-modal-title").textContent = `${friendName(username)}의 인증샷`;
    document.getElementById("photo-modal-img").src = `${API}/photo?date=${date}&username=${encodeURIComponent(username)}&t=${Date.now()}`;
    photoModal.classList.remove("hidden");
  }
  document.getElementById("photo-modal-close").addEventListener("click", () => photoModal.classList.add("hidden"));
  photoModal.addEventListener("click", (e) => {
    if (e.target === photoModal) photoModal.classList.add("hidden");
  });

  // ---------- 날짜 네비게이션 ----------
  const dateInput = document.getElementById("date-input");
  dateInput.value = state.date;
  dateInput.addEventListener("change", () => {
    state.date = dateInput.value || todayStr();
    refreshCurrentPanel();
  });
  document.getElementById("date-prev").addEventListener("click", () => {
    state.date = addDays(state.date, -1);
    dateInput.value = state.date;
    refreshCurrentPanel();
  });
  document.getElementById("date-next").addEventListener("click", () => {
    state.date = addDays(state.date, 1);
    dateInput.value = state.date;
    refreshCurrentPanel();
  });
  document.getElementById("date-today").addEventListener("click", () => {
    state.date = todayStr();
    dateInput.value = state.date;
    refreshCurrentPanel();
  });

  // ---------- 메인 탭 ----------
  let activePanel = "panel-attendance";
  document.querySelectorAll(".main-tabbar .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".main-tabbar .tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
      activePanel = btn.dataset.panel;
      document.getElementById(activePanel).classList.remove("hidden");
      refreshCurrentPanel();
    });
  });

  function refreshCurrentPanel() {
    if (activePanel === "panel-attendance") {
      renderAttendanceArea();
    } else if (activePanel === "panel-diet") {
      renderDiet();
    } else {
      renderSummary();
    }
  }

  // ---------- 요약 (주간/월간) ----------
  document.querySelectorAll(".range-toggle .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-toggle .tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.summaryRange = btn.dataset.range;
      renderSummary();
    });
  });

  async function renderSummary() {
    const dates = state.summaryRange === "week" ? weekDatesFor(state.date) : monthDatesFor(state.date);
    const rangeLabel = state.summaryRange === "week" ? "이번 주" : "이번 달";
    document.getElementById("summary-range-label").textContent = `${rangeLabel} (${dates.length}일)`;

    const [attendanceResults, dietResults, scoreResults] = await Promise.all([
      Promise.all(dates.map((dt) => api(`/attendance?date=${dt}`).catch(() => ({ records: [] })))),
      Promise.all(dates.map((dt) => api(`/diet?date=${dt}`).catch(() => ({ records: [] })))),
      Promise.all(dates.map((dt) => api(`/diet-score?date=${dt}`).catch(() => ({ records: [] })))),
    ]);

    const stats = {};
    allMembers().forEach((m) => {
      stats[m.username] = { attendanceCount: 0, dietDays: new Set(), scoreSum: 0, scoreCount: 0 };
    });

    attendanceResults.forEach(({ records }, i) => {
      records.forEach((r) => {
        if (r.checked && stats[r.username]) stats[r.username].attendanceCount += 1;
      });
    });
    dietResults.forEach(({ records }, i) => {
      const dt = dates[i];
      records.forEach((r) => {
        if (r.menu && stats[r.username]) stats[r.username].dietDays.add(dt);
      });
    });
    scoreResults.forEach(({ records }) => {
      records.forEach((r) => {
        if (r.score && stats[r.username]) {
          stats[r.username].scoreSum += r.score;
          stats[r.username].scoreCount += 1;
        }
      });
    });

    renderMySummaryStats(stats, dates.length);
    renderSummaryBadges(stats, dates.length);
    renderRankBars(
      "summary-attendance-rank",
      allMembers()
        .map((m) => ({ username: m.username, value: stats[m.username].attendanceCount }))
        .sort((a, b) => b.value - a.value),
      (v) => `${v}/${dates.length}`,
      (v) => (v / dates.length) * 100
    );

    const scoreRanked = allMembers()
      .map((m) => {
        const s = stats[m.username];
        const avg = s.scoreCount ? s.scoreSum / s.scoreCount : null;
        return { username: m.username, value: avg };
      })
      .filter((r) => r.value !== null)
      .sort((a, b) => b.value - a.value);

    document.getElementById("summary-score-empty").classList.toggle("hidden", scoreRanked.length > 0);
    renderRankBars(
      "summary-score-rank",
      scoreRanked,
      (v) => `${v.toFixed(1)}/5`,
      (v) => (v / 5) * 100
    );
  }

  function renderMySummaryStats(stats, totalDays) {
    const mine = stats[state.me.username];
    const avg = mine.scoreCount ? (mine.scoreSum / mine.scoreCount).toFixed(1) : "-";
    const wrap = document.getElementById("my-summary-stats");
    wrap.innerHTML = `
      <div class="summary-stat">
        <div class="stat-value">${mine.attendanceCount}<span style="font-size:0.9rem;">/${totalDays}</span></div>
        <div class="stat-label">운동 출석</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${mine.dietDays.size}<span style="font-size:0.9rem;">/${totalDays}</span></div>
        <div class="stat-label">식단 기록일</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${avg}</div>
        <div class="stat-label">평균 식단 점수</div>
      </div>
    `;
  }

  function renderSummaryBadges(stats, totalDays) {
    const badges = [];
    const members = allMembers();

    const topAttendance = members
      .map((m) => ({ m, v: stats[m.username].attendanceCount }))
      .sort((a, b) => b.v - a.v)[0];
    if (topAttendance && topAttendance.v > 0) {
      badges.push({ emoji: "🔥", text: `개근왕 ${friendName(topAttendance.m.username)} (${topAttendance.v}회)` });
    }

    const scoreCandidates = members
      .map((m) => {
        const s = stats[m.username];
        return { m, avg: s.scoreCount ? s.scoreSum / s.scoreCount : null, count: s.scoreCount };
      })
      .filter((c) => c.avg !== null && c.count >= 2)
      .sort((a, b) => b.avg - a.avg);
    if (scoreCandidates[0]) {
      badges.push({ emoji: "🥗", text: `식단왕 ${friendName(scoreCandidates[0].m.username)} (${scoreCandidates[0].avg.toFixed(1)}점)` });
    }

    const topDietDays = members
      .map((m) => ({ m, v: stats[m.username].dietDays.size }))
      .sort((a, b) => b.v - a.v)[0];
    if (topDietDays && topDietDays.v > 0) {
      badges.push({ emoji: "📝", text: `기록왕 ${friendName(topDietDays.m.username)} (${topDietDays.v}일)` });
    }

    const card = document.getElementById("summary-badges-card");
    const wrap = document.getElementById("summary-badges");
    card.classList.toggle("hidden", badges.length === 0);
    wrap.innerHTML = badges
      .map((b) => `<span class="badge-chip"><span class="badge-emoji">${b.emoji}</span>${escapeHtml(b.text)}</span>`)
      .join("");
  }

  function renderRankBars(containerId, ranked, formatLabel, pctFn) {
    const board = document.getElementById(containerId);
    board.innerHTML = "";
    ranked.forEach((row, idx) => {
      const el = document.createElement("div");
      el.className = "leaderboard-row" + (row.username === state.me.username ? " me" : "");
      const pct = Math.max(0, Math.min(100, Math.round(pctFn(row.value))));
      el.innerHTML = `
        <span class="rank">${idx + 1}</span>
        <span class="lb-name">${escapeHtml(friendName(row.username))}</span>
        <span class="lb-bar-track"><span class="lb-bar-fill" style="width:${pct}%"></span></span>
        <span class="lb-count">${formatLabel(row.value)}</span>
      `;
      board.appendChild(el);
    });
  }

  // ---------- 출석 + 주간 집계 + 사진 (한 번에 로드) ----------
  async function renderAttendanceArea() {
    document.getElementById("attendance-date-label").textContent = formatKoreanDate(state.date);

    const weekDates = weekDatesFor(state.date);
    const [weekResults, photoList] = await Promise.all([
      Promise.all(weekDates.map((dt) => api(`/attendance?date=${dt}`).catch(() => ({ records: [] })))),
      api(`/photo?date=${state.date}`).catch(() => ({ usernames: [] })),
    ]);
    state.photoUsernames = photoList.usernames || [];

    const todayRecords = weekResults[weekDates.indexOf(state.date)].records;

    renderAttendanceList(todayRecords);
    renderStreak(weekDates, weekResults);
    renderLeaderboard(weekDates, weekResults);
    renderPhotoWidget();
  }

  function renderAttendanceList(records) {
    const list = document.getElementById("attendance-list");
    list.innerHTML = "";

    const byUser = Object.fromEntries(records.map((r) => [r.username, r]));
    const members = allMembers();
    document.getElementById("attendance-empty").classList.toggle("hidden", members.length > 0);

    members.forEach((m) => {
      const isMe = m.username === state.me.username;
      const checked = !!byUser[m.username]?.checked;
      const hasPhoto = state.photoUsernames.includes(m.username);

      const li = document.createElement("li");
      li.className = "member-row" + (isMe ? " me" : "");
      li.innerHTML = `
        <span class="member-row-left">
          ${hasPhoto
            ? `<img class="member-photo-thumb" src="${API}/photo?date=${state.date}&username=${encodeURIComponent(m.username)}" alt="${escapeHtml(m.displayName)} 인증샷" />`
            : ""}
          <span class="name">${escapeHtml(m.displayName)}${isMe ? '<span class="you-tag">나</span>' : ""}</span>
        </span>
        <button class="check-toggle${checked ? " checked" : ""}" ${isMe ? "" : "disabled"} type="button">
          ${checked ? "✅ 출석" : "⬜ 미출석"}
        </button>
      `;

      if (hasPhoto) {
        li.querySelector(".member-photo-thumb").addEventListener("click", () => openPhotoModal(m.username, state.date));
      }

      if (isMe) {
        li.querySelector(".check-toggle").addEventListener("click", async (e) => {
          const btn = e.currentTarget;
          const next = !btn.classList.contains("checked");
          btn.disabled = true;
          try {
            await api("/attendance", {
              method: "POST",
              body: JSON.stringify({ date: state.date, checked: next }),
            });
            btn.classList.toggle("checked", next);
            btn.textContent = next ? "✅ 출석" : "⬜ 미출석";
            renderAttendanceArea();
          } finally {
            btn.disabled = false;
          }
        });
      }

      list.appendChild(li);
    });
  }

  function renderStreak(weekDates, weekResults) {
    const strip = document.getElementById("streak-strip");
    strip.innerHTML = "";

    weekDates.forEach((dt, i) => {
      const rec = weekResults[i].records.find((r) => r.username === state.me.username);
      const filled = !!rec?.checked;
      const isToday = dt === state.date;
      const dot = document.createElement("div");
      dot.className = "streak-dot" + (filled ? " filled" : "") + (isToday ? " today" : "");
      dot.textContent = WEEKDAY_LABELS[i];
      strip.appendChild(dot);
    });
  }

  function renderLeaderboard(weekDates, weekResults) {
    const board = document.getElementById("leaderboard");
    board.innerHTML = "";

    const counts = {};
    allMembers().forEach((m) => { counts[m.username] = 0; });
    weekResults.forEach(({ records }) => {
      records.forEach((r) => {
        if (r.checked && counts[r.username] !== undefined) counts[r.username] += 1;
      });
    });

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const totalDays = weekDates.length;

    ranked.forEach(([username, count], idx) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row" + (username === state.me.username ? " me" : "");
      const pct = Math.round((count / totalDays) * 100);
      row.innerHTML = `
        <span class="rank">${idx + 1}</span>
        <span class="lb-name">${escapeHtml(friendName(username))}</span>
        <span class="lb-bar-track"><span class="lb-bar-fill" style="width:${pct}%"></span></span>
        <span class="lb-count">${count}/${totalDays}</span>
      `;
      board.appendChild(row);
    });
  }

  // ---------- 사진 위젯 (오늘의 인증샷) ----------
  const photoInput = document.getElementById("photo-input");
  let pendingPhotoContext = null; // "attendance"

  function renderPhotoWidget() {
    const wrap = document.getElementById("photo-widget");
    const hasPhoto = state.photoUsernames.includes(state.me.username);

    wrap.innerHTML = `
      ${hasPhoto
        ? `<img id="my-photo-thumb" class="photo-thumb" src="${API}/photo?date=${state.date}&username=${encodeURIComponent(state.me.username)}" alt="내 인증샷" />`
        : `<div class="photo-placeholder">📷</div>`}
      <div class="photo-actions">
        <button id="photo-upload-btn" class="btn ghost small" type="button">${hasPhoto ? "사진 변경" : "사진 추가"}</button>
        ${hasPhoto ? `<button id="photo-delete-btn" class="btn ghost small" type="button">삭제</button>` : ""}
        <span id="photo-status" class="photo-status"></span>
      </div>
    `;

    if (hasPhoto) {
      wrap.querySelector("#my-photo-thumb").addEventListener("click", () => openPhotoModal(state.me.username, state.date));
      wrap.querySelector("#photo-delete-btn").addEventListener("click", async () => {
        const status = document.getElementById("photo-status");
        status.textContent = "삭제 중...";
        try {
          await api(`/photo?date=${state.date}`, { method: "DELETE" });
          renderAttendanceArea();
        } catch (err) {
          status.textContent = err.message;
        }
      });
    }

    wrap.querySelector("#photo-upload-btn").addEventListener("click", () => {
      pendingPhotoContext = "attendance";
      photoInput.value = "";
      photoInput.click();
    });
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    const status = document.getElementById("photo-status");
    if (status) status.textContent = "이미지 처리 중...";
    try {
      const blob = await resizeImageToJpeg(file, PHOTO_MAX_DIM, PHOTO_QUALITY);
      if (status) status.textContent = "업로드 중...";
      const res = await fetch(`${API}/photo?date=${state.date}`, {
        method: "POST",
        headers: { "content-type": "image/jpeg", authorization: `Bearer ${state.token}` },
        body: blob,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "업로드에 실패했습니다");
      }
      renderAttendanceArea();
    } catch (err) {
      if (status) status.textContent = err.message;
    }
  });

  function resizeImageToJpeg(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 읽을 수 없습니다"));
      };
      img.src = url;
    });
  }

  // ---------- 식단 ----------
  async function renderDiet() {
    document.getElementById("diet-date-label").textContent = formatKoreanDate(state.date);

    const [{ records }, { records: scoreRecords }] = await Promise.all([
      api(`/diet?date=${state.date}`),
      api(`/diet-score?date=${state.date}`),
    ]);

    renderDietScoreWidget(scoreRecords);
    renderMyMealForms(records);
    renderDietBoard(records, scoreRecords);
  }

  function renderMyMealForms(records) {
    const wrap = document.getElementById("meal-forms");
    wrap.innerHTML = "";

    MEALS.forEach((meal) => {
      const mine = records.find((r) => r.username === state.me.username && r.meal === meal.id);

      const box = document.createElement("div");
      box.className = "meal-form";
      box.innerHTML = `
        <div class="meal-form-head"><span class="meal-emoji">${meal.emoji}</span> ${meal.label}</div>
        <input type="text" placeholder="무엇을 먹었나요? (예: 닭가슴살 샐러드)" class="menu-input" maxlength="300" />
        <input type="text" placeholder="메모 (선택)" class="memo-input" maxlength="300" />
        <div class="save-row">
          <button class="btn ghost small save-btn" type="button">저장</button>
          <span class="save-status"></span>
        </div>
      `;
      const menuInput = box.querySelector(".menu-input");
      const memoInput = box.querySelector(".memo-input");
      const status = box.querySelector(".save-status");
      menuInput.value = mine?.menu || "";
      memoInput.value = mine?.memo || "";

      box.querySelector(".save-btn").addEventListener("click", async () => {
        status.textContent = "저장 중...";
        status.classList.remove("saved");
        try {
          await api("/diet", {
            method: "POST",
            body: JSON.stringify({
              date: state.date,
              meal: meal.id,
              menu: menuInput.value.trim(),
              memo: memoInput.value.trim(),
            }),
          });
          status.textContent = "저장됨";
          status.classList.add("saved");
          renderDiet();
        } catch (err) {
          status.textContent = err.message;
        }
      });

      wrap.appendChild(box);
    });
  }

  function renderDietBoard(records, scoreRecords) {
    const board = document.getElementById("diet-board");
    board.innerHTML = "";

    const scoreByUser = Object.fromEntries(scoreRecords.map((s) => [s.username, s.score]));

    const byUser = {};
    records.forEach((r) => {
      if (!r.menu) return;
      (byUser[r.username] ||= []).push(r);
    });
    // 식단은 없어도 점수만 입력한 경우도 카드에 보여준다
    scoreRecords.forEach((s) => {
      if (s.score && !byUser[s.username]) byUser[s.username] = [];
    });

    document.getElementById("diet-empty").classList.toggle("hidden", Object.keys(byUser).length > 0);

    Object.entries(byUser).forEach(([username, entries]) => {
      const person = document.createElement("div");
      person.className = "diet-person";
      const rows = MEALS.filter((m) => entries.some((e) => e.meal === m.id))
        .map((m) => {
          const e = entries.find((x) => x.meal === m.id);
          return `<div class="diet-meal-row"><span class="meal-tag">${m.label}</span><span class="menu-text">${escapeHtml(e.menu)}</span></div>`;
        })
        .join("");
      const score = scoreByUser[username];
      const scoreBadge = score ? `<span class="score-badge">⭐ ${score}/5</span>` : "";
      person.innerHTML = `<div class="person-name">${escapeHtml(friendName(username))}${username === state.me.username ? " (나)" : ""}${scoreBadge}</div>${rows || '<div class="diet-meal-row"><span class="menu-text">식단 기록 없음</span></div>'}`;
      board.appendChild(person);
    });
  }

  function renderDietScoreWidget(scoreRecords) {
    const wrap = document.getElementById("diet-score-widget");
    const mine = scoreRecords.find((s) => s.username === state.me.username);

    wrap.innerHTML = `
      <div class="star-row">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn${mine?.score >= n ? " active" : ""}" data-score="${n}">⭐</button>`).join("")}
      </div>
      <input type="text" id="diet-score-memo" placeholder="한 줄 메모 (선택, 예: 야식 참았음)" maxlength="200" value="${escapeAttr(mine?.memo || "")}" />
      <div class="save-row">
        <button id="diet-score-save" class="btn ghost small" type="button">저장</button>
        <span id="diet-score-status" class="save-status"></span>
      </div>
    `;

    let selected = mine?.score || 0;
    const buttons = Array.from(wrap.querySelectorAll(".star-btn"));
    function paint() {
      buttons.forEach((b) => b.classList.toggle("active", Number(b.dataset.score) <= selected));
    }
    buttons.forEach((b) => {
      b.addEventListener("click", () => {
        selected = Number(b.dataset.score);
        paint();
      });
    });

    wrap.querySelector("#diet-score-save").addEventListener("click", async () => {
      const status = wrap.querySelector("#diet-score-status");
      if (!selected) {
        status.textContent = "별점을 선택해주세요";
        return;
      }
      status.textContent = "저장 중...";
      status.classList.remove("saved");
      try {
        await api("/diet-score", {
          method: "POST",
          body: JSON.stringify({
            date: state.date,
            score: selected,
            memo: wrap.querySelector("#diet-score-memo").value.trim(),
          }),
        });
        status.textContent = "저장됨";
        status.classList.add("saved");
        renderDiet();
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  // ---------- 기타 ----------
  function formatKoreanDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }

  // ---------- 부트스트랩 ----------
  async function bootApp() {
    const { friends } = await api("/friends");
    state.friends = friends;
    showApp();
    refreshCurrentPanel();
  }

  (async function init() {
    if (!state.token) return showAuth();
    try {
      const me = await api("/me");
      state.me = me;
      await bootApp();
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      state.token = "";
      showAuth();
    }
  })();
})();
