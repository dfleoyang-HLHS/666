const App = (() => {
  let currentDate = new Date();
  let saveTimeout = null;

  const $ = (id) => document.getElementById(id);

  const els = {
    welcomeSection: $('welcomeSection'),
    journalSection: $('journalSection'),
    headerActions: $('headerActions'),
    signInBtn: $('signInBtn'),
    signOutBtn: $('signOutBtn'),
    userAvatar: $('userAvatar'),
    userName: $('userName'),
    saveStatus: $('saveStatus'),
    setupNotice: $('setupNotice'),
    openSetupBtn: $('openSetupBtn'),
    setupModal: $('setupModal'),
    clientIdInput: $('clientIdInput'),
    saveClientIdBtn: $('saveClientIdBtn'),
    closeSetupBtn: $('closeSetupBtn'),
    journalForm: $('journalForm'),
    currentDate: $('currentDate'),
    prevDayBtn: $('prevDayBtn'),
    nextDayBtn: $('nextDayBtn'),
    todayBtn: $('todayBtn'),
    saveBtn: $('saveBtn'),
    historyList: $('historyList'),
    historyEmpty: $('historyEmpty'),
    historyModal: $('historyModal'),
    historyModalTitle: $('historyModalTitle'),
    historyModalBody: $('historyModalBody'),
    closeHistoryBtn: $('closeHistoryBtn'),
    toast: $('toast'),
  };

  const fieldIds = [
    'grateful1', 'grateful2', 'grateful3',
    'greatDay', 'affirmation',
    'amazing1', 'amazing2', 'amazing3',
    'better',
  ];

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDisplayDate(date) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日（${weekdays[date.getDay()]}）`;
  }

  function isToday(date) {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
  }

  function readForm() {
    return {
      morning: {
        grateful: [
          $('grateful1').value.trim(),
          $('grateful2').value.trim(),
          $('grateful3').value.trim(),
        ],
        greatDay: $('greatDay').value.trim(),
        affirmation: $('affirmation').value.trim(),
      },
      evening: {
        amazing: [
          $('amazing1').value.trim(),
          $('amazing2').value.trim(),
          $('amazing3').value.trim(),
        ],
        better: $('better').value.trim(),
      },
    };
  }

  function writeForm(entry) {
    const data = entry || {
      morning: { grateful: ['', '', ''], greatDay: '', affirmation: '' },
      evening: { amazing: ['', '', ''], better: '' },
    };
    $('grateful1').value = data.morning.grateful[0] || '';
    $('grateful2').value = data.morning.grateful[1] || '';
    $('grateful3').value = data.morning.grateful[2] || '';
    $('greatDay').value = data.morning.greatDay || '';
    $('affirmation').value = data.morning.affirmation || '';
    $('amazing1').value = data.evening.amazing[0] || '';
    $('amazing2').value = data.evening.amazing[1] || '';
    $('amazing3').value = data.evening.amazing[2] || '';
    $('better').value = data.evening.better || '';
  }

  function hasContent(entry) {
    if (!entry) return false;
    const m = entry.morning;
    const e = entry.evening;
    return (
      m.grateful.some(Boolean) ||
      m.greatDay ||
      m.affirmation ||
      e.amazing.some(Boolean) ||
      e.better
    );
  }

  function hasMorningContent(entry) {
    if (!entry?.morning) return false;
    const m = entry.morning;
    return m.grateful.some(Boolean) || m.greatDay || m.affirmation;
  }

  function hasEveningContent(entry) {
    if (!entry?.evening) return false;
    const e = entry.evening;
    return e.amazing.some(Boolean) || e.better;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.add('show');
    setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => { els.toast.hidden = true; }, 300);
    }, 3000);
  }

  function setSaveStatus(state, text) {
    els.saveStatus.textContent = text;
    els.saveStatus.className = `save-status ${state}`;
  }

  function updateUIForAuth(signedIn, profile) {
    if (signedIn && profile) {
      els.welcomeSection.hidden = true;
      els.journalSection.hidden = false;
      els.headerActions.hidden = false;
      els.userAvatar.src = profile.picture || '';
      els.userAvatar.alt = profile.name || '';
      els.userName.textContent = profile.name || profile.email || '';
    } else {
      els.welcomeSection.hidden = false;
      els.journalSection.hidden = true;
      els.headerActions.hidden = true;
    }
  }

  function updateDateDisplay() {
    els.currentDate.textContent = formatDisplayDate(currentDate);
    els.nextDayBtn.disabled = isToday(currentDate);
  }

  function loadDateEntry() {
    const key = formatDateKey(currentDate);
    const entry = Drive.getEntry(key);
    writeForm(entry);
    updateDateDisplay();
  }

  async function saveCurrentEntry(showMessage = true) {
    const key = formatDateKey(currentDate);
    const entry = readForm();

    if (!hasContent(entry)) {
      if (showMessage) showToast('請至少填寫一項內容');
      return false;
    }

    setSaveStatus('saving', '儲存中…');
    els.saveBtn.disabled = true;

    try {
      Drive.setEntry(key, entry);
      await Drive.saveJournal();
      setSaveStatus('saved', '已儲存至雲端硬碟');
      renderHistory();
      if (showMessage) showToast('日記已儲存至 Google 雲端硬碟');
      return true;
    } catch (err) {
      console.error(err);
      setSaveStatus('error', '儲存失敗');
      showToast(err.message || '儲存失敗，請稍後再試');
      return false;
    } finally {
      els.saveBtn.disabled = false;
    }
  }

  function scheduleAutoSave() {
    clearTimeout(saveTimeout);
    setSaveStatus('', '有未儲存的變更');
    saveTimeout = setTimeout(() => {
      if (Auth.isSignedIn()) {
        saveCurrentEntry(false);
      }
    }, 2000);
  }

  function renderHistory() {
    const entries = Drive.getAllEntries();
    const keys = Object.keys(entries).sort((a, b) => b.localeCompare(a));

    els.historyList.innerHTML = '';
    els.historyEmpty.hidden = keys.length > 0;

    keys.forEach((key) => {
      const entry = entries[key];
      const li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.date = key;

      const preview = entry.morning?.grateful?.find(Boolean)
        || entry.evening?.amazing?.find(Boolean)
        || '（無內容）';

      const badges = [];
      if (hasMorningContent(entry)) badges.push('<span class="badge badge-morning">早晨</span>');
      if (hasEveningContent(entry)) badges.push('<span class="badge badge-evening">夜晚</span>');

      const [y, m, d] = key.split('-');
      li.innerHTML = `
        <span class="history-item-date">${y}/${m}/${d}</span>
        <span class="history-item-preview">${escapeHtml(preview)}</span>
        <span class="history-item-badges">${badges.join('')}</span>
      `;
      li.addEventListener('click', () => showHistoryDetail(key, entry));
      els.historyList.appendChild(li);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showHistoryDetail(key, entry) {
    const [y, m, d] = key.split('-');
    els.historyModalTitle.textContent = `${y} 年 ${m} 月 ${d} 日`;

    const m = entry.morning;
    const e = entry.evening;

    els.historyModalBody.innerHTML = `
      <div class="history-detail-section">
        <h3>☀️ 早晨感恩</h3>
        <p><strong>感恩：</strong></p>
        ${m.grateful.filter(Boolean).map((g) => `<p class="value">${escapeHtml(g)}</p>`).join('') || '<p class="value">（未填寫）</p>'}
        <p><strong>讓今天更美好：</strong></p>
        <p class="value">${escapeHtml(m.greatDay) || '（未填寫）'}</p>
        <p><strong>正向肯定：</strong></p>
        <p class="value">${escapeHtml(m.affirmation) || '（未填寫）'}</p>
      </div>
      <div class="history-detail-section">
        <h3>🌙 夜晚反思</h3>
        <p><strong>今日美好：</strong></p>
        ${e.amazing.filter(Boolean).map((a) => `<p class="value">${escapeHtml(a)}</p>`).join('') || '<p class="value">（未填寫）</p>'}
        <p><strong>如何更好：</strong></p>
        <p class="value">${escapeHtml(e.better) || '（未填寫）'}</p>
      </div>
    `;
    els.historyModal.showModal();
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active);
    });
    $('todayPanel').classList.toggle('active', tabName === 'today');
    $('todayPanel').hidden = tabName !== 'today';
    $('historyPanel').classList.toggle('active', tabName === 'history');
    $('historyPanel').hidden = tabName !== 'history';
    if (tabName === 'history') renderHistory();
  }

  function checkClientIdSetup() {
    const configured = hasClientId();
    els.setupNotice.hidden = configured;
    if (!configured) {
      els.clientIdInput.value = '';
    }
  }

  function openSetupModal() {
    els.clientIdInput.value = getClientId();
    els.setupModal.showModal();
  }

  async function handleSignIn() {
    if (!hasClientId()) {
      openSetupModal();
      return;
    }
    els.signInBtn.disabled = true;
    try {
      await Auth.signIn();
      await Drive.loadJournal();
      loadDateEntry();
      renderHistory();
      setSaveStatus('saved', '已連線雲端硬碟');
      showToast('登入成功！日記已從雲端硬碟載入');
    } catch (err) {
      console.error(err);
      showToast(err.message || '登入失敗');
    } finally {
      els.signInBtn.disabled = false;
    }
  }

  function handleSignOut() {
    Drive.reset();
    Auth.signOut();
    writeForm(null);
    setSaveStatus('', '');
  }

  function bindEvents() {
    els.signInBtn.addEventListener('click', handleSignIn);
    els.signOutBtn.addEventListener('click', handleSignOut);
    els.openSetupBtn.addEventListener('click', openSetupModal);

    els.saveClientIdBtn.addEventListener('click', () => {
      const id = els.clientIdInput.value.trim();
      if (!id || !id.includes('.apps.googleusercontent.com')) {
        showToast('請輸入有效的 OAuth 用戶端 ID');
        return;
      }
      setClientId(id);
      els.setupModal.close();
      els.setupNotice.hidden = true;
      showToast('設定已儲存，請點擊登入');
    });

    els.closeSetupBtn.addEventListener('click', () => els.setupModal.close());

    els.journalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCurrentEntry(true);
    });

    fieldIds.forEach((id) => {
      $(id).addEventListener('input', scheduleAutoSave);
    });

    els.prevDayBtn.addEventListener('click', () => {
      currentDate.setDate(currentDate.getDate() - 1);
      loadDateEntry();
    });

    els.nextDayBtn.addEventListener('click', () => {
      if (!isToday(currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        loadDateEntry();
      }
    });

    els.todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      loadDateEntry();
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    els.closeHistoryBtn.addEventListener('click', () => els.historyModal.close());

    els.setupModal.addEventListener('click', (e) => {
      if (e.target === els.setupModal) els.setupModal.close();
    });
    els.historyModal.addEventListener('click', (e) => {
      if (e.target === els.historyModal) els.historyModal.close();
    });
  }

  function init() {
    try {
      checkClientIdSetup();
      bindEvents();
      updateDateDisplay();

      Auth.init(async ({ signedIn, profile, error }) => {
        if (error) {
          showToast('登入失敗：' + error);
          return;
        }
        updateUIForAuth(signedIn, profile);
        if (signedIn) {
          try {
            await Drive.loadJournal();
            loadDateEntry();
            renderHistory();
            setSaveStatus('saved', '已連線雲端硬碟');
          } catch (err) {
            showToast('載入日記失敗：' + err.message);
          }
        }
      });
    } catch (err) {
      console.error(err);
      showToast('應用程式初始化失敗：' + err.message);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
