// --- 状态 ---
let narrativeState = 0; // 0: 日常, 1: 异常
let stateTimer = 0;
const STATE_DURATION = 15000; // 每阶段 15 秒
let autoPlayText = false; // 默认关闭自动播放

let timeOfDay = 1.0; // 0 = dusk, 1 = night — mirrors scene/sketch.js env.timeOfDay (CC 21)

let time1964 = new Date("1964-08-12T00:00:00").getTime();

// --- 调色 ---
const ledColors = {
    red: [255, 30, 30],
    green: [20, 255, 50],
    yellow: [255, 220, 0],
    orange: [255, 120, 0]
};

// --- 文本 ---
const gateTexts = [
    [{ t: "扫码缴费", c: "green" }, { t: "快速离场", c: "green" }, { t: "出入平安", c: "green" }],
    [{ t: "快速离场", c: "red" }, { t: "快", c: "yellow" }, { t: "快", c: "green" }]
];

const billboardTexts = [
    { slogan1: "创建文明社区", slogan2: "共建美好家园", cSlogan: "red" },
    { slogan1: "好人好马上三线", slogan2: "战天斗地建家园", cSlogan: "red" }
];

// --- 变量 ---
let mountains = [];
let aviationLights = [];
let gateMachine;
let mainBillboard;
let groundLevel;

// ==================
// TD
// ==================
window.toggleGate = function () {
    if (!gateMachine) return;
    // 手动控制后，关闭自动升降
    gateMachine.autoMode = false;

    // 状态切换
    if (gateMachine.armState === 0 || gateMachine.armState === 3) {
        gateMachine.armState = 1; // 如果正降下或已降下 -> 强制抬起
    } else {
        gateMachine.armState = 3; // 如果正抬起或已抬起 -> 强制降下
    }
};

window.toggleTextState = function () {
    // 手动控制后，关闭自动状态轮播
    autoPlayText = false;
    narrativeState = (narrativeState + 1) % 2;
    stateTimer = 0;
};


function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace');
    groundLevel = height * 1.05;

    setupMountains();

    // 横向大屏
    mainBillboard = new Billboard(width * 0.2, height * 0.45, width * 0.5, height * 0.25);

    // 门禁系统
    gateMachine = new GateMachine(groundLevel);
}

function setupMountains() {
    mountains = [];
    aviationLights = [];

    // 山脉
    const farRidgePoints = [
        { x: 0.00, y: 0.50 }, { x: 0.15, y: 0.40 }, { x: 0.30, y: 0.46 },
        { x: 0.50, y: 0.36 }, { x: 0.70, y: 0.44 }, { x: 0.85, y: 0.38 }, { x: 1.00, y: 0.46 }
    ];

    const ridgeSpecs = [
        { points: farRidgePoints, depth: 0.00 },
        { points: [{ x: 0.00, y: 0.58 }, { x: 0.20, y: 0.50 }, { x: 0.45, y: 0.56 }, { x: 0.60, y: 0.46 }, { x: 0.80, y: 0.52 }, { x: 1.00, y: 0.51 }], depth: 0.45 },
        { points: [{ x: 0.00, y: 0.72 }, { x: 0.18, y: 0.66 }, { x: 0.40, y: 0.70 }, { x: 0.62, y: 0.65 }, { x: 0.82, y: 0.69 }, { x: 1.00, y: 0.72 }], depth: 0.85 }
    ];

    for (const r of ridgeSpecs) {
        mountains.push(new Mountain(r.points, r.depth, groundLevel));
    }

    // 航空障碍灯
    for (let i = 1; i < farRidgePoints.length - 1; i++) {
        const prev = farRidgePoints[i - 1];
        const cur = farRidgePoints[i];
        const next = farRidgePoints[i + 1];
        if (cur.y < prev.y && cur.y < next.y) {
            aviationLights.push({
                xFrac: cur.x,
                yFrac: cur.y,
                freq: random(1.0, 1.8),
                phase: random(TWO_PI),
            });
        }
    }
}

function draw() {
    let dt = deltaTime;

    // --- 剧情状态机 (仅自动模式开启时执行) ---
    if (autoPlayText) {
        stateTimer += dt;
        if (stateTimer > STATE_DURATION) {
            stateTimer = 0;
            narrativeState = (narrativeState + 1) % 2;
        }
    }

    // --- 环境 ---
    noStroke();
    drawSky();

    // 背景山脉、航空灯与底部雾气
    for (let m of mountains) m.draw();
    drawAviationLights();
    drawFog();

    // 前景门禁光晕与栅栏
    drawAtmosphere();
    drawFence();

    // 实体设备
    mainBillboard.draw();
    drawGround();
    gateMachine.update(dt);
    gateMachine.draw();
}

// ==================
// 渲染辅助函数
// ==================

function drawSky() {
    // Same dusk→night palette as scene/sketch.js drawSky() so both scenes fade together.
    let topColor = lerpColor(color(20, 18, 35), color(2, 3, 8), timeOfDay);
    let bottomColor = lerpColor(color(60, 35, 30), color(8, 8, 14), timeOfDay);

    drawingContext.save();
    let grad = drawingContext.createLinearGradient(0, 0, 0, groundLevel);
    grad.addColorStop(0, topColor.toString());
    grad.addColorStop(1, bottomColor.toString());
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, 0, width, groundLevel);
    drawingContext.restore();
}

function drawAviationLights() {
    let t = millis() / 1000;
    for (let av of aviationLights) {
        const alpha = 0.6 + 0.4 * sin(t * av.freq + av.phase);
        drawingContext.shadowColor = `rgba(255, 32, 32, ${alpha})`;
        drawingContext.shadowBlur = 8;
        fill(255, 30, 30, 255 * alpha);
        ellipse(av.xFrac * width, av.yFrac * height, 3, 3);
    }
    drawingContext.shadowBlur = 0;
}

function drawFog() {
    let fogTop = height * 0.35;
    drawingContext.save();
    let grad = drawingContext.createLinearGradient(0, fogTop, 0, groundLevel);
    grad.addColorStop(0, `rgba(30, 30, 35, 0)`);
    grad.addColorStop(1, `rgba(40, 25, 30, 0.4)`);
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, fogTop, width, groundLevel - fogTop);
    drawingContext.restore();
}

function drawAtmosphere() {
    drawingContext.globalCompositeOperation = 'screen';
    let grad = drawingContext.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.4);
    grad.addColorStop(0, 'rgba(40, 25, 15, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, 0, width, height);
    drawingContext.globalCompositeOperation = 'source-over';
}

function drawFence() {
    stroke(15, 15, 18);
    strokeWeight(5);
    let fenceTop = groundLevel - 180;
    for (let x = 0; x < width; x += 35) {
        line(x, groundLevel, x, fenceTop);
    }
    line(0, fenceTop + 20, width, fenceTop + 20);
    line(0, fenceTop + 140, width, fenceTop + 140);
    noStroke();
}

function drawGround() {
    fill(5, 5, 6);
    rect(0, groundLevel, width, height - groundLevel);

    let carLightX = width * 0.45;
    let carLightY = height;

    drawingContext.globalCompositeOperation = 'screen';
    let grad = drawingContext.createRadialGradient(carLightX, carLightY, 0, carLightX, carLightY, height * 0.8);
    grad.addColorStop(0, 'rgba(200, 220, 255, 0.12)');
    grad.addColorStop(1, 'rgba(200, 220, 255, 0)');
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, groundLevel, width, height - groundLevel);
    drawingContext.globalCompositeOperation = 'source-over';
}

function drawLEDScreen(x, y, w, h, ledSize, drawContentFunc) {
    fill(8, 8, 8);
    rect(x, y, w, h);

    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(x, y, w, h);
    drawingContext.clip();

    drawContentFunc();

    drawingContext.restore();
    pop();

    stroke(2, 2, 2, 240);
    strokeWeight(ledSize * 0.4);
    for (let ix = x; ix <= x + w; ix += ledSize) {
        line(ix, y, ix, y + h);
    }
    for (let iy = y; iy <= y + h; iy += ledSize) {
        line(x, iy, x + w, iy);
    }
    noStroke();
}

// ==================
// 场景物体类定义
// ==================

class Mountain {
    constructor(points, depth, baseY) {
        this.points = points;
        this.depth = depth;
        this.baseY = baseY;
    }
    draw() {
        // Same dusk→night palette as scene/sketch.js Mountain.getColor() so ridges fade in lockstep.
        let duskFar = [55, 42, 52], duskClose = [20, 16, 26];
        let nightFar = [22, 26, 38], nightClose = [4, 6, 12];
        let far = [
            lerp(duskFar[0], nightFar[0], timeOfDay),
            lerp(duskFar[1], nightFar[1], timeOfDay),
            lerp(duskFar[2], nightFar[2], timeOfDay)
        ];
        let close = [
            lerp(duskClose[0], nightClose[0], timeOfDay),
            lerp(duskClose[1], nightClose[1], timeOfDay),
            lerp(duskClose[2], nightClose[2], timeOfDay)
        ];

        let c = color(
            lerp(far[0], close[0], this.depth),
            lerp(far[1], close[1], this.depth),
            lerp(far[2], close[2], this.depth)
        );

        fill(c);
        beginShape();
        vertex(0, this.baseY);
        for (let p of this.points) {
            vertex(p.x * width, p.y * height);
        }
        vertex(width, this.baseY);
        endShape(CLOSE);
    }
}

class GateMachine {
    constructor(baseY) {
        this.baseY = baseY;

        this.w = 140;
        this.h = 350;
        this.x = width * 0.8;
        this.y = baseY - this.h;

        this.poleW = 45;
        this.poleH = 220;
        this.poleX = width * 0.1;
        this.poleY = baseY - this.poleH;

        this.armX = this.poleX + this.poleW * 0.5;
        this.armY = this.poleY + 30;
        this.armL = this.x - this.armX - 15;
        this.armW = 12;
        this.armAngle = 0;

        this.armState = 0;
        this.timer = 0;
        this.autoMode = false; // 默认关闭自动起落模式
    }

    update(dt) {
        // 仅在自动模式下执行循环起落计时器
        if (this.autoMode) {
            this.timer += dt;
            if (this.armState === 0 && this.timer > 6000) { this.armState = 1; this.timer = 0; }
            if (this.armState === 2 && this.timer > 4000) { this.armState = 3; this.timer = 0; }
        }

        let speed = 0.0012 * dt;

        if (this.armState === 1) { // 抬起中
            this.armAngle -= speed;
            if (this.armAngle <= -HALF_PI) { this.armAngle = -HALF_PI; this.armState = 2; }
        } else if (this.armState === 3) { // 降下中
            this.armAngle += speed;
            if (this.armAngle >= 0) { this.armAngle = 0; this.armState = 0; }
        }
    }

    draw() {
        fill(10, 10, 12);
        rect(this.poleX, this.poleY, this.poleW, this.poleH, 4);

        fill(8, 8, 9);
        rect(this.x, this.y, this.w, this.h, 8);

        let screenY = this.y + 40;
        let screenH = 180;

        drawLEDScreen(this.x + 10, screenY, this.w - 20, screenH, 2.5, () => {
            let texts = gateTexts[narrativeState];
            textSize(28);
            textStyle(BOLD);

            let maxW = 0;
            for (let txt of texts) {
                maxW = max(maxW, textWidth(txt.t));
            }
            let startX = this.x + this.w / 2 - maxW / 2;
            textAlign(LEFT, CENTER);

            for (let i = 0; i < 3; i++) {
                let txtData = texts[i];
                let ty = screenY + 35 + i * 55;

                let flicker = 1;
                if (narrativeState === 1 && random() > 0.8) flicker = random(0.5, 1);

                let cArr = ledColors[txtData.c];
                let col = color(cArr[0], cArr[1], cArr[2], 255 * flicker);

                drawingContext.shadowBlur = 5;
                drawingContext.shadowColor = col.toString();
                fill(col);
                text(txtData.t, startX, ty);
            }
            drawingContext.shadowBlur = 0;
        });

        push();
        translate(this.armX, this.armY);
        let glitchAngle = (narrativeState === 1 && this.armAngle < 0 && this.armAngle > -HALF_PI) ? random(-0.02, 0.02) : 0;
        rotate(this.armAngle + glitchAngle);

        fill(220);
        rect(0, -this.armW / 2, this.armL, this.armW, 3);

        fill(180, 30, 30);
        for (let lx = 10; lx < this.armL - 10; lx += 45) {
            rect(lx, -this.armW / 2, 25, this.armW);
        }

        drawingContext.save();
        drawingContext.beginPath();
        drawingContext.rect(0, -this.armW / 2, this.armL, this.armW);
        drawingContext.clip();

        rotate(-(this.armAngle + glitchAngle));
        translate(-this.armX, -this.armY);

        drawingContext.globalCompositeOperation = 'screen';
        let lightX = width * 0.45;
        let lightY = this.armY;
        let bGrad = drawingContext.createRadialGradient(lightX, lightY, 0, lightX, lightY, 200);
        bGrad.addColorStop(0, 'rgba(220, 230, 255, 0.85)');
        bGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

        drawingContext.fillStyle = bGrad;
        drawingContext.fillRect(0, 0, width, height);
        drawingContext.globalCompositeOperation = 'source-over';

        drawingContext.restore();

        fill(25); ellipse(0, 0, 35, 35);
        fill(10); ellipse(0, 0, 15, 15);
        pop();
    }
}

class Billboard {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.pillarW = 25;
    }

    draw() {
        fill(10, 10, 12);
        rect(this.x + this.w * 0.15, this.y + this.h, this.pillarW, groundLevel - (this.y + this.h));
        rect(this.x + this.w * 0.85 - this.pillarW, this.y + this.h, this.pillarW, groundLevel - (this.y + this.h));

        fill(40, 40, 45);
        rect(this.x - 8, this.y - 8, this.w + 16, this.h + 16, 3);
        fill(20, 20, 25);
        rect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);

        drawLEDScreen(this.x, this.y, this.w, this.h, 2.5, () => {
            let data = billboardTexts[narrativeState];

            textAlign(CENTER, CENTER);
            textStyle(BOLD);

            let flickerS = (narrativeState === 1 && random() > 0.95) ? random(0.5, 1) : 1;
            let cRed = color(ledColors.red[0], ledColors.red[1], ledColors.red[2], 255 * flickerS);

            textSize(this.w * 0.06);
            drawingContext.shadowBlur = 8;
            drawingContext.shadowColor = cRed.toString();
            fill(cRed);

            text(data.slogan1, this.x + this.w / 2, this.y + this.h * 0.30);
            text(data.slogan2, this.x + this.w / 2, this.y + this.h * 0.55);

            let timeStr = this.getTimeString();

            let flickerT = 1;
            let cGrn = color(ledColors.green[0], ledColors.green[1], ledColors.green[2], 255 * flickerT);

            textSize(this.w * 0.04);
            drawingContext.shadowBlur = 6;
            drawingContext.shadowColor = cGrn.toString();
            fill(cGrn);
            text(timeStr, this.x + this.w / 2, this.y + this.h * 0.85);

            drawingContext.shadowBlur = 0;
        });
    }

    getTimeString() {
        if (narrativeState === 0) {
            return this.formatDate(new Date());
        } else {
            return this.formatDate(new Date(time1964 + millis()));
        }
    }

    formatDate(d) {
        let pad = (n) => n.toString().padStart(2, '0');
        const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${days[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
}

// ==================
// 窗口自适应
// ==================
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    groundLevel = height * 1.05;
    setupMountains();

    mainBillboard.x = width * 0.2;
    mainBillboard.y = height * 0.45;
    mainBillboard.w = width * 0.5;
    mainBillboard.h = height * 0.25;

    gateMachine.x = width * 0.8;
    gateMachine.y = groundLevel - gateMachine.h;
    gateMachine.poleX = width * 0.1;
    gateMachine.poleY = groundLevel - gateMachine.poleH;

    gateMachine.armX = gateMachine.poleX + gateMachine.poleW * 0.5;
    gateMachine.armY = gateMachine.poleY + 30;
    gateMachine.armL = gateMachine.x - gateMachine.armX - 15;
}

// ==================
// MIDI (TouchDesigner via IAC Driver)
// ==================
// CC 21 mirrors scene/sketch.js so the gate's sky fades in lockstep with the scene.
const MIDI_NOTE_MAP = {
    65: () => window.toggleGate(),
    66: () => window.toggleTextState(),
};
const MIDI_CC_MAP = {
    21: (v) => { timeOfDay = v; }, // 0=dusk → 1=night
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
        const fn = MIDI_NOTE_MAP[data1];
        if (fn) fn();
    } else if (type === 0xB0) {
        const fn = MIDI_CC_MAP[data1];
        if (fn) fn(data2 / 127);
    }
}

setupMIDI();
