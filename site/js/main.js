/* ==================================================================
   ページの最小限の動き
   1. 事務所の共通情報の反映
   2. スマホ用メニューの開閉
   3. お問合せ／初回無料相談の切り替え
   4. ご予約希望日時(カレンダー+時間帯)
   5. ご面会方法「訪問」の訪問先住所
   6. 送信前のチェック(予約希望日時)
   7. お問合せフォーム(準備中)
   ================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  /* ---------- 1. 事務所の共通情報の反映 ----------
     index.html の <head> 内「事務所の共通情報」(id="office-info")の内容を、
     data-office="name" などが付いた場所に入れます。ここは編集不要です。 */
  var info = {};
  var infoEl = document.getElementById('office-info');
  if (infoEl) {
    try {
      info = JSON.parse(infoEl.textContent);
    } catch (e) {
      console.error('事務所の共通情報の書き方に誤りがあります(, や " が消えていないか確認してください)', e);
    }
  }

  document.querySelectorAll('[data-office]').forEach(function (el) {
    var value = info[el.getAttribute('data-office')];
    if (!value) return;
    el.textContent = value;
    // 電話番号はタップで発信できるリンクにする
    if (el.getAttribute('data-office-link') === 'tel') {
      el.setAttribute('href', 'tel:' + value.replace(/[^0-9+]/g, ''));
    }
  });

  /* ---------- 2. スマホ用メニューの開閉 ---------- */
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('global-nav');

  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle-label').textContent = open ? '閉じる' : 'メニュー';
    nav.classList.toggle('is-open', open);
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // メニュー内のリンクを押したら閉じる
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    // Escキーで閉じる
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  var form = document.querySelector('.contact-form');
  if (!form) return;
  var formMessage = form.querySelector('.form-message');

  function showMessage(text) {
    formMessage.textContent = text;
    formMessage.classList.toggle('is-visible', Boolean(text));
  }

  /* ---------- 3. お問合せ／初回無料相談の切り替え ----------
     data-mode-only="inquiry"(お問合せ)/"consult"(初回無料相談)が付いた部分を出し分けます。
     隠れている側の項目は送信されず、必須チェックもされません。 */
  var modeNames = { inquiry: 'お問合せ', consult: '初回無料相談' };
  var modeButtons = document.querySelectorAll('[data-mode-button]');

  function setMode(mode) {
    modeButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-mode-button') === mode));
    });
    document.querySelectorAll('#contact [data-mode-only]').forEach(function (el) {
      var active = el.getAttribute('data-mode-only') === mode;
      el.hidden = !active;
      if (el.tagName === 'FIELDSET') el.disabled = !active;
    });
    form.elements.form_type.value = modeNames[mode];
    showMessage('');
  }

  modeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setMode(button.getAttribute('data-mode-button'));
    });
  });

  /* ---------- 4. ご予約希望日時(カレンダー+時間帯) ----------
     選べる曜日・時間帯・期間は、index.html の「事務所の共通情報」の "reservation" で設定します。ここは編集不要です。 */
  var rv = Object.assign({
    firstHour: 9, lastHour: 17, closedWeekdays: [0, 6], closedDates: [], daysFromToday: 1, daysAhead: 60
  }, info.reservation || {});
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function timeLabel(h) { return h + ':00〜' + (h + 1) + ':00'; }
  function dateLabel(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WEEK[d.getDay()] + ')'; }

  var today = startOfDay(new Date());
  var minDate = addDays(today, rv.daysFromToday);
  var maxDate = addDays(today, rv.daysFromToday + rv.daysAhead);

  function isSelectable(d) {
    return d >= minDate && d <= maxDate &&
      rv.closedWeekdays.indexOf(d.getDay()) === -1 &&
      rv.closedDates.indexOf(ymd(d)) === -1;
  }

  var slots = [];
  var closeOtherSlots = function (current) {
    slots.forEach(function (slot) { if (slot !== current) slot.close(); });
  };

  function createSlot(root) {
    var n = root.getAttribute('data-slot');
    var input = root.querySelector('input[type="hidden"]');
    var state = { date: null, hour: null, month: new Date(minDate.getFullYear(), minDate.getMonth(), 1) };

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'slot-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'slot-panel-' + n);
    toggle.setAttribute('aria-describedby', 'slot-label-' + n);

    var panel = document.createElement('div');
    panel.className = 'slot-panel';
    panel.id = 'slot-panel-' + n;
    panel.hidden = true;
    panel.innerHTML =
      '<div class="cal">' +
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-cal="prev" aria-label="前の月">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<p class="cal-title" aria-live="polite"></p>' +
          '<button type="button" class="cal-nav" data-cal="next" aria-label="次の月">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
        '<div class="cal-week" aria-hidden="true">' + WEEK.map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
        '<div class="cal-grid"></div>' +
      '</div>' +
      '<div class="times">' +
        '<p class="times-title">時間帯</p>' +
        '<p class="times-hint">先に日付を選択してください</p>' +
        '<div class="times-list"></div>' +
      '</div>';

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'slot-clear';
    clear.textContent = '取消';
    clear.setAttribute('aria-label', '第' + n + '候補を取り消す');

    var head = document.createElement('div');
    head.className = 'slot-head';
    head.appendChild(toggle);
    head.appendChild(clear);
    root.appendChild(head);
    root.appendChild(panel);

    var calTitle = panel.querySelector('.cal-title');
    var calGrid = panel.querySelector('.cal-grid');
    var timesList = panel.querySelector('.times-list');
    var prevBtn = panel.querySelector('[data-cal="prev"]');
    var nextBtn = panel.querySelector('[data-cal="next"]');

    function renderToggle() {
      if (state.date && state.hour !== null) {
        toggle.textContent = dateLabel(state.date) + ' ' + timeLabel(state.hour);
        toggle.classList.add('is-filled');
      } else if (state.date) {
        toggle.textContent = dateLabel(state.date) + '(時間帯を選択)';
        toggle.classList.remove('is-filled');
      } else {
        toggle.textContent = '日時を選択';
        toggle.classList.remove('is-filled');
      }
      clear.hidden = !state.date;
      input.value = state.date && state.hour !== null ? ymd(state.date) + ' ' + timeLabel(state.hour) : '';
      root.classList.remove('is-error');
    }

    function renderCalendar() {
      var y = state.month.getFullYear();
      var m = state.month.getMonth();
      calTitle.textContent = y + '年' + (m + 1) + '月';
      prevBtn.disabled = new Date(y, m, 1) <= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      nextBtn.disabled = new Date(y, m + 1, 1) > maxDate;

      var html = '';
      var firstDay = new Date(y, m, 1).getDay();
      for (var i = 0; i < firstDay; i++) html += '<span></span>';
      var last = new Date(y, m + 1, 0).getDate();
      for (var day = 1; day <= last; day++) {
        var d = new Date(y, m, day);
        var selected = state.date && ymd(d) === ymd(state.date);
        html += '<button type="button" class="cal-day' + (selected ? ' is-selected' : '') + '" data-date="' + ymd(d) + '"' +
          (isSelectable(d) ? '' : ' disabled') + ' aria-pressed="' + Boolean(selected) + '"' +
          ' aria-label="' + (m + 1) + '月' + day + '日(' + WEEK[d.getDay()] + ')">' + day + '</button>';
      }
      calGrid.innerHTML = html;
    }

    function renderTimes() {
      var html = '';
      for (var h = rv.firstHour; h <= rv.lastHour; h++) {
        var selected = state.hour === h;
        html += '<button type="button" class="time-option' + (selected ? ' is-selected' : '') + '" data-hour="' + h + '"' +
          (state.date ? '' : ' disabled') + ' aria-pressed="' + selected + '">' + timeLabel(h) + '</button>';
      }
      timesList.innerHTML = html;
      timesList.classList.toggle('is-waiting', !state.date);
      panel.querySelector('.times-hint').hidden = Boolean(state.date);
    }

    prevBtn.addEventListener('click', function () {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
      renderCalendar();
    });
    nextBtn.addEventListener('click', function () {
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
      renderCalendar();
    });

    calGrid.addEventListener('click', function (event) {
      var btn = event.target.closest('.cal-day');
      if (!btn || btn.disabled) return;
      var p = btn.getAttribute('data-date').split('-');
      state.date = new Date(+p[0], +p[1] - 1, +p[2]);
      renderCalendar();
      renderTimes();
      renderToggle();
      var focusTarget = timesList.querySelector('.is-selected') || timesList.querySelector('.time-option');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });

    timesList.addEventListener('click', function (event) {
      var btn = event.target.closest('.time-option');
      if (!btn || btn.disabled) return;
      state.hour = +btn.getAttribute('data-hour');
      renderTimes();
      renderToggle();
      api.close();
      toggle.focus();
    });

    toggle.addEventListener('click', function () {
      if (panel.hidden) api.open(); else api.close();
    });

    clear.addEventListener('click', function () {
      state.date = null;
      state.hour = null;
      renderCalendar();
      renderTimes();
      renderToggle();
      toggle.focus();
    });

    var api = {
      root: root,
      input: input,
      toggle: toggle,
      open: function () {
        closeOtherSlots(api);
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        var sel = timesList.querySelector('.is-selected');
        timesList.scrollTop = sel ? Math.max(0, sel.offsetTop - timesList.offsetTop - 40) : 0;
      },
      close: function () {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
      }
    };

    renderCalendar();
    renderTimes();
    renderToggle();
    return api;
  }

  document.querySelectorAll('.slot[data-slot]').forEach(function (root) {
    slots.push(createSlot(root));
  });

  /* ---------- 5. ご面会方法「訪問」の訪問先住所 ----------
     「訪問」を選ぶと訪問先住所の欄が出ます。ご住所が入力済みなら自動でコピーします。 */
  var visitBox = form.querySelector('.visit-address');
  var visitInput = form.querySelector('#contact-visit-address');
  var addressInput = form.querySelector('#contact-address');

  if (visitBox && visitInput && addressInput) {
    form.querySelectorAll('input[name="meeting_method"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        var isVisit = form.querySelector('input[name="meeting_method"]:checked').value === '訪問';
        visitBox.hidden = !isVisit;
        visitInput.disabled = !isVisit;
        if (isVisit && !visitInput.value && addressInput.value.trim()) {
          visitInput.value = addressInput.value.trim();
        }
      });
    });
    form.querySelector('[data-visit="copy"]').addEventListener('click', function () {
      visitInput.value = addressInput.value.trim();
      visitInput.focus();
    });
    form.querySelector('[data-visit="clear"]').addEventListener('click', function () {
      visitInput.value = '';
      visitInput.focus();
    });
  }

  /* ---------- 6. 送信前のチェック(予約希望日時) ----------
     通常の入力欄の必須チェックはブラウザが行います。ここでは予約希望日時の3候補をチェックします。
     (送信先を設定した後も、このブロックは残してください) */
  form.addEventListener('submit', function (event) {
    var consult = form.querySelector('[data-mode-only="consult"]');
    if (!consult || consult.disabled) return;

    var error = '';
    var errorSlot = null;
    var seen = {};
    slots.forEach(function (slot, i) {
      if (error) return;
      var value = slot.input.value;
      if (!value) {
        error = '第' + (i + 1) + '候補の日時(日付と時間帯)を選択してください。';
        errorSlot = slot;
      } else if (seen[value]) {
        error = '第' + (i + 1) + '候補が第' + seen[value] + '候補と同じ日時です。別の日時を選択してください。';
        errorSlot = slot;
      } else {
        seen[value] = i + 1;
      }
    });

    if (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMessage(error);
      errorSlot.root.classList.add('is-error');
      errorSlot.toggle.focus();
    }
  });

  /* ---------- 7. お問合せフォーム(準備中) ----------
     【ここを後で差し替える】フォームの送信先を設定したら、このブロック全体
     (ここから「準備中ここまで」まで)を削除してください。
     現在は送信ボタンを押しても何も送信せず、「現在は準備中です」と表示します。 */
  if (form.getAttribute('data-form-status') === 'preparing') {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showMessage('現在は準備中です。');
    });
  }
  /* 準備中ここまで */
})();
