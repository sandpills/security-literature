const CONFIG = {
    baseWidth: 320,
    baseHeight: 240,
    scaleFactor: 3,

    // 视觉滤镜
    tintColor: [255, 255, 255],
    textColor: [120, 255, 140],
    noiseAlpha: 5,      // 全局雪花噪点透明度 (0-255)
    scanlineAlpha: 150, // CRT 横向扫描线透明度 (0-255)

    // 故障效果 (Glitch)
    glitchProb: 0.04,        // 普通横向偏移的概率
    glitchIntensity: 8,      // 普通偏移的最大像素距
    majorGlitchProb: 0.005,  // 严重信号撕裂的概率
    majorGlitchIntensity: 40 // 严重撕裂的最大像素距
};

// 全局变量
let pg;       // 离屏绘图对象
let noiseTex; // 预渲染的噪点纹理缓存 (提升性能)
let timeOffset = 0;

// CAM 04 (9801楼四层) 空间扭曲触发状态机
let cam4GlitchState = {
    nextTriggerFrame: 1000,
    isActive: false,
    endFrame: 0
};

function setup() {
    createCanvas(CONFIG.baseWidth * CONFIG.scaleFactor, CONFIG.baseHeight * CONFIG.scaleFactor);
    noSmooth();

    // 创建离屏低保真画布
    pg = createGraphics(CONFIG.baseWidth, CONFIG.baseHeight);
    pg.noSmooth();
    pg.pixelDensity(1);

    // 预渲染全屏白噪点，提升运行帧率
    noiseTex = createGraphics(CONFIG.baseWidth, CONFIG.baseHeight);
    noiseTex.pixelDensity(1);
    noiseTex.loadPixels();
    for (let i = 0; i < noiseTex.pixels.length; i += 4) {
        let val = random(255);
        noiseTex.pixels[i] = val;
        noiseTex.pixels[i + 1] = val;
        noiseTex.pixels[i + 2] = val;
        noiseTex.pixels[i + 3] = CONFIG.noiseAlpha;
    }
    noiseTex.updatePixels();

    cam4GlitchState.nextTriggerFrame = floor(random(2700, 3900));
}

function draw() {
    background(0);
    timeOffset += 0.01;

    // 清空离屏画布
    pg.background(10);

    let quadW = CONFIG.baseWidth / 2;
    let quadH = CONFIG.baseHeight / 2;

    // ==========================================
    // 绘制四个监控画面
    // ==========================================

    // CAM 01 - 自行车棚 (左上)
    pg.push();
    pg.translate(0, 0);
    drawCam1(quadW, quadH);
    pg.pop();

    // CAM 02 - 二号锅炉房 (右上)
    pg.push();
    pg.translate(quadW, 0);
    drawCam2(quadW, quadH);
    pg.pop();

    // CAM 03 - 白崖溪老寨 (左下)
    pg.push();
    pg.translate(0, quadH);
    drawCam3(quadW, quadH);
    pg.pop();

    // CAM 04 - 9801栋四层 (右下)
    pg.push();
    pg.translate(quadW, quadH);
    drawCam4(quadW, quadH);
    pg.pop();

    // 十字分割线
    pg.stroke(200, 100);
    pg.strokeWeight(1);
    pg.line(quadW, 0, quadW, CONFIG.baseHeight);
    pg.line(0, quadH, CONFIG.baseWidth, quadH);

    // 全局动态噪点 (随机偏移预渲染纹理)
    pg.image(noiseTex, random(-50, 0), random(-50, 0), CONFIG.baseWidth + 50, CONFIG.baseHeight + 50);

    // 屏幕全局暗角 (在文字图层下方)
    pg.noFill();
    for (let i = 0; i < 15; i++) {
        pg.stroke(0, i * 12);
        pg.strokeWeight(1);
        pg.rect(i, i, CONFIG.baseWidth - i * 2, CONFIG.baseHeight - i * 2);
    }

    // ==========================================
    // 顶层 UI (位于暗角之上)
    // ==========================================
    pg.push(); pg.translate(0, 0);         drawOverlayUI(0, 0, quadW, 1, "CAM 01", "[自行车棚]");     pg.pop();
    pg.push(); pg.translate(quadW, 0);     drawOverlayUI(0, 0, quadW, 2, "CAM 02", "[二号锅炉房]");   pg.pop();
    pg.push(); pg.translate(0, quadH);     drawOverlayUI(0, 0, quadW, 3, "CAM 03", "[白崖溪老寨]");   pg.pop();
    pg.push(); pg.translate(quadW, quadH); drawOverlayUI(0, 0, quadW, 4, "CAM 04", "[9801栋-四层]"); pg.pop();

    // ==========================================
    // 后期处理：tint + 切片撕裂 + CRT 扫描线
    // ==========================================
    tint(CONFIG.tintColor[0], CONFIG.tintColor[1], CONFIG.tintColor[2]);

    let y = 0;
    let sliceH = 2;
    let isGlitchBurst = noise(timeOffset * 1.5) > 0.72;

    while (y < CONFIG.baseHeight) {
        let offsetX = 0;
        if (isGlitchBurst) {
            if (random() < CONFIG.glitchProb) {
                offsetX = random(-CONFIG.glitchIntensity, CONFIG.glitchIntensity);
            }
            if (random() < CONFIG.majorGlitchProb) {
                offsetX = random(-CONFIG.majorGlitchIntensity, CONFIG.majorGlitchIntensity);
            }
        }
        image(
            pg,
            offsetX * CONFIG.scaleFactor, y * CONFIG.scaleFactor, CONFIG.baseWidth * CONFIG.scaleFactor, sliceH * CONFIG.scaleFactor,
            0, y, CONFIG.baseWidth, sliceH
        );
        y += sliceH;
    }

    noTint();

    // CRT 扫描线
    stroke(0, CONFIG.scanlineAlpha);
    strokeWeight(1.5);
    for (let i = 0; i < height; i += 3) {
        line(0, i, width, i);
    }
}

/** CAM 01 - 自行车棚
 *  倾斜棚顶 + 几辆停得歪斜的自行车 + 一辆翻倒的，
 *  头顶昏暗灯泡随机闪烁；偶发黑影从右侧探出。
 */
function drawCam1(w, h) {
    pg.noStroke();
    pg.fill(15);
    pg.rect(0, 0, w, h);

    // 棚顶 (倾斜的雨棚轮廓)
    pg.fill(25);
    pg.quad(0, 0, w, 0, w, 30, 0, 45);
    pg.stroke(50);
    pg.strokeWeight(1);
    pg.line(0, 45, w, 30);
    pg.noStroke();

    // 立柱
    pg.fill(6);
    pg.rect(w * 0.25, 36, 8, h);
    pg.rect(w * 0.75, 32, 10, h);

    // 地面
    pg.fill(22);
    pg.rect(0, h * 0.6, w, h * 0.4);

    // 头顶昏暗灯泡 (闪烁)
    let lightFlicker = noise(timeOffset * 4) > 0.4 ? 255 : 100;
    if (lightFlicker > 100) {
        pg.fill(255, 15);
        pg.ellipse(w * 0.5, h * 0.75, 120, 30); // 地面光斑
    }

    // 自行车 (一辆翻倒)
    let bikes = [
        { x: w * 0.22, y: h * 0.68, s: 0.45, angle:  1.2, isFallen: false, col: 45 },
        { x: w * 0.62, y: h * 0.63, s: 0.35, angle: -0.8, isFallen: false, col: 35 },
        { x: w * 0.45, y: h * 0.75, s: 0.50, angle:  0.1, isFallen: false, col: 55 },
        { x: w * 0.82, y: h * 0.78, s: 0.55, angle:  0.0, isFallen: true,  col: 40 }
    ];
    bikes.sort((a, b) => a.y - b.y); // y 排序避免遮挡顺序错乱

    for (let i = 0; i < bikes.length; i++) {
        let b = bikes[i];
        pg.push();
        pg.translate(b.x, b.y);
        pg.scale(b.s);
        let strokeW = 1.2 / b.s;
        pg.strokeWeight(strokeW);

        let cosA = Math.cos(b.angle);
        let sinA = Math.sin(b.angle);
        let wheelW, wheelH, frameY;
        if (b.isFallen) {
            wheelW = 24; wheelH = 8; frameY = 0.25;
            pg.rotate(0.15);
            cosA = 1; sinA = 0;
        } else {
            wheelW = max(22 * Math.abs(cosA), 4);
            wheelH = 24;
            frameY = 1.0;
        }
        let proj = (lx, ly) => ({ x: lx * cosA, y: ly * frameY + lx * sinA * 0.4 });
        let pRAxle = proj(-20, 0);
        let pFAxle = proj(20, 0);
        let pBB    = proj(-4, 0);
        let pSeat  = proj(-10, -18);
        let pHeadB = proj(12, -18);
        let pHeadT = proj(10, -25);

        // 灯泡亮起时绘制阴影
        if (lightFlicker > 100) {
            let distToLightX = Math.abs(b.x - w * 0.5);
            let shadowAlpha = map(distToLightX, 30, 65, 180, 0, true);
            if (b.isFallen) {
                pg.noStroke();
                pg.fill(5, shadowAlpha);
                pg.ellipse(-10, wheelH / 2 + 2, 28, 12);
            } else {
                pg.stroke(5, shadowAlpha);
                pg.strokeWeight(8);
                pg.line(pRAxle.x, pRAxle.y + wheelH / 2, pFAxle.x, pFAxle.y + wheelH / 2);
                pg.noStroke();
                pg.strokeWeight(strokeW);
            }
        }

        // 车轮
        pg.stroke(b.col);
        pg.noFill();
        pg.ellipse(pRAxle.x, pRAxle.y, wheelW, wheelH);
        pg.ellipse(pFAxle.x, pFAxle.y, wheelW, wheelH);

        // 主车架
        pg.stroke(b.col + 20);
        pg.line(pRAxle.x, pRAxle.y, pBB.x, pBB.y);
        pg.line(pBB.x, pBB.y, pSeat.x, pSeat.y);
        pg.line(pSeat.x, pSeat.y, pRAxle.x, pRAxle.y);
        pg.line(pBB.x, pBB.y, pHeadB.x, pHeadB.y);
        pg.line(pHeadB.x, pHeadB.y, pSeat.x, pSeat.y);
        pg.line(pFAxle.x, pFAxle.y, pHeadB.x, pHeadB.y);
        pg.line(pHeadB.x, pHeadB.y, pHeadT.x, pHeadT.y);

        // 把手与坐垫
        pg.stroke(b.col + 30);
        if (b.isFallen) {
            pg.line(pHeadT.x, pHeadT.y, pHeadT.x + 8, pHeadT.y - 8);
            pg.line(pBB.x, pBB.y, pBB.x + 4, pBB.y - 6);
        } else {
            let hbDx = 8 * sinA;
            let hbDy = 2 * cosA;
            pg.line(pHeadT.x - hbDx, pHeadT.y - hbDy, pHeadT.x + hbDx, pHeadT.y + hbDy);
            pg.line(pSeat.x, pSeat.y, pSeat.x - 2 * cosA, pSeat.y - 4);
            pg.line(pSeat.x - 6 * cosA, pSeat.y - 4, pSeat.x + 4 * cosA, pSeat.y - 4 + 2 * sinA * 0.4);
        }
        pg.pop();
    }

    // 灯泡本体
    pg.noStroke();
    pg.fill(lightFlicker, 220);
    pg.ellipse(w * 0.5, 36, 10, 4);

    // 【怪异事件】偶发黑影
    if (noise(timeOffset * 0.2) > 0.88) {
        pg.fill(2);
        let shadowX = w * 0.80 + noise(timeOffset) * 6;
        pg.rect(shadowX, h * 0.45, 12, 30, 4);
        pg.ellipse(shadowX + 6, h * 0.42, 10, 10);
    }
}

/** CAM 02 - 地下车库 / 设备房视角 */
function drawCam2(w, h) {
    pg.noStroke();
    pg.fill(18);
    pg.rect(0, 0, w, h);

    // 远处的微弱灯光
    pg.fill(90, 120);
    pg.ellipse(w * 0.7, h * 0.4, 60, 30);

    // 粗大的承重柱 (压暗)
    pg.fill(5);
    pg.rect(w * 0.15, 0, 30, h); // 前景柱子
    pg.fill(8);
    pg.rect(w * 0.65, h * 0.2, 20, h); // 中景柱子

    // 顶部管道
    pg.fill(4);
    pg.rect(0, 10, w, 8);
    pg.rect(0, 25, w, 5);

    // 空气中的灰尘
    for (let i = 0; i < 15; i++) {
        let dx = (noise(i, timeOffset * 0.2) * w * 1.5) % w;
        let dy = (noise(i + 50, timeOffset * 0.2) * h * 1.5) % h;
        pg.fill(255, 90);
        pg.rect(dx, dy, 1, 1);
    }

    // 【怪异事件】柱子后蠕动的黑影
    if (noise(timeOffset * 0.15) > 0.85) {
        pg.fill(0);
        let peekX = w * 0.15 + 30 + noise(timeOffset) * 8;
        pg.ellipse(peekX, h * 0.6, 15, 25);
    }
}

/** CAM 03 - 白崖溪老寨 (小区花园 / 人工湖夜景) */
function drawCam3(w, h) {
    pg.noStroke();
    pg.fill(15);
    pg.rect(0, 0, w, h);

    // 偶发的极轻微花屏 (信号微闪，比白闪更隐蔽)
    if (random() < 0.0003) {
        pg.fill(22);
        pg.rect(0, 0, w, h);
        return;
    }

    let offX = w * 0.12; // 整体右移，构图错位

    // 远处地平线 / 灌木丛 (随风缓慢起伏)
    pg.fill(2);
    pg.beginShape();
    pg.vertex(0, h);
    for (let x = 0; x <= w; x += 10) {
        let y = h * 0.5 + noise(x * 0.05, timeOffset * 0.3) * 15;
        pg.vertex(x, y);
    }
    pg.vertex(w, h);
    pg.endShape(CLOSE);

    // 弯曲的小径
    pg.fill(35);
    pg.beginShape();
    pg.vertex(w * 0.3 + offX, h);
    pg.vertex(w * 0.7 + offX, h);
    pg.vertex(w * 0.55 + offX, h * 0.5);
    pg.vertex(w * 0.45 + offX, h * 0.5);
    pg.endShape(CLOSE);

    // 远处的一盏路灯
    pg.fill(255, 40);
    pg.ellipse(w * 0.25 + offX, h * 0.3, 50, 50); // 光晕
    pg.fill(255, 150);
    pg.ellipse(w * 0.25 + offX, h * 0.3, 8, 8);   // 灯泡

    // 灯杆
    pg.stroke(2);
    pg.strokeWeight(2);
    pg.line(w * 0.25 + offX, h * 0.3, w * 0.25 + offX, h * 0.6);
    pg.noStroke();
}

/** CAM 04 - 9801楼四层 (电梯间视角)
 *  长时间死寂的电梯门，以状态机触发的空间扭曲事件 (60-120 帧 / 2700-3900 帧间隔)
 */
function drawCam4(w, h) {
    pg.noStroke();
    pg.fill(25);
    pg.rect(0, 0, w, h);

    // 状态机：触发空间扭曲
    if (!cam4GlitchState.isActive && frameCount >= cam4GlitchState.nextTriggerFrame) {
        cam4GlitchState.isActive = true;
        cam4GlitchState.endFrame = frameCount + floor(random(60, 120));
    }

    if (cam4GlitchState.isActive) {
        if (frameCount >= cam4GlitchState.endFrame) {
            cam4GlitchState.isActive = false;
            cam4GlitchState.nextTriggerFrame = frameCount + floor(random(2700, 3900));
        }

        // 异常状态：几何错乱 + 漂移 + 撕裂线
        pg.fill(random(5, 35));
        pg.rect(0, 0, w, h);

        pg.push();
        let driftX = random(-30, 30);
        let driftY = random(-10, 10);
        pg.translate(driftX, driftY);

        pg.fill(5);
        pg.quad(
            w * 0.2 + random(-15, 15), h * 0.25,
            w * 0.8 + random(-15, 15), h * 0.25,
            w * 0.9, h * 0.95,
            w * 0.1, h * 0.95
        );

        pg.stroke(0);
        pg.strokeWeight(2);
        let gapX = w * 0.5 + random(-10, 10);
        pg.line(gapX, h * 0.25, gapX, h);

        pg.stroke(100, 20);
        pg.line(gapX + 5, h * 0.25, gapX + 5, h);
        pg.pop();
    } else {
        // 正常状态：死寂的电梯门
        let doorTop = h * 0.35;
        pg.fill(35);
        pg.rect(w * 0.3, doorTop, w * 0.4, h - doorTop);
        pg.stroke(0);
        pg.strokeWeight(1);
        pg.line(w * 0.5, doorTop, w * 0.5, h);

        // 楼层显示器
        let dispTop = h * 0.22;
        pg.fill(5);
        pg.noStroke();
        pg.rect(w * 0.42, dispTop, w * 0.16, 12);
        pg.fill(200, 150);
        pg.rect(w * 0.45, dispTop + 2, 4, 8); // F
        pg.rect(w * 0.52, dispTop + 2, 6, 8); // 4
    }
}

/** 顶层 UI: 标题 + 时间码 */
function drawOverlayUI(x, y, w, camId, camTitle, locationInfo) {
    pg.fill(CONFIG.textColor[0], CONFIG.textColor[1], CONFIG.textColor[2]);
    pg.noStroke();
    pg.textFont('monospace');
    pg.textSize(8);

    // 外侧避开暗角的宽边距，内侧贴合中线的窄边距
    let outerPad = 18;
    let innerPad = 4;
    let leftPadX, rightPadX, topPadY;

    if (camId === 1) {        // 左上
        leftPadX = outerPad; rightPadX = innerPad; topPadY = outerPad;
    } else if (camId === 2) { // 右上
        leftPadX = innerPad; rightPadX = outerPad; topPadY = outerPad;
    } else if (camId === 3) { // 左下
        leftPadX = outerPad; rightPadX = innerPad; topPadY = innerPad;
    } else if (camId === 4) { // 右下
        leftPadX = innerPad; rightPadX = outerPad; topPadY = innerPad;
    }

    pg.textAlign(LEFT, TOP);
    pg.text(camTitle, x + leftPadX, y + topPadY);
    pg.text(locationInfo, x + leftPadX, y + topPadY + 11);

    pg.textAlign(RIGHT, TOP);
    let dateStr = "";
    let timeStr = "";
    let blink = "";

    if (camId === 1) {
        // CAM 01 - 自行车棚: 倒流的 1961
        let s = 59 - (floor(frameCount / 60) % 60);
        let ss = s < 10 ? '0' + s : s;
        dateStr = "1961/11/01";
        timeStr = `04:15:${ss}`;
    } else if (camId === 2) {
        // CAM 02 - 锅炉房: 锁死的 1992 + 乱码
        dateStr = "1992/08/██";
        timeStr = "17:30:00";
    } else if (camId === 3) {
        // CAM 03 - 白崖溪老寨: 偶尔回到建校前的闰二月
        if (noise(timeOffset * 0.3, 100) > 0.80) {
            dateStr = "1957/02/29";
            timeStr = "00:00:00";
        } else {
            let s = floor(frameCount / 60) % 60;
            let ss = s < 10 ? '0' + s : s;
            dateStr = "2026/11/01";
            timeStr = `04:15:${ss}`;
        }
    } else if (camId === 4) {
        // CAM 04 - 9801: 完全错乱的时间码 + 疯狂 REC 闪烁
        dateStr = `1999/12/${floor(random(32, 99))}`;
        timeStr = `${floor(random(25, 99))}:${floor(random(60, 99))}:${floor(random(60, 99))}`;
        blink = random() > 0.5 ? "REC " : "    ";
    }

    pg.text(dateStr, x + w - rightPadX, y + topPadY);
    pg.text(`${blink}${timeStr}`, x + w - rightPadX, y + topPadY + 11);
}
