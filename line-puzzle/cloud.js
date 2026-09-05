/* ============================================================
   ラインパズル — アカウントと進行状況のクラウド保存
   給与・勤怠システムと同じ Supabase プロジェクトを使う。

   ・登録: ユーザー名 / メールアドレス / パスワード
   ・ログイン: メールアドレス + パスワード
     （メールが本人確認の宛先になるので、パスワード再設定メールが使える）
   ・進行状況は line_puzzle_progress テーブルに1ユーザー1行で置く

   supabase-js は 200KB あり、この一枚のゲームには重いので使わない。
   必要なのは「登録・ログイン・トークン更新・1行の読み書き」だけなので、
   fetch で直接 REST を叩いている。

   window.LinePuzzleCloud として公開する。
   ============================================================ */
(function () {
  'use strict';

  // anon キーは行レベルセキュリティ(RLS)を前提に公開される設計のキーで、
  // クライアントに含めてよい。service_role キーは絶対に置かないこと。
  var URL_BASE = 'https://bvokxhtmgfeevfpfafqk.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2b2t4aHRtZ2ZlZXZmcGZhZnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTcxNzUsImV4cCI6MjEwMDA5MzE3NX0.qI5hA2ZV85ZpxFVCqZ5J46PciYa8udCRev3RQcJfWTM';
  var TABLE = 'line_puzzle_progress';
  var SESSION_KEY = 'linePuzzle.session.v1';

  // テストや別プロジェクトへの差し替え用
  if (window.LINE_PUZZLE_SUPABASE) {
    URL_BASE = window.LINE_PUZZLE_SUPABASE.url || URL_BASE;
    ANON_KEY = window.LINE_PUZZLE_SUPABASE.anonKey || ANON_KEY;
  }

  var session = null;   // { access_token, refresh_token, expires_at, user }

  /* ---------- セッションの保存（この端末） ---------- */

  function loadSession() {
    try {
      var raw = window.localStorage.getItem(SESSION_KEY);
      var s = raw ? JSON.parse(raw) : null;
      if (s && s.access_token && s.user && s.user.id) return s;
    } catch (e) { /* 読めなければ未ログイン扱い */ }
    return null;
  }

  function storeSession(s) {
    session = s;
    try {
      if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* 保存できなくてもこのセッション中は動く */ }
  }

  function shapeSession(data) {
    if (!data || !data.access_token) return null;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      // 期限の30秒手前で切れた扱いにして、ぎりぎりの失敗を避ける
      expires_at: Date.now() + Math.max(0, (data.expires_in || 3600) - 30) * 1000,
      user: {
        id: data.user ? data.user.id : '',
        email: data.user ? data.user.email : '',
        username: userName(data.user)
      }
    };
  }

  function userName(user) {
    if (!user) return '';
    var m = user.user_metadata || {};
    return m.username || (user.email || '').split('@')[0];
  }

  /* ---------- 通信 ---------- */

  function request(path, opts) {
    opts = opts || {};
    var headers = { apikey: ANON_KEY, 'Content-Type': 'application/json' };
    if (opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;

    return window.fetch(URL_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text }; } }
        if (!res.ok) throw apiError(res.status, data);
        return data;
      });
    }, function () {
      throw new Error('通信に失敗しました。電波の届く場所でもう一度お試しください。');
    });
  }

  // Supabase のエラーを日本語の案内に置き換える
  function apiError(status, data) {
    var raw = (data && (data.error_description || data.msg || data.message ||
                        data.error_description || data.error)) || '';
    var low = String(raw).toLowerCase();
    var msg;
    if (low.indexOf('invalid login credentials') >= 0) {
      msg = 'メールアドレスかパスワードが違います。';
    } else if (low.indexOf('email not confirmed') >= 0) {
      msg = 'メールの確認がまだ済んでいません。届いたメールのリンクを開いてください。';
    } else if (low.indexOf('already registered') >= 0 || low.indexOf('already exists') >= 0 ||
               status === 422 && low.indexOf('user') >= 0 && low.indexOf('exist') >= 0) {
      msg = 'このメールアドレスはすでに登録されています。';
    } else if (low.indexOf('password should be') >= 0 || low.indexOf('password') >= 0 && status === 422) {
      msg = 'パスワードは6文字以上にしてください。';
    } else if (low.indexOf('invalid email') >= 0 || low.indexOf('unable to validate email') >= 0) {
      msg = 'メールアドレスの形式が正しくありません。';
    } else if (low.indexOf('for security purposes') >= 0 || status === 429) {
      msg = '短い間に何度も試されました。少し待ってからお試しください。';
    } else if (status === 404 || low.indexOf('does not exist') >= 0 ||
               low.indexOf('schema cache') >= 0) {
      msg = '保存用のテーブルが見つかりません。管理者に連絡してください。';
    } else {
      msg = raw || ('エラーが発生しました（' + status + '）');
    }
    var e = new Error(msg);
    e.status = status;
    return e;
  }

  // 期限が切れていればトークンを更新してから使う
  function withToken() {
    if (!session) return Promise.reject(new Error('ログインしていません'));
    if (Date.now() < session.expires_at) return Promise.resolve(session.access_token);
    if (!session.refresh_token) { storeSession(null); return Promise.reject(new Error('ログインの有効期限が切れました')); }
    return request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refresh_token }
    }).then(function (data) {
      var s = shapeSession(data);
      if (!s) throw new Error('ログインの有効期限が切れました');
      // 更新レスポンスに user が無いことがあるので、分かっている分は引き継ぐ
      if (!s.user.id) s.user = session.user;
      storeSession(s);
      return s.access_token;
    }, function (e) {
      storeSession(null);
      throw e;
    });
  }

  /* ---------- 公開する操作 ---------- */

  // メールのリンクから戻ってくる先。Supabase の
  // Authentication → URL Configuration → Redirect URLs に登録しておく必要がある
  function redirectTo() {
    return window.location.origin + window.location.pathname;
  }
  function withRedirect(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') +
           'redirect_to=' + encodeURIComponent(redirectTo());
  }

  function checkName(name) {
    name = String(name || '').trim();
    if (name.length < 2 || name.length > 20) {
      throw new Error('ユーザー名は2〜20文字にしてください。');
    }
    return name;
  }

  function signUp(username, email, password) {
    var name;
    try { name = checkName(username); } catch (e) { return Promise.reject(e); }
    return request(withRedirect('/auth/v1/signup'), {
      method: 'POST',
      body: { email: String(email || '').trim(), password: password, data: { username: name } }
    }).then(function (data) {
      // 確認メールを送る設定のとき、すでに登録済みのメールでも Supabase は
      // 成功のような形で返す（他人のメールが登録済みかを外から調べられないため）。
      // その場合は identities が空で返るので、それで見分ける。
      if (data && data.identities && data.identities.length === 0) {
        throw new Error('このメールアドレスはすでに登録されています。ログインしてください。');
      }
      var s = shapeSession(data);
      if (s) { storeSession(s); return { session: s, needsConfirm: false }; }
      // 確認メールが必要な設定のときは、ここではまだログインできない
      return { session: null, needsConfirm: true };
    });
  }

  /* ---------- 登録済みのアカウントを変える ---------- */

  function updateUser(body, needsRedirect) {
    return withToken().then(function (token) {
      var path = needsRedirect ? withRedirect('/auth/v1/user') : '/auth/v1/user';
      return request(path, { method: 'PUT', token: token, body: body });
    }).then(function (data) {
      // 変更が即時に効くもの（ユーザー名・パスワード）は手元の情報も更新する
      if (session && data && data.id) {
        session.user.username = userName(data) || session.user.username;
        session.user.email = data.email || session.user.email;
        storeSession(session);
      }
      return data;
    });
  }

  function changeName(username) {
    var name;
    try { name = checkName(username); } catch (e) { return Promise.reject(e); }
    return updateUser({ data: { username: name } }, false).then(function () { return name; });
  }

  // メールアドレスの変更は、新しいアドレス宛の確認メールが済むまで反映されない
  function changeEmail(email) {
    return updateUser({ email: String(email || '').trim() }, true).then(function () { return true; });
  }

  function changePassword(password) {
    if (String(password || '').length < 6) {
      return Promise.reject(new Error('パスワードは6文字以上にしてください。'));
    }
    return updateUser({ password: password }, false).then(function () { return true; });
  }

  function signIn(email, password) {
    return request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: String(email || '').trim(), password: password }
    }).then(function (data) {
      var s = shapeSession(data);
      if (!s) throw new Error('ログインできませんでした。');
      storeSession(s);
      return s;
    });
  }

  function sendReset(email) {
    return request(withRedirect('/auth/v1/recover'), {
      method: 'POST', body: { email: String(email || '').trim() }
    }).then(function () { return true; });
  }

  /* ---------- メールのリンクから戻ってきたとき ----------
     Supabase は確認できたら
       …/line-puzzle/#access_token=…&refresh_token=…&type=signup
     の形で戻してくる（失敗時は #error_description=… ）。
     ここでその # を読み取ってログイン状態にし、URL からは消す。
     type は signup（新規登録の確認）/ recovery（パスワード再設定）/
     email_change（メールアドレス変更の確認）。 */
  function readAuthRedirect() {
    var hash = window.location.hash || '';
    if (hash.length < 2 || hash.indexOf('=') < 0) return null;
    var q = {};
    hash.slice(1).split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i > 0) q[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });
    if (!q.access_token && !q.error_description && !q.error) return null;

    // 同じリンクを二度処理しないよう、URL から # を落とす
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) { window.location.hash = ''; }

    if (!q.access_token) {
      var msg = q.error_description || q.error || '';
      if (/expired/i.test(msg)) msg = 'このリンクは期限切れです。もう一度お試しください。';
      else if (/invalid/i.test(msg)) msg = 'このリンクは使えません。もう一度お試しください。';
      return { type: q.type || 'error', error: msg || 'リンクを確認できませんでした。' };
    }
    var s = shapeSession({
      access_token: q.access_token, refresh_token: q.refresh_token,
      expires_in: parseInt(q.expires_in, 10) || 3600, user: null
    });
    storeSession(s);
    // リンクの # にはユーザー情報が入っていないので、改めて取りに行く
    return { type: q.type || 'signup', session: s, pending: fetchUser() };
  }

  function fetchUser() {
    return withToken().then(function (token) {
      return request('/auth/v1/user', { token: token });
    }).then(function (data) {
      if (session && data && data.id) {
        session.user = { id: data.id, email: data.email || '', username: userName(data) };
        storeSession(session);
      }
      return session ? session.user : null;
    });
  }

  function signOut() {
    var token = session && session.access_token;
    storeSession(null);
    if (!token) return Promise.resolve();
    // 手元のログイン状態はすでに消してあるので、失敗しても支障はない
    return request('/auth/v1/logout', { method: 'POST', token: token, body: {} })
      .then(function () { return true; }, function () { return true; });
  }

  // クラウドに保存されている進行状況。まだ無ければ null
  function fetchProgress() {
    return withToken().then(function (token) {
      var q = '/rest/v1/' + TABLE + '?select=progress&user_id=eq.' + encodeURIComponent(session.user.id);
      return request(q, { token: token });
    }).then(function (rows) {
      if (!rows || !rows.length) return null;
      var p = rows[0].progress;
      return (p && typeof p === 'object') ? p : null;
    });
  }

  function saveProgress(progress) {
    return withToken().then(function (token) {
      return request('/rest/v1/' + TABLE + '?on_conflict=user_id', {
        method: 'POST',
        token: token,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: [{ user_id: session.user.id, progress: progress, updated_at: new Date().toISOString() }]
      });
    }).then(function () { return true; });
  }

  session = loadSession();

  window.LinePuzzleCloud = {
    user: function () { return session ? session.user : null; },
    signedIn: function () { return !!session; },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    sendReset: sendReset,
    changeName: changeName,
    changeEmail: changeEmail,
    changePassword: changePassword,
    readAuthRedirect: readAuthRedirect,
    fetchProgress: fetchProgress,
    saveProgress: saveProgress
  };
})();
