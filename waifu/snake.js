/* dayroom 贪吃蛇小游戏（看板娘工具菜单） */
(function () {
  const ID = 'dayroom-snake';
  const GRID = 20;        // 网格 20x20
  const CELL = 20;        // 每格 20px
  const SIZE = GRID * CELL; // 400px
  let animId = null;
  let lastTime = 0;
  let interval = 0;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let score = 0;
  let paused = false;
  let over = false;
  let keyHandler = null;
  let rootEl = null;
  let canvas = null;
  let ctx = null;
  let scoreEl = null;
  let statusEl = null;

  function buildUI() {
    rootEl = document.createElement('div');
    rootEl.id = ID;
    rootEl.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(3px)',
      'font-family:inherit'
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:rgba(15,15,18,0.97)', 'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:16px', 'padding:20px 24px', 'text-align:center',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '🐍 贪吃蛇';
    title.style.cssText = 'font-size:18px;font-weight:600;color:#fff;margin-bottom:4px';

    const hint = document.createElement('div');
    hint.textContent = '方向键/WASD 移动 · 空格 暂停 · Esc 退出';
    hint.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:12px';

    const scoreRow = document.createElement('div');
    scoreRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;color:rgba(255,255,255,0.85)';
    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = '得分';
    scoreEl = document.createElement('span');
    scoreEl.id = ID + '-score';
    scoreEl.textContent = '0';
    scoreEl.style.cssText = 'font-weight:700;color:#ffd54a;font-size:16px';
    scoreRow.appendChild(scoreLabel);
    scoreRow.appendChild(scoreEl);

    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText = 'display:block;border-radius:8px;background:#0b0e17';

    statusEl = document.createElement('div');
    statusEl.id = ID + '-status';
    statusEl.style.cssText = 'margin-top:10px;font-size:12px;color:rgba(255,255,255,0.55);min-height:18px';

    panel.appendChild(title);
    panel.appendChild(hint);
    panel.appendChild(scoreRow);
    panel.appendChild(canvas);
    panel.appendChild(statusEl);
    rootEl.appendChild(panel);
    document.body.appendChild(rootEl);
    ctx = canvas.getContext('2d');
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler, true);
      keyHandler = null;
    }
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    rootEl = null;
    canvas = null;
    ctx = null;
  }

  function reset() {
    snake = [];
    for (let i = 2; i >= 0; i--) snake.push({ x: i, y: Math.floor(GRID / 2) });
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    paused = false;
    over = false;
    interval = 140;
    lastTime = 0;
    scoreEl.textContent = '0';
    statusEl.textContent = '';
    spawnFood();
  }

  function spawnFood() {
    for (;;) {
      const f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; return; }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
    }
    // 食物
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    // 蛇
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a';
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // 撞墙
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) { gameOver(); return; }
    // 撞自己
    if (snake.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = String(score);
      if (interval > 70) interval -= 3;
      spawnFood();
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    over = true;
    statusEl.innerHTML = '💀 游戏结束 · 得分 <b>' + score + '</b> · 按 空格 再来一局 · Esc 退出';
  }

  function loop(t) {
    if (!ctx) return;
    if (paused || over) {
      animId = requestAnimationFrame(loop);
      return;
    }
    if (lastTime === 0) lastTime = t;
    const dt = t - lastTime;
    if (dt >= interval) {
      lastTime = t;
      step();
      draw();
    }
    animId = requestAnimationFrame(loop);
  }

  function start() {
    if (document.getElementById(ID)) { destroy(); }
    buildUI();
    reset();
    keyHandler = function (e) {
      const k = e.key;
      const map = {
        ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
        W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 }
      };
      if (map[k]) {
        // capture 阶段拦截：防止网站音乐快捷键（空格/上下方向键）被误触发
        e.preventDefault();
        e.stopImmediatePropagation();
        const nd = map[k];
        // 禁止原地掉头
        if (nd.x !== -dir.x || nd.y !== -dir.y) nextDir = nd;
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (over) { reset(); lastTime = 0; }
        else paused = !paused;
        return;
      }
      if (k === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        destroy();
      }
    };
    // 用 capture 阶段注册，先于网站全局快捷键（冒泡阶段）执行
    document.addEventListener('keydown', keyHandler, true);
    draw();
    animId = requestAnimationFrame(loop);
  }

  window.SnakeGame = { start: start, destroy: destroy };
  // 脚本加载后立即启动（懒加载模式）
  start();
})();
