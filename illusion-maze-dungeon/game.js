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

// ---------- input ----------
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'BracketRight') rotateCameraBy(90);
  if (e.code === 'BracketLeft') rotateCameraBy(-90);
  if (e.code === 'KeyG') cycleGravityFace();
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

  if (!shifting) updateMovement(dt);
  updateGravityShift(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
