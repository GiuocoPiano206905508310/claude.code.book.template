import * as THREE from './vendor/three.module.min.js';

/*
 * 錯視迷宮の勇者 -- movement + camera prototype (roadmap step 2).
 *
 * This is a deliberately small test floor, not Stage 1 itself: a plaza, one
 * north wall, and a ceiling, just enough surface to prove out camera-relative
 * movement and the gravity-face reversal mechanic in a real browser before
 * building the full dungeon geometry (roadmap step 6).
 */

// ---------- gravity faces ----------
// Each face names which way is "down" for the hero while standing on it, plus
// the reachable bounds on that surface so movement can be clamped without a
// full physics/collision system yet.
const GRAVITY_FACES = {
  floor: {
    down: new THREE.Vector3(0, -1, 0),
    bounds: { min: new THREE.Vector3(-6, 0, -6), max: new THREE.Vector3(6, 0, 6) },
    label: '床',
  },
  wallNorth: {
    down: new THREE.Vector3(0, 0, -1),
    bounds: { min: new THREE.Vector3(-6, 0.5, -18), max: new THREE.Vector3(6, 9.5, -18) },
    label: '北の壁',
  },
  ceiling: {
    down: new THREE.Vector3(0, 1, 0),
    bounds: { min: new THREE.Vector3(-6, 18, -6), max: new THREE.Vector3(6, 18, 6) },
    label: '天井',
  },
};
const GRAVITY_CYCLE = ['floor', 'wallNorth', 'ceiling'];

// ---------- renderer / scene / lights ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe0ee);
scene.fog = new THREE.Fog(0xbfe0ee, 28, 60);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xfff6da, 0x3a4438, 0.9));
const sun = new THREE.DirectionalLight(0xfff0cf, 1.1);
sun.position.set(8, 14, 6);
scene.add(sun);

// ---------- test floor geometry ----------
const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc5, roughness: 0.9 });
const stoneMatDark = new THREE.MeshStandardMaterial({ color: 0xc9bfa3, roughness: 0.9 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xc7902f, roughness: 0.4, metalness: 0.3 });

const colliders = [];

function addBlock(w, h, d, x, y, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  colliders.push(mesh);
  return mesh;
}

addBlock(50, 1, 50, 0, -0.5, 0, stoneMat);        // floor, top surface at y = 0
addBlock(50, 19, 1, 0, 9.5, -18.5, stoneMatDark); // north wall, inner face at z = -18
addBlock(50, 1, 50, 0, 18.5, 0, stoneMatDark);    // ceiling, underside at y = 18

const goalMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), goldMat);
goalMarker.position.set(4, 0.35, 4);
scene.add(goalMarker);

// A simple contact trap: red-brown, sits flush with the floor, deals damage
// once per entry. Stand-in for the "罠" damage source until real hazards
// (falling rocks, crumbling floor) exist in roadmap step 6.
const trapMat = new THREE.MeshStandardMaterial({ color: 0x9c4a3c, roughness: 0.85 });
const trap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.8), trapMat);
trap.position.set(-3, 0.06, -2.5);
scene.add(trap);

// ---------- player ----------
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.7, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0xeee7d6, roughness: 0.7 }),
);
body.position.y = 0.9;
player.add(body);

const cape = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.9, 0.12),
  new THREE.MeshStandardMaterial({ color: 0x2e6b60, roughness: 0.8 }),
);
cape.position.set(0, 0.85, 0.32); // sits on the hero's back, marking facing direction
player.add(cape);

const shield = new THREE.Mesh(
  new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16),
  goldMat,
);
shield.rotation.z = Math.PI / 2;
shield.position.set(-0.4, 0.85, 0);
player.add(shield);

// Gold ring that appears while a guard charm is active, per the design doc's
// "防御膜" (defense membrane) visual for the shield item.
const shieldRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.04, 8, 32),
  new THREE.MeshStandardMaterial({ color: 0xe0b95f, emissive: 0xe0b95f, emissiveIntensity: 0.6, roughness: 0.3 }),
);
shieldRing.rotation.x = Math.PI / 2;
shieldRing.position.y = 0.05;
shieldRing.visible = false;
player.add(shieldRing);

// Sword: a pivot at the shoulder so a swing is just one rotation to animate.
const swordPivot = new THREE.Group();
swordPivot.position.set(0.4, 0.9, 0);
player.add(swordPivot);
const swordBlade = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.5, 0.06),
  new THREE.MeshStandardMaterial({ color: 0xdfe6e4, metalness: 0.6, roughness: 0.3 }),
);
swordBlade.position.y = 0.25;
swordPivot.add(swordBlade);

player.position.set(0, 0, 2);
scene.add(player);

// ---------- camera rig: fixed 90-degree steps around the player ----------
const cameraRig = {
  yaw: 45,
  targetYaw: 45,
  startYaw: 45,
  elapsed: 0,
  duration: 0.35,
  rotating: false,
  distance: 10,
  height: 8,
  pitch: 42,
};

function rotateCameraBy(deltaDegrees) {
  if (cameraRig.rotating) return;
  cameraRig.startYaw = cameraRig.yaw;
  cameraRig.targetYaw = cameraRig.yaw + deltaDegrees;
  cameraRig.elapsed = 0;
  cameraRig.rotating = true;
}

// Builds a stable right/forward basis perpendicular to an arbitrary "up"
// vector, so the camera rig can orbit correctly no matter which gravity face
// the hero is currently standing on (world Y is not always "up").
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_FORWARD = new THREE.Vector3(0, 0, 1);
function orbitBasis(up) {
  const seed = Math.abs(up.dot(WORLD_UP)) > 0.9 ? WORLD_FORWARD : WORLD_UP;
  const right = new THREE.Vector3().crossVectors(seed, up).normalize();
  const forward = new THREE.Vector3().crossVectors(up, right).normalize();
  return { right, forward };
}

function updateCamera(dt) {
  if (cameraRig.rotating) {
    cameraRig.elapsed += dt;
    const t = Math.min(cameraRig.elapsed / cameraRig.duration, 1);
    const eased = t * t * (3 - 2 * t); // smoothstep
    cameraRig.yaw = THREE.MathUtils.lerp(cameraRig.startYaw, cameraRig.targetYaw, eased);
    if (t >= 1) { cameraRig.yaw = cameraRig.targetYaw; cameraRig.rotating = false; }
  }

  const yawRad = THREE.MathUtils.degToRad(cameraRig.yaw);
  const pitchRad = THREE.MathUtils.degToRad(cameraRig.pitch);

  const up = upFor(currentFaceKey);
  const { right, forward } = orbitBasis(up);
  const focus = player.position.clone().addScaledVector(up, 1);

  const horizontalDist = cameraRig.distance * Math.cos(pitchRad);
  const liftDist = cameraRig.distance * Math.sin(pitchRad) + cameraRig.height * 0.15;

  const offset = new THREE.Vector3()
    .addScaledVector(right, Math.sin(yawRad) * horizontalDist)
    .addScaledVector(forward, Math.cos(yawRad) * horizontalDist)
    .addScaledVector(up, liftDist);

  camera.position.copy(focus).add(offset);
  // Guard against the orbit basis dipping the camera below the floor when the
  // hero is on a wall face (the "forward" axis can end up world-vertical) --
  // the actual stages will use fixed, hand-picked framing instead of a fully
  // free orbit, so this is a safety net for this test floor only.
  camera.position.y = Math.max(camera.position.y, 0.15);
  camera.up.copy(up);
  camera.lookAt(focus);
}

// ---------- gravity face state ----------
let currentFaceKey = 'floor';
let shifting = false;
const shiftDuration = 0.5;
let shiftElapsed = 0;
let shiftStartPos = new THREE.Vector3();
let shiftTargetPos = new THREE.Vector3();
let shiftStartQuat = new THREE.Quaternion();
let shiftTargetQuat = new THREE.Quaternion();

const raycaster = new THREE.Raycaster();

function upFor(faceKey) {
  return GRAVITY_FACES[faceKey].down.clone().negate();
}

function setGravityFace(nextKey) {
  if (shifting || nextKey === currentFaceKey) return;

  const nextDown = GRAVITY_FACES[nextKey].down;
  const rayOrigin = player.position.clone().addScaledVector(nextDown, -3);
  raycaster.set(rayOrigin, nextDown);
  const hits = raycaster.intersectObjects(colliders, false);

  const targetPos = hits.length > 0
    ? hits[0].point.clone().addScaledVector(nextDown, -0.02)
    : player.position.clone();

  shiftStartPos.copy(player.position);
  shiftTargetPos.copy(targetPos);
  shiftStartQuat.copy(player.quaternion);
  shiftTargetQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upFor(nextKey));

  shifting = true;
  shiftElapsed = 0;
  currentFaceKey = nextKey;
  document.getElementById('face-badge').textContent = GRAVITY_FACES[nextKey].label;
}

function cycleGravityFace() {
  const idx = GRAVITY_CYCLE.indexOf(currentFaceKey);
  setGravityFace(GRAVITY_CYCLE[(idx + 1) % GRAVITY_CYCLE.length]);
}

// ---------- HP / damage ----------
// A single entry point for every damage source (traps, monsters, falling --
// whatever comes later) so invincibility, the HP bar, and game over all stay
// consistent no matter where the damage came from.
const MAX_HP = 100;
const INVINCIBLE_DURATION = 0.8;

let hp = MAX_HP;
let invincible = false;
let invincibleTimer = 0;
let gameOver = false;

const hpFillEl = document.getElementById('hp-fill');
const hpBarEl = hpFillEl.parentElement;
const hpTextEl = document.getElementById('hp-text');
const gameOverEl = document.getElementById('game-over');

function updateHpUI() {
  hpFillEl.style.width = `${(hp / MAX_HP) * 100}%`;
  hpTextEl.textContent = `${hp} / ${MAX_HP}`;
}

function flashHpBar(kind) {
  hpBarEl.classList.remove('flash-damage', 'flash-heal', 'flash-block');
  void hpBarEl.offsetWidth; // restart the CSS animation
  hpBarEl.classList.add(kind);
}

function takeDamage(amount) {
  if (invincible || gameOver || amount <= 0) return;
  if (shieldActive) {
    shieldActive = false;
    shieldRing.visible = false;
    flashHpBar('flash-block');
    invincible = true;
    invincibleTimer = INVINCIBLE_DURATION;
    return;
  }
  hp = Math.max(0, hp - amount);
  updateHpUI();
  flashHpBar('flash-damage');
  invincible = true;
  invincibleTimer = INVINCIBLE_DURATION;
  if (hp <= 0) triggerGameOver();
}

function heal(amount) {
  if (gameOver || amount <= 0) return;
  hp = Math.min(MAX_HP, hp + amount);
  updateHpUI();
  flashHpBar('flash-heal');
}

function triggerGameOver() {
  gameOver = true;
  gameOverEl.hidden = false;
}

function resetGame() {
  hp = MAX_HP;
  gameOver = false;
  invincible = false;
  invincibleTimer = 0;
  gameOverEl.hidden = true;
  updateHpUI();

  currentFaceKey = 'floor';
  document.getElementById('face-badge').textContent = GRAVITY_FACES.floor.label;
  shifting = false;
  player.position.set(0, 0, 2);
  player.quaternion.identity();

  potionCount = 0;
  shieldCount = 0;
  shieldActive = false;
  shieldRing.visible = false;
  updateInventoryUI();
  for (const c of chests) {
    c.opened = false;
    c.lidPivot.rotation.x = 0;
  }

  for (const enemy of enemies) {
    if (enemy.state === ENEMY_STATE.DEAD) scene.add(enemy.group);
    enemy.hp = enemy.maxHp;
    enemy.state = ENEMY_STATE.PATROL;
    enemy.patrolDir = 1;
    enemy.hitFlashTimer = 0;
    enemy.bodyMesh.material.emissiveIntensity = 0;
    enemy.group.position.copy(enemy.home);
    enemy.group.rotation.y = 0;
  }
}

document.getElementById('retry-btn').addEventListener('click', resetGame);
updateHpUI();

let wasInTrap = false;
function updateTrap() {
  const dx = player.position.x - trap.position.x;
  const dz = player.position.z - trap.position.z;
  const inside = currentFaceKey === 'floor' && Math.abs(dx) < 1 && Math.abs(dz) < 1;
  if (inside && !wasInTrap) takeDamage(15);
  wasInTrap = inside;
}

// ---------- chests & items ----------
// A chest is a group (base + hinged lid) plus which item it awards. Walking
// within range shows the "調べる" prompt from the UI design doc; opening it
// adds one of the two items to inventory, matching this roadmap step's
// scope (回復薬・守りの盾) rather than the full five-item chest table.
const chestBaseMat = new THREE.MeshStandardMaterial({ color: 0x233a63, roughness: 0.7 });
const chestTrimMat = new THREE.MeshStandardMaterial({ color: 0xc7902f, roughness: 0.4, metalness: 0.4 });

function createChest(x, z, itemType) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.36, 0.5), chestBaseMat);
  base.position.y = 0.18;
  group.add(base);
  const trimBand = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.52), chestTrimMat);
  trimBand.position.y = 0.06;
  group.add(trimBand);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.36, -0.25);
  group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.52), chestBaseMat);
  lid.position.set(0, 0.07, 0.25);
  lidPivot.add(lid);

  group.position.set(x, 0, z);
  scene.add(group);
  return { group, lidPivot, opened: false, itemType };
}

const chests = [
  createChest(3, -1, 'potion'),
  createChest(-1, 4, 'shield'),
];

const openingLids = [];
function animateLidOpen(chest) {
  openingLids.push({ pivot: chest.lidPivot, t: 0 });
}
function updateLids(dt) {
  for (const item of openingLids) item.t = Math.min(1, item.t + dt / 0.4);
  for (const item of openingLids) {
    const eased = item.t * item.t * (3 - 2 * item.t);
    item.pivot.rotation.x = -1.9 * eased;
  }
  for (let i = openingLids.length - 1; i >= 0; i--) {
    if (openingLids[i].t >= 1) openingLids.splice(i, 1);
  }
}

const bursts = [];
function spawnBurst(position, color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.03, 8, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  bursts.push({ mesh: ring, age: 0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    const t = b.age / 0.6;
    b.mesh.scale.setScalar(1 + t * 6);
    b.mesh.material.opacity = Math.max(0, 0.9 * (1 - t));
    if (t >= 1) {
      scene.remove(b.mesh);
      bursts.splice(i, 1);
    }
  }
}

let potionCount = 0;
let shieldCount = 0;
let shieldActive = false;

const potionCountEl = document.getElementById('potion-count');
const shieldCountEl = document.getElementById('shield-count');
function updateInventoryUI() {
  potionCountEl.textContent = potionCount;
  shieldCountEl.textContent = shieldCount;
}
updateInventoryUI();

function usePotion() {
  if (potionCount <= 0 || gameOver) return;
  potionCount--;
  heal(30);
  updateInventoryUI();
}
function useShield() {
  if (shieldCount <= 0 || gameOver || shieldActive) return;
  shieldCount--;
  shieldActive = true;
  shieldRing.visible = true;
  updateInventoryUI();
}

const examinePromptEl = document.getElementById('examine-prompt');
let nearbyChest = null;

function updateChestProximity() {
  nearbyChest = null;
  if (currentFaceKey === 'floor') {
    for (const c of chests) {
      if (c.opened) continue;
      const dx = player.position.x - c.group.position.x;
      const dz = player.position.z - c.group.position.z;
      if (Math.hypot(dx, dz) < 1.3) { nearbyChest = c; break; }
    }
  }
  examinePromptEl.hidden = !nearbyChest;
}

function tryExamine() {
  if (!nearbyChest) return;
  openChest(nearbyChest);
}

function openChest(chest) {
  chest.opened = true;
  animateLidOpen(chest);
  const color = chest.itemType === 'potion' ? 0x6fc9b3 : 0xe0b95f;
  spawnBurst(chest.group.position.clone().add(new THREE.Vector3(0, 0.4, 0)), color);
  if (chest.itemType === 'potion') potionCount++;
  else shieldCount++;
  updateInventoryUI();
  examinePromptEl.hidden = true;
}

// ---------- enemies ----------
// A small state machine (待機/巡回 -> 発見 -> 追跡 -> 攻撃 -> 撃破) shared by
// every enemy; a new monster type only needs its own factory function with
// different stats/visuals, reusing updateEnemy() as-is. Only the slime from
// the design doc is implemented here -- the other three (bat, stone guardian,
// grimoire) come later once this loop is proven out.
const ENEMY_STATE = { PATROL: 'patrol', CHASE: 'chase', ATTACK: 'attack', DEAD: 'dead' };
const DETECT_RADIUS = 3.5;
const LOSE_RADIUS = 5.5;
const ENEMY_ATTACK_RANGE = 0.8;

const slimeBodyMat = new THREE.MeshStandardMaterial({ color: 0x8fb9c4, transparent: true, opacity: 0.85, roughness: 0.6 });
const slimeCoreMat = new THREE.MeshStandardMaterial({ color: 0x7fd9c0, emissive: 0x7fd9c0, emissiveIntensity: 0.7 });

function createSlime(x, z, patrolToX, patrolToZ) {
  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), slimeBodyMat.clone());
  bodyMesh.scale.set(1, 0.7, 1);
  bodyMesh.position.y = 0.22;
  group.add(bodyMesh);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), slimeCoreMat);
  core.position.y = 0.24;
  group.add(core);

  group.position.set(x, 0, z);
  scene.add(group);

  return {
    group, bodyMesh,
    hp: 20, maxHp: 20, attackPower: 8,
    state: ENEMY_STATE.PATROL,
    home: new THREE.Vector3(x, 0, z),
    patrolTarget: new THREE.Vector3(patrolToX, 0, patrolToZ),
    patrolDir: 1,
    speed: 1.1,
    chaseSpeed: 1.8,
    hopPhase: Math.random() * 10,
    attackCooldown: 0,
    hitFlashTimer: 0,
  };
}

const enemies = [
  createSlime(1, -5, 3, -5),
  createSlime(-5, -1, -5, 2),
];

function updateEnemy(enemy, dt) {
  if (enemy.state === ENEMY_STATE.DEAD) return;

  const toPlayer = new THREE.Vector3().subVectors(player.position, enemy.group.position);
  toPlayer.y = 0;
  const dist = toPlayer.length();
  const canSeePlayer = currentFaceKey === 'floor' && !gameOver;

  if (enemy.state === ENEMY_STATE.PATROL) {
    if (canSeePlayer && dist < DETECT_RADIUS) {
      enemy.state = ENEMY_STATE.CHASE;
    } else {
      const target = enemy.patrolDir > 0 ? enemy.patrolTarget : enemy.home;
      const toTarget = new THREE.Vector3().subVectors(target, enemy.group.position);
      if (toTarget.length() < 0.15) {
        enemy.patrolDir *= -1;
      } else {
        toTarget.normalize();
        enemy.group.position.addScaledVector(toTarget, enemy.speed * dt);
      }
    }
  } else if (enemy.state === ENEMY_STATE.CHASE) {
    if (!canSeePlayer || dist > LOSE_RADIUS) {
      enemy.state = ENEMY_STATE.PATROL;
    } else if (dist < ENEMY_ATTACK_RANGE) {
      enemy.state = ENEMY_STATE.ATTACK;
      enemy.attackCooldown = 0;
    } else {
      toPlayer.normalize();
      enemy.group.position.addScaledVector(toPlayer, enemy.chaseSpeed * dt);
    }
  } else if (enemy.state === ENEMY_STATE.ATTACK) {
    enemy.attackCooldown -= dt;
    if (!canSeePlayer || dist > ENEMY_ATTACK_RANGE * 1.5) {
      enemy.state = ENEMY_STATE.CHASE;
    } else if (enemy.attackCooldown <= 0) {
      takeDamage(enemy.attackPower);
      enemy.attackCooldown = 1.0;
    }
  }

  const isMoving = enemy.state === ENEMY_STATE.PATROL || enemy.state === ENEMY_STATE.CHASE;
  if (isMoving) {
    enemy.hopPhase += dt * (enemy.state === ENEMY_STATE.CHASE ? 8 : 4);
    const hop = Math.abs(Math.sin(enemy.hopPhase));
    enemy.bodyMesh.scale.y = 0.7 + hop * 0.25;
    enemy.group.position.y = hop * 0.12;
  }
  if ((enemy.state === ENEMY_STATE.CHASE || enemy.state === ENEMY_STATE.ATTACK) && dist > 0.05) {
    enemy.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
  }

  if (enemy.hitFlashTimer > 0) {
    enemy.hitFlashTimer -= dt;
    enemy.bodyMesh.material.emissive = new THREE.Color(0xffffff);
    enemy.bodyMesh.material.emissiveIntensity = Math.max(0, enemy.hitFlashTimer / 0.15) * 0.9;
  }
}

function damageEnemy(enemy, amount) {
  if (enemy.state === ENEMY_STATE.DEAD) return;
  enemy.hp -= amount;
  enemy.hitFlashTimer = 0.15;
  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy) {
  enemy.state = ENEMY_STATE.DEAD;
  spawnBurst(enemy.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0x7fd9c0);
  scene.remove(enemy.group);
}

// ---------- hero attack ----------
const ATTACK_DAMAGE = 15;
const ATTACK_RANGE = 1.1;
const ATTACK_ARC = Math.PI * 0.7;
const ATTACK_COOLDOWN = 0.45;
const ATTACK_ANIM_DURATION = 0.25;

let attackCooldownTimer = 0;
let attackAnimTimer = 0;

function performAttack() {
  if (gameOver || attackCooldownTimer > 0) return;
  attackCooldownTimer = ATTACK_COOLDOWN;
  attackAnimTimer = ATTACK_ANIM_DURATION;

  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
  for (const enemy of enemies) {
    if (enemy.state === ENEMY_STATE.DEAD) continue;
    const toEnemy = new THREE.Vector3().subVectors(enemy.group.position, player.position);
    toEnemy.y = 0;
    const dist = toEnemy.length();
    if (dist > ATTACK_RANGE || dist < 1e-4) continue;
    toEnemy.normalize();
    if (forward.angleTo(toEnemy) < ATTACK_ARC / 2) damageEnemy(enemy, ATTACK_DAMAGE);
  }
}

function updateAttack(dt) {
  if (attackCooldownTimer > 0) attackCooldownTimer -= dt;
  if (attackAnimTimer > 0) {
    attackAnimTimer -= dt;
    const t = 1 - attackAnimTimer / ATTACK_ANIM_DURATION;
    swordPivot.rotation.x = -Math.sin(t * Math.PI) * 1.4;
  } else {
    swordPivot.rotation.x = 0;
  }
}

// ---------- input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'BracketRight') rotateCameraBy(90);
  if (e.code === 'BracketLeft') rotateCameraBy(-90);
  if (e.code === 'KeyG') cycleGravityFace();
  if (e.code === 'KeyH') takeDamage(10);
  if (e.code === 'KeyJ') heal(20);
  if (e.code === 'KeyE') tryExamine();
  if (e.code === 'KeyQ') usePotion();
  if (e.code === 'KeyR') useShield();
  if (e.code === 'Space') { e.preventDefault(); performAttack(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function moveAxis() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y += 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y -= 1;
  return { x, y };
}

// ---------- movement ----------
const moveSpeed = 3.2;
const turnLerp = 10;

function clampToFace(position, faceKey) {
  const { min, max } = GRAVITY_FACES[faceKey].bounds;
  position.x = THREE.MathUtils.clamp(position.x, min.x, max.x);
  position.y = THREE.MathUtils.clamp(position.y, min.y, max.y);
  position.z = THREE.MathUtils.clamp(position.z, min.z, max.z);
}

function updateMovement(dt) {
  const axis = moveAxis();
  const moving = axis.x !== 0 || axis.y !== 0;
  if (!moving) return;

  const planeUp = upFor(currentFaceKey);
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.projectOnPlane(planeUp).normalize();
  const camRight = new THREE.Vector3().crossVectors(camForward, planeUp).normalize();

  const direction = new THREE.Vector3()
    .addScaledVector(camForward, axis.y)
    .addScaledVector(camRight, axis.x);
  if (direction.lengthSq() < 1e-6) return;
  direction.normalize();

  player.position.addScaledVector(direction, moveSpeed * dt);
  clampToFace(player.position, currentFaceKey);

  const lookTarget = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone(),
  );
  // Keep the hero's "up" aligned with the current surface while turning to
  // face the movement direction.
  const up = upFor(currentFaceKey);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), direction.clone().negate(), up);
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
  player.quaternion.slerp(targetQuat, Math.min(1, turnLerp * dt));
}

function updateGravityShift(dt) {
  if (!shifting) return;
  shiftElapsed += dt;
  const t = Math.min(shiftElapsed / shiftDuration, 1);
  const eased = t * t * (3 - 2 * t);
  player.position.lerpVectors(shiftStartPos, shiftTargetPos, eased);
  player.quaternion.slerpQuaternions(shiftStartQuat, shiftTargetQuat, eased);
  if (t >= 1) shifting = false;
}

// ---------- resize ----------
function resize() {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- main loop ----------
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!shifting && !gameOver) updateMovement(dt);
  if (!gameOver) {
    updateGravityShift(dt);
    updateTrap();
    updateChestProximity();
    for (const enemy of enemies) updateEnemy(enemy, dt);
  }
  updateAttack(dt);
  updateLids(dt);
  updateBursts(dt);
  updateCamera(dt);

  if (shieldActive) shieldRing.rotation.z += dt * 1.5;

  if (invincible) {
    invincibleTimer -= dt;
    body.material.opacity = 0.35 + 0.65 * (Math.sin(invincibleTimer * 40) * 0.5 + 0.5);
    body.material.transparent = true;
    if (invincibleTimer <= 0) {
      invincible = false;
      body.material.opacity = 1;
      body.material.transparent = false;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
