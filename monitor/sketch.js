const CONFIG = {
    baseWidth: 320,
    baseHeight: 240,
    scaleFactor: 3,

    // 视觉滤镜
    tintColor: [255, 255, 255],
    textColor: [120, 255, 140],
    noiseAlpha: 12,   // 全局雪花噪点透明度 (0-255)
    scanlineAlpha: 150, // CRT 横向扫描线透明度 (0-255)

    // 故障效果 (Glitch)
    glitchProb: 0.04,   // 普通横向偏移的概率
    glitchIntensity: 8, // 普通偏移的最大像素距
    majorGlitchProb: 0.005,  // 严重信号撕裂的概率
    majorGlitchIntensity: 40 // 严重撕裂的最大像素距
};

// 全局变量
let pg;       // 离屏绘图对象
let noiseTex; // 预渲染的噪点纹理缓存 (提升性能)
let timeOffset = 0;

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
}

function draw() {
    background(0);
    timeOffset += 0.01;

    // 清空离屏画布
    pg.background(10);

    let quadW = CONFIG.baseWidth / 2;
    let quadH = CONFIG.baseHeight / 2;

    // ==========================================
    // 绘制四个监控画面 (局部位移，方便绘制)
    // ==========================================

    // CAM 01 - 5902楼走廊
    pg.push();
    pg.translate(0, 0);
    drawCam1(quadW, quadH);
    pg.pop();

    // CAM 02 - 废弃锅炉房
    pg.push();
    pg.translate(quadW, 0);
    drawCam2(quadW, quadH);
    pg.pop();

    // CAM 03 - 9801楼四层 (不存在的楼层)
    pg.push();
    pg.translate(0, quadH);
    drawCam3(quadW, quadH);
    pg.pop();

    // CAM 04 - 白崖溪老寨
    pg.push();
    pg.translate(quadW, quadH);
    drawCam4(quadW, quadH);
    pg.pop();

    // 绘制十字分割线
    pg.stroke(200, 100);
    pg.strokeWeight(1);
    pg.line(quadW, 0, quadW, CONFIG.baseHeight);
    pg.line(0, quadH, CONFIG.baseWidth, quadH);

    // 覆盖全局动态噪点 (通过随机偏移预渲染纹理实现动画)
    pg.image(noiseTex, random(-50, 0), random(-50, 0), CONFIG.baseWidth + 50, CONFIG.baseHeight + 50);

    // 屏幕全局暗角 (在离屏画布上绘制，处于文字图层下方，避免重叠)
    pg.noFill();
    for (let i = 0; i < 15; i++) {
        pg.stroke(0, i * 12);
        pg.strokeWeight(1);
        pg.rect(i, i, CONFIG.baseWidth - i * 2, CONFIG.baseHeight - i * 2);
    }

    // ==========================================
    // 统一绘制顶层 UI (避免被底层的暗角和画面元素遮挡)
    // ==========================================
    pg.push(); pg.translate(0, 0); drawOverlayUI(0, 0, quadW, 1, "CH-01", "[5902栋-内走廊]"); pg.pop();
    pg.push(); pg.translate(quadW, 0); drawOverlayUI(0, 0, quadW, 2, "CH-02", "[二号锅炉房]"); pg.pop();
    pg.push(); pg.translate(0, quadH); drawOverlayUI(0, 0, quadW, 3, "CH-03", "[9801栋-四层]"); pg.pop();
    pg.push(); pg.translate(quadW, quadH); drawOverlayUI(0, 0, quadW, 4, "CH-04", "[白崖溪老寨]"); pg.pop();

    // ==========================================
    // 后期处理：渲染到主画布 + 故障/扫描线
    // ==========================================

    // 应用夜视颜色滤镜
    tint(CONFIG.tintColor[0], CONFIG.tintColor[1], CONFIG.tintColor[2]);

    // 切片渲染机制 (模拟信号撕裂 Glitch)
    let y = 0;
    let sliceH = 2; // 每次切分 2 个低分辨率像素的高度

    // 使用 Perlin Noise 控制故障爆发的随机时间间隔
    let isGlitchBurst = noise(timeOffset * 1.5) > 0.72;

    while (y < CONFIG.baseHeight) {
        let offsetX = 0;

        // 只有在故障爆发期才执行画面撕裂，降低整体频率并增加随机感
        if (isGlitchBurst) {
            if (random() < CONFIG.glitchProb) {
                offsetX = random(-CONFIG.glitchIntensity, CONFIG.glitchIntensity);
            }
            if (random() < CONFIG.majorGlitchProb) {
                offsetX = random(-CONFIG.majorGlitchIntensity, CONFIG.majorGlitchIntensity);
            }
        }

        // 使用 image() 函数截取特定行并偏移绘制到主画布
        // image(img, dx, dy, dW, dH, sx, sy, sW, sH)
        image(
            pg,
            offsetX * CONFIG.scaleFactor, y * CONFIG.scaleFactor, CONFIG.baseWidth * CONFIG.scaleFactor, sliceH * CONFIG.scaleFactor,
            0, y, CONFIG.baseWidth, sliceH
        );
        y += sliceH;
    }

    noTint(); // 移除滤镜，准备绘制 UI 层罩

    // 绘制 CRT 扫描线 (主画布分辨率)
    stroke(0, CONFIG.scanlineAlpha);
    strokeWeight(1.5);
    for (let i = 0; i < height; i += 3) {
        line(0, i, width, i);
    }
}

/** * CAM 01 - 真实走廊透视
 */
function drawCam1(w, h) {
    pg.noStroke();
    pg.fill(22); // 稍微提亮基础背景
    pg.rect(0, 0, w, h);
    let vpX = w / 2;
    let vpY = h / 2 - 10;

    // 地板 (明显提亮，拉开与墙壁的对比)
    pg.fill(50);
    pg.noStroke();
    pg.beginShape();
    pg.vertex(0, h); pg.vertex(vpX - 15, vpY); pg.vertex(vpX + 15, vpY); pg.vertex(w, h);
    pg.endShape(CLOSE);

    // 墙壁上的门框 (模拟真实的公寓走廊)
    pg.stroke(5); // 加深线条，增强立体感
    pg.strokeWeight(1);
    for (let i = 0; i < 3; i++) {
        let xOff = map(i, 0, 2, 20, 70);
        let yOff = map(i, 0, 2, 10, 50);
        pg.fill(20);
        // 左侧门
        pg.quad(xOff, h - yOff, xOff, yOff + 10, xOff + 8, yOff + 15, xOff + 8, h - yOff - 5);
        // 右侧门
        pg.quad(w - xOff, h - yOff, w - xOff, yOff + 10, w - xOff - 8, yOff + 15, w - xOff - 8, h - yOff - 5);
    }

    // 走廊尽头昏暗的灯光 (强化高光)
    pg.noStroke();
    if (noise(timeOffset * 3) > 0.3) {
        pg.fill(255, 220); // 更刺眼的白光
        pg.rect(vpX - 6, vpY - 20, 12, 3);
        pg.fill(255, 60);  // 更亮的光晕
        pg.ellipse(vpX, vpY - 18, 40, 20);
    }

    // 【怪异事件】极低概率出现走廊尽头的黑影
    if (noise(timeOffset * 0.2) > 0.88) {
        pg.fill(2); // 黑影更黑
        pg.rect(vpX - 3, vpY - 5, 6, 18);
        pg.ellipse(vpX, vpY - 7, 5, 5); // 头
    }
}

/** * CAM 02 - 地下车库 / 设备房视角
 */
function drawCam2(w, h) {
    pg.noStroke();
    pg.fill(18); // 提亮环境底色
    pg.rect(0, 0, w, h);

    // 远处的微弱灯光 (提亮)
    pg.noStroke();
    pg.fill(90, 120);
    pg.ellipse(w * 0.7, h * 0.4, 60, 30);

    // 粗大的承重柱 (压暗，形成强对比)
    pg.fill(5);
    pg.rect(w * 0.15, 0, 30, h); // 前景柱子
    pg.fill(8);
    pg.rect(w * 0.65, h * 0.2, 20, h); // 中景柱子

    // 顶部的管道
    pg.fill(4);
    pg.rect(0, 10, w, 8);
    pg.rect(0, 25, w, 5);

    // 空气中的灰尘飞舞 (更白、更清晰)
    for (let i = 0; i < 15; i++) {
        let dx = (noise(i, timeOffset * 0.2) * w * 1.5) % w;
        let dy = (noise(i + 50, timeOffset * 0.2) * h * 1.5) % h;
        pg.fill(255, 90);
        pg.rect(dx, dy, 1, 1);
    }

    // 【怪异事件】偶尔从柱子后探出的半个身子或黑影
    let shadowActive = noise(timeOffset * 0.15) > 0.85;
    if (shadowActive) {
        pg.fill(0);
        let peekX = w * 0.15 + 30 + noise(timeOffset) * 8; // 在柱子边缘蠕动
        pg.ellipse(peekX, h * 0.6, 15, 25);
    }
}

/** * CAM 03 - 9801楼四层 (电梯间视角)
 */
function drawCam3(w, h) {
    pg.noStroke();
    pg.fill(25); // 提亮底色
    pg.rect(0, 0, w, h);

    // 【怪异事件】这层楼的信号偶尔会发生空间扭曲
    let isGlitching = noise(timeOffset * 0.3) > 0.85;

    if (isGlitching) {
        pg.fill(random(10, 100)); // 故障闪烁时的亮度范围拉大
        pg.rect(0, 0, w, h);
        pg.fill(5);
        // 错乱的透视几何
        pg.quad(
            w * 0.2 + random(-10, 10), h * 0.1,
            w * 0.8 + random(-10, 10), h * 0.1 + random(-20, 20),
            w * 0.9, h * 0.9,
            w * 0.1, h * 0.9
        );
    } else {
        // 大部分时间是正常的、死寂的电梯门 (提亮门面)
        pg.fill(35);
        pg.rect(w * 0.25, h * 0.15, w * 0.5, h * 0.85); // 电梯外框

        // 电梯门中缝 (压暗)
        pg.stroke(0);
        pg.strokeWeight(1);
        pg.line(w * 0.5, h * 0.15, w * 0.5, h);

        // 楼层显示器
        pg.fill(5);
        pg.noStroke();
        pg.rect(w * 0.42, h * 0.05, w * 0.16, 12);

        // 散发着微弱红光的 "F4" (在黑白模式下显示为亮灰)
        pg.fill(200, 150);
        pg.rect(w * 0.45, h * 0.07, 4, 8);
        pg.rect(w * 0.52, h * 0.07, 6, 8);
    }
}

/** * CAM 04 - 白崖溪老寨 (小区花园/人工湖夜景)
 */
function drawCam4(w, h) {
    pg.noStroke();
    pg.fill(15); // 提亮夜空/远景
    pg.rect(0, 0, w, h);

    // 偶发的花屏信号丢失
    if (random() < 0.005) {
        pg.fill(255);
        pg.rect(0, 0, w, h);
        return;
    }

    // 远处的地平线与灌木丛轮廓 (压暗)
    pg.noStroke();
    pg.fill(2);
    pg.beginShape();
    pg.vertex(0, h);
    for (let x = 0; x <= w; x += 10) {
        // 随风极其缓慢摆动的树丛
        let y = h * 0.5 + noise(x * 0.05, timeOffset * 0.3) * 15;
        pg.vertex(x, y);
    }
    pg.vertex(w, h);
    pg.endShape(CLOSE);

    // 弯曲的小径 (提亮)
    pg.fill(35);
    pg.beginShape();
    pg.vertex(w * 0.3, h);
    pg.vertex(w * 0.7, h);
    pg.vertex(w * 0.55, h * 0.5);
    pg.vertex(w * 0.45, h * 0.5);
    pg.endShape(CLOSE);

    // 远处的一盏路灯 (强化高光)
    pg.fill(255, 40);
    pg.ellipse(w * 0.25, h * 0.3, 50, 50); // 光晕
    pg.fill(255, 150);
    pg.ellipse(w * 0.25, h * 0.3, 8, 8);  // 灯泡

    // 路灯杆
    pg.stroke(2);
    pg.strokeWeight(2);
    pg.line(w * 0.25, h * 0.3, w * 0.25, h * 0.6);
    pg.noStroke();
}

/**
 * 绘制统一的 UI 层 (去除底色，避免文字与边框重叠)
 */
function drawOverlayUI(x, y, w, camId, camTitle, locationInfo) {
    pg.fill(CONFIG.textColor[0], CONFIG.textColor[1], CONFIG.textColor[2]); // 应用绿色文字
    pg.noStroke();
    pg.textFont('monospace');
    pg.textSize(8);

    // 定义两种边距：外侧躲避暗角的宽边距，和内侧贴合中线的窄边距
    let outerPad = 18;
    let innerPad = 4;

    let leftPadX, rightPadX, topPadY;

    // 根据不同分屏的位置，动态分配边距
    if (camId === 1) {
        leftPadX = outerPad;  // CH-01: 贴左上外侧
        rightPadX = innerPad; // 1961: 贴中线左侧
        topPadY = outerPad;
    } else if (camId === 2) {
        leftPadX = innerPad;  // CH-02: 贴中线右侧
        rightPadX = outerPad; // 1992: 贴右上外侧
        topPadY = outerPad;
    } else if (camId === 3) {
        leftPadX = outerPad;  // CH-03: 贴左下外侧
        rightPadX = innerPad; // 1999: 贴中线左侧
        topPadY = innerPad;   // 整体上挪贴合水平中线下侧
    } else if (camId === 4) {
        leftPadX = innerPad;  // CH-04: 贴中线右侧
        rightPadX = outerPad; // 2026: 贴右下外侧
        topPadY = innerPad;   // 整体上挪贴合水平中线下侧
    }

    pg.textAlign(LEFT, TOP);

    // 左上角信息
    pg.text(camTitle, x + leftPadX, y + topPadY);
    pg.text(locationInfo, x + leftPadX, y + topPadY + 11);

    // 右上角跳动时间码
    pg.textAlign(RIGHT, TOP);

    let dateStr = "";
    let timeStr = "";
    let blink = frameCount % 60 < 30 ? "REC" : "   ";

    if (camId === 1) {
        // CAM 01: 倒流的时间 (1961年)
        let s = 59 - (floor(frameCount / 60) % 60);
        let ss = s < 10 ? '0' + s : s;
        dateStr = "1961/11/01";
        timeStr = `04:15:${ss}`;
    } else if (camId === 2) {
        // CAM 02: 锁死的时间与乱码 (1992年)
        dateStr = "1992/08/██";
        timeStr = "17:30:00";
        if (random() < 0.05) blink = "REC"; // 偶尔卡顿闪烁
    } else if (camId === 3) {
        // CAM 03: 疯狂错乱的绝对错误时间 (1999年)
        let d = floor(random(32, 99));
        let h = floor(random(25, 99));
        let m = floor(random(60, 99));
        let s = floor(random(60, 99));
        dateStr = `1999/12/${d}`;
        timeStr = `${h}:${m}:${s}`;
        blink = random() > 0.5 ? "REC" : "   "; // 疯狂闪烁
    } else if (camId === 4) {
        // CAM 04: 偶尔闪烁回建校前 (1957年闰二月)
        if (random() < 0.05 || noise(timeOffset * 5) > 0.85) {
            dateStr = "1957/02/29";
            timeStr = "00:00:00";
            blink = "REC"; // 撕裂时强制闪亮
        } else {
            let s = floor(frameCount / 60) % 60;
            let ss = s < 10 ? '0' + s : s;
            dateStr = "2026/11/01";
            timeStr = `04:15:${ss}`;
        }
    }

    pg.text(dateStr, x + w - rightPadX, y + topPadY);
    pg.text(`${blink} ${timeStr}`, x + w - rightPadX, y + topPadY + 11);
}
