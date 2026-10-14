/* Кабинет супер-админа: вход по паролю, список заявок, статус и заметка.
 * Внутренний инструмент — только русский, без i18n сайта. */
(function () {
  'use strict';

  const STATUS_LABELS = {
    all: 'Все',
    new: 'Новые',
    in_progress: 'В работе',
    done: 'Закрытые',
    spam: 'Спам'
  };

  const PROJECT_TYPES = {
    mvp: 'MVP',
    saas: 'SaaS',
    marketplace: 'Маркетплейс',
    admin: 'Админ-панель',
    automation: 'Автоматизация',
    ai: 'AI-интеграция',
    other: 'Другое'
  };

  const MAIL_LABELS = {
    sent: 'Письмо ушло',
    failed: 'Письмо не ушло',
    dry_run: 'Тестовый режим',
    pending: 'Письмо не отправлено'
  };

  const AUTO_REFRESH_MS = 60 * 1000;
  const DESCRIPTION_CLAMP = 280;

  const els = {
    topbarActions: document.getElementById('topbarActions'),
    refreshBtn: document.getElementById('refreshBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginView: document.getElementById('loginView'),
    loginForm: document.getElementById('loginForm'),
    password: document.getElementById('password'),
    loginError: document.getElementById('loginError'),
    loginBtn: document.getElementById('loginBtn'),
    disabledView: document.getElementById('disabledView'),
    leadsView: document.getElementById('leadsView'),
    statusTabs: document.getElementById('statusTabs'),
    searchInput: document.getElementById('searchInput'),
    loadError: document.getElementById('loadError'),
    leadList: document.getElementById('leadList'),
    template: document.getElementById('leadTemplate')
  };

  const state = {
    leads: [],
    filter: 'all',
    query: '',
    loaded: false,
    refreshTimer: null
  };

  // ─── API ───

  class AuthError extends Error {}

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }, options));
    let payload = {};
    try { payload = await response.json(); } catch (_) { /* пустой или не-JSON ответ */ }
    if (response.status === 401) throw new AuthError(payload.message || 'Not authenticated');
    if (!response.ok) {
      const error = new Error(payload.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function sendJson(path, method, body) {
    return api(path, {
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  // ─── Экраны ───

  function showView(name) {
    els.loginView.hidden = name !== 'login';
    els.disabledView.hidden = name !== 'disabled';
    els.leadsView.hidden = name !== 'leads';
    els.topbarActions.hidden = name !== 'leads';
    if (name === 'login') {
      stopAutoRefresh();
      els.password.focus();
    }
  }

  async function boot() {
    try {
      const session = await api('/api/admin/session');
      if (session.authenticated) {
        openLeads();
      } else {
        showView('login');
      }
    } catch (error) {
      if (error.status === 503) {
        showView('disabled');
        return;
      }
      showView('login');
      els.loginError.textContent = 'Сервер не отвечает. Обновите страницу через минуту.';
    }
  }

  function openLeads() {
    showView('leads');
    renderSkeleton();
    loadLeads();
    startAutoRefresh();
  }

  // ─── Вход и выход ───

  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = els.password.value;
    if (!password) {
      els.loginError.textContent = 'Введите пароль.';
      return;
    }
    els.loginBtn.disabled = true;
    els.loginError.textContent = '';
    try {
      await sendJson('/api/admin/login', 'POST', { password });
      els.password.value = '';
      openLeads();
    } catch (error) {
      if (error instanceof AuthError) {
        els.loginError.textContent = 'Пароль не подошёл.';
      } else if (error.status === 429) {
        els.loginError.textContent = 'Слишком много неудачных попыток. Попробуйте через 15 минут.';
      } else {
        els.loginError.textContent = 'Не получилось войти: сервер не ответил. Попробуйте ещё раз.';
      }
      els.password.select();
    } finally {
      els.loginBtn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    try { await sendJson('/api/admin/logout', 'POST', {}); } catch (_) { /* выходим в любом случае */ }
    state.leads = [];
    state.loaded = false;
    showView('login');
  });

  // ─── Загрузка ───

  async function loadLeads() {
    els.refreshBtn.disabled = true;
    try {
      const payload = await api('/api/admin/leads');
      state.leads = payload.leads || [];
      state.loaded = true;
      els.loadError.hidden = true;
      render();
    } catch (error) {
      if (error instanceof AuthError) {
        showView('login');
        return;
      }
      els.loadError.textContent = 'Не удалось загрузить заявки. Нажмите «Обновить» или зайдите позже.';
      els.loadError.hidden = false;
      if (!state.loaded) els.leadList.replaceChildren();
    } finally {
      els.refreshBtn.disabled = false;
    }
  }

  els.refreshBtn.addEventListener('click', loadLeads);

  function startAutoRefresh() {
    stopAutoRefresh();
    state.refreshTimer = setInterval(() => {
      // Не перерисовываем список, пока админ печатает заметку
      const typing = document.activeElement && document.activeElement.classList.contains('lead-note');
      if (!document.hidden && !typing) loadLeads();
    }, AUTO_REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  // ─── Фильтры ───

  function countByStatus() {
    const counts = { all: state.leads.length, new: 0, in_progress: 0, done: 0, spam: 0 };
    state.leads.forEach((lead) => {
      if (counts[lead.status] !== undefined) counts[lead.status] += 1;
    });
    return counts;
  }

  function renderTabs() {
    const counts = countByStatus();
    els.statusTabs.replaceChildren(...Object.keys(STATUS_LABELS).map((key) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(state.filter === key));
      tab.dataset.filter = key;
      const label = document.createElement('span');
      label.textContent = STATUS_LABELS[key];
      const count = document.createElement('span');
      count.className = 'tab-count';
      count.textContent = counts[key];
      tab.append(label, count);
      return tab;
    }));
  }

  els.statusTabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    state.filter = tab.dataset.filter;
    render();
  });

  els.searchInput.addEventListener('input', () => {
    state.query = els.searchInput.value.trim().toLowerCase();
    renderList();
  });

  function getVisibleLeads() {
    return state.leads.filter((lead) => {
      if (state.filter !== 'all' && lead.status !== state.filter) return false;
      if (!state.query) return true;
      return [lead.contact, lead.description, lead.note, lead.projectType]
        .some((value) => String(value || '').toLowerCase().includes(state.query));
    });
  }

  // ─── Список ───

  function render() {
    renderTabs();
    renderList();
  }

  function renderSkeleton() {
    els.leadList.replaceChildren(...[0, 1, 2].map(() => {
      const item = document.createElement('li');
      item.className = 'lead lead-skeleton';
      item.setAttribute('aria-hidden', 'true');
      item.innerHTML = '<span></span><span></span><span></span>';
      return item;
    }));
  }

  function renderList() {
    const visible = getVisibleLeads();
    if (!visible.length) {
      els.leadList.replaceChildren(renderEmpty());
      return;
    }
    els.leadList.replaceChildren(...visible.map(renderLead));
  }

  function renderEmpty() {
    const item = document.createElement('li');
    item.className = 'empty';
    const title = document.createElement('p');
    title.className = 'empty-title';
    const hint = document.createElement('p');
    if (!state.leads.length) {
      title.textContent = 'Заявок пока нет';
      hint.textContent = 'Они появятся здесь сразу, как только кто-то отправит форму на сайте.';
    } else if (state.query) {
      title.textContent = 'Ничего не нашлось';
      hint.textContent = 'Поиск идёт по контакту, тексту заявки и заметке.';
    } else {
      title.textContent = `В разделе «${STATUS_LABELS[state.filter]}» пусто`;
      hint.textContent = 'Статус меняется в правом столбце у каждой заявки.';
    }
    item.append(title, hint);
    return item;
  }

  const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
  const dayYearFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

  // «14 окт. 17:16»; год пишем, только если он не текущий
  function formatDate(value) {
    const date = new Date(value);
    const day = date.getFullYear() === new Date().getFullYear() ? dayFormat : dayYearFormat;
    return `${day.format(date)} ${timeFormat.format(date)}`;
  }

  function renderContact(container, contact) {
    const value = String(contact || '').trim();
    let href = null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) href = `mailto:${value}`;
    else if (/^@[A-Za-z0-9_]{4,}$/.test(value)) href = `https://t.me/${value.slice(1)}`;
    else if (/^https?:\/\/(t\.me|wa\.me)\//i.test(value)) href = value;
    else if (/^\+?[\d\s()-]{7,}$/.test(value)) href = `tel:${value.replace(/[^\d+]/g, '')}`;

    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = value;
      if (href.startsWith('http')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      container.replaceChildren(link);
    } else {
      container.textContent = value;
    }
  }

  function renderLead(lead) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.id = lead.id;
    node.dataset.status = lead.status;

    const date = node.querySelector('.lead-date');
    date.dateTime = lead.createdAt;
    date.textContent = formatDate(lead.createdAt);

    node.querySelector('.lead-type').textContent = PROJECT_TYPES[lead.projectType] || lead.projectType || 'Тип не выбран';

    const mailStatus = (lead.mail && lead.mail.status) || 'pending';
    const badge = node.querySelector('.mail-badge');
    badge.textContent = MAIL_LABELS[mailStatus] || mailStatus;
    badge.dataset.mail = mailStatus;
    if (lead.mail && lead.mail.error) badge.title = lead.mail.error;

    renderContact(node.querySelector('.lead-contact'), lead.contact);

    const description = node.querySelector('.lead-description');
    const more = node.querySelector('.lead-more');
    const full = String(lead.description || '');
    if (full.length > DESCRIPTION_CLAMP) {
      description.textContent = `${full.slice(0, DESCRIPTION_CLAMP).trimEnd()}…`;
      more.hidden = false;
      more.addEventListener('click', () => {
        description.textContent = full;
        more.hidden = true;
      });
    } else {
      description.textContent = full;
    }

    const select = node.querySelector('.lead-status');
    const saveState = node.querySelector('.save-state');
    select.value = lead.status;
    select.addEventListener('change', () => saveLead(lead, { status: select.value }, saveState, () => {
      select.value = lead.status;
    }));

    const note = node.querySelector('.lead-note');
    note.value = lead.note || '';
    autoGrow(note);
    note.addEventListener('input', () => autoGrow(note));
    note.addEventListener('blur', () => {
      if (note.value.trim() === (lead.note || '')) return;
      saveLead(lead, { note: note.value }, saveState, () => { note.value = lead.note || ''; });
    });

    return node;
  }

  function autoGrow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  async function saveLead(lead, changes, saveState, rollback) {
    saveState.textContent = 'Сохраняю…';
    saveState.dataset.state = 'pending';
    try {
      const payload = await sendJson(`/api/admin/leads/${lead.id}`, 'PATCH', changes);
      Object.assign(lead, payload.lead);
      saveState.textContent = 'Сохранено';
      saveState.dataset.state = 'ok';
      // Счётчики во вкладках меняются вместе со статусом; заявку из чужой вкладки не прячем сразу
      if (changes.status) renderTabs();
      const item = saveState.closest('.lead');
      if (item) item.dataset.status = lead.status;
    } catch (error) {
      if (error instanceof AuthError) {
        showView('login');
        return;
      }
      rollback();
      saveState.textContent = 'Не сохранилось';
      saveState.dataset.state = 'error';
    }
  }

  boot();
})();
