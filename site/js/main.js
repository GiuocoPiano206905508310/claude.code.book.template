/* ==================================================================
   ページの最小限の動き
   1. 事務所の共通情報の反映
   2. スマホ用メニューの開閉
   3. お問い合わせフォーム(準備中)
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

  /* ---------- 3. お問い合わせフォーム(準備中) ----------
     【ここを後で差し替える】フォームの送信先を設定したら、このブロック全体
     (ここから「準備中ここまで」まで)を削除してください。
     現在は送信ボタンを押しても何も送信せず、「現在は準備中です」と表示します。 */
  var form = document.querySelector('.contact-form[data-form-status="preparing"]');
  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var message = form.querySelector('.form-message');
      message.textContent = '現在は準備中です。';
      message.classList.add('is-visible');
    });
  }
  /* 準備中ここまで */
})();
