// 1. إعداد الشاشة والخلفية الفضائية
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameActive = false; 
let isPaused = false;   

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// نظام النجوم الخلفية المتحركة
let stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.9 + 0.4
    });
}

// 2. خصائص كائن المركبة الفضائية
let player = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    size: 22,
    color: '#00ffff', 
    isDragging: false,
    hasShield: false,
    shieldTimeLeft: 0, 
    dragOffsetX: 0,
    dragOffsetY: 0,
    lives: 3,                 
    invincibleTime: 0,        
    isInvincible: false
};

// 3. مصفوفات ومتغيرات اللعبة
let obstacles = [];
let items = []; 
let damageTexts = []; 
let obstacleSpawnTimer = 0;
let scoreItemTimer = 0;
let shieldItemTimer = 0; 
let pulseBombTimer = 0; 
let extraLifeTimer = 0; 
let score = 0;

// متغيرات نظام اهتزاز الشاشة (Screen Shake)
let shakeIntensity = 0;
let shakeDuration = 0;
let currentShakeX = 0; 
let currentShakeY = 0; 

function triggerShake(intensity, duration) {
    shakeIntensity = intensity;
    shakeDuration = duration;
}

let highScore = localStorage.getItem('neon_drift_highscore') ? parseInt(localStorage.getItem('neon_drift_highscore')) : 0;
let currentLevel = 1; 
let gameFrameCount = 0; 

// 4. نظام الصوت والموسيقى المطور عالي الوضوح
let audioCtx = null;
let bgMusicInterval = null; 
let musicStep = 0;          

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        startBackgroundMusic(); 
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function startBackgroundMusic() {
    if (bgMusicInterval) clearInterval(bgMusicInterval);
    
    bgMusicInterval = setInterval(() => {
        if (!audioCtx || isPaused) return; 
        
        if (gameActive) {
            let bassNotes = [110, 110, 130, 130, 146, 146, 165, 165]; 
            let melodyNotes = [220, 261, 293, 329, 392, 329, 293, 261];
            
            let step = musicStep % bassNotes.length;
            
            let oscBass = audioCtx.createOscillator();
            let gainBass = audioCtx.createGain();
            oscBass.type = 'triangle'; 
            oscBass.frequency.setValueAtTime(bassNotes[step], audioCtx.currentTime);
            gainBass.gain.setValueAtTime(0.35, audioCtx.currentTime); 
            gainBass.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            oscBass.connect(gainBass);
            gainBass.connect(audioCtx.destination);
            oscBass.start();
            oscBass.stop(audioCtx.currentTime + 0.2);
            
            if (musicStep % 2 === 0) {
                let oscMelody = audioCtx.createOscillator();
                let gainMelody = audioCtx.createGain();
                oscMelody.type = 'sine'; 
                oscMelody.frequency.setValueAtTime(melodyNotes[(musicStep / 2) % melodyNotes.length], audioCtx.currentTime);
                gainMelody.gain.setValueAtTime(0.20, audioCtx.currentTime); 
                gainMelody.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
                oscMelody.connect(gainMelody);
                gainMelody.connect(audioCtx.destination);
                oscMelody.start();
                oscMelody.stop(audioCtx.currentTime + 0.35);
            }
            
        } else {
            // موسيقى هادئة للقائمة الرئيسية ونهاية اللعبة
            if (musicStep % 4 === 0) { 
                let menuNotes = [146, 165, 196, 220];
                let oscMenu = audioCtx.createOscillator();
                let gainMenu = audioCtx.createGain();
                oscMenu.type = 'sine';
                oscMenu.frequency.setValueAtTime(menuNotes[Math.floor(musicStep / 4) % menuNotes.length], audioCtx.currentTime);
                gainMenu.gain.setValueAtTime(0.25, audioCtx.currentTime); 
                gainMenu.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
                oscMenu.connect(gainMenu);
                gainMenu.connect(audioCtx.destination);
                oscMenu.start();
                oscMenu.stop(audioCtx.currentTime + 0.7);
            }
        }
        musicStep++;
    }, 220); 
}

function playCollectSound() {
    if (!audioCtx || isPaused) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(550, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
}

function playShieldSound() {
    if (!audioCtx || isPaused) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
}

function playBombExplosionSound() {
    if (!audioCtx || isPaused) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sawtooth'; 
    osc.frequency.setValueAtTime(450, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.55, audioCtx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
}

function playExtraLifeSound() {
    if (!audioCtx || isPaused) return;
    let now = audioCtx.currentTime;
    
    let osc1 = audioCtx.createOscillator();
    let gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    let osc2 = audioCtx.createOscillator();
    let gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.3);
}

function playExplosionSound() {
    if (!audioCtx || isPaused) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
}

// 5. التحكم بالسحب الحر 
canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (!gameActive || isPaused) return; 
    
    player.isDragging = true;
    player.dragOffsetX = touch.clientX - player.x;
    player.dragOffsetY = touch.clientY - player.y;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!gameActive || !player.isDragging || isPaused) return;
    const touch = e.touches[0];
    player.x = touch.clientX - player.dragOffsetX;
    player.y = touch.clientY - player.dragOffsetY;
    
    if (player.x < player.size) player.x = player.size;
    if (player.x > canvas.width - player.size) player.x = canvas.width - player.size;
    if (player.y < player.size) player.y = player.size;
    if (player.y > canvas.height - player.size) player.y = canvas.height - player.size;
});

canvas.addEventListener('touchend', () => { player.isDragging = false; });

// 6. دوال التحكم الخارجية (يتم استدعاؤها من ملف HTML)
window.setPause = function(paused) {
    isPaused = paused;
    if (paused && audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend();
    } else if (!paused && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

window.resetToMenu = function() {
    gameActive = false;
    isPaused = false;
    obstacles = [];
    items = [];
    damageTexts = [];
    if (bgMusicInterval) {
        clearInterval(bgMusicInterval);
        bgMusicInterval = null;
    }
};

// الدالة المسؤولة عن بدء اللعبة وتهيئة المتغيرات بدون مضاعفة الـ gameLoop
window.initGame = function() {
    // 1. تصفير المتغيرات والمصفوفات
    obstacles = []; 
    items = []; 
    damageTexts = [];
    score = 0; 
    currentLevel = 1; 
    gameFrameCount = 0; 
    gameActive = true;
    isPaused = false;
    
    if (document.getElementById('score')) document.getElementById('score').innerText = score;
    
    // 2. تحديث الشاشة وضبط مكان اللاعب بدقة
    resizeCanvas();
    player.x = canvas.width / 2;
    player.y = canvas.height - 150; 
    player.hasShield = false; 
    player.shieldTimeLeft = 0; 
    player.lives = 3;             
    player.isInvincible = false;
    player.invincibleTime = 0;
    
    obstacleSpawnTimer = 0;
    scoreItemTimer = 0;
    shieldItemTimer = 0;
    pulseBombTimer = 0;
    extraLifeTimer = 0; 
    currentShakeX = 0;
    currentShakeY = 0;
    
    // 3. تشغيل الصوت والموسيقى
    initAudio(); 
};

// 7. حلقة اللعبة المستمرة والوحيدة
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050508'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (shakeDuration > 0 && !isPaused) {
        currentShakeX = (Math.random() - 0.5) * shakeIntensity;
        currentShakeY = (Math.random() - 0.5) * shakeIntensity;
        shakeDuration--;
    } else if (!isPaused) {
        currentShakeX = 0;
        currentShakeY = 0;
    }

    drawStars(); 
    
    // تحديث المنطق فقط إذا كانت اللعبة قيد التشغيل وليست متوقفة
    if (gameActive && !isPaused) {
        gameFrameCount++;
        updateDifficulty(); 
        updateObstacles();
        updateItems();
        updateTimers(); 
        checkCollisions();
    }
    
    // رسم العناصر إذا كنا داخل واجهة اللعب
    if (document.getElementById('game-interface').style.display !== 'none') {
        drawItems();
        drawObstacles();
        if (gameActive || player.lives <= 0) {
            drawPlayer();
        }
        drawDamageTexts(); 
        drawHighScoreUI(); 
    }
    
    requestAnimationFrame(gameLoop);
}

function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let star of stars) {
        ctx.fillRect(star.x + currentShakeX, star.y + currentShakeY, star.size, star.size);
        if ((gameActive && !isPaused) || !gameActive) {
            star.y += star.speed;
            if (star.y > canvas.height) {
                star.y = 0;
                star.x = Math.random() * canvas.width;
            }
        }
    }
}

function updateDifficulty() {
    let secondsPassed = Math.floor(gameFrameCount / 60);
    currentLevel = Math.floor(secondsPassed / 20) + 1; 
    if (currentLevel > 5) currentLevel = 5;
}

function updateTimers() {
    if (player.hasShield) {
        player.shieldTimeLeft--;
        if (player.shieldTimeLeft <= 0) player.hasShield = false; 
    }
    if (player.isInvincible) {
        player.invincibleTime--;
        if (player.invincibleTime <= 0) player.isInvincible = false;
    }
    for (let i = damageTexts.length - 1; i >= 0; i--) {
        damageTexts[i].y -= 1.2;
        damageTexts[i].alpha -= 0.02;
        if (damageTexts[i].alpha <= 0) damageTexts.splice(i, 1);
    }
}

function updateObstacles() {
    obstacleSpawnTimer++;
    let spawnInterval = (currentLevel === 2) ? 55 : (currentLevel === 3) ? 43 : (currentLevel === 4) ? 34 : (currentLevel >= 5) ? 26 : 70;
    
    if (obstacleSpawnTimer > spawnInterval) {
        let size = Math.random() * 18 + 14; 
        let xPos = Math.random() * (canvas.width - size * 2) + size;
        let baseSpeed = Math.random() * 1.5 + 3.2 + currentLevel * 0.55; 
        let type = 'normal'; 
        let rand = Math.random();
        
        if (currentLevel === 2 && rand < 0.30) type = 'zigzag';
        else if (currentLevel === 3 && rand < 0.35) type = 'zigzag';
        else if (currentLevel === 3 && rand < 0.55) type = 'satellite';
        else if (currentLevel === 4 && rand < 0.40) type = 'zigzag';
        else if (currentLevel === 4 && rand < 0.70) type = 'satellite';
        else if (currentLevel >= 5) {
            let levelFrames = gameFrameCount - (4 * 20 * 60); 
            let dynamicSeekerChance = 0.05 + Math.min(0.35, levelFrames / 3000); 
            
            if (rand < dynamicSeekerChance) {
                type = 'seeker';
            } else if (rand < dynamicSeekerChance + 0.25) {
                type = 'zigzag';
            } else if (rand < dynamicSeekerChance + 0.50) {
                type = 'satellite';
            }
        }

        obstacles.push({
            x: xPos, y: -50, size: size, speed: baseSpeed, type: type,
            angle: Math.random() * Math.PI * 2, rotSpeed: Math.random() * 0.03 - 0.015,
            zigzagDirection: Math.random() > 0.5 ? 1 : -1, zigzagAmplitude: Math.random() * 2 + 1.5, 
            satelliteDirection: Math.random() > 0.5 ? 1 : -1
        });
        obstacleSpawnTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += obs.speed;
        obs.angle += obs.rotSpeed; 
        if (obs.type === 'zigzag') obs.x += Math.sin(obs.y * 0.04) * obs.zigzagAmplitude * obs.zigzagDirection;
        else if (obs.type === 'satellite') {
            obs.x += obs.speed * 0.5 * obs.satelliteDirection;
            if (obs.x < obs.size || obs.x > canvas.width - obs.size) obs.satelliteDirection *= -1;
        }
        else if (obs.type === 'seeker') {
            obs.x += (player.x - obs.x) * 0.025;
        }
        
        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
            score += 1;
            if (document.getElementById('score')) document.getElementById('score').innerText = score;
        }
    }
}

function updateItems() {
    scoreItemTimer++; shieldItemTimer++; pulseBombTimer++;
    
    if (scoreItemTimer > 450) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 15, speed: 2.2, type: 'bonus' }); scoreItemTimer = 0; }
    if (shieldItemTimer > 3000) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 15, speed: 2.0, type: 'shield' }); shieldItemTimer = 0; }
    if (pulseBombTimer > 1200) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 16, speed: 1.8, type: 'bomb' }); pulseBombTimer = 0; }
    
    if (currentLevel >= 4) {
        extraLifeTimer++;
        if (extraLifeTimer > 2100) { 
            items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 14, speed: 1.6, type: 'heart_item' }); 
            extraLifeTimer = 0; 
        }
    }
    
    for (let i = items.length - 1; i >= 0; i--) { items[i].y += items[i].speed; if (items[i].y > canvas.height) items.splice(i, 1); }
}

function checkCollisions() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        let dist = Math.sqrt((player.x - obs.x)**2 + (player.y - obs.y)**2);
        if (dist < player.size * 0.85 + obs.size) {
            if (player.hasShield) { 
                player.hasShield = false; 
                obstacles.splice(i, 1); 
                playBombExplosionSound(); 
            }
            else if (!player.isInvincible) { 
                player.lives--; 
                damageTexts.push({ x: player.x, y: player.y - 30, alpha: 1.0 });
                score = Math.max(0, score - 10);
                if (document.getElementById('score')) document.getElementById('score').innerText = score;

                obstacles.splice(i, 1); 
                playExplosionSound();
                triggerShake(15, 15);

                if (player.lives <= 0) {
                    gameActive = false; 
                    
                    // تحويل الموسيقى لهادئة
                    startBackgroundMusic(); 

                    // حفظ النتيجة واستدعاء نافذة الخسارة HTML
                    let isNewRecord = score > highScore;
                    if (isNewRecord) { 
                        highScore = score; 
                        localStorage.setItem('neon_drift_highscore', highScore); 
                    }
                    if (typeof showGameOverMenu === 'function') {
                        showGameOverMenu(score, highScore, isNewRecord);
                    }
                    
                } else {
                    player.isInvincible = true;
                    player.invincibleTime = 120;
                }
            } 
        }
    }
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        let dist = Math.sqrt((player.x - it.x)**2 + (player.y - it.y)**2);
        if (dist < player.size + it.size) {
            if (it.type === 'shield') { 
                player.hasShield = true; 
                player.shieldTimeLeft = 900; 
                playShieldSound(); 
            }
            else if (it.type === 'bomb') {
                obstacles = [];
                triggerShake(20, 15);
                score += 2;
                if (document.getElementById('score')) document.getElementById('score').innerText = score;
                playBombExplosionSound(); 
            }
            else if (it.type === 'heart_item') {
                if (player.lives < 3) player.lives++;
                playExtraLifeSound(); 
            }
            else { 
                score += 5; 
                if (document.getElementById('score')) document.getElementById('score').innerText = score;
                playCollectSound(); 
            }
            items.splice(i, 1);
        }
    }
}

// 8. الرسوميات
function drawPlayer() {
    if (player.isInvincible && Math.floor(player.invincibleTime / 6) % 2 === 0) {
        return; 
    }

    ctx.save(); ctx.translate(player.x + currentShakeX, player.y + currentShakeY);
    let flameHeight = (player.isDragging && !isPaused) ? Math.random() * 15 + 15 : Math.random() * 8 + 5;
    ctx.beginPath(); ctx.moveTo(-6, player.size * 0.7); ctx.lineTo(0, player.size * 0.7 + flameHeight); ctx.lineTo(6, player.size * 0.7); ctx.closePath();
    ctx.fillStyle = '#ff3300'; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 15; ctx.fill();
    ctx.shadowColor = player.color; ctx.shadowBlur = (player.isDragging && !isPaused) ? 25 : 15; ctx.fillStyle = player.color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -player.size * 1.4); ctx.lineTo(-player.size * 0.8, player.size * 0.6); ctx.lineTo(-player.size * 0.3, player.size * 0.3); ctx.lineTo(player.size * 0.3, player.size * 0.3); ctx.lineTo(player.size * 0.8, player.size * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -player.size * 0.2, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    
    if (player.hasShield && (player.shieldTimeLeft > 120 || Math.floor(player.shieldTimeLeft / 8) % 2 === 0)) { 
        ctx.beginPath(); 
        ctx.arc(0, -player.size * 0.2, player.size * 1.7, 0, Math.PI * 2); 
        ctx.strokeStyle = '#00aaff'; 
        ctx.lineWidth = 3; 
        ctx.shadowColor = '#00aaff'; 
        ctx.shadowBlur = 20; 
        ctx.stroke(); 
    }
    ctx.restore();
}

function drawObstacles() {
    for (let obs of obstacles) {
        ctx.save(); ctx.translate(obs.x + currentShakeX, obs.y + currentShakeY); ctx.rotate(obs.angle);
        ctx.beginPath();
        ctx.fillStyle = (obs.type === 'seeker') ? '#ff0055' : (obs.type === 'zigzag') ? '#cc00ff' : (obs.type === 'satellite') ? '#0066ff' : '#e65c00';
        ctx.shadowColor = (obs.type === 'seeker') ? '#ff0000' : (obs.type === 'zigzag') ? '#ff00ff' : (obs.type === 'satellite') ? '#00f0ff' : '#ff751a';
        ctx.shadowBlur = 15;
        let points = (obs.type === 'satellite') ? 4 : 8;
        for (let i = 0; i < points; i++) {
            let angle = (i / points) * Math.PI * 2;
            let modifier = (obs.type === 'satellite') ? 1 : (0.8 + (i % 2 === 0 ? 0.2 : 0));
            ctx.lineTo(Math.cos(angle) * obs.size * modifier, Math.sin(angle) * obs.size * modifier);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
}

function drawItems() {
    for (let it of items) {
        ctx.save(); ctx.translate(it.x + currentShakeX, it.y + currentShakeY);
        
        if (it.type === 'bomb') {
            ctx.beginPath(); ctx.arc(0, 0, it.size, 0, Math.PI * 2); ctx.fillStyle = '#00ff66'; ctx.shadowColor = '#00ff66'; ctx.shadowBlur = 18; ctx.fill();
            ctx.fillStyle = '#050508'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💥', 0, 0);
        }
        else if (it.type === 'shield') { ctx.beginPath(); ctx.arc(0, 0, it.size, 0, Math.PI * 2); ctx.fillStyle = '#002244'; ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 3; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 15; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -7, 6, 14); ctx.fillRect(-7, -3, 14, 6); }
        else if (it.type === 'heart_item') {
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.bezierCurveTo(-5, -11, -11, -11, -11, -4);
            ctx.bezierCurveTo(-11, 3, -3, 8, 0, 13);
            ctx.bezierCurveTo(3, 8, 11, 3, 11, -4);
            ctx.bezierCurveTo(11, -11, 5, -11, 0, -3);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';       
            ctx.shadowColor = '#ffffff';     
            ctx.shadowBlur = 20;             
            ctx.fill();
        }
        else { ctx.beginPath(); ctx.arc(0, 0, it.size, 0, Math.PI * 2); ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 15; ctx.fill(); ctx.fillStyle = '#332200'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+5', 0, 0); }
        
        ctx.restore();
    }
}

function drawDamageTexts() {
    ctx.save();
    ctx.font = 'bold 1.2rem sans-serif';
    ctx.textAlign = 'center';
    for (let text of damageTexts) {
        ctx.fillStyle = `rgba(255, 51, 51, ${text.alpha})`;
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 10;
        ctx.fillText('-10', text.x, text.y);
    }
    ctx.restore();
}

function drawHighScoreUI() {
    ctx.save();
    
    let heartX = canvas.width - 40;
    let heartY = 35;
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(heartX - (i * 35), heartY);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-6, -10, -14, -10, -14, -2);
        ctx.bezierCurveTo(-14, 6, -4, 12, 0, 18);
        ctx.bezierCurveTo(4, 12, 14, 6, 14, -2);
        ctx.bezierCurveTo(14, -10, 6, -10, 0, 0);
        ctx.closePath();
        
        if (i < player.lives) {
            ctx.fillStyle = '#ff0055';
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 12;
            ctx.fill();
        } else {
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.25)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.font = 'bold 1.1rem sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 5;
    ctx.textAlign = 'left';
    ctx.fillText('🏆 أعلى نتيجة: ' + highScore, 20, 95);

    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 1.3rem sans-serif';
    ctx.fillText('⚡ المستوى: ' + currentLevel, 20, 130);
    ctx.restore();
}

// تشغيل الرسوميات الخلفية فور تحميل الكود
requestAnimationFrame(gameLoop);
