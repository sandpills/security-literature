const CONFIG = {
    baseWidth: 320,        
    baseHeight: 240,       
    scaleFactor: 3,        

    tintColor: [255, 255, 255], 
    textColor: [120, 255, 140], 
    noiseAlpha: 5,              
    scanlineAlpha: 150,         

    glitchProb: 0.04,        
    glitchIntensity: 8,      
    majorGlitchProb: 0.005,  
    majorGlitchIntensity: 40 
};

let pg;       
let noiseTex; 
let timeOffset = 0;

let manualTriggers = { 1: false, 2: false, 3: false, 4: false };

// 全局异常实体
let shadowEntity = {
    active: false,
    state: 'TRANSIT', // ENTERING(进入), WANDERING(徘徊), LEAVING(离开), TRANSIT(转场)
    camId: 1, 
    x: 0, y: 0,       // 这里的 y 指的是黑影的脚底板接触地面的位置
    targetX: 0, targetY: 0,
    speed: 0.35,
    transitTimer: 0,
    wanderCount: 0
};

function setup() {
    createCanvas(CONFIG.baseWidth * CONFIG.scaleFactor, CONFIG.baseHeight * CONFIG.scaleFactor);
    noSmooth(); 

    pg = createGraphics(CONFIG.baseWidth, CONFIG.baseHeight);
    pg.noSmooth();
    pg.pixelDensity(1);

    noiseTex = createGraphics(CONFIG.baseWidth, CONFIG.baseHeight);
    noiseTex.pixelDensity(1);
    noiseTex.loadPixels();
    for (let i = 0; i < noiseTex.pixels.length; i += 4) {
        let val = random(255);
        noiseTex.pixels[i] = val;
        noiseTex.pixels[i+1] = val;
        noiseTex.pixels[i+2] = val;
        noiseTex.pixels[i+3] = CONFIG.noiseAlpha; 
    }
    noiseTex.updatePixels();
}

// 获取各画面的可走动地面范围，防止飞到天上
function getFloorY(camId, quadH) {
    if (camId === 1) return { min: quadH * 0.65, max: quadH - 5 }; // 自行车棚
    if (camId === 2) return { min: quadH * 0.55, max: quadH - 5 }; // 锅炉房
    if (camId === 3) return { min: quadH * 0.60, max: quadH - 5 }; // 老寨
    if (camId === 4) return { min: quadH * 0.85, max: quadH - 5 }; // 四层电梯门外
    return { min: quadH * 0.5, max: quadH - 5 };
}

function draw() {
    background(0);
    timeOffset += 0.01;
    pg.background(10);

    let quadW = CONFIG.baseWidth / 2;
    let quadH = CONFIG.baseHeight / 2;

    // ==========================================
    // 更新全局实体 (黑影) 的寻路与状态机制
    // ==========================================
    let isCam1Anomaly = manualTriggers[1] || noise(timeOffset * 0.2) > 0.88;
    
    if (isCam1Anomaly) {
        if (!shadowEntity.active) {
            shadowEntity.active = true;
            shadowEntity.state = 'ENTERING';
            shadowEntity.camId = 1;
            let bounds = getFloorY(1, quadH);
            shadowEntity.x = quadW + 20;  // 从右侧画面外走入
            shadowEntity.y = random(bounds.min, bounds.max); // 限定在地面
            shadowEntity.targetX = quadW * 0.8;
            shadowEntity.targetY = random(bounds.min, bounds.max);
        }

        if (shadowEntity.state === 'TRANSIT') {
            shadowEntity.transitTimer--;
            if (shadowEntity.transitTimer <= 0) {
                // 转场结束，随机降临到一个新监控的边缘
                shadowEntity.camId = floor(random(1, 5));
                shadowEntity.state = 'ENTERING';
                
                let bounds = getFloorY(shadowEntity.camId, quadH);
                let edge = floor(random(3)); // 0:左边, 1:右边, 2:底边 (只能从地上走进来)
                
                if (edge === 0) { shadowEntity.x = -20; shadowEntity.y = random(bounds.min, bounds.max); }
                if (edge === 1) { shadowEntity.x = quadW + 20; shadowEntity.y = random(bounds.min, bounds.max); }
                if (edge === 2) { shadowEntity.x = random(20, quadW - 20); shadowEntity.y = quadH + 20; }
                
                shadowEntity.targetX = random(20, quadW - 20);
                shadowEntity.targetY = random(bounds.min, bounds.max);
            }
        } else {
            let dx = shadowEntity.targetX - shadowEntity.x;
            let dy = shadowEntity.targetY - shadowEntity.y;
            let dist = sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                let bounds = getFloorY(shadowEntity.camId, quadH);
                if (shadowEntity.state === 'ENTERING') {
                    shadowEntity.state = 'WANDERING';
                    shadowEntity.wanderCount = floor(random(2, 6)); // 徘徊停留几次
                    shadowEntity.targetX = random(20, quadW - 20);
                    shadowEntity.targetY = random(bounds.min, bounds.max);
                } else if (shadowEntity.state === 'WANDERING') {
                    shadowEntity.wanderCount--;
                    if (shadowEntity.wanderCount <= 0) {
                        shadowEntity.state = 'LEAVING'; 
                        let edge = floor(random(3)); // 往边缘走
                        if (edge === 0) { shadowEntity.targetX = -30; shadowEntity.targetY = random(bounds.min, bounds.max); }
                        if (edge === 1) { shadowEntity.targetX = quadW + 30; shadowEntity.targetY = random(bounds.min, bounds.max); }
                        if (edge === 2) { shadowEntity.targetX = random(20, quadW - 20); shadowEntity.targetY = quadH + 30; }
                    } else {
                        shadowEntity.targetX = random(20, quadW - 20);
                        shadowEntity.targetY = random(bounds.min, bounds.max);
                    }
                } else if (shadowEntity.state === 'LEAVING') {
                    shadowEntity.state = 'TRANSIT';
                    shadowEntity.transitTimer = floor(random(60, 150)); // 消失 1-2.5 秒钟后去别处
                }
            } else {
                // 移动，轻微的横向摆动
                shadowEntity.x += (dx / dist) * shadowEntity.speed + random(-0.2, 0.2);
                shadowEntity.y += (dy / dist) * shadowEntity.speed;
            }
        }
    } else {
        shadowEntity.active = false;
    }

    // ==========================================
    // 绘制四个监控画面
    // ==========================================
    
    // CAM 01 - 自行车棚
    pg.push(); pg.translate(0, 0); 
    pg.drawingContext.save(); pg.drawingContext.beginPath(); pg.drawingContext.rect(0, 0, quadW, quadH); pg.drawingContext.clip();
    drawCam1(quadW, quadH); 
    pg.drawingContext.restore(); pg.pop();

    // CAM 02 - 废弃锅炉房
    pg.push(); pg.translate(quadW, 0); 
    pg.drawingContext.save(); pg.drawingContext.beginPath(); pg.drawingContext.rect(0, 0, quadW, quadH); pg.drawingContext.clip();
    drawCam2(quadW, quadH); 
    pg.drawingContext.restore(); pg.pop();

    // CAM 03 - 白崖溪老寨
    pg.push(); pg.translate(0, quadH); 
    pg.drawingContext.save(); pg.drawingContext.beginPath(); pg.drawingContext.rect(0, 0, quadW, quadH); pg.drawingContext.clip();
    drawCam3(quadW, quadH); 
    pg.drawingContext.restore(); pg.pop();

    // CAM 04 - 9801楼四层
    pg.push(); pg.translate(quadW, quadH); 
    pg.drawingContext.save(); pg.drawingContext.beginPath(); pg.drawingContext.rect(0, 0, quadW, quadH); pg.drawingContext.clip();
    drawCam4(quadW, quadH); 
    pg.drawingContext.restore(); pg.pop();

    pg.stroke(200, 100);
    pg.strokeWeight(1);
    pg.line(quadW, 0, quadW, CONFIG.baseHeight);
    pg.line(0, quadH, CONFIG.baseWidth, quadH);

    pg.image(noiseTex, random(-50, 0), random(-50, 0), CONFIG.baseWidth + 50, CONFIG.baseHeight + 50);

    pg.noFill();
    for (let i = 0; i < 15; i++) {
        pg.stroke(0, i * 12);
        pg.strokeWeight(1);
        pg.rect(i, i, CONFIG.baseWidth - i * 2, CONFIG.baseHeight - i * 2);
    }

    // ==========================================
    // UI 信息
    // ==========================================
    pg.push(); pg.translate(0, 0); drawOverlayUI(0, 0, quadW, 1, "CAM 01", "[自行车棚]"); pg.pop();
    pg.push(); pg.translate(quadW, 0); drawOverlayUI(0, 0, quadW, 2, "CAM 02", "[二号锅炉房]"); pg.pop();
    pg.push(); pg.translate(0, quadH); drawOverlayUI(0, 0, quadW, 3, "CAM 03", "[白崖溪老寨]"); pg.pop();
    pg.push(); pg.translate(quadW, quadH); drawOverlayUI(0, 0, quadW, 4, "CAM 04", "[9801栋-四层]"); pg.pop();

    tint(CONFIG.tintColor[0], CONFIG.tintColor[1], CONFIG.tintColor[2]);

    let y = 0;
    let sliceH = 2; 
    let isGlitchBurst = noise(timeOffset * 1.5) > 0.72; 
    
    while(y < CONFIG.baseHeight) {
        let offsetX = 0;
        if (isGlitchBurst) {
            if (random() < CONFIG.glitchProb) offsetX = random(-CONFIG.glitchIntensity, CONFIG.glitchIntensity);
            if (random() < CONFIG.majorGlitchProb) offsetX = random(-CONFIG.majorGlitchIntensity, CONFIG.majorGlitchIntensity);
        }
        image(pg, offsetX * CONFIG.scaleFactor, y * CONFIG.scaleFactor, CONFIG.baseWidth * CONFIG.scaleFactor, sliceH * CONFIG.scaleFactor, 0, y, CONFIG.baseWidth, sliceH);
        y += sliceH;
    }

    noTint(); 

    stroke(0, CONFIG.scanlineAlpha);
    strokeWeight(1.5);
    for (let i = 0; i < height; i += 3) {
        line(0, i, width, i);
    }
}

/**
 * 局部实体渲染器 - 修改为锚定于“脚下坐标(x,y)”
 */
function drawShadowEntityLocal(camId) {
    if (shadowEntity.active && shadowEntity.camId === camId && shadowEntity.state !== 'TRANSIT') {
        pg.push();
        pg.noStroke();
        
        // 走动时的轻微上下颠簸
        let bobY = sin(frameCount * 0.4) * 1.5; 
        
        pg.fill(5, 180);
        pg.ellipse(shadowEntity.x, shadowEntity.y, 14, 4); // 绘制贴地阴影

        pg.fill(2, 230);
        // (x, y) 为脚底板，矩形向上绘制 (-30)
        pg.rect(shadowEntity.x - 6, shadowEntity.y - 30 + bobY, 12, 30, 4); // 身体
        pg.ellipse(shadowEntity.x, shadowEntity.y - 32 + bobY, 10, 10);     // 头部
        pg.pop();
    }
}

/** * CAM 01 - 自行车棚 */
function drawCam1(w, h) {
    pg.noStroke();
    pg.fill(15);
    pg.rect(0, 0, w, h);

    pg.fill(25);
    pg.quad(0, 0, w, 0, w, 30, 0, 45);
    pg.stroke(50);
    pg.strokeWeight(1);
    pg.line(0, 45, w, 30);
    pg.noStroke();

    pg.fill(6);
    pg.rect(w * 0.25, 36, 8, h);
    pg.rect(w * 0.75, 32, 10, h); 

    pg.fill(22);
    pg.rect(0, h * 0.6, w, h * 0.4);

    let lightFlicker = noise(timeOffset * 4) > 0.4 ? 255 : 100;
    if (lightFlicker > 100) {
        pg.fill(255, 15);  
        pg.ellipse(w * 0.5, h * 0.75, 120, 30); 
    }

    let bikes = [
        { x: w * 0.22, y: h * 0.68, s: 0.45, angle:  1.2, isFallen: false, col: 45 },
        { x: w * 0.62, y: h * 0.63, s: 0.35, angle: -0.8, isFallen: false, col: 35 },
        { x: w * 0.45, y: h * 0.75, s: 0.50, angle:  0.1, isFallen: false, col: 55 },
        { x: w * 0.82, y: h * 0.78, s: 0.55, angle:  0.0, isFallen: true,  col: 40 }
    ];

    // 将自行车和黑影合并到一个渲染队列中
    let renderList = bikes.map(b => ({ type: 'bike', obj: b, y: b.y }));
    if (shadowEntity.active && shadowEntity.camId === 1 && shadowEntity.state !== 'TRANSIT') {
        renderList.push({ type: 'shadow', y: shadowEntity.y });
    }
    
    // 按照真实世界物理坐标(脚部Y轴)严格排序，实现完美的前后交错遮挡！
    renderList.sort((a, b) => a.y - b.y);

    for (let i = 0; i < renderList.length; i++) {
        let ro = renderList[i];
        if (ro.type === 'shadow') {
            drawShadowEntityLocal(1);
        } else {
            let b = ro.obj;
            pg.push();
            pg.translate(b.x, b.y);
            pg.scale(b.s);
            let strokeW = 1.2 / b.s;
            pg.strokeWeight(strokeW); 
            let cosA = Math.cos(b.angle);
            let sinA = Math.sin(b.angle);
            let wheelW, wheelH, frameY;
            if (b.isFallen) {
                wheelW = 24; wheelH = 8; frameY = 0.25; pg.rotate(0.15); cosA = 1; sinA = 0;
            } else {
                wheelW = max(22 * Math.abs(cosA), 4); wheelH = 24; frameY = 1.0;
            }
            let proj = (lx, ly) => { return { x: lx * cosA, y: ly * frameY + lx * sinA * 0.4 }; };
            let pRAxle = proj(-20, 0);
            let pFAxle = proj(20, 0);
            let pBB    = proj(-4, 0);
            let pSeat  = proj(-10, -18);
            let pHeadB = proj(12, -18);
            let pHeadT = proj(10, -25);

            if (lightFlicker > 100) {
                let distToLightX = Math.abs(b.x - w * 0.5);
                let shadowAlpha = map(distToLightX, 30, 65, 180, 0, true);
                if (b.isFallen) {
                    pg.noStroke(); pg.fill(5, shadowAlpha); pg.ellipse(-10, wheelH / 2 + 2, 28, 12); 
                } else {
                    pg.stroke(5, shadowAlpha); pg.strokeWeight(8); pg.line(pRAxle.x, pRAxle.y + wheelH / 2, pFAxle.x, pFAxle.y + wheelH / 2);
                    pg.noStroke(); pg.strokeWeight(strokeW);
                }
            }
            pg.stroke(b.col); pg.noFill(); pg.ellipse(pRAxle.x, pRAxle.y, wheelW, wheelH); pg.ellipse(pFAxle.x, pFAxle.y, wheelW, wheelH);
            pg.stroke(b.col + 20);
            pg.line(pRAxle.x, pRAxle.y, pBB.x, pBB.y); pg.line(pBB.x, pBB.y, pSeat.x, pSeat.y); pg.line(pSeat.x, pSeat.y, pRAxle.x, pRAxle.y); 
            pg.line(pBB.x, pBB.y, pHeadB.x, pHeadB.y); pg.line(pHeadB.x, pHeadB.y, pSeat.x, pSeat.y); 
            pg.line(pFAxle.x, pFAxle.y, pHeadB.x, pHeadB.y); pg.line(pHeadB.x, pHeadB.y, pHeadT.x, pHeadT.y); 
            pg.stroke(b.col + 30);
            if (b.isFallen) {
                pg.line(pHeadT.x, pHeadT.y, pHeadT.x + 8, pHeadT.y - 8); pg.line(pBB.x, pBB.y, pBB.x + 4, pBB.y - 6); 
            } else {
                let hbDx = 8 * sinA; let hbDy = 2 * cosA;
                pg.line(pHeadT.x - hbDx, pHeadT.y - hbDy, pHeadT.x + hbDx, pHeadT.y + hbDy); 
                pg.line(pSeat.x, pSeat.y, pSeat.x - 2 * cosA, pSeat.y - 4); pg.line(pSeat.x - 6 * cosA, pSeat.y - 4, pSeat.x + 4 * cosA, pSeat.y - 4 + 2 * sinA * 0.4); 
            }
            pg.pop();
        }
    }
    
    pg.noStroke(); pg.fill(lightFlicker, 220); pg.ellipse(w * 0.5, 36, 10, 4); 
}

/** * CAM 02 - 废弃锅炉房 */
function drawCam2(w, h) {
    pg.noStroke(); pg.fill(18); pg.rect(0, 0, w, h); 
    pg.fill(90, 120); pg.ellipse(w*0.7, h*0.4, 60, 30); 
    
    // 远处的管道
    pg.fill(4); pg.rect(0, 10, w, 8); pg.rect(0, 25, w, 5);
    
    // 中景实体 (如果实体走到后面的话)
    if (shadowEntity.active && shadowEntity.camId === 2 && shadowEntity.y < h * 0.8) drawShadowEntityLocal(2);
    
    // 前景遮挡柱子
    pg.fill(5); pg.rect(w*0.15, 0, 30, h); 
    pg.fill(8); pg.rect(w*0.65, h*0.2, 20, h); 
    
    // 前景实体 (如果实体走到柱子前面的话)
    if (shadowEntity.active && shadowEntity.camId === 2 && shadowEntity.y >= h * 0.8) drawShadowEntityLocal(2);

    let isAnomaly = noise(timeOffset * 0.15) > 0.85 || manualTriggers[2];
    let bugCount = isAnomaly ? 200 : 15;
    let speedMult = isAnomaly ? 0.6 : 0.2;

    for(let i=0; i<bugCount; i++) {
        let dx = (noise(i, timeOffset * speedMult) * w * 1.5) % w; 
        let dy = (noise(i+50, timeOffset * speedMult) * h * 1.5) % h;
        pg.fill(255, isAnomaly ? 110 : 90); 
        pg.rect(dx, dy, 1, 1);
    }
}

/** * CAM 03 - 白崖溪老寨 */
function drawCam3(w, h) {
    pg.noStroke();
    pg.fill(15);
    pg.rect(0, 0, w, h);
    
    let isAnomaly = random() < 0.0003 || manualTriggers[3];
    
    if (isAnomaly) {
        if (random() > 0.3) {
            pg.fill(random(18, 35)); 
            pg.rect(0, 0, w, h);
            drawShadowEntityLocal(3);
            return; 
        }
    }
    
    let offX = w * 0.12;
    pg.noStroke();
    pg.fill(2);
    pg.beginShape();
    pg.vertex(0, h);
    for(let x=0; x<=w; x+=10) {
        let y = h*0.5 + noise(x*0.05, timeOffset*0.3) * 15;
        pg.vertex(x, y);
    }
    pg.vertex(w, h);
    pg.endShape(CLOSE);
    
    pg.fill(35);
    pg.beginShape();
    pg.vertex(w*0.3 + offX, h); 
    pg.vertex(w*0.7 + offX, h); 
    pg.vertex(w*0.55 + offX, h*0.5); 
    pg.vertex(w*0.45 + offX, h*0.5);
    pg.endShape(CLOSE);
    
    pg.fill(255, 40);
    pg.ellipse(w*0.25 + offX, h*0.3, 50, 50);
    pg.fill(255, 150);
    pg.ellipse(w*0.25 + offX, h*0.3, 8, 8);
    pg.stroke(2);
    pg.strokeWeight(2);
    pg.line(w*0.25 + offX, h*0.3, w*0.25 + offX, h*0.6);
    pg.noStroke();

    drawShadowEntityLocal(3);
}

/** * CAM 04 - 9801楼四层 */
function drawCam4(w, h) {
    pg.noStroke();
    pg.fill(25);
    pg.rect(0, 0, w, h);
    
    // 纯手动触发，移除原有的 cam4GlitchState 定时器逻辑
    let isAnomaly = manualTriggers[4];

    if (isAnomaly) {
         pg.fill(random(5, 35));
         pg.rect(0, 0, w, h);
         
         pg.push();
         let driftX = random(-30, 30);
         let driftY = random(-10, 10);
         pg.translate(driftX, driftY);
         
         pg.fill(5);
         let stretch = map(sin(frameCount * 0.5), -1, 1, 0.8, 1.5);
         pg.quad(
             w*0.2 + random(-15,15), h*0.25, 
             w*0.8 + random(-15,15), h*0.25, 
             w*0.9, h*0.95, 
             w*0.1, h*0.95
         );
         
         pg.stroke(0);
         pg.strokeWeight(2);
         let gapX = w * 0.5 + random(-10, 10);
         pg.line(gapX, h*0.25, gapX, h);
         
         pg.stroke(100, 20);
         pg.line(gapX + 5, h*0.25, gapX + 5, h);
         pg.pop();
    } else {
        let doorTop = h * 0.35;
        pg.fill(35);
        pg.rect(w*0.3, doorTop, w*0.4, h - doorTop);
        pg.stroke(0);
        pg.strokeWeight(1);
        pg.line(w*0.5, doorTop, w*0.5, h); 
        let dispTop = h * 0.22;
        pg.fill(5);
        pg.noStroke();
        pg.rect(w*0.42, dispTop, w*0.16, 12);
        pg.fill(200, 150);
        pg.rect(w*0.45, dispTop + 2, 4, 8); 
        pg.rect(w*0.52, dispTop + 2, 6, 8);
    }

    drawShadowEntityLocal(4);
}

function drawOverlayUI(x, y, w, camId, camTitle, locationInfo) {
    pg.fill(CONFIG.textColor[0], CONFIG.textColor[1], CONFIG.textColor[2]);
    pg.noStroke();
    pg.textFont('monospace');
    pg.textSize(8);
    
    let outerPad = 18; let innerPad = 4;
    let leftPadX, rightPadX, topPadY;

    if (camId === 1) { 
        leftPadX = outerPad; rightPadX = innerPad; topPadY = outerPad;
    } else if (camId === 2) { 
        leftPadX = innerPad; rightPadX = outerPad; topPadY = outerPad;
    } else if (camId === 3) { 
        leftPadX = outerPad; rightPadX = innerPad; topPadY = innerPad;   
    } else if (camId === 4) { 
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
        let s = 59 - (floor(frameCount / 60) % 60);
        dateStr = "1961/11/01"; timeStr = `04:15:${s < 10 ? '0' + s : s}`;
    } else if (camId === 2) {
        dateStr = "1992/08/██"; timeStr = "17:30:00";
    } else if (camId === 3) {
        if (noise(timeOffset * 0.3, 100) > 0.80 || manualTriggers[3]) {
            dateStr = "1957/02/29"; timeStr = "00:00:00";
        } else {
            let s = floor(frameCount / 60) % 60;
            dateStr = "2026/11/01"; timeStr = `04:15:${s < 10 ? '0' + s : s}`;
        }
    } else if (camId === 4) { 
        dateStr = `1999/12/${floor(random(32, 99))}`;
        timeStr = `${floor(random(25, 99))}:${floor(random(60, 99))}:${floor(random(60, 99))}`;
        blink = random() > 0.5 ? "REC " : "    ";
    }

    pg.text(dateStr, x + w - rightPadX, y + topPadY);
    pg.text(`${blink}${timeStr}`, x + w - rightPadX, y + topPadY + 11);
}

// ==========================================
// 全局控制函数：开关切换逻辑
// ==========================================
function triggerAnomaly(camId) {
    manualTriggers[camId] = !manualTriggers[camId];

    let btn = document.getElementById('btn' + camId);
    if (btn) {
        if (manualTriggers[camId]) {
            btn.style.backgroundColor = '#78ff8c';
            btn.style.color = '#050505';
            btn.innerText = `[恢复: CAM 0${camId}]`;
        } else {
            btn.style.backgroundColor = '#050505';
            btn.style.color = '#78ff8c';
            btn.innerText = `[干预: CAM 0${camId}]`;
        }
    }
}

// ==================
// MIDI (TouchDesigner via IAC Driver)
// ==================
const MIDI_NOTE_MAP = {
    74: () => triggerAnomaly(1),
    75: () => triggerAnomaly(2),
    76: () => triggerAnomaly(3),
    77: () => triggerAnomaly(4),
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
    }
}

setupMIDI();
