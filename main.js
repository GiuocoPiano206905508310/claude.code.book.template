const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const messageEl = document.getElementById('message');

const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_WIDTH = 52;
const BRICK_HEIGHT = 18;
const BRICK_PADDING = 6;
const BRICK_OFFSET_TOP = 30;
const BRICK_OFFSET_LEFT = 16;

const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 10;
const BALL_RADIUS = 6;

let score = 0;
let lives = 3;
let running = true;

const paddle = {
  x: (canvas.width - PADDLE_WIDTH) / 2,
  y: canvas.height - PADDLE_HEIGHT - 10,
  dx: 0,
  speed: 6,
};

const ball = {
  x: canvas.width / 2,
  y: paddle.y - BALL_RADIUS,
  dx: 3,
  dy: -3,
};

const bricks = [];
for (let c = 0; c < BRICK_COLS; c++) {
  bricks[c] = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    bricks[c][r] = { x: 0, y: 0, alive: true };
  }
}

const rightPressed = { value: false };
const leftPressed = { value: false };

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'Right') rightPressed.value = true;
  else if (e.key === 'ArrowLeft' || e.key === 'Left') leftPressed.value = true;
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'Right') rightPressed.value = false;
  else if (e.key === 'ArrowLeft' || e.key === 'Left') leftPressed.value = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const relativeX = e.clientX - rect.left;
  if (relativeX > 0 && relativeX < canvas.width) {
    paddle.x = relativeX - PADDLE_WIDTH / 2;
  }
});

function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = paddle.y - BALL_RADIUS;
  ball.dx = 3 * (Math.random() < 0.5 ? -1 : 1);
  ball.dy = -3;
  paddle.x = (canvas.width - PADDLE_WIDTH) / 2;
}

function drawBricks() {
  for (let c = 0; c < BRICK_COLS; c++) {
    for (let r = 0; r < BRICK_ROWS; r++) {
      const brick = bricks[c][r];
      if (!brick.alive) continue;
      const x = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT;
      const y = r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP;
      brick.x = x;
      brick.y = y;
      ctx.fillStyle = `hsl(${r * 45}, 70%, 55%)`;
      ctx.fillRect(x, y, BRICK_WIDTH, BRICK_HEIGHT);
    }
  }
}

function drawPaddle() {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(paddle.x, paddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);
}

function drawBall() {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd93d';
  ctx.fill();
  ctx.closePath();
}

function collideBricks() {
  for (let c = 0; c < BRICK_COLS; c++) {
    for (let r = 0; r < BRICK_ROWS; r++) {
      const brick = bricks[c][r];
      if (!brick.alive) continue;
      if (
        ball.x > brick.x &&
        ball.x < brick.x + BRICK_WIDTH &&
        ball.y > brick.y &&
        ball.y < brick.y + BRICK_HEIGHT
      ) {
        ball.dy = -ball.dy;
        brick.alive = false;
        score += 10;
        scoreEl.textContent = score;
        if (bricks.every((col) => col.every((b) => !b.alive))) {
          endGame(true);
        }
      }
    }
  }
}

function update() {
  if (rightPressed.value) paddle.x += paddle.speed;
  if (leftPressed.value) paddle.x -= paddle.speed;
  paddle.x = Math.max(0, Math.min(canvas.width - PADDLE_WIDTH, paddle.x));

  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x - BALL_RADIUS < 0 || ball.x + BALL_RADIUS > canvas.width) {
    ball.dx = -ball.dx;
  }
  if (ball.y - BALL_RADIUS < 0) {
    ball.dy = -ball.dy;
  }

  if (
    ball.y + BALL_RADIUS > paddle.y &&
    ball.y - BALL_RADIUS < paddle.y + PADDLE_HEIGHT &&
    ball.x > paddle.x &&
    ball.x < paddle.x + PADDLE_WIDTH
  ) {
    ball.dy = -Math.abs(ball.dy);
    const hitPos = (ball.x - paddle.x) / PADDLE_WIDTH - 0.5;
    ball.dx = hitPos * 6;
  }

  if (ball.y - BALL_RADIUS > canvas.height) {
    lives -= 1;
    livesEl.textContent = lives;
    if (lives <= 0) {
      endGame(false);
    } else {
      resetBall();
    }
  }

  collideBricks();
}

function endGame(won) {
  running = false;
  messageEl.textContent = won ? 'クリア！おめでとうございます！' : 'ゲームオーバー';
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBricks();
  drawPaddle();
  drawBall();
}

function loop() {
  if (!running) return;
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
