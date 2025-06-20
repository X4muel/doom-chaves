// --- Variáveis Globais ---
let scene, camera, renderer;
const mazeSize = 25;
const cellSize = 10;
let mazeGrid = [];
let wallMeshes = [];

// Materiais 3D
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x4F4F4F });

// Player/Câmera
let controls;
const playerHeight = cellSize / 2;
const playerRadius = cellSize * 0.1;
const playerSpeed = 0.15;
let keys = {};
let canMove = false; // Começa como false, só vira true com PointerLock
let playerHealth = 100;
const maxPlayerHealth = 100;
let lastDamageTime = 0;
const damageCooldown = 1000;
let lastShotTime = 0;
const shootCooldown = 200;

// Variáveis para o pulo
const jumpForce = 1;
const gravity = 0.03;
let verticalVelocity = 0;
let isJumping = false;
let isOnGround = true;

// Variáveis para munição
let currentAmmo = 30;
const maxAmmo = 30;
const reloadTime = 1500;
let isReloading = false;

// Arma
let weaponMesh;
let reloadStartTime = 0; 
let originalWeaponRotation = new THREE.Euler(); 
let weaponIdleOffset = 0; // Para animação de idle da arma
const weaponIdleSpeed = 0.05;
const weaponIdleRange = 0.02;

// Inimigos
let enemies = [];
const enemySpawnChance = 0.1;
const enemySpeed = 0.04;
const enemyDamage = 10;
const enemyHealth = 50;
const enemyCollisionRadius = cellSize * 0.8; 

// Raycaster para Colisão e Tiro
const raycaster = new THREE.Raycaster();
const collisionDistance = playerRadius + 0.1;

// Efeito de bala
const bulletSpeed = 10;
const bulletLifeTime = 1000;
let bullets = [];
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

// Loader de modelos GLTF
const loader = new THREE.GLTFLoader();
const ENEMY_MODEL_URL = 'chaves.glb'; 
const WEAPON_MODEL_URL = null; 

let enemyModel = null;
let weaponModel = null;

// UI Elements
let playerHealthBar;
let overlay, crosshair;
let enemyHealthBarsContainer;
let ammoDisplay;

let playerPointLight;

// Variáveis de ÁUDIO e MENU
let menuMusic;
let gameplayMusic;
let damageSound;
let shootSound; // Pode ser removido se não tiver tiro.mp3
let reloadSound; // Pode ser removido se não tiver recarregar.mp3

let mainMenu; // Referência ao div do menu principal
let startGameButton; // Referência ao botão de iniciar jogo


// --- Função de Inicialização (prepara o menu e listeners) ---
function init() {
    // Referências aos elementos do DOM
    mainMenu = document.getElementById('mainMenu');
    startGameButton = document.getElementById('startGameButton');
    overlay = document.getElementById('overlay');
    crosshair = document.getElementById('crosshair');
    playerHealthBar = document.getElementById('playerHealthBar');
    enemyHealthBarsContainer = document.getElementById('enemyHealthBars');
    ammoDisplay = document.getElementById('ammoDisplay');

    // Carrega referências para os elementos de áudio
    menuMusic = document.getElementById('menuMusic');
    gameplayMusic = document.getElementById('gameplayMusic');
    damageSound = document.getElementById('damageSound');
    // Verifique se os elementos de áudio existem antes de atribuir
    shootSound = document.getElementById('shootSound'); 
    reloadSound = document.getElementById('reloadSound'); 

    // Garante que o menu principal seja exibido no início
    if (mainMenu) {
        mainMenu.style.display = 'flex';
    } else {
        console.error("ERRO: Elemento 'mainMenu' não encontrado! Verifique o index.html");
        // Se o menu principal não for encontrado, exibe um erro no overlay
        if (overlay) {
            overlay.innerHTML = '<h1>Erro: Menu Principal não encontrado!</h1><p>Verifique o console do navegador e o arquivo index.html.</p>';
            overlay.style.display = 'flex';
        }
        return; // Sai da função init se o menu principal não existir
    }

    // Listener para o botão de iniciar jogo
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            console.log("Botão 'Iniciar Jogo' clicado. Tentando tocar música do menu...");
            // Garante que a música do menu toque ao clicar no botão
            playSound(menuMusic, true); 
            startGame(); // Inicia a configuração do jogo
        });
    } else {
        console.error("ERRO: Elemento 'startGameButton' não encontrado! Verifique o index.html");
        // Se o botão não for encontrado, exibe um erro no overlay
        if (overlay) {
            overlay.innerHTML = '<h1>Erro: Botão "Iniciar Jogo" não encontrado!</h1><p>Verifique o console do navegador e o arquivo index.html.</p>';
            overlay.style.display = 'flex';
        }
    }
}

// --- Função para Iniciar o Jogo (após o clique no menu) ---
async function startGame() {
    // Esconde o menu principal
    if (mainMenu) mainMenu.style.display = 'none';
    
    // Configuração inicial da cena Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xADD8E6);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    playerPointLight = new THREE.PointLight(0xffffff, 0.7, 50);
    scene.add(playerPointLight);

    // Configura UI (barras de vida, munição)
    if (!playerHealthBar || !ammoDisplay || !enemyHealthBarsContainer || !crosshair || !overlay) {
        console.error("ERRO: Alguns elementos da UI (barra de vida, munição, overlay, crosshair, enemyHealthBars) não foram encontrados! Verifique o index.html");
        overlay.innerHTML = '<h1>Erro: Elementos da UI não encontrados!</h1><p>Verifique o console do navegador e o index.html.</p>';
        overlay.style.display = 'flex';
        if (gameplayMusic) gameplayMusic.pause(); // Garante que a música do menu pare se houver erro
        return;
    }
    updateHealthDisplay();
    updateAmmoDisplay();

    // Carregamento de modelos 3D
    const modelPromises = [];
    if (ENEMY_MODEL_URL) {
        modelPromises.push(loadModel(ENEMY_MODEL_URL).then(model => enemyModel = model));
    }
    if (WEAPON_MODEL_URL) {
        modelPromises.push(loadModel(WEAPON_MODEL_URL).then(model => weaponModel = model));
    }

    try {
        await Promise.all(modelPromises);
        console.log("Modelos 3D carregados com sucesso!");
    } catch (error) {
        console.error('ERRO FATAL: Falha ao carregar modelos 3D:', error);
        overlay.innerHTML = '<h1>Erro ao carregar modelos 3D!</h1><p>Verifique o console para detalhes e os caminhos dos arquivos. (Ex: chaves.glb, deagle.glb)</p>';
        overlay.style.display = 'flex';
        if (gameplayMusic) gameplayMusic.pause();
        return;
    }

    // Geração do labirinto e spawn de inimigos
    generateMaze(mazeSize, mazeSize);
    renderMaze();
    setupWeapon();

    // Configuração dos controles de câmera (PointerLockControls)
    controls = new THREE.PointerLockControls(camera, renderer.domElement);

    // O listener de clique para travar o ponteiro - ESTA É A SEGUNDA INTERAÇÃO GARANTIDA
    renderer.domElement.addEventListener('click', function() {
        if (!controls.isLocked) {
             console.log("Clicado no canvas. Tentando travar PointerLockControls...");
             controls.lock();
        }
    });

    controls.addEventListener('lock', function() {
        // Quando o ponteiro é travado, o jogo está ativo.
        console.log("PointerLockControls travado. Jogo ativo.");
        if (overlay) overlay.style.display = 'none';
        if (crosshair) crosshair.style.display = 'block';
        canMove = true;
        
        // PAUSA A MÚSICA DO MENU E INICIA A MÚSICA DE GAMEPLAY AQUI
        if (menuMusic && !menuMusic.paused) { 
            menuMusic.pause();
            menuMusic.currentTime = 0; 
            console.log("Música do menu pausada ao iniciar gameplay.");
        }
        playSound(gameplayMusic, true); 
    });

    controls.addEventListener('unlock', function() {
        // Quando o ponteiro é destravado (ex: pressiona ESC ou Game Over)
        console.log("PointerLockControls destravado. Jogo pausado/inativo.");
        if (overlay) {
            // Se já for Game Over, não sobrescreva a mensagem
            if (overlay.innerHTML.indexOf('GAME OVER') === -1) {
                overlay.innerHTML = '<h1>Jogo Pausado</h1><p>Pressione ESC ou clique para continuar</p>';
            }
            overlay.style.display = 'flex'; 
        }
        if (crosshair) crosshair.style.display = 'none';
        canMove = false;
        // Pausa a música de gameplay quando o jogador sai do jogo
        if (gameplayMusic) gameplayMusic.pause();
    });

    // Posição inicial do jogador
    let startX = 0, startY = 0;
    for(let y = 0; y < mazeSize; y++) {
        for(let x = 0; x < mazeSize; x++) {
            if(mazeGrid[y][x] === 1) {
                startX = x;
                startY = y;
                break;
            }
        }
        if (startX !== 0) break;
    }
    camera.position.set(startX * cellSize + cellSize / 2, playerHeight, startY * cellSize + cellSize / 2);

    // Listeners de eventos de teclado e mouse
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    document.addEventListener('mousedown', onMouseDown, false); 

    window.addEventListener('resize', onWindowResize, false);

    // Inicia o loop de animação
    animate();
}


function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            resolve(gltf.scene);
        }, undefined, (error) => {
            console.error(`Erro ao carregar o modelo 3D: ${url}`, error);
            reject(error);
        });
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    keys[event.code] = true;
    if (event.code === 'Space' && isOnGround && canMove) {
        verticalVelocity = jumpForce;
        isJumping = true;
        isOnGround = false;
    }
    if (event.code === 'KeyR' && !isReloading && currentAmmo < maxAmmo && canMove) {
        startReload();
    }
}

function onKeyUp(event) {
    keys[event.code] = false;
}

function onMouseDown(event) {
    if (canMove && event.button === 0) { // Somente atira se o jogo estiver ativo e for botão esquerdo do mouse
        shoot();
    }
}

function generateMaze(width, height) {
    for (let y = 0; y < height; y++) {
        mazeGrid[y] = [];
        for (let x = 0; x < width; x++) {
            mazeGrid[y][x] = 0;
        }
    }

    function isValid(x, y) {
        return x >= 0 && x < width && y >= 0 && y < height;
    }

    function carvePassages(cx, cy) {
        mazeGrid[cy][cx] = 1;

        const directions = [
            [-2, 0],
            [2, 0],
            [0, -2],
            [0, 2]
        ];

        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (isValid(nx, ny) && mazeGrid[ny][nx] === 0) {
                mazeGrid[cy + dy / 2][cx + dx / 2] = 1;
                carvePassages(nx, ny);
            }
        }
    }

    carvePassages(1, 1);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (mazeGrid[y][x] === 0 && Math.random() < 0.05) {
                 if (mazeGrid[y+1][x] === 1 || mazeGrid[y-1][x] === 1 || mazeGrid[y][x+1] === 1 || mazeGrid[y][x-1] === 1) {
                     mazeGrid[y][x] = 1;
                 }
            }
        }
    }
    mazeGrid[height - 2][width - 1] = 1; 
}

function renderMaze() {
    const floorGeometry = new THREE.PlaneGeometry(mazeSize * cellSize, mazeSize * cellSize);
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set((mazeSize * cellSize) / 2 - cellSize / 2, 0, (mazeSize * cellSize) / 2 - cellSize / 2);
    floorMesh.receiveShadow = true; 
    scene.add(floorMesh);

    const wallGeometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);

    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (mazeGrid[y][x] === 0) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x * cellSize + cellSize / 2, cellSize / 2, y * cellSize + cellSize / 2);
                wall.castShadow = true; 
                wall.receiveShadow = true; 
                scene.add(wall);
                wallMeshes.push(wall);
            } else {
                if (Math.random() < enemySpawnChance && !(x === 1 && y === 1)) {
                    spawnEnemy(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
                }
            }
        }
    }
}

function setupWeapon() {
    if (weaponModel) {
        weaponMesh = weaponModel.clone();
        weaponMesh.scale.set(10, 10, 10); 
        weaponMesh.position.set(0.6, -0.4, 1); 
        weaponMesh.rotation.set(-Math.PI / 10, Math.PI, Math.PI / 2); 

        originalWeaponRotation.copy(weaponMesh.rotation); 

        weaponMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } else {
        const weaponGeometry = new THREE.BoxGeometry(0.5, 0.2, 2);
        const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
        weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
        weaponMesh.position.set(0.6, -0.4, -1);
    }
    camera.add(weaponMesh); 
}

function spawnEnemy(x, z) {
    let enemy;
    if (enemyModel) {
        enemy = enemyModel.clone();
        enemy.scale.set(4, 4, 4); 
        enemy.position.set(x, 0, z); 
        enemy.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } else {
        const enemyGeometry = new THREE.BoxGeometry(cellSize * 0.8, cellSize * 0.8, cellSize * 0.8);
        enemy = new THREE.Mesh(enemyGeometry, new THREE.MeshLambertMaterial({ color: 0xFF0000 }));
        enemy.position.set(x, cellSize * 0.4, z);
    }

    enemy.userData = {
        health: enemyHealth,
        maxHealth: enemyHealth,
        id: enemies.length,
        healthBarElement: createEnemyHealthBar(enemies.length)
    };
    scene.add(enemy);
    enemies.push(enemy);
}

function createEnemyHealthBar(id) {
    const container = document.createElement('div');
    container.className = 'enemy-health-bar-container';
    container.id = `enemy-health-bar-${id}`;

    const bar = document.createElement('div');
    bar.className = 'enemy-health-bar';
    container.appendChild(bar);

    enemyHealthBarsContainer.appendChild(container);
    return bar;
}

function updateEnemyHealthBar(enemy) {
    const healthBarEl = enemy.userData.healthBarElement;
    if (!healthBarEl) return;

    const origin = camera.position.clone();
    const enemyWorldPosition = new THREE.Vector3();
    enemy.getWorldPosition(enemyWorldPosition);
    const direction = new THREE.Vector3().subVectors(enemyWorldPosition, origin).normalize();
    raycaster.set(origin, direction);

    raycaster.far = origin.distanceTo(enemyWorldPosition) - (cellSize * 0.2);

    const intersects = raycaster.intersectObjects(wallMeshes);

    if (intersects.length > 0) {
        healthBarEl.parentElement.style.display = 'none';
        return;
    }

    const vector = new THREE.Vector3();
    enemy.getWorldPosition(vector);
    vector.project(camera);

    const distanceToEnemy = camera.position.distanceTo(enemy.position);
    if (vector.z < -1 || vector.z > 1 || distanceToEnemy > 100) {
        healthBarEl.parentElement.style.display = 'none';
        return;
    }

    healthBarEl.parentElement.style.display = 'block';

    const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;

    const offset = 50;
    healthBarEl.parentElement.style.left = `${x}px`;
    healthBarEl.parentElement.style.top = `${y - offset}px`;

    const healthPercentage = (enemy.userData.health / enemy.userData.maxHealth) * 100;
    healthBarEl.style.width = `${healthPercentage}%`;

    if (healthPercentage < 30) {
        healthBarEl.style.backgroundColor = 'red';
    } else if (healthPercentage < 60) {
        healthBarEl.style.backgroundColor = 'orange';
    } else {
        healthBarEl.style.backgroundColor = 'limegreen';
    }
}

function takeDamage(amount) {
    const currentTime = Date.now();
    if (currentTime - lastDamageTime > damageCooldown) {
        playerHealth -= amount;
        lastDamageTime = currentTime;
        if (playerHealth < 0) playerHealth = 0;
        updateHealthDisplay();
        playSound(damageSound); 
        if (playerHealth === 0) {
            gameOver();
        }
    }
}

function updateHealthDisplay() {
    if (playerHealthBar) {
        playerHealthBar.style.width = (playerHealth / maxPlayerHealth) * 100 + '%';
        if (playerHealth < maxPlayerHealth * 0.3) {
            playerHealthBar.style.backgroundColor = 'red';
        } else if (playerHealth < maxPlayerHealth * 0.6) {
            playerHealthBar.style.backgroundColor = 'orange';
        } else {
            playerHealthBar.style.backgroundColor = 'green';
        }
    }
}

function updateAmmoDisplay() {
    if (ammoDisplay) {
        ammoDisplay.textContent = `Munição: ${currentAmmo}/${maxAmmo}`;
        if (currentAmmo <= 5 && currentAmmo > 0) {
            ammoDisplay.style.color = 'orange';
        } else if (currentAmmo === 0) {
            ammoDisplay.style.color = 'red';
        } else {
            ammoDisplay.style.color = 'white';
        }
    }
}

function gameOver() {
    canMove = false;
    // O unlock dos controls irá exibir o overlay automaticamente
    controls.unlock(); 
    if (gameplayMusic) gameplayMusic.pause();
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerHTML = '<h1>GAME OVER!</h1><p>Clique para Reiniciar</p>';
        overlay.onclick = () => location.reload();
    }
}

function startReload() {
    if (currentAmmo === maxAmmo || isReloading) {
        console.log("Munição cheia ou já recarregando!");
        return;
    }
    isReloading = true;
    reloadStartTime = Date.now(); 
    if (weaponMesh) {
        originalWeaponRotation.copy(weaponMesh.rotation); 
    }
    // Verifica se shootSound existe antes de tocar
    if (reloadSound) { 
        playSound(reloadSound); 
    } else {
        console.warn("Som de recarga não encontrado.");
    }

    console.log("Recarregando...");

    setTimeout(() => {
        currentAmmo = maxAmmo;
        updateAmmoDisplay();
        isReloading = false;
        console.log("Recarga completa!");

        if (weaponMesh) {
            weaponMesh.rotation.copy(originalWeaponRotation);
        }
    }, reloadTime);
}

function shoot() {
    const currentTime = Date.now();
    if (isReloading) {
        console.log("A arma está recarregando!");
        return;
    }
    if (currentTime - lastShotTime < shootCooldown) {
        return;
    }
    if (currentAmmo <= 0) {
        console.log("Sem munição! Pressione 'R' para recarregar.");
        return;
    }

    lastShotTime = currentTime;
    currentAmmo--;
    updateAmmoDisplay();
    // Verifica se shootSound existe antes de tocar
    if (shootSound) {
        playSound(shootSound); 
    } else {
        console.warn("Som de tiro não encontrado.");
    }

    const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    bullet.position.copy(camera.position);

    const forwardVector = new THREE.Vector3();
    camera.getWorldDirection(forwardVector);
    
    const bulletSpawnOffset = new THREE.Vector3(0.5, -0.2, 0.8);
    bulletSpawnOffset.applyQuaternion(camera.quaternion);
    bullet.position.add(bulletSpawnOffset);


    bullet.userData.direction = forwardVector;
    bullet.userData.spawnTime = currentTime;
    bullet.userData.damage = 20;
    bullet.userData.hit = false;

    scene.add(bullet);
    bullets.push(bullet);
}

// Função playSound ajustada para logar erros de autoplay
function playSound(soundElement, loop = false) {
    if (soundElement) {
        // Pausa e reinicia o som para garantir que ele comece do zero
        if (!soundElement.paused) { // Verifica se não está já pausado
            soundElement.pause();
        }
        soundElement.currentTime = 0; 
        soundElement.loop = loop;     
        
        const playPromise = soundElement.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                console.log(`Áudio '${soundElement.id}' tocando.`);
            })
            .catch(error => {
                console.warn(`AVISO: Falha ao tocar áudio '${soundElement.id}'. Motivo: ${error.message}`);
                console.warn("Isso geralmente ocorre devido às políticas de reprodução automática dos navegadores. Garanta que o usuário interagiu com a página antes de tentar tocar o áudio.");
            });
        }
    } else {
        console.warn("Elemento de áudio não encontrado para tocar.");
    }
}

// --- Loop de Animação (Game Loop) ---
function animate() {
    requestAnimationFrame(animate);

    if (canMove) { 
        const prevPosition = camera.position.clone();

        const moveSpeed = playerSpeed;
        if (keys['KeyW']) controls.moveForward(moveSpeed);
        if (keys['KeyS']) controls.moveForward(-moveSpeed);
        if (keys['KeyA']) controls.moveRight(-moveSpeed);
        if (keys['KeyD']) controls.moveRight(moveSpeed);

        if (!isOnGround) {
            verticalVelocity -= gravity;
            camera.position.y += verticalVelocity;

            if (camera.position.y <= playerHeight) {
                camera.position.y = playerHeight;
                verticalVelocity = 0;
                isOnGround = true;
                isJumping = false;
            }
        } else if (isJumping && verticalVelocity <= 0) {
             isJumping = false;
        }

        playerPointLight.position.set(camera.position.x, camera.position.y + 5, camera.position.z);

        const playerCurrentPos = camera.position.clone();
        const collisionDirections = [
            new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)
        ];

        let playerCollidedWithWall = false;
        for (const dir of collisionDirections) {
            const rayDirection = dir.clone().applyQuaternion(camera.quaternion);
            raycaster.set(playerCurrentPos, rayDirection);

            const intersects = raycaster.intersectObjects(wallMeshes);
            if (intersects.length > 0 && intersects[0].distance < playerRadius) {
                playerCollidedWithWall = true;
                break;
            }
        }

        if (playerCollidedWithWall) {
            camera.position.copy(prevPosition);
        }

        if (weaponMesh && !isReloading) {
            weaponIdleOffset += weaponIdleSpeed;
            weaponMesh.position.y = -0.4 + Math.sin(weaponIdleOffset) * weaponIdleRange;
            weaponMesh.position.x = 0.6 + Math.cos(weaponIdleOffset * 0.5) * weaponIdleRange * 0.5;
        }


        enemies.forEach(enemy => {
            const enemyPrevPosition = enemy.position.clone();

            const directionToPlayer = new THREE.Vector3();
            directionToPlayer.subVectors(camera.position, enemy.position).normalize();

            enemy.position.x += directionToPlayer.x * enemySpeed;
            enemy.position.z += directionToPlayer.z * enemySpeed;

            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z);

            const enemyCollisionRays = [
                new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
            ];

            let enemyCollidedWithWall = false;
            for (const dir of enemyCollisionRays) {
                raycaster.set(enemy.position, dir);
                const intersects = raycaster.intersectObjects(wallMeshes);
                if (intersects.length > 0 && intersects[0].distance < enemyCollisionRadius) {
                    enemyCollidedWithWall = true;
                    break;
                }
            }

            if (enemyCollidedWithWall) {
                enemy.position.copy(enemyPrevPosition);
            }

            const distanceToPlayer = enemy.position.distanceTo(camera.position);
            if (distanceToPlayer < (playerRadius + enemyCollisionRadius)) {
                takeDamage(enemyDamage); 
            }

            updateEnemyHealthBar(enemy);
        });

        const currentTime = Date.now();
        bullets = bullets.filter(bullet => {
            if (currentTime - bullet.userData.spawnTime > bulletLifeTime) {
                scene.remove(bullet);
                return false;
            }

            const bulletPrevPosition = bullet.position.clone();

            bullet.position.addScaledVector(bullet.userData.direction, bulletSpeed);

            const bulletTravelDirection = new THREE.Vector3().subVectors(bullet.position, bulletPrevPosition).normalize();
            raycaster.set(bulletPrevPosition, bulletTravelDirection);
            raycaster.far = bulletPrevPosition.distanceTo(bullet.position) + 0.1;

            const wallIntersects = raycaster.intersectObjects(wallMeshes);
            if (wallIntersects.length > 0) {
                scene.remove(bullet);
                return false;
            }

            enemies.forEach(enemy => {
                if (bullet.userData.hit) return;

                const distanceToEnemy = bullet.position.distanceTo(enemy.position);
                if (distanceToEnemy < enemyCollisionRadius) {
                    enemy.userData.health -= bullet.userData.damage;
                    updateEnemyHealthBar(enemy);
                    bullet.userData.hit = true;
                    scene.remove(bullet);

                    if (enemy.userData.health <= 0) {
                        scene.remove(enemy);
                        if (enemy.userData.healthBarElement) {
                            enemy.userData.healthBarElement.parentElement.remove();
                        }
                        enemies = enemies.filter(e => e.userData.id !== enemy.userData.id);
                    }
                }
            });

            return !bullet.userData.hit;
        });
    }

    if (isReloading && weaponMesh) {
        const elapsedTime = Date.now() - reloadStartTime;
        const progress = Math.min(1, elapsedTime / reloadTime); 

        weaponMesh.rotation.z = originalWeaponRotation.z + (Math.PI * 2 * progress); 
        
        if (progress >= 1) {
             weaponMesh.rotation.copy(originalWeaponRotation); 
        }
    }

    renderer.render(scene, camera);
}

// Inicia o menu quando a janela carregar
window.onload = init;