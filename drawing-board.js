(function () {
  const canvas = document.getElementById('drawing-board');
  const ctx = canvas.getContext('2d');
  const statusBar = document.getElementById('status-bar');

  let isDrawing = false;
  let penColor = '#000000';
  let penSize = 5;
  let opacity = 1;
  let currentTool = 'pen';
  let startX = 0, startY = 0;
  let snapshot = null;
  let undoStack = [];
  const MAX_UNDO = 30;

  const COLORS = [
    '#000000','#ffffff','#6b7280','#d1d5db',
    '#ef4444','#f97316','#f59e0b','#eab308',
    '#22c55e','#10b981','#14b8a6','#06b6d4',
    '#3b82f6','#6366f1','#8b5cf6','#a855f7',
    '#ec4899','#f43f5e','#84cc16','#0ea5e9',
    '#dc2626','#b45309','#065f46','#1e3a5f',
    '#fde68a','#bbf7d0','#bfdbfe','#fce7f3',
    '#7f1d1d','#1e40af','#14532d','#4c1d95'
  ];

  // --- Palette ---
  const swatchRow = document.getElementById('swatches');
  const curSwatch = document.getElementById('cur-color-swatch');

  function selectColor(c) {
    penColor = c;
    curSwatch.style.background = c;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    const match = document.querySelector(`.swatch[data-color="${c}"]`);
    if (match) match.classList.add('selected');
    if (currentTool === 'eraser') setTool('pen');
    updateStatus();
  }

  COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.dataset.color = c;
    btn.style.background = c;
    btn.title = c;
    btn.addEventListener('click', () => selectColor(c));
    swatchRow.appendChild(btn);
  });

  document.getElementById('custom-color').addEventListener('input', function () {
    selectColor(this.value);
  });

  selectColor('#000000');

  // --- Tools ---
  const toolButtons = {
    pen: document.getElementById('btn-pen'),
    eraser: document.getElementById('btn-eraser'),
    line: document.getElementById('btn-line'),
    rect: document.getElementById('btn-rect'),
    circle: document.getElementById('btn-circle'),
    fill: document.getElementById('btn-fill'),
  };

  function setTool(tool) {
    currentTool = tool;
    Object.entries(toolButtons).forEach(([name, btn]) => {
      btn.classList.toggle('active', name === tool);
    });
    canvas.style.cursor = tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : 'crosshair';
    updateStatus();
  }

  Object.entries(toolButtons).forEach(([name, btn]) => {
    btn.addEventListener('click', () => setTool(name));
  });

  // --- Size & Opacity ---
  const penSizeSlider = document.getElementById('pen-size');
  const sizeVal = document.getElementById('size-val');
  penSizeSlider.addEventListener('input', function () {
    penSize = parseInt(this.value);
    sizeVal.textContent = penSize;
    updateStatus();
  });

  const opacitySlider = document.getElementById('opacity-slider');
  const opacityVal = document.getElementById('opacity-val');
  opacitySlider.addEventListener('input', function () {
    opacity = parseFloat(this.value);
    opacityVal.textContent = Math.round(opacity * 100) + '%';
  });

  // --- Undo ---
  function saveState() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    const img = new Image();
    img.src = prev;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  });

  // --- Clear ---
  document.getElementById('btn-clear').addEventListener('click', () => {
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // --- Download ---
  document.getElementById('btn-download').addEventListener('click', () => {
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = canvas.width;
    tmpCanvas.height = canvas.height;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.fillStyle = '#ffffff';
    tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    tmpCtx.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = 'edraw.png';
    link.href = tmpCanvas.toDataURL('image/png');
    link.click();
  });

  // --- Drawing ---
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    saveState();
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    if (currentTool === 'fill') {
      floodFill(Math.round(startX), Math.round(startY), penColor);
      isDrawing = false;
      return;
    }
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const x = pos.x;
    const y = pos.y;

    ctx.globalAlpha = opacity;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'pen') {
      ctx.strokeStyle = penColor;
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (currentTool === 'eraser') {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = penColor;
      ctx.fillStyle = penColor;
      ctx.beginPath();
      if (currentTool === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (currentTool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY);
      } else if (currentTool === 'circle') {
        const rx = Math.abs(x - startX) / 2;
        const ry = Math.abs(y - startY) / 2;
        const cx = startX + (x - startX) / 2;
        const cy = startY + (y - startY) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    ctx.globalAlpha = 1;
    ctx.beginPath();
  }

  // --- Flood Fill ---
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return [r, g, b, 255];
  }

  function colorsMatch(a, b, tolerance) {
    return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) + Math.abs(a[3]-b[3]) <= tolerance;
  }

  function floodFill(x, y, fillColorHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;
    const fillColor = hexToRgb(fillColorHex);
    const idx = (y * w + x) * 4;
    const target = [data[idx], data[idx+1], data[idx+2], data[idx+3]];
    if (colorsMatch(target, fillColor, 10)) return;

    const stack = [[x, y]];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      const i = cy * w + cx;
      if (visited[i]) continue;
      const pi = i * 4;
      if (!colorsMatch([data[pi],data[pi+1],data[pi+2],data[pi+3]], target, 30)) continue;
      visited[i] = 1;
      data[pi] = fillColor[0];
      data[pi+1] = fillColor[1];
      data[pi+2] = fillColor[2];
      data[pi+3] = 255;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // --- Status bar ---
  function updateStatus() {
    statusBar.textContent = `Tool: ${currentTool.charAt(0).toUpperCase()+currentTool.slice(1)}  |  Size: ${penSize}  |  Color: ${penColor}`;
  }

  // --- Events ---
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'p') setTool('pen');
    if (e.key === 'e') setTool('eraser');
    if (e.key === 'l') setTool('line');
    if (e.key === 'r') setTool('rect');
    if (e.key === 'c') setTool('circle');
    if (e.key === 'f') setTool('fill');
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') document.getElementById('btn-undo').click();
  });

  updateStatus();
})();
