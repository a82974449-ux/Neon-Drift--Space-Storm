// 1. إعداد الشاشة والخلفية الفضائية
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameActive = false; 
let isPaused = false;   

// --- متغيرات التناسق وحجم الشاشة ---
let scaleW = 1;
let scaleH = 1;
let baseScale = 1;

// 2. خصائص كائن المركبة الفضائية (تم تعريفها أولاً لتجنب مشكلة الشاشة السوداء)
let player = {
    x: window.innerWidth / 2,
    y: window.innerHeight - 150,
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

// حساب الأبعاد ديناميكياً
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // حساب نسبة التناسق بناءً على شاشة مرجعية
    scaleW = canvas.width / 360;
    scaleH = canvas.height / 800;
    baseScale = scaleW;
    
    // وضع حدود للتكبير لضمان عدم تضخم العناصر بشكل غريب في الشاشات العريضة جداً
    if (baseScale > 1.5) baseScale = 1.5;
    if (scaleH > 1.5) scaleH = 1.5;

    // تحديث حجم اللاعب ديناميكياً
    player.size = 22 * baseScale;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// نظام النجوم الخلفية المتحركة (متناسق مع الشاشة)
let stars = [];
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: (Math.random() * 2) * baseScale,
        speed: (Math.random() * 0.9 + 0.4) * scaleH
    });
}

// 3. مصفوفات ومتغيرات اللعبة
let obstacles = [];
let items = []; 
let damageTexts = []; 
let milestoneTexts = []; 
let obstacleSpawnTimer = 0;
let scoreItemTimer = 0;
let shieldItemTimer = 0; 
let pulseBombTimer = 0; 
let heartItemTimer = 0; // عداد مكافأة القلب
let score = 0;
let nextMilestone = 100; 

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
            // تم رفع مستوى الصوت للـ Bass من 0.35 إلى 0.70
            gainBass.gain.setValueAtTime(0.70, audioCtx.currentTime); 
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
                // تم رفع مستوى الصوت للـ Melody من 0.20 إلى 0.45
                gainMelody.gain.setValueAtTime(0.45, audioCtx.currentTime); 
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
                // تم رفع الصوت هنا أيضاً
                gainMenu.gain.setValueAtTime(0.50, audioCtx.currentTime); 
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
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime); // رفع صوت الالتقاط
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
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
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
    gain.gain.setValueAtTime(0.70, audioCtx.currentTime); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
}

function playExplosionSound() {
    if (!audioCtx || isPaused) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.45);
    gain.gain.setValueAtTime(0.60, audioCtx.currentTime);
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

// 6. دوال التحكم الخارجية
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
    milestoneTexts = [];
    if (bgMusicInterval) {
        clearInterval(bgMusicInterval);
        bgMusicInterval = null;
    }
};

window.initGame = function() {
    obstacles = []; 
    items = []; 
    damageTexts = [];
    milestoneTexts = [];
    score = 0; 
    nextMilestone = 100; // تصفير هدف الإشعار القادم
    currentLevel = 1; 
    gameFrameCount = 0; 
    gameActive = true;
    isPaused = false;
    
    if (document.getElementById('score')) document.getElementById('score').innerText = score;
    
    resizeCanvas();
    player.x = canvas.width / 2;
    player.y = canvas.height - (150 * scaleH); 
    player.hasShield = false; 
    player.shieldTimeLeft = 0; 
    player.lives = 3;             
    player.isInvincible = false;
    player.invincibleTime = 0;
    
    obstacleSpawnTimer = 0;
    scoreItemTimer = 0;
    shieldItemTimer = 0;
    pulseBombTimer = 0;
    heartItemTimer = 0;
    currentShakeX = 0;
    currentShakeY = 0;
    
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
    
    if (gameActive && !isPaused) {
        gameFrameCount++;
        updateDifficulty(); 
        updateObstacles();
        updateItems();
        updateTimers(); 
        checkCollisions();
        checkMilestones(); // فحص نقاط الإنجاز للإشعارات
    }
    
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
    currentLevel = Math.floor(secondsPassed / 25) + 1; 
    if (currentLevel > 20) currentLevel = 20;
}

// نظام فحص وتحديث إشعارات التحفيز
function checkMilestones() {
    if (score >= nextMilestone) {
        let messages = ['أسطورة! 🔥', 'استمر يا بطل! ⚡', 'أداء مبهر! 🚀', 'لا يمكن إيقافك! 💥'];
        let randomMsg = messages[Math.floor(Math.random() * messages.length)];
        
        milestoneTexts.push({
            text: `🏆 ${nextMilestone} نقطة! ${randomMsg}`,
            y: 170, // أسفل عداد المستوى مباشرة حتى لا يغطي المنتصف
            alpha: 2.5 // قيمة أعلى ليبقى ظاهراً لفترة أطول قبل أن يبدأ بالتلاشي
        });
        nextMilestone += 100;
    }
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
        damageTexts[i].y -= 1.2 * scaleH;
        damageTexts[i].alpha -= 0.02;
        if (damageTexts[i].alpha <= 0) damageTexts.splice(i, 1);
    }
    // تحديث حركة وشفافية إشعارات الإنجاز
    for (let i = milestoneTexts.length - 1; i >= 0; i--) {
        milestoneTexts[i].y -= 0.3 * scaleH; 
        milestoneTexts[i].alpha -= 0.015; 
        if (milestoneTexts[i].alpha <= 0) milestoneTexts.splice(i, 1);
    }
}

function updateObstacles() {
    obstacleSpawnTimer++;
    
    let spawnInterval = Math.max(12, 60 - (currentLevel * 2.5)); 
    
    if (obstacleSpawnTimer > spawnInterval) {
        let size = (Math.random() * 18 + 14) * baseScale; 
        let xPos = Math.random() * (canvas.width - size * 2) + size;
        let baseSpeed = (Math.random() * 2 + 3.0 + (currentLevel * 0.45)) * scaleH; 
        let type = 'normal'; 
        let rand = Math.random();
        
        let seekerChance = (currentLevel > 4) ? Math.min(0.3, (currentLevel - 4) * 0.02) : 0;
        let zigzagChance = (currentLevel > 2) ? Math.min(0.35, currentLevel * 0.02) : 0;
        let satelliteChance = (currentLevel > 3) ? Math.min(0.35, currentLevel * 0.02) : 0;

        if (rand < seekerChance) {
            type = 'seeker';
        } else if (rand < seekerChance + zigzagChance) {
            type = 'zigzag';
        } else if (rand < seekerChance + zigzagChance + satelliteChance) {
            type = 'satellite';
        }

        obstacles.push({
            x: xPos, y: -50, size: size, speed: baseSpeed, type: type,
            angle: Math.random() * Math.PI * 2, rotSpeed: Math.random() * 0.03 - 0.015,
            zigzagDirection: Math.random() > 0.5 ? 1 : -1, 
            zigzagAmplitude: (Math.random() * 2 + 1.5 + (currentLevel * 0.1)) * scaleW, 
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
            obs.x += (player.x - obs.x) * (0.015 + currentLevel * 0.001); 
        }
        
        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
            score += 1;
            if (document.getElementById('score')) document.getElementById('score').innerText = score;
        }
    }
}

function updateItems() {
    scoreItemTimer++; shieldItemTimer++; pulseBombTimer++; heartItemTimer++;
    
    if (scoreItemTimer > 450) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 15 * baseScale, speed: 2.2 * scaleH, type: 'bonus' }); scoreItemTimer = 0; }
    if (shieldItemTimer > 3000) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 15 * baseScale, speed: 2.0 * scaleH, type: 'shield' }); shieldItemTimer = 0; }
    if (pulseBombTimer > 1200) { items.push({ x: Math.random() * (canvas.width - 40) + 20, y: -30, size: 16 * baseScale, speed: 1.8 * scaleH, type: 'bomb' }); pulseBombTimer = 0; }
    
    // إضافة مكافأة القلب الأبيص (الروح الإضافية)
    // نادرة الظهور وتبدأ من المستوى 6
    if (currentLevel >= 6 && heartItemTimer > 3500) {
        let startXPos = Math.random() * (canvas.width - 80) + 40;
        items.push({ 
            x: startXPos, 
            startX: startXPos,
            y: -30, 
            size: 14 * baseScale, 
            speed: 3.5 * scaleH, // سرعة أسرع من باقي المكافآت لتحدي أكبر
            type: 'life',
            wavePhase: Math.random() * Math.PI * 2
        }); 
        // تصفير مؤقت القلب برقم عشوائي ليجعل وقت ظهوره القادم غير متوقع تماماً
        heartItemTimer = Math.floor(Math.random() * 1000); 
    }
    
    for (let i = items.length - 1; i >= 0; i--) { 
        let it = items[i];
        it.y += it.speed; 
        
        // حركة متموجة (Sine wave) للقلب ليصعب الإمساك به
        if (it.type === 'life') {
            it.wavePhase += 0.08;
            it.x = it.startX + Math.sin(it.wavePhase) * (60 * scaleW); // سعة موجة الانحراف
            // التأكد من عدم الخروج خارج مساحة اللعب أثناء التموج
            if (it.x < it.size) it.x = it.size;
            if (it.x > canvas.width - it.size) it.x = canvas.width - it.size;
        }

        if (it.y > canvas.height) items.splice(i, 1); 
    }
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
                damageTexts.push({ x: player.x, y: player.y - (30 * baseScale), alpha: 1.0, text: '-10', color: '255, 51, 51' });
                score = Math.max(0, score - 10);
                if (document.getElementById('score')) document.getElementById('score').innerText = score;

                obstacles.splice(i, 1); 
                playExplosionSound();
                triggerShake(15, 15);

                if (player.lives <= 0) {
                    gameActive = false; 
                    
                    startBackgroundMusic(); 

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
            else if (it.type === 'life') {
                if (player.lives < 3) {
                    player.lives++; // زيادة الروح
                } else {
                    score += 10; // إضافة 10 نقاط بدلاً من 15
                    // إظهار نص +10 باللون الأخضر النيوني
                    damageTexts.push({ x: player.x, y: player.y - (30 * baseScale), alpha: 1.0, text: '+10', color: '0, 255, 102' }); 
                }
                if (document.getElementById('score')) document.getElementById('score').innerText = score;
                playCollectSound();
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

// 8. الرسوميات (متناسقة مع الحجم)
function drawPlayer() {
    if (player.isInvincible && Math.floor(player.invincibleTime / 6) % 2 === 0) {
        return; 
    }

    ctx.save(); ctx.translate(player.x + currentShakeX, player.y + currentShakeY);
    let flameHeight = (player.isDragging && !isPaused) ? (Math.random() * 15 + 15) * baseScale : (Math.random() * 8 + 5) * baseScale;
    
    ctx.beginPath(); ctx.moveTo(-6 * baseScale, player.size * 0.7); ctx.lineTo(0, player.size * 0.7 + flameHeight); ctx.lineTo(6 * baseScale, player.size * 0.7); ctx.closePath();
    ctx.fillStyle = '#ff3300'; ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 15; ctx.fill();
    
    ctx.shadowColor = player.color; ctx.shadowBlur = (player.isDragging && !isPaused) ? 25 : 15; ctx.fillStyle = player.color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(0, -player.size * 1.4); 
    ctx.lineTo(-player.size * 0.8, player.size * 0.6); 
    ctx.lineTo(-player.size * 0.3, player.size * 0.3); 
    ctx.lineTo(player.size * 0.3, player.size * 0.3); 
    ctx.lineTo(player.size * 0.8, player.size * 0.6); 
    ctx.closePath(); 
    ctx.fill(); ctx.stroke();
    
    ctx.beginPath(); ctx.arc(0, -player.size * 0.2, 6 * baseScale, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    
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
            ctx.fillStyle = '#050508'; ctx.font = 'bold ' + Math.floor(10 * baseScale) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💥', 0, 0);
        }
        else if (it.type === 'shield') { 
            ctx.beginPath(); ctx.arc(0, 0, it.size, 0, Math.PI * 2); ctx.fillStyle = '#002244'; ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 3; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 15; ctx.fill(); ctx.stroke(); 
            ctx.fillStyle = '#ffffff'; 
            ctx.fillRect(-3 * baseScale, -7 * baseScale, 6 * baseScale, 14 * baseScale); 
            ctx.fillRect(-7 * baseScale, -3 * baseScale, 14 * baseScale, 6 * baseScale); 
        }
        else if (it.type === 'life') {
            // رسم القلب الأبيض
            ctx.beginPath(); 
            ctx.arc(0, 0, it.size, 0, Math.PI * 2); 
            ctx.fillStyle = '#ffffff'; 
            ctx.shadowColor = '#ffffff'; 
            ctx.shadowBlur = 18; 
            ctx.fill(); 
            ctx.fillStyle = '#ff0055'; 
            ctx.font = 'bold ' + Math.floor(14 * baseScale) + 'px sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle'; 
            ctx.fillText('❤', 0, 1 * baseScale);
        }
        else { 
            ctx.beginPath(); ctx.arc(0, 0, it.size, 0, Math.PI * 2); ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 15; ctx.fill(); 
            ctx.fillStyle = '#332200'; ctx.font = 'bold ' + Math.floor(11 * baseScale) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+5', 0, 0); 
        }
        
        ctx.restore();
    }
}

// تعديل الدالة لتدعم النصوص المخصصة والألوان المختلفة (مثل +10 للأرواح)
function drawDamageTexts() {
    ctx.save();
    ctx.font = 'bold ' + (1.2 * baseScale) + 'rem sans-serif';
    ctx.textAlign = 'center';
    for (let textObj of damageTexts) {
        let t = textObj.text || '-10'; // النص الافتراضي
        let c = textObj.color || '255, 51, 51'; // اللون الافتراضي (أحمر)
        
        ctx.fillStyle = `rgba(${c}, ${textObj.alpha})`;
        ctx.shadowColor = `rgb(${c})`;
        ctx.shadowBlur = 10;
        ctx.fillText(t, textObj.x, textObj.y);
    }
    ctx.restore();
}

function drawHighScoreUI() {
    ctx.save();
    
    // مقياس خفيف لواجهة المستخدم للحفاظ عليها متسقة
    let uiScale = baseScale > 1.2 ? 1.2 : baseScale;
    let heartX = canvas.width - (40 * uiScale);
    let heartY = 35 * uiScale;
    
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(heartX - (i * 35 * uiScale), heartY);
        ctx.scale(uiScale, uiScale);
        
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

    ctx.font = 'bold ' + (1.1 * uiScale) + 'rem sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 5;
    ctx.textAlign = 'left';
    ctx.fillText('🏆 أعلى نتيجة: ' + highScore, 20 * uiScale, 95 * uiScale);

    if (currentLevel === 20) {
        ctx.fillStyle = '#ff0055'; 
        ctx.shadowColor = '#ff0055';
        ctx.font = 'bold ' + (1.4 * uiScale) + 'rem sans-serif';
        ctx.fillText('⚡ المستوى: ' + currentLevel + ' (الأقصى 🔥)', 20 * uiScale, 130 * uiScale);
    } else {
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.font = 'bold ' + (1.3 * uiScale) + 'rem sans-serif';
        ctx.fillText('⚡ المستوى: ' + currentLevel, 20 * uiScale, 130 * uiScale);
    }
    
    for (let mt of milestoneTexts) {
        ctx.fillStyle = `rgba(255, 204, 0, ${Math.min(1, mt.alpha)})`; 
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 15;
        ctx.font = 'bold ' + (1.2 * uiScale) + 'rem sans-serif';
        ctx.fillText(mt.text, 20 * uiScale, mt.y * uiScale);
    }
    
    ctx.restore();
}

requestAnimationFrame(gameLoop);
