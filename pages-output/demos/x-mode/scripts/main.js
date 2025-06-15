// ========================================================================
// A. SYSTEM ARCHITECTURE (The Jukebox)
// ========================================================================

const canvas = document.getElementById('demo-canvas');
const ctx = canvas.getContext('2d');

const globalConfig = {
  width: 320,
  height: 240,
};

canvas.width = globalConfig.width;
canvas.height = globalConfig.height;

let appState = {
  time: 0,
  activeDemoIndex: 0,
  demos: [],
  imageData: ctx.createImageData(globalConfig.width, globalConfig.height)
};

let lastTime = 0;

function tick(currentTime) {
  const dt = (currentTime - lastTime) / 1000 || 0;
  lastTime = currentTime;
  appState.time += dt;

  const activeDemo = appState.demos[appState.activeDemoIndex];

  if (activeDemo) {
    if (activeDemo.update) activeDemo.update(dt, appState.time, globalConfig);
    if (activeDemo.draw) activeDemo.draw(ctx, globalConfig, appState.imageData, appState.time, dt);
  }

  requestAnimationFrame(tick);
}

function switchDemo(index) {
  if (index < 0 || index >= appState.demos.length) {
    return;
  }

  const oldDemo = appState.demos[appState.activeDemoIndex];
  if (oldDemo && oldDemo.cleanup) {
    oldDemo.cleanup();
  }

  appState.activeDemoIndex = index;

  const newDemo = appState.demos[index];
  if (newDemo.init) {
    newDemo.init(globalConfig);
  }

  document.querySelectorAll('.demo-button').forEach((btn, i) => {
    if (i === index) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'true');
    } else {
      btn.classList.remove('active');
      btn.removeAttribute('aria-current');
    }
  });
}

function registerDemo(demo) {
  appState.demos.push(demo);
}

// ========================================================================
// B. DEMO MODULES (The Records)
// ========================================================================

const plasmaDemo = {
  name: "Plasma",
  state: {},
  init(config) { // config is passed but not directly used here, relies on this.state or appState
    this.state.palettes = [];
    this.state.activePaletteIndex = 0;
    this.state.oldPaletteIndex = 0;
    this.state.isFading = false;
    this.state.fadeProgress = 1;
    this.state.cycleOffset = 0;
    this.state.lastPaletteSwitchTime = 0;

    const generatePalette = (r_freq, g_freq, b_freq, r_phase, g_phase, b_phase) => {
      const p = [];
      for (let i = 0; i < 256; i++) {
        const r = Math.sin(r_freq * i + r_phase) * 127 + 128;
        const g = Math.sin(g_freq * i + g_phase) * 127 + 128;
        const b = Math.sin(b_freq * i + b_phase) * 127 + 128;
        p.push({ r, g, b });
      }
      return p;
    };

    this.state.palettes.push(generatePalette(.1, .1, .1, 0, 2, 4));
    this.state.palettes.push(generatePalette(.05, .1, .08, 0, 0, 0));
    this.state.palettes.push(generatePalette(.08, .05, .1, 4, 2, 0));
    this.state.palettes.push(generatePalette(.1, .08, .05, 0, 2, 4));
  },
  update(dt, time, _config) {
    this.state.cycleOffset += dt * 33;

    if (this.state.isFading) {
      this.state.fadeProgress += dt / 3.0;
      if (this.state.fadeProgress >= 1) {
        this.state.fadeProgress = 1;
        this.state.isFading = false;
        this.state.oldPaletteIndex = this.state.activePaletteIndex;
      }
    }
    else if (time - this.state.lastPaletteSwitchTime > 12) {
      this.state.isFading = true;
      this.state.fadeProgress = 0;
      this.state.oldPaletteIndex = this.state.activePaletteIndex;
      this.state.activePaletteIndex = (this.state.activePaletteIndex + 1) % this.state.palettes.length;
      this.state.lastPaletteSwitchTime = time;
    }
  },
  draw(ctx, config, imageData, time, _dt) { // Uses appState.time via 'time' param for speedGovernor
    const data = imageData.data;
    const maxSpeed = 150;
    // speedGovernor uses the passed 'time' (which is appState.time)
    const speedGovernor = time <= maxSpeed ? maxSpeed : time;
    const speed = 0.7 + Math.sin(speedGovernor * 0.5) * 0.2;
    const t = speedGovernor * speed;

    const oldPalette = this.state.palettes[this.state.oldPaletteIndex];
    const activePalette = this.state.palettes[this.state.activePaletteIndex];
    const offset = Math.floor(this.state.cycleOffset);
    const fade = this.state.fadeProgress;

    for (let y = 0, i = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++, i += 4) {
        const val = Math.sin(x / 16 + t) + Math.sin(y / 8 + t) + Math.sin((x + y) / 16 + t) + Math.sin(Math.sqrt(x * x + y * y) / 8 + t);
        const baseIndex = Math.floor(128 + 64 * val);
        const colorIndex = (baseIndex + offset) & 255;

        const oldColor = oldPalette[colorIndex];
        const newColor = activePalette[colorIndex];

        data[i] = oldColor.r * (1 - fade) + newColor.r * fade;
        data[i + 1] = oldColor.g * (1 - fade) + newColor.g * fade;
        data[i + 2] = oldColor.b * (1 - fade) + newColor.b * fade;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
};

const tunnelDemo = {
  name: "Tunnel",
  state: {},
  init(_config) {
    this.state.textures = [];
    const texSize = 128;
    let t;

    t = new Uint8ClampedArray(texSize * texSize * 4);
    for (let y = 0; y < texSize; y++) {
      for (let x = 0; x < texSize; x++) {
        const i = (y * texSize + x) * 4;
        const c = ((x & 16) ^ (y & 16)) ? 64 : 128; t[i] = c;
        t[i + 1] = c / 2; t[i + 2] = c * 2; t[i + 3] = 255;
      }
    }
    this.state.textures.push(t);

    t = new Uint8ClampedArray(texSize * texSize * 4);
    for (let i = 0; i < t.length; i += 4) {
      const c = Math.random() * 128;
      t[i] = 255;
      t[i + 1] = 128 + c;
      t[i + 2] = 0;
      t[i + 3] = 255;
    }
    this.state.textures.push(t);

    t = new Uint8ClampedArray(texSize * texSize * 4);
    for (let i = 0; i < t.length; i += 4) {
      const c = Math.random() > .95 ? 255 : 0;
      t[i] = 0;
      t[i + 1] = c;
      t[i + 2] = c / 3;
      t[i + 3] = 255;
    }
    this.state.textures.push(t);

    this.state.textureSize = texSize;
    this.state.distanceOffset = 0;
    this.state.angleOffset = 0;
  },
  update(dt, _time, _config) {
    this.state.distanceOffset += dt * 120;
    this.state.angleOffset += dt * 0.3;
  },
  draw(ctx, config, imageData, _time, _dt) {
    const screenData = imageData.data;
    const { width, height } = config;
    const halfW = width / 2;
    const halfH = height / 2;
    const distOffset = this.state.distanceOffset;
    const angleOffset = this.state.angleOffset;

    const sectionLength = 512;
    const fadeLength = 256;

    const distInSection = distOffset % sectionLength;
    const currentSectionIndex = Math.floor(distOffset / sectionLength) % this.state.textures.length;
    const nextSectionIndex = (currentSectionIndex + 1) % this.state.textures.length;
    const textureData1 = this.state.textures[currentSectionIndex];
    const textureData2 = this.state.textures[nextSectionIndex];
    const textureSize = this.state.textureSize;

    let fade = 0;
    if (distInSection > sectionLength - fadeLength) {
      fade = (distInSection - (sectionLength - fadeLength)) / fadeLength;
    }

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4) {
        const dx = x - halfW;
        const dy = y - halfH;

        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = Math.atan2(dy, dx) + angleOffset;

        const texU = angle / (2 * Math.PI) * textureSize;
        const texV = (width * 8) / dist + distOffset;
        const texIndex = (Math.floor(texV) & (textureSize - 1)) * textureSize * 4 + (Math.floor(texU) & (textureSize - 1)) * 4;

        const fog = Math.min(1.0, dist / (width / 2));

        const r1 = textureData1[texIndex];
        const g1 = textureData1[texIndex + 1];
        const b1 = textureData1[texIndex + 2];

        let finalFade = fade * Math.max(0, 1.0 - (dist / (width / 3)));

        const r2 = textureData2[texIndex];
        const g2 = textureData2[texIndex + 1];
        const b2 = textureData2[texIndex + 2];

        screenData[i] = (r1 * (1 - finalFade) + r2 * finalFade) * fog;
        screenData[i + 1] = (g1 * (1 - finalFade) + g2 * finalFade) * fog;
        screenData[i + 2] = (b1 * (1 - finalFade) + b2 * finalFade) * fog;
        screenData[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
};

const metaballsDemo = {
  name: "Metal", state: {},
  init(config) {
    this.state.balls = [];
    const numBalls = 5;
    const colors = [
      { r: 255, g: 50, b: 50 },
      { r: 50, g: 255, b: 50 },
      { r: 50, g: 150, b: 255 },
      { r: 255, g: 255, b: 50 },
      { r: 255, g: 50, b: 255 }
    ];

    for (let i = 0; i < numBalls; i++) {
      this.state.balls.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        vx: (Math.random() - .5) * 30,
        vy: (Math.random() - .5) * 30,
        strength: Math.random() * 2e3 + 2500,
        color: colors[i % colors.length]
      });
    }
    this.state.fieldBuffer = new Float32Array(config.width * config.height);
  },
  update(dt, _time, config) {
    this.state.balls.forEach(ball => {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < 0 || ball.x > config.width) {
        ball.vx *= -1;
        ball.x = Math.max(0, Math.min(ball.x, config.width)); // Clamp position
      }
      if (ball.y < 0 || ball.y > config.height) {
        ball.vy *= -1;
        ball.y = Math.max(0, Math.min(ball.y, config.height)); // Clamp position
      }
    })
  },
  draw(ctx, config, imageData, _time, _dt) {
    const screenData = imageData.data;
    const balls = this.state.balls;
    const field = this.state.fieldBuffer;
    const { width, height } = config;
    const threshold = .7;

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        let sum = 0;
        for (const ball of balls) {
          const dx = x - ball.x;
          const dy = y - ball.y;
          sum += ball.strength / (dx * dx + dy * dy || 1);
        }
        field[i] = sum;
      }
    }

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        const strength = field[i], pixelIndex = i * 4;

        if (strength >= threshold) {
          let mixedR = 0;
          let mixedG = 0;
          let mixedB = 0;

          for (const ball of balls) {
            const dx = x - ball.x; const dy = y - ball.y;
            const influence = ball.strength / (dx * dx + dy * dy || 1);
            mixedR += ball.color.r * influence;
            mixedG += ball.color.g * influence;
            mixedB += ball.color.b * influence;
          }

          const baseR = mixedR / strength;
          const baseG = mixedG / strength;
          const baseB = mixedB / strength;
          const rightStrength = x < width - 1 ? field[i + 1] : strength;
          const downStrength = y < height - 1 ? field[i + width] : strength;
          const normalX = strength - rightStrength;
          const normalY = strength - downStrength;
          const light = normalX * .707 - normalY * .707;
          const lightFactor = Math.pow(Math.max(0, light + .5), .6) * 1.6 + .2;

          screenData[pixelIndex] = Math.min(255, baseR * lightFactor);
          screenData[pixelIndex + 1] = Math.min(255, baseG * lightFactor);
          screenData[pixelIndex + 2] = Math.min(255, baseB * lightFactor);
          screenData[pixelIndex + 3] = 255
        } else {
          screenData[pixelIndex] = 10;
          screenData[pixelIndex + 1] = 10;
          screenData[pixelIndex + 2] = 20;
          screenData[pixelIndex + 3] = 255
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }
};

const starfieldDemo = {
  name: "Stars",
  state: {},
  init(config) { // Renamed param from c to config
    this.state.stars = [];
    const numStars = 500; // Renamed param s to numStars

    for (let i = 0; i < numStars; i++) { // Renamed param t to i
      this.state.stars.push({
        x: (Math.random() - .5) * config.width,
        y: (Math.random() - .5) * config.height,
        z: Math.random() * config.width
      });
    }
  },
  update(dt, _time, config) { // Renamed param c to dt, added config
    this.state.stars.forEach(star => { // Renamed param s to star
      star.z -= 100 * dt; // Speed 100
      if (star.z <= 0) {
        star.z = config.width;
        star.x = (Math.random() - .5) * config.width;
        star.y = (Math.random() - .5) * config.height;
      }
    })
  },
  draw(ctx, config, _imageData, _time, _dt) { // Renamed params c to ctx, s to config
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.fillStyle = "#FFF";

    const halfWidth = config.width / 2; // Renamed t to halfWidth
    const halfHeight = config.height / 2; // Renamed h to halfHeight

    this.state.stars.forEach(star => { // Renamed e to star
      const projX = star.x / star.z * halfWidth + halfWidth; // Renamed a to projX
      const projY = star.y / star.z * halfHeight + halfHeight; // Renamed o to projY

      if (projX > 0 && projX < config.width && projY > 0 && projY < config.height) {
        const brightness = 1 - star.z / config.width; // Renamed n to brightness
        const starSize = 2 * brightness;

        ctx.globalAlpha = brightness;
        ctx.fillRect(projX - starSize / 2, projY - starSize / 2, starSize, starSize); // Centered star
      }
    });
    ctx.globalAlpha = 1;
  }
};

const gridDeformerDemo = {
  name: "Flag",
  state: {},
  init(config) {
    const gridCols = 24;
    const gridRows = 18;

    this.state.gridConfig = {
      columns: gridCols,
      rows: gridRows
    };

    const points = [];
    for (let r = 0; r <= gridRows; r++) {
      for (let c = 0; c <= gridCols; c++) {
        points.push({ x: c / gridCols, y: r / gridRows });
      }
    }
    this.state.baseGrid = points;
    this.state.transformedGrid = [];

    this.state.palette = [];
    for (let i = 0; i < 256; i++) {
      const r = Math.sin(i * 0.05 + 0) * 127 + 128;
      const g = Math.sin(i * 0.05 + 2) * 127 + 128;
      const b = Math.sin(i * 0.05 + 4) * 127 + 128;
      this.state.palette.push(`rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`);
    }
    this.state.colorOffset = 0;
  },
  update(dt, time, config) {
    this.state.transformedGrid = this.state.baseGrid.map(p => {
      const wave1 = Math.sin(p.x * 4 + time * 3) * 15 * p.x;
      const wave2 = Math.sin(p.x * 2 + p.y * 5 + time * 2) * 10 * p.x;
      const y = (p.y - 0.5) * config.height * 0.8 + wave1 + wave2;
      const z = Math.cos(p.x * 4 + time * 3) * 15 * p.x;

      return {
        x: p.x * config.width,
        y: y + config.height / 2,
        z: z, originalY: p.y
      };
    });
    this.state.colorOffset += dt * 50;
  },
  draw(ctx, config, _imageData, _time, _dt) {
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillRect(0, 0, config.width, config.height);
    const { columns, rows } = this.state.gridConfig;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const i00 = y * (columns + 1) + x;
        const i10 = y * (columns + 1) + x + 1;
        const i01 = (y + 1) * (columns + 1) + x;
        const i11 = (y + 1) * (columns + 1) + x + 1;
        const p00 = this.state.transformedGrid[i00];
        const p10 = this.state.transformedGrid[i10];
        const p01 = this.state.transformedGrid[i01];
        const p11 = this.state.transformedGrid[i11];

        const colorIndex = Math.floor(p00.originalY * 100 + this.state.colorOffset) % 256;
        const baseColor = this.state.palette[colorIndex];

        const light = Math.max(0.1, (p00.z + p10.z + p01.z) / 3 / 30 + 0.5);

        ctx.fillStyle = baseColor;
        ctx.globalAlpha = light;

        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(p11.x, p11.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }
};

const fireDemo = {
  name: "Fire",
  state: {},
  init(config) {
    this.state.fireBuffer = new Uint8Array(config.width * config.height).fill(0);
    this.state.palette = [];
    this.state.updateAccumulator = 0;
    for (let i = 0; i < 256; i++) {
      const normVal = i / 255;
      this.state.palette.push({
        r: 255 * Math.min(1.5 * normVal, 1),
        g: 255 * Math.max(0, Math.min(2 * (normVal - .25), 1)),
        b: 255 * Math.max(0, Math.min(5 * (normVal - .8), 1))
      });
    }
  },
  update(dt, _time, config) {
    this.state.updateAccumulator += dt;
    const updateInterval = 1 / 50;

    if (this.state.updateAccumulator < updateInterval) {
      return;
    }
    this.state.updateAccumulator -= updateInterval;

    const w = config.width;
    const h = config.height;
    const buf = this.state.fireBuffer;

    for (let x = 0; x < w; x++) {
      const rand = Math.random();
      if (rand > 0.98) {
        buf[(h - 1) * w + x] = 255 + Math.random() * 1300;
      } else if (rand > 0.6) {
        buf[(h - 1) * w + x] = 128 + Math.random() * 200;
      } else {
        buf[(h - 1) * w + x] = 80;
      }
    }

    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p1 = buf[(y + 1) * w + (x - 1 + w) % w];
        const p2 = buf[(y + 1) * w + x];
        const p3 = buf[(y + 1) * w + (x + 1) % w];
        const p4 = buf[(y + 2 < h) ? (y + 2) * w + x : (y + 1) * w + x];
        const average = (p1 + p2 + p2 + p3 + p4) / 5.04;
        buf[i] = Math.max(0, average);
      }
    }
  },
  draw(ctx, _config, imageData, _time, _dt) {
    const pixelData = imageData.data;
    const fireBuf = this.state.fireBuffer;

    for (let idx = 0; idx < fireBuf.length; idx++) {
      const fireValue = Math.min(255, Math.floor(fireBuf[idx]));
      const color = this.state.palette[fireValue];
      const pixelArrIdx = 4 * idx;

      pixelData[pixelArrIdx] = color.r;
      pixelData[pixelArrIdx + 1] = color.g;
      pixelData[pixelArrIdx + 2] = color.b;
      pixelData[pixelArrIdx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }
};

const voronoiDemo = {
  name: "Voronoi",
  state: {},
  init(config) {
    this.state.points = [];
    this.state.colors = [];
    const numPoints = 15;

    for (let i = 0; i < numPoints; i++) {
      this.state.points.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        vx: Math.random() * 40 - 20,
        vy: Math.random() * 40 - 20
      });
      this.state.colors.push({
        r: Math.random() * 155 + 100,
        g: Math.random() * 155 + 100,
        b: Math.random() * 155 + 100
      });
    }
  },
  update(dt, _time, config) {
    this.state.points.forEach(point => {
      point.x += point.vx * dt;
      point.y += point.vy * dt;
      if (point.x < 0 || point.x > config.width) {
        point.vx *= -1;
        point.x = Math.max(0, Math.min(point.x, config.width));
      }
      if (point.y < 0 || point.y > config.height) {
        point.vy *= -1;
        point.y = Math.max(0, Math.min(point.y, config.height));
      }
    });
  },
  draw(ctx, config, imageData, _time, _dt) {
    const pixelData = imageData.data;
    const { width, height } = config;
    const points = this.state.points;
    const colors = this.state.colors;

    for (let y = 0, pixelIndex = 0; y < height; y++) {
      for (let x = 0; x < width; x++, pixelIndex += 4) {
        let minDistSq = 1e7;
        let closestPointIdx = -1;

        for (let k = 0; k < points.length; k++) {
          const dx = x - points[k].x;
          const dy = y - points[k].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDistSq) {
            minDistSq = distSq;
            closestPointIdx = k;
          }
        }

        const color = colors[closestPointIdx];
        pixelData[pixelIndex] = color.r;
        pixelData[pixelIndex + 1] = color.g;
        pixelData[pixelIndex + 2] = color.b;
        pixelData[pixelIndex + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }
};

const vectorBallDemo = {
  name: "Vector",
  state: {},
  init(config) {
    this.state.balls = [];
    const numBalls = 60;
    for (let i = 0; i < numBalls; i++) {
      this.state.balls.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        vx: Math.random() * 30 - 15,
        vy: Math.random() * 30 - 15,
        r: Math.random() * 2 + 1.5
      });
    }
  },
  update(dt, _time, config) {
    this.state.balls.forEach(ball => {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < ball.r || ball.x > config.width - ball.r) {
        ball.vx *= -1;
        ball.x = Math.max(ball.r, Math.min(ball.x, config.width - ball.r));
      }
      if (ball.y < ball.r || ball.y > config.height - ball.r) {
        ball.vy *= -1;
        ball.y = Math.max(ball.r, Math.min(ball.y, config.height - ball.r));
      }
    });
  },
  draw(ctx, config, _imageData, _time, _dt) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, config.width, config.height);
    const balls = this.state.balls;
    const connectionDist = 70;
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";

    for (let i = 0; i < balls.length; i++) {
      const ball1 = balls[i];
      ctx.beginPath();
      ctx.arc(ball1.x, ball1.y, ball1.r, 0, 2 * Math.PI);
      ctx.fill();
      for (let j = i + 1; j < balls.length; j++) {
        const ball2 = balls[j];
        const dx = ball1.x - ball2.x;
        const dy = ball1.y - ball2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectionDist) {
          ctx.globalAlpha = 1 - dist / connectionDist;
          ctx.beginPath();
          ctx.moveTo(ball1.x, ball1.y);
          ctx.lineTo(ball2.x, ball2.y);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
};

const lensFlareDemo = {
  name: "Flare",
  state: {},
  init(config) {
    this.state.flarePos = {
      x: config.width / 2,
      y: config.height / 2
    };
    this.state.ghosts = [
      { d: 0.5, s: 40, c: "rgba(255,200,200,0.15)", aspect: 1.2 },
      { d: 0.35, s: 25, c: "rgba(200,255,200,0.12)", aspect: 1.2 },
      { d: 0.1, s: 150, c: "rgba(200,200,255,0.05)", aspect: 1.1 },
      { d: -0.1, s: 60, c: "rgba(255,200,255,0.08)", aspect: 1.3 },
      { d: -0.5, s: 80, c: "rgba(255,255,100,0.09)", aspect: 1.3 },
      { d: -1, s: 120, c: "rgba(255,100,100,0.08)", aspect: 1.2 }
    ];
  },
  update(_dt, time, config) {
    this.state.flarePos.x = config.width / 2 + (Math.cos(time * .6) * config.width * .45);
    this.state.flarePos.y = config.height / 2 + (Math.sin(time * .8) * config.height * .45);
  },
  draw(ctx, config, _imageData, _time, _dt) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.globalCompositeOperation = "lighter";

    const halfWidth = config.width / 2;
    const halfHeight = config.height / 2;
    const flareOffsetX = this.state.flarePos.x - halfWidth;
    const flareOffsetY = this.state.flarePos.y - halfHeight;

    const streakGrad = ctx.createLinearGradient(0, this.state.flarePos.y, config.width, this.state.flarePos.y);
    streakGrad.addColorStop(0.4, "rgba(50, 100, 255, 0)");
    streakGrad.addColorStop(0.5, "rgba(200, 220, 255, 0.2)");
    streakGrad.addColorStop(0.6, "rgba(50, 100, 255, 0)");
    ctx.fillStyle = streakGrad;
    ctx.fillRect(0, this.state.flarePos.y - 2, config.width, 4);

    const glareGrad = ctx.createRadialGradient(this.state.flarePos.x, this.state.flarePos.y, 0, this.state.flarePos.x, this.state.flarePos.y, 40);
    glareGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    glareGrad.addColorStop(0.2, "rgba(255, 255, 220, 0.4)");
    glareGrad.addColorStop(1, "rgba(255, 255, 220, 0)");
    ctx.fillStyle = glareGrad;
    ctx.fillRect(0, 0, config.width, config.height);

    this.state.ghosts.forEach(ghost => {
      const ghostX = halfWidth - flareOffsetX * ghost.d;
      const ghostY = halfHeight - flareOffsetY * ghost.d;
      const sizeX = ghost.s;
      const sizeY = ghost.s * ghost.aspect;

      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
      ctx.beginPath();
      ctx.ellipse(ghostX - 2, ghostY, sizeX, sizeY, 0, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "rgba(50, 50, 255, 0.5)";
      ctx.beginPath();
      ctx.ellipse(ghostX + 2, ghostY, sizeX, sizeY, 0, 0, 2 * Math.PI);
      ctx.fill();

      ctx.globalAlpha = 1.0;
      ctx.fillStyle = ghost.c;
      ctx.beginPath();
      ctx.ellipse(ghostX, ghostY, sizeX * 0.9, sizeY * 0.9, 0, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
  }
};

const mandelbrotDemo = {
  name: "Mandel",
  state: {},
  init(_config) {
    this.state.needsRender = true;
    this.hslToRgb = (h, s, l) => {
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      }
      else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) {
            t += 1;
          }

          if (t > 1) {
            t -= 1;
          }

          if (t < 1 / 6) {
            return p + (q - p) * 6 * t;
          }

          if (t < 1 / 2) {
            return q;
          };

          if (t < 2 / 3) {
            return p + (q - p) * (2 / 3 - t) * 6;
          };

          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return { r: r * 255, g: g * 255, b: b * 255 };
    };
  },
  update(_dt, time, _config) {
    this.state.zoom = Math.pow(1.01, time);
    this.state.panX = 0.2 - Math.cos(time * 0.1) * 0.1;
    this.state.panY = -0.5 - Math.sin(time * 0.12) * 0.1;
    this.state.needsRender = true;
  },
  draw(ctx, config, imageData, time, _dt) {
    if (!this.state.needsRender) return;

    const palette = [];
    const timeHueOffset = time * 0.05;
    for (let i = 0; i < 256; i++) {
      const hue = (i / 256 + timeHueOffset) % 1;
      const lightness = Math.pow(i / 255, 0.5);
      palette.push(this.hslToRgb(hue, 1.0, lightness));
    }

    const data = imageData.data;
    const { width, height } = config;
    const maxIter = 100;
    const zoom = this.state.zoom;
    const panX = this.state.panX;
    const panY = this.state.panY;

    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4) {
        const zx = 1.5 * (x - width / 2) / (0.5 * zoom * width) + panX;
        const zy = (y - height / 2) / (0.5 * zoom * height) + panY;
        let iX = zx;
        let iY = zy;
        let iter = 0;

        while (iX * iX + iY * iY <= 4 && iter < maxIter) {
          let tmp = iX * iX - iY * iY + zx;
          iY = 2 * iX * iY + zy;
          iX = tmp;
          iter++;
        }

        if (iter < maxIter) {
          const color = palette[iter % 256];
          data[i] = color.r;
          data[i + 1] = color.g;
          data[i + 2] = color.b;
        } else {
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    this.state.needsRender = false;
  }
};

// ========================================================================
// C. INITIALIZATION (The Boot Sequence)
// ========================================================================

function main() {
  registerDemo(plasmaDemo);
  registerDemo(tunnelDemo);
  registerDemo(metaballsDemo);
  registerDemo(gridDeformerDemo);
  registerDemo(fireDemo);
  registerDemo(voronoiDemo);
  registerDemo(vectorBallDemo);
  registerDemo(lensFlareDemo);
  registerDemo(mandelbrotDemo);
  registerDemo(starfieldDemo);

  const controlsContainer = document.getElementById('controls');
  appState.demos.forEach((demo, index) => {
    const button = document.createElement('button');
    button.className = 'demo-button bg-gray-700 text-gray-200 p-1 md:p-2 rounded-lg border-b-4 border-gray-800 text-xs';
    button.textContent = `${index}: ${demo.name}`;
    button.title = `Switch to ${demo.name} demo (shortcut: ${index})`;
    button.onclick = () => switchDemo(index);
    controlsContainer.appendChild(button);
  });

  window.addEventListener('keydown', (e) => {
    const keyIndex = parseInt(e.key, 10);
    if (!isNaN(keyIndex) && keyIndex >= 0 && keyIndex < 10 && keyIndex < appState.demos.length) {
      switchDemo(keyIndex);
      e.preventDefault();
    }
  });

  switchDemo(0);
  requestAnimationFrame(tick);
}

main();