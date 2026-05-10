
let env = {
    fog: 0.4,
    timeOfDay: 1.0,   // 0 = dusk, 1 = night
    windowDim: 0,     // 0 = full brightness, 1 = fully dimmed
    aviationLights: true,
    paused: false,
    globalTime: 0,
};

// shared y-coordinates (fractions of canvas height)
const GROUND_Y = 0.88;          // where ridges close + mid-rises sit + ground gradient starts
const FG_GROUND_Y = 0.92;       // where row houses + streetlamps sit


class Building {
    constructor(x, baseY, w, h, rows, cols, windowOpts = {}, foreground = false) {
        this.x = x;
        this.baseY = baseY;
        this.w = w;
        this.h = h;
        this.rows = rows;
        this.cols = cols;
        this.foreground = foreground;
        this.windows = [];

        this.windowOpts = {
            windowW: windowOpts.windowW || 8,
            windowH: windowOpts.windowH || 12,
            padding: windowOpts.padding || 4,
            gap: windowOpts.gap || 4,
            stairEvery: windowOpts.stairEvery || 0, // 0 = no stair columns
            stairExtraGap: windowOpts.stairExtraGap !== undefined ? windowOpts.stairExtraGap : 4,
            stairWidthRatio: windowOpts.stairWidthRatio || 0.7,
            ...windowOpts
        };

        const o = this.windowOpts;
        // separate horizontal/vertical padding — fall back to `padding` if not given
        o.paddingX = o.paddingX !== undefined ? o.paddingX : o.padding;
        o.paddingY = o.paddingY !== undefined ? o.paddingY : o.padding;
        this.isStairCol = (c) => o.stairEvery > 0 && c % o.stairEvery === 0;

        if (o.fitWidth && cols > 1) {
            let extras = 0;
            for (let c = 1; c < cols; c++) {
                if (this.isStairCol(c) || this.isStairCol(c - 1)) extras++;
            }
            const usable = this.w - 2 * o.paddingX - cols * o.windowW - extras * o.stairExtraGap;
            o.gap = usable / (cols - 1);
        }

        // pre-compute per-column x offset, with extra gap surrounding stair columns
        this.colX = [];
        let cursor = o.paddingX;
        for (let c = 0; c < cols; c++) {
            if (c > 0) {
                const extra = (this.isStairCol(c) || this.isStairCol(c - 1)) ? o.stairExtraGap : 0;
                cursor += o.gap + extra;
            }
            this.colX.push(cursor);
            cursor += o.windowW;
        }

        // one brightness per stair column — consistent across all floors
        const stairBrightness = {};
        for (let c = 0; c < cols; c++) {
            if (this.isStairCol(c)) stairBrightness[c] = random(0.5, 0.7);
        }

        for (let r = 0; r < this.rows; r++) {
            this.windows[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const stair = this.isStairCol(c);
                this.windows[r][c] = {
                    type: stair ? 'stair' : 'res',
                    on: stair ? true : random() < 0.4,         // stairwells stay lit
                    brightness: stair ? stairBrightness[c] : random(0.5, 1),
                    flicker: false
                };
            }
        }
    }

    getWindowRect(r, c) {
        const opts = this.windowOpts;
        const wx = this.x + this.colX[c];
        const wy = this.baseY - this.h + opts.paddingY + r * (opts.windowH + opts.gap);
        return { x: wx, y: wy, w: opts.windowW, h: opts.windowH };
    }

    toggleWindow(r, c) {
        const wnd = this.windows[r] && this.windows[r][c];
        if (!wnd || wnd.type === 'stair') return;   // stairwells aren't toggleable
        wnd.on = !wnd.on;
    }

    setBroken(r, c, isBroken = true) {
        if (this.windows[r] && this.windows[r][c]) {
            this.windows[r][c].flicker = isBroken;
            if (isBroken) this.windows[r][c].on = true;
        }
    }

    randomBroken(count = 1) {
        for (let i = 0; i < count; i++) {
            const r = Math.floor(random(this.rows));
            const c = Math.floor(random(this.cols));
            this.setBroken(r, c, true);
        }
    }

    checkClick(mx, my) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const rect = this.getWindowRect(r, c);
                if (mx >= rect.x && mx <= rect.x + rect.w &&
                    my >= rect.y && my <= rect.y + rect.h) {
                    this.toggleWindow(r, c);
                    return true;
                }
            }
        }
        return false;
    }

    draw() {
        // 楼栋
        noStroke();
        fill(0);
        rect(this.x, this.baseY - this.h, this.w, this.h);

        // 窗户
        const o = this.windowOpts;
        const dimMult = 1 - env.windowDim;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const wnd = this.windows[r][c];
                const rct = this.getWindowRect(r, c);

                if (wnd.type === 'stair') {
                    // always rendered as a stair — never falls back to residential look
                    const stripW = max(2, o.windowW * o.stairWidthRatio);
                    const stripX = rct.x + (o.windowW - stripW) / 2;
                    const glow = 100 * wnd.brightness * dimMult;
                    drawingContext.shadowColor = `rgba(190, 210, 230, ${0.4 * dimMult})`;
                    drawingContext.shadowBlur = 5;
                    fill(glow, glow, glow, 10 * dimMult);
                    rect(stripX, rct.y, stripW, rct.h);
                    drawingContext.shadowBlur = 0;
                } else if (wnd.on) {
                    let alpha = 1;
                    if (wnd.flicker) {
                        alpha = 0.7 + 0.3 * sin(env.globalTime * 8 + r * 2 + c);
                    }
                    const dim = env.windowDim;
                    const baseGlow = 220 * wnd.brightness * alpha;
                    const rr = lerp(baseGlow, 15, dim);
                    const gg = lerp(baseGlow * 0.75, 15, dim);
                    const bb = lerp(baseGlow * 0.4, 15, dim);
                    const aa = lerp(200, 255, dim);
                    drawingContext.shadowColor = `rgba(220, 170, 90, ${0.5 * alpha * (1 - dim)})`;
                    drawingContext.shadowBlur = 6;
                    fill(rr, gg, bb, aa);
                    rect(rct.x, rct.y, rct.w, rct.h);
                    drawingContext.shadowBlur = 0;
                } else {
                    fill(15, 15, 15);
                    rect(rct.x, rct.y, rct.w, rct.h);
                }
            }
        }
    }
}


class Streetlamp {
    constructor(x, y, intensity = 1) {
        this.x = x;
        this.y = y;
        this.intensity = intensity;
        this.on = true;
        this.flicker = false;
    }

    draw() {
        if (!this.on) return;

        let flickerMult = 1;
        if (this.flicker) {
            const n = noise(env.globalTime * 14, this.x * 0.01);
            flickerMult = n > 0.5 ? 1 : (n > 0.38 ? 0.4 : 0.05);
        }

        drawingContext.save();
        for (let i = 4; i >= 1; i--) {
            const r = i * 35;
            const alpha = (0.4 * this.intensity * flickerMult) / (i * 1.5);
            const grad = drawingContext.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, r
            );
            grad.addColorStop(0, `rgba(255, 220, 140, ${alpha})`);
            grad.addColorStop(1, `rgba(255, 220, 140, 0)`);
            drawingContext.fillStyle = grad;
            drawingContext.fillRect(this.x - r, this.y - r, r * 2, r * 2);
        }
        drawingContext.restore();
    }
}


class Mountain {
    constructor(points, depth, yBase) {
        this.points = points;
        this.depth = depth; // 0 = far/hazy, 1 = close/silhouette
        this.yBase = yBase;
    }

    getColor() {
        const dusk = { far: [55, 42, 52], close: [20, 16, 26] };
        const night = { far: [22, 26, 38], close: [4, 6, 12] };
        const t = env.timeOfDay;
        const farR = lerp(dusk.far[0], night.far[0], t);
        const farG = lerp(dusk.far[1], night.far[1], t);
        const farB = lerp(dusk.far[2], night.far[2], t);
        const clR = lerp(dusk.close[0], night.close[0], t);
        const clG = lerp(dusk.close[1], night.close[1], t);
        const clB = lerp(dusk.close[2], night.close[2], t);
        return color(
            lerp(farR, clR, this.depth),
            lerp(farG, clG, this.depth),
            lerp(farB, clB, this.depth)
        );
    }

    draw() {
        noStroke();
        fill(this.getColor());
        beginShape();
        vertex(0, this.yBase);
        for (let p of this.points) {
            vertex(p.x, p.y);
        }
        vertex(width, this.yBase);
        endShape(CLOSE);
    }
}

// globals
let buildings = [];
let mountains = [];
let streetlamps = [];
let aviationLights = [];

function setup() {
    createCanvas(windowWidth, windowHeight);
    setupScene();
}

function setupScene() {
    buildings = [];
    mountains = [];
    streetlamps = [];
    aviationLights = [];

    const groundY = height * GROUND_Y;
    const fgGroundY = height * FG_GROUND_Y;

    // ===== ridges & near hill =====
    const farRidgePoints = [
        { x: 0.00, y: 0.50 },
        { x: 0.15, y: 0.40 },
        { x: 0.30, y: 0.46 },
        { x: 0.50, y: 0.36 },
        { x: 0.70, y: 0.44 },
        { x: 0.85, y: 0.38 },
        { x: 1.00, y: 0.46 },
    ];
    const ridgeSpecs = [
        { points: farRidgePoints, depth: 0.00, baseY: groundY },
        {
            points: [
                { x: 0.00, y: 0.58 }, { x: 0.20, y: 0.50 }, { x: 0.45, y: 0.56 },
                { x: 0.60, y: 0.46 }, { x: 0.80, y: 0.52 }, { x: 1.00, y: 0.51 },
            ], depth: 0.45, baseY: groundY
        },
        {
            points: [
                { x: 0.00, y: 0.72 }, { x: 0.18, y: 0.66 }, { x: 0.40, y: 0.70 },
                { x: 0.62, y: 0.65 }, { x: 0.82, y: 0.69 }, { x: 1.00, y: 0.72 },
            ], depth: 0.85, baseY: groundY
        },
    ];
    for (const r of ridgeSpecs) {
        mountains.push(new Mountain(
            r.points.map(p => ({ x: width * p.x, y: height * p.y })),
            r.depth, r.baseY
        ));
    }

    // ===== background mid-rise  =====
    const midRiseWindowOpts = { windowW: 22, windowH: 22, paddingX: 25, paddingY: 40, gap: 12, stairEvery: 3 };
    const midRiseClusters = [
        { startX: 0.02, endX: 0.27, count: 2, colChoices: [7] },
        { startX: 0.31, endX: 0.675, count: 1, colChoices: [13] },
        { startX: 0.71, endX: 0.98, count: 2, colChoices: [5, 7, 9] },
    ];
    for (const cl of midRiseClusters) {
        const slotW = (cl.endX - cl.startX) / cl.count;
        const slotPx = slotW * width;
        for (let i = 0; i < cl.count; i++) {
            const o = midRiseWindowOpts;
            const rows = floor(random(5, 8));      // 5..8
            const cols = random(cl.colChoices);
            // derive width and height so the window grid fits exactly (incl. stair extras)
            let extras = 0;
            for (let cc = 1; cc < cols; cc++) {
                if (cc % o.stairEvery === 0 || (cc - 1) % o.stairEvery === 0) extras++;
            }
            const stairExtra = o.stairExtraGap !== undefined ? o.stairExtraGap : 4;
            const padX = o.paddingX !== undefined ? o.paddingX : o.padding;
            const padY = o.paddingY !== undefined ? o.paddingY : o.padding;
            const buildingW = cols * o.windowW + (cols - 1) * o.gap + extras * stairExtra + 2 * padX;
            const buildingH = rows * o.windowH + (rows - 1) * o.gap + 2 * padY;
            const slotLeftPx = (cl.startX + i * slotW) * width;
            const x = slotLeftPx + (slotPx - buildingW) / 2;
            buildings.push(new Building(
                x, groundY, buildingW, buildingH,
                rows, cols, { ...o }
            ));
        }
    }

    // ===== foreground row houses =====
    const fgWindowOpts = { windowW: 20, windowH: 25, paddingX: 20, paddingY: 30, fitWidth: true };
    const fgCount = 4;
    const fgGap = 0.02;
    const fgUnitW = (1.0 - fgGap * (fgCount - 1)) / fgCount;
    for (let i = 0; i < fgCount; i++) {
        const x = i * (fgUnitW + fgGap);
        const h = random(0.13, 0.15);
        const cols = floor(width * fgUnitW / 38);  // ~one window per ~38px
        buildings.push(new Building(
            width * x, fgGroundY, width * fgUnitW, height * h,
            1, cols, { ...fgWindowOpts }, true
        ));
    }

    // ===== streetlamps =====
    const lampCount = 5;
    for (let i = 0; i < lampCount; i++) {
        const x = (i + 0.5) / lampCount;
        streetlamps.push(new Streetlamp(
            width * x,
            fgGroundY + random(10, 16),
            random(0.7, 1.0)
        ));
    }

    // ===== aviation lights =====
    for (let i = 1; i < farRidgePoints.length - 1; i++) {
        const prev = farRidgePoints[i - 1];
        const cur = farRidgePoints[i];
        const next = farRidgePoints[i + 1];
        if (cur.y < prev.y && cur.y < next.y) {
            aviationLights.push({
                x: width * cur.x,
                y: height * cur.y,
                freq: random(1.0, 1.8),
                phase: random(TWO_PI),
            });
        }
    }
}

// helpers

function toggleAllWindows() {
    let on = 0, total = 0;
    for (let b of buildings) {
        for (let row of b.windows) {
            for (let w of row) {
                if (w.type === 'stair') continue;
                total++;
                if (w.on) on++;
            }
        }
    }
    const newState = on / total < 0.5;
    for (let b of buildings) {
        for (let row of b.windows) {
            for (let w of row) {
                if (w.type === 'stair') continue;
                w.on = newState;
            }
        }
    }
}

function randomizeWindows() {
    for (let b of buildings) {
        for (let row of b.windows) {
            for (let w of row) {
                if (w.type === 'stair') continue;
                w.on = random() < 0.4;
                w.brightness = random(0.5, 1);
            }
        }
    }
}

function toggleStreetlamps() {
    for (let lamp of streetlamps) {
        lamp.on = !lamp.on;
    }
}

function flickerOnWindows() {
    let flickering = 0, total = 0;
    for (let b of buildings) {
        for (let row of b.windows) {
            for (let w of row) {
                if (w.type === 'stair' || !w.on) continue;
                total++;
                if (w.flicker) flickering++;
            }
        }
    }
    const turnOn = total === 0 || flickering / total < 0.5;
    for (let b of buildings) {
        for (let row of b.windows) {
            for (let w of row) {
                if (w.type === 'stair' || !w.on) continue;
                w.flicker = turnOn;
            }
        }
    }
}

function flickerStreetlamp(index) {
    const lamp = streetlamps[index];
    if (lamp) lamp.flicker = !lamp.flicker;
}

// control
function mousePressed() {
    for (let b of buildings) {
        if (b.checkClick(mouseX, mouseY)) {
            return;
        }
    }
}

function keyPressed() {
    if (key === ' ') env.paused = !env.paused;
}

// ===== command bus =====
// Single dispatch table used by both BroadcastChannel (controls page)
// and WebMIDI (TouchDesigner via IAC Driver).
const commands = {
    'fog:set': (v) => env.fog = v,
    'time:set': (v) => env.timeOfDay = v,
    'windows:dim:set': (v) => env.windowDim = v,
    'windows:toggle': () => toggleAllWindows(),
    'windows:randomize': () => randomizeWindows(),
    'windows:flicker': () => flickerOnWindows(),
    'streetlamps:toggle': () => toggleStreetlamps(),
    'streetlamp:flicker2': () => flickerStreetlamp(1),
    'aviation:toggle': () => env.aviationLights = !env.aviationLights,
};

function applyCommand(cmd, value) {
    const fn = commands[cmd];
    if (fn) fn(value);
    else console.warn('unknown command:', cmd);
}

// MIDI mapping — channel-agnostic, note-on triggers, CC for continuous.
const MIDI_NOTE_MAP = {
    67: 'windows:toggle',
    68: 'windows:randomize',
    70: 'streetlamps:toggle',
    71: 'aviation:toggle',
    72: 'windows:flicker',
    73: 'streetlamp:flicker2',
};
const MIDI_CC_MAP = {
    20: 'fog:set',         // 0..1
    21: 'time:set',        // 0=dusk → 1=night
    22: 'windows:dim:set', // 0=full bright → 1=dark
};

function setupMIDI() {
    if (!navigator.requestMIDIAccess) {
        console.warn('WebMIDI not available in this browser');
        return;
    }
    navigator.requestMIDIAccess().then(midi => {
        const wire = (input) => {
            input.onmidimessage = handleMIDI;
            console.log('MIDI input:', input.name);
        };
        for (const input of midi.inputs.values()) wire(input);
        midi.onstatechange = (e) => {
            if (e.port.type === 'input' && e.port.state === 'connected') wire(e.port);
        };
    }).catch(err => console.warn('MIDI access denied:', err));
}

function handleMIDI(msg) {
    const [status, data1, data2] = msg.data;
    const type = status & 0xF0;
    if (type === 0x90 && data2 > 0) {
        const cmd = MIDI_NOTE_MAP[data1];
        if (cmd) applyCommand(cmd);
    } else if (type === 0xB0) {
        const cmd = MIDI_CC_MAP[data1];
        if (cmd) applyCommand(cmd, data2 / 127);
    }
}

setupMIDI();


function draw() {
    if (!env.paused) {
        env.globalTime += deltaTime / 1000;
    }

    drawSky();

    for (let m of mountains) {
        m.draw();
    }

    for (let b of buildings) {
        if (!b.foreground) b.draw();
    }

    drawGround();

    for (let b of buildings) {
        if (b.foreground) b.draw();
    }

    if (env.aviationLights) {
        for (let av of aviationLights) {
            const alpha = 0.6 + 0.4 * sin(env.globalTime * av.freq + av.phase);
            drawingContext.shadowColor = `rgba(255, 32, 32, ${alpha})`;
            drawingContext.shadowBlur = 8;
            noStroke();
            fill(255, 30, 30, 255 * alpha);
            ellipse(av.x, av.y, 3, 3);
            drawingContext.shadowBlur = 0;
        }
    }

    for (let lamp of streetlamps) {
        lamp.draw();
    }

    drawFog();
}

function drawSky() {
    const dT = env.timeOfDay;
    const topColor = lerpColor(color(20, 18, 35), color(2, 3, 8), dT);
    const bottomColor = lerpColor(color(60, 35, 30), color(8, 8, 14), dT);

    for (let y = 0; y < height; y++) {
        const t = y / height;
        const c = lerpColor(topColor, bottomColor, t);
        stroke(c);
        line(0, y, width, y);
    }
    noStroke();
}

function drawGround() {
    const dT = env.timeOfDay;
    const topCol = lerpColor(color(18, 14, 22), color(4, 5, 10), dT);
    const botCol = lerpColor(color(15, 11, 20), color(10, 10, 14), dT);
    const groundTop = height * GROUND_Y;
    for (let y = groundTop; y < height; y++) {
        const t = (y - groundTop) / (height - groundTop);
        stroke(lerpColor(topCol, botCol, t));
        line(0, y, width, y);
    }
    noStroke();
}

function drawFog() {
    const fogTop = height * (0.4 - env.fog * 0.3);

    drawingContext.save();
    const grad = drawingContext.createLinearGradient(0, fogTop, 0, height);
    grad.addColorStop(0, `rgba(50, 50, 60, 0)`);
    grad.addColorStop(0.35, `rgba(55, 55, 65, ${env.fog * 0.45})`);
    grad.addColorStop(0.6, `rgba(60, 60, 70, ${0.3 + env.fog * 0.65})`);
    grad.addColorStop(1, `rgba(70, 70, 80, ${0.6 + env.fog * 0.4})`);
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, fogTop, width, height - fogTop);
    drawingContext.restore();
}


function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    setupScene();
}
