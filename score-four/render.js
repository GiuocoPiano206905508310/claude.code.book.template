/* ============================================================
   立体四目並べ — 3D描画とカメラ操作・入力判定
   THREE.js のシーン構築、コマの落下アニメーション、勝利演出、
   ドラッグ回転・ホイール/ピンチズーム、棒のタップ判定を受け持つ。

   window.ScoreFourRender として公開する。
   ゲームの手番管理は main.js 側が持ち、ここでは
   「タップされた柱 (x,y) を伝える」「コマを描く」だけを行う。
   ============================================================ */
(function () {
  'use strict';

  var Game = window.ScoreFourGame;
  var N = Game.N;

  var SPACING = 0.66;
  var LEVEL_H = 0.5;
  var BALL_R = 0.225;
  var PEG_R = 0.05;
  var PEG_TIP_R = PEG_R * 1.05;
  var PEG_TIP_H = 0.11;
  var TOPBALL_SURFACE = (N - 1) * LEVEL_H + BALL_R * 2;
  var PEG_H = TOPBALL_SURFACE + 0.018;
  var BASE_SIZE = SPACING * 4 + 0.5;

  var scene, camera, renderer, raycaster, ndc;
  var TARGET = new THREE.Vector3(0, 0.7, 0);
  var colliders = [];
  var hoverRings = [];
  var ballMeshes;
  var p1Mat, p2Mat, ballGeo;
  var tweens = [];
  var winLineObj = null;
  var winMeshes = [];
  var pulseClock = 0;
  var hoveredKey = null;
  var interactionEnabled = true;

  var api = {
    onColumnTap: null,   // function(x, y)
    onColumnHover: null  // function(x, y | null)
  };

  function gx(x) { return (x - 1.5) * SPACING; }
  function gz(y) { return (y - 1.5) * SPACING; }
  function gy(z) { return z * LEVEL_H + BALL_R; }

  var BACKGROUNDS = {
    dark: { bg: 0x17130f, fogNear: 7, fogFar: 15, hemiSky: 0x6b5a3e, hemiGround: 0x0c0906, hemiI: 0.65, ambI: 0.22, keyI: 1.15 },
    // 環境光を強くすると、白玉のような明るい色は陰影がほぼ消えて平坦に見えるため、
    // ホワイト背景では環境光を弱め、方向のあるキーライトで立体感を出す
    light: { bg: 0xf2e9d5, fogNear: 8, fogFar: 17, hemiSky: 0xffffff, hemiGround: 0xcabf9e, hemiI: 0.45, ambI: 0.08, keyI: 1.5 }
  };
  var hemiLight, ambientLight, keyLight;

  // 金属の映り込み用の簡易スタジオ環境マップ（HDRI無しでも金属らしい陰影を出す）
  function buildStudioEnvMap() {
    var size = 128;
    function grad(c1, c2, vertical) {
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      var g = vertical ? ctx.createLinearGradient(0, 0, 0, size) : ctx.createLinearGradient(0, 0, size, 0);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return canvas;
    }
    var images = [
      grad('#d7dade', '#9aa0a6', false),
      grad('#9aa0a6', '#d7dade', false),
      grad('#fbfcfc', '#e6e8ea', true),
      grad('#5b5f63', '#3c3f42', true),
      grad('#c9ccd0', '#a7abb0', false),
      grad('#a7abb0', '#c9ccd0', false)
    ];
    var tex = new THREE.CubeTexture(images);
    tex.needsUpdate = true;
    return tex;
  }

  function setBackground(mode) {
    var t = BACKGROUNDS[mode] || BACKGROUNDS.dark;
    if (document.body) document.body.classList.toggle('theme-light', mode === 'light');
    if (!scene) return;
    scene.background = new THREE.Color(t.bg);
    scene.fog = new THREE.Fog(t.bg, t.fogNear, t.fogFar);
    hemiLight.color = new THREE.Color(t.hemiSky);
    hemiLight.groundColor = new THREE.Color(t.hemiGround);
    hemiLight.intensity = t.hemiI;
    ambientLight.intensity = t.ambI;
    keyLight.intensity = t.keyI;
  }

  function init(container) {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 描画開始後にWebGLが落ちた場合、無反応な黒画面のまま気づけないのを避ける
    renderer.domElement.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      var box = document.getElementById('boot-error');
      var msg = document.getElementById('boot-error-msg');
      if (box && msg) { msg.textContent = '3D描画が途中で止まりました。再読み込みしてください。'; box.style.display = 'flex'; }
    });

    hemiLight = new THREE.HemisphereLight(0x6b5a3e, 0x0c0906, 0.65);
    scene.add(hemiLight);
    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    keyLight = new THREE.DirectionalLight(0xffe9c2, 1.15);
    keyLight.position.set(3.2, 6, 2.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -3; keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3; keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.camera.far = 14;
    keyLight.shadow.bias = -0.002;
    scene.add(keyLight);
    var rim = new THREE.DirectionalLight(0xc9982f, 0.35);
    rim.position.set(-3, 2, -3);
    scene.add(rim);
    setBackground('dark');

    var envMap = buildStudioEnvMap();

    var steelMat = new THREE.MeshStandardMaterial({ color: 0x868b90, roughness: 0.42, metalness: 0.85, envMap: envMap, envMapIntensity: 1.3 });
    var steelTopMat = new THREE.MeshStandardMaterial({ color: 0xa2a7ac, roughness: 0.38, metalness: 0.85, envMap: envMap, envMapIntensity: 1.3 });
    var base = new THREE.Mesh(new THREE.BoxGeometry(BASE_SIZE, 0.24, BASE_SIZE), steelMat);
    base.position.y = -0.12;
    base.receiveShadow = true;
    scene.add(base);
    var baseTop = new THREE.Mesh(new THREE.BoxGeometry(BASE_SIZE - 0.16, 0.03, BASE_SIZE - 0.16), steelTopMat);
    baseTop.position.y = 0.015;
    baseTop.receiveShadow = true;
    scene.add(baseTop);

    var pegMat = new THREE.MeshStandardMaterial({ color: 0xaeb3b8, roughness: 0.32, metalness: 0.88, envMap: envMap, envMapIntensity: 1.4 });
    var colliderMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    var hoverMat = new THREE.MeshBasicMaterial({ color: 0xe8b94a, transparent: true, opacity: 0.55, side: THREE.DoubleSide });

    p1Mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.22, metalness: 0.05,
      clearcoat: 0.6, clearcoatRoughness: 0.12,
      envMap: envMap, envMapIntensity: 0.5
    });
    p2Mat = new THREE.MeshPhysicalMaterial({
      color: 0x2a1d12, roughness: 0.28, metalness: 0.05,
      clearcoat: 0.6, clearcoatRoughness: 0.12,
      envMap: envMap, envMapIntensity: 0.5
    });
    ballGeo = new THREE.SphereGeometry(BALL_R, 28, 20);

    ballMeshes = Array.from({ length: N }, function () {
      return Array.from({ length: N }, function () { return Array(N).fill(null); });
    });

    for (var x = 0; x < N; x++) {
      for (var y = 0; y < N; y++) {
        var px = gx(x), pz = gz(y);

        var peg = new THREE.Mesh(new THREE.CylinderGeometry(PEG_R, PEG_R * 1.15, PEG_H, 14), pegMat);
        peg.position.set(px, PEG_H / 2, pz);
        peg.castShadow = true;
        scene.add(peg);

        var tip = new THREE.Mesh(new THREE.ConeGeometry(PEG_TIP_R, PEG_TIP_H, 12), pegMat);
        tip.position.set(px, PEG_H + PEG_TIP_H / 2, pz);
        tip.castShadow = true;
        scene.add(tip);

        var collider = new THREE.Mesh(new THREE.CylinderGeometry(SPACING * 0.42, SPACING * 0.42, PEG_H + 0.4, 10), colliderMat);
        collider.position.set(px, (PEG_H + 0.4) / 2, pz);
        collider.userData = { x: x, y: y };
        scene.add(collider);
        colliders.push(collider);

        var ring = new THREE.Mesh(new THREE.RingGeometry(SPACING * 0.24, SPACING * 0.32, 24), hoverMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(px, 0.032, pz);
        ring.visible = false;
        scene.add(ring);
        hoverRings.push(ring);
      }
    }

    initCamera();
    initPointer();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(animate);
  }

  /* ---- カメラ操作（ドラッグ回転・ホイール／ピンチズーム） ---- */

  var MIN_PHI = 0.06, MAX_PHI = 1.5;
  var MIN_R = 2.6, MAX_R = 8;
  var theta = Math.PI * 0.28;
  var phi = 0.62;
  var radius = MAX_R;

  function updateCamera() {
    var sp = Math.sin(phi), cp = Math.cos(phi);
    camera.position.set(
      TARGET.x + radius * sp * Math.sin(theta),
      TARGET.y + radius * cp,
      TARGET.z + radius * sp * Math.cos(theta)
    );
    camera.lookAt(TARGET);
  }

  function initCamera() { updateCamera(); }

  var pointers = new Map();
  var dragging = false, dragMoved = false, lastX = 0, lastY = 0;
  var pinchStartDist = 0, pinchStartRadius = 0;

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function initPointer() {
    raycaster = new THREE.Raycaster();
    ndc = new THREE.Vector2();
    var el = renderer.domElement;

    el.addEventListener('pointerdown', function (e) {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = true; dragMoved = false;
        lastX = e.clientX; lastY = e.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        var pts = Array.from(pointers.values());
        pinchStartDist = dist(pts[0], pts[1]);
        pinchStartRadius = radius;
      }
    });

    el.addEventListener('pointermove', function (e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var d = dist(pts[0], pts[1]);
        if (pinchStartDist > 0) {
          radius = Math.min(MAX_R, Math.max(MIN_R, pinchStartRadius * (pinchStartDist / d)));
          updateCamera();
        }
        return;
      }

      if (dragging) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.hypot(dx, dy) > 3) dragMoved = true;
        theta -= dx * 0.006;
        phi = Math.min(MAX_PHI, Math.max(MIN_PHI, phi - dy * 0.006));
        lastX = e.clientX; lastY = e.clientY;
        updateCamera();
      } else {
        updateHover(e.clientX, e.clientY);
      }
    });

    function endPointer(e) {
      var wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStartDist = 0;
      if (wasSingle && dragging) {
        dragging = false;
        if (!dragMoved) handleTap(e.clientX, e.clientY);
      }
      if (pointers.size === 0) dragging = false;
    }
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      radius = Math.min(MAX_R, Math.max(MIN_R, radius + e.deltaY * 0.0025));
      updateCamera();
    }, { passive: false });
  }

  function pickColumn(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(colliders);
    return hits.length ? hits[0].object.userData : null;
  }

  function updateHover(clientX, clientY) {
    if (!interactionEnabled) { setHoverRing(null); return; }
    setHoverRing(pickColumn(clientX, clientY));
  }

  function setHoverRing(col) {
    var key = col ? col.x + '_' + col.y : null;
    if (key === hoveredKey) return;
    hoveredKey = key;
    for (var i = 0; i < hoverRings.length; i++) hoverRings[i].visible = false;
    if (col) {
      var idx = col.x * N + col.y;
      var full = Game.getDropZ(currentBoardRef(), col.x, col.y) === -1;
      hoverRings[idx].visible = !full;
    }
    if (api.onColumnHover) api.onColumnHover(col);
  }

  function handleTap(clientX, clientY) {
    if (!interactionEnabled) return;
    var col = pickColumn(clientX, clientY);
    if (!col) return;
    if (api.onColumnTap) api.onColumnTap(col.x, col.y);
  }

  // ホバー時に「その柱が満杯か」を見るための、現在の盤面参照
  var boardRef = null;
  function currentBoardRef() { return boardRef || Game.createBoard(); }
  function setBoardRef(board) { boardRef = board; }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---- 落下アニメーション ---- */

  function easeOutBounce(t) {
    var n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  }

  function placeBall(x, y, z, player, onDone) {
    var mat = player === 1 ? p1Mat : p2Mat;
    var mesh = new THREE.Mesh(ballGeo, mat);
    var px = gx(x), pz = gz(y);
    var startY = PEG_H + BALL_R + 0.15;
    var endY = gy(z);
    mesh.position.set(px, startY, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    ballMeshes[x][y][z] = mesh;

    var duration = 420 + z * 90;
    tweens.push({ mesh: mesh, startY: startY, endY: endY, start: performance.now(), duration: duration, onComplete: onDone });
  }

  function removeBall(x, y, z) {
    var mesh = ballMeshes[x][y][z];
    if (mesh) { scene.remove(mesh); ballMeshes[x][y][z] = null; }
  }

  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      var t = Math.min(1, (now - tw.start) / tw.duration);
      var e = easeOutBounce(t);
      tw.mesh.position.y = tw.startY + (tw.endY - tw.startY) * e;
      if (t >= 1) {
        tw.mesh.position.y = tw.endY;
        tweens.splice(i, 1);
        if (tw.onComplete) tw.onComplete();
      }
    }
  }

  /* ---- 勝利演出 ---- */

  function highlightWin(line) {
    var pts = [];
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      var mesh = ballMeshes[c[0]][c[1]][c[2]];
      mesh.userData.winning = true;
      winMeshes.push(mesh);
      pts.push(mesh.position.clone());
    }
    var curve = new THREE.CatmullRomCurve3(pts);
    var tubeGeo = new THREE.TubeGeometry(curve, 24, 0.035, 8, false);
    var tubeMat = new THREE.MeshStandardMaterial({ color: 0xe8b94a, emissive: 0xc9982f, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 });
    winLineObj = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(winLineObj);
  }

  function clearWinHighlight() {
    for (var i = 0; i < winMeshes.length; i++) winMeshes[i].userData.winning = false;
    winMeshes = [];
    if (winLineObj) { scene.remove(winLineObj); winLineObj = null; }
  }

  function clearBoard() {
    for (var x = 0; x < N; x++) for (var y = 0; y < N; y++) for (var z = 0; z < N; z++) removeBall(x, y, z);
    tweens.length = 0;
    clearWinHighlight();
    setHoverRing(null);
  }

  function setInteractionEnabled(enabled) {
    interactionEnabled = enabled;
    if (!enabled) setHoverRing(null);
  }

  function animate(now) {
    requestAnimationFrame(animate);
    stepTweens(now);
    pulseClock += 0.016;
    if (winMeshes.length) {
      var s = 1 + Math.sin(pulseClock * 4) * 0.08;
      for (var i = 0; i < winMeshes.length; i++) winMeshes[i].scale.setScalar(s);
    }
    for (var j = 0; j < hoverRings.length; j++) {
      if (hoverRings[j].visible) hoverRings[j].material.opacity = 0.4 + Math.sin(pulseClock * 5) * 0.15;
    }
    renderer.render(scene, camera);
  }

  window.ScoreFourRender = Object.assign(api, {
    init: init,
    placeBall: placeBall,
    removeBall: removeBall,
    clearBoard: clearBoard,
    highlightWin: highlightWin,
    clearWinHighlight: clearWinHighlight,
    setInteractionEnabled: setInteractionEnabled,
    setBoardRef: setBoardRef,
    setBackground: setBackground
  });
})();
