// --- Global Variables ---
let scene, camera, renderer;
const mazeSize = 25;
const cellSize = 10;
let mazeGrid = [];
let wallMeshes = [];

// 3D Materials
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x4F4F4F });

// Player/Camera
let controls; // Re-introducing PointerLockControls for desktop
const playerHeight = cellSize / 2;
const playerRadius = cellSize * 0.1;
let playerSpeed = 0.15; // Made mutable if needed for touch device speed adjustments
let keys = {}; // Keeping for desktop keyboard input
let playerHealth = 100;
const maxPlayerHealth = 100;
let lastDamageTime = 0;
const damageCooldown = 1000;
let lastShotTime = 0;
const shootCooldown = 200;

// Jump variables
const jumpForce = 1;
const gravity = 0.03;
let verticalVelocity = 0;
let isJumping = false;
let isOnGround = true;

// Ammo variables
let currentAmmo = 30;
const maxAmmo = 30;
const reloadTime = 1500;
let isReloading = false;

// Weapon
let weaponMesh;
let reloadStartTime = 0;
let originalWeaponRotation = new THREE.Euler();
let weaponIdleOffset = 0; // For weapon idle animation
const weaponIdleSpeed = 0.05;
const weaponIdleRange = 0.02;

// Enemies
let enemies = [];
const enemySpawnChance = 0.1;
const enemySpeed = 0.04;
const enemyDamage = 10;
const enemyHealth = 50;
const enemyCollisionRadius = cellSize * 0.8;

// Raycaster for Collision and Shooting
const raycaster = new THREE.Raycaster();

// Bullet effect
const bulletSpeed = 10;
const bulletLifeTime = 1000;
let bullets = [];
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

// GLTF model loader
const loader = new THREE.GLTFLoader();
const ENEMY_MODEL_URL = 'chaves.glb';
const WEAPON_MODEL_URL = null; // Set to your weapon GLB file, e.g., 'deagle.glb'

let enemyModel = null;
let weaponModel = null;

// UI Elements
let playerHealthBar;
let overlay, crosshair;
let enemyHealthBarsContainer;
let ammoDisplay;
let mobileControls; // Reference to the mobile controls div
let touchLookArea; // New: Reference to the touch look area div

let playerPointLight;

// Audio and Menu Variables
let menuMusic;
let gameplayMusic;
let damageSound;
let shootSound;
let reloadSound;

let mainMenu; // Reference to the main menu div
let startGameButton; // Reference to the start game button
let multiplayerButton; // New: Reference to the multiplayer button
let multiplayerLobby; // New: Reference to the multiplayer lobby div
let createRoomCoopButton; // New: Create Cooperative Room button
let createRoomCompetitiveButton; // New: Create Competitive Room button
let backToMenuButton; // New: Back to Main Menu button
let roomListElement; // New: UL element to list rooms
let userIdDisplay; // New: Element to display user ID

// Firebase Variables
let db;
let auth;
let currentUserId; // Stores the Firebase user ID
let currentRoomRef = null; // Reference to the current joined room
let unsubscribeFromRoom = null; // Function to unsubscribe from room updates

// Input State - Unified input handling for mobile game logic activation
const inputState = {
    canMove: false, // Initialized to false, set to true when game starts
    joystickActive: false, // For mobile joystick
    lastTouchX: 0, // For mobile look
    lastTouchY: 0, // For mobile look
};

// Touch Control Specifics
let isTouchDevice = false;
let touchIdentifierLook = -1; // Identifier for the touch controlling camera look
let touchIdentifierJoystick = -1; // Identifier for the touch controlling joystick
let joystickCenter = new THREE.Vector2(); // Center of the virtual joystick
let joystickKnob = null; // Reference to the joystick knob element

// --- Utility Function to Detect Mobile Device ---
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0);
}

// --- Initialization Function (prepares menu and listeners) ---
function init() {
    isTouchDevice = isMobileDevice();
    console.log("Is Mobile Device:", isTouchDevice);

    // References to DOM elements
    mainMenu = document.getElementById('mainMenu');
    startGameButton = document.getElementById('startGameButton');
    multiplayerButton = document.getElementById('multiplayerButton'); // Get multiplayer button
    multiplayerLobby = document.getElementById('multiplayerLobby'); // Get multiplayer lobby div
    createRoomCoopButton = document.getElementById('createRoomCoopButton');
    createRoomCompetitiveButton = document.getElementById('createRoomCompetitiveButton');
    backToMenuButton = document.getElementById('backToMenuButton');
    roomListElement = document.getElementById('roomList');
    userIdDisplay = document.getElementById('userIdDisplay');

    overlay = document.getElementById('overlay');
    crosshair = document.getElementById('crosshair');
    playerHealthBar = document.getElementById('playerHealthBar');
    enemyHealthBarsContainer = document.getElementById('enemyHealthBars');
    ammoDisplay = document.getElementById('ammoDisplay');
    mobileControls = document.getElementById('mobileControls');
    touchLookArea = document.getElementById('touchLookArea'); // Get reference to the new touch look area

    // Load references for audio elements
    menuMusic = document.getElementById('menuMusic');
    gameplayMusic = document.getElementById('gameplayMusic');
    damageSound = document.getElementById('damageSound');
    shootSound = document.getElementById('shootSound');
    reloadSound = document.getElementById('reloadSound');

    // Ensure main menu is displayed at start
    if (mainMenu) {
        mainMenu.style.display = 'flex';
    } else {
        console.error("ERRO: 'mainMenu' element not found! Check index.html");
        if (overlay) {
            overlay.innerHTML = '<h1>Erro: Menu Principal não encontrado!</h1><p>Verifique o console do navegador e o arquivo index.html.</p>';
            overlay.style.display = 'flex';
        }
        return; // Exit init function if main menu is missing
    }

    // --- Menu Button Listeners ---
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            console.log("Single Player Game button clicked. Attempting to play menu music...");
            playSound(menuMusic, true);
            startGame(false); // Start single player game
        });
    } else {
        console.error("ERRO: Elemento 'startGameButton' não encontrado!");
    }

    if (multiplayerButton) {
        multiplayerButton.addEventListener('click', () => {
            showMultiplayerLobby();
        });
    } else {
        console.error("ERRO: Elemento 'multiplayerButton' não encontrado!");
    }

    // --- Multiplayer Lobby Button Listeners ---
    if (createRoomCoopButton) {
        createRoomCoopButton.addEventListener('click', () => createRoom('coop'));
    }
    if (createRoomCompetitiveButton) {
        createRoomCompetitiveButton.addEventListener('click', () => createRoom('competitive'));
    }
    if (backToMenuButton) {
        backToMenuButton.addEventListener('click', () => {
            hideMultiplayerLobby();
            if (menuMusic) playSound(menuMusic, true); // Resume menu music
        });
    }

    // Initialize Firebase (Firebase variables are attached to window by the <script type="module"> in index.html)
    db = window.db;
    auth = window.auth;

    // Listen for auth state changes to get the user ID
    if (auth) {
        firebase.auth().onAuthStateChanged((user) => { // Using firebase.auth() due to global scope issue
            if (user) {
                currentUserId = user.uid;
                if (userIdDisplay) userIdDisplay.textContent = `ID do Usuário: ${currentUserId.substring(0, 8)}...`; // Display truncated ID
                console.log("Current user ID:", currentUserId);
                if (multiplayerLobby.style.display === 'flex') { // If lobby is already visible
                    listenForRooms(); // Start listening for rooms once authenticated
                }
            } else {
                console.warn("No user signed in yet.");
            }
        });
    } else {
        console.error("Firebase Auth not initialized!");
    }
}

// --- Function to Show Multiplayer Lobby ---
function showMultiplayerLobby() {
    if (mainMenu) mainMenu.style.display = 'none';
    if (multiplayerLobby) multiplayerLobby.style.display = 'flex';
    if (menuMusic) playSound(menuMusic, true); // Ensure menu music is playing in lobby

    if (currentUserId) { // Only listen for rooms if user is authenticated
        listenForRooms();
    } else {
        roomListElement.innerHTML = '<li>Autenticando...</li>';
    }
}

// --- Function to Hide Multiplayer Lobby ---
function hideMultiplayerLobby() {
    if (multiplayerLobby) multiplayerLobby.style.display = 'none';
    if (mainMenu) mainMenu.style.display = 'flex';
    if (unsubscribeFromRoom) {
        unsubscribeFromRoom(); // Stop listening for rooms
        unsubscribeFromRoom = null;
    }
}

// --- Listen for Real-time Room Updates ---
function listenForRooms() {
    if (!db) {
        console.error("Firestore DB not initialized!");
        return;
    }

    const roomsCollection = firebase.firestore().collection(`artifacts/${__app_id}/public/data/rooms`); // Correct collection path

    // Unsubscribe from previous listener if any
    if (unsubscribeFromRoom) {
        unsubscribeFromRoom();
    }

    unsubscribeFromRoom = roomsCollection.onSnapshot(snapshot => {
        roomListElement.innerHTML = ''; // Clear existing rooms
        if (snapshot.empty) {
            roomListElement.innerHTML = '<li>Nenhuma sala disponível. Crie uma!</li>';
            return;
        }

        snapshot.forEach(doc => {
            const roomData = doc.data();
            const roomId = doc.id;
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>Sala: ${roomId.substring(0, 6)} | Modo: ${roomData.mode} | Jogadores: ${roomData.players ? Object.keys(roomData.players).length : 0}</span>
                <button class="join-button" data-room-id="${roomId}">Entrar</button>
            `;
            listItem.querySelector('.join-button').addEventListener('click', (event) => joinRoom(event.target.dataset.roomId));
            roomListElement.appendChild(listItem);
        });
    }, error => {
        console.error("Error listening for rooms:", error);
        roomListElement.innerHTML = '<li>Erro ao carregar salas. Tente novamente mais tarde.</li>';
    });
}

// --- Create Room Function ---
async function createRoom(mode) {
    if (!db || !currentUserId) {
        console.error("Firestore DB or User ID not available for room creation.");
        return;
    }

    const roomsCollection = firebase.firestore().collection(`artifacts/${__app_id}/public/data/rooms`);

    try {
        const newRoomRef = await roomsCollection.add({
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            hostId: currentUserId,
            mode: mode, // 'coop' or 'competitive'
            status: 'waiting', // 'waiting', 'playing', 'finished'
            players: {
                [currentUserId]: { // Add host as the first player
                    id: currentUserId,
                    health: maxPlayerHealth,
                    ammo: maxAmmo,
                    position: new THREE.Vector3().toArray(), // Store as array
                    rotation: new THREE.Euler().toArray(), // Store as array
                    kills: 0,
                    deaths: 0,
                    // Add other player specific data
                }
            },
            enemies: {}, // Enemies will be managed by the host initially
            bullets: {}, // Bullets will be synced
        });
        console.log("Room created with ID:", newRoomRef.id);
        joinRoom(newRoomRef.id); // Automatically join the created room
    } catch (error) {
        console.error("Error creating room:", error);
    }
}

// --- Join Room Function ---
async function joinRoom(roomId) {
    if (!db || !currentUserId) {
        console.error("Firestore DB or User ID not available for joining room.");
        return;
    }

    currentRoomRef = firebase.firestore().collection(`artifacts/${__app_id}/public/data/rooms`).doc(roomId);

    try {
        const roomDoc = await currentRoomRef.get();
        if (!roomDoc.exists) {
            console.error("Room does not exist:", roomId);
            return;
        }

        const roomData = roomDoc.data();
        if (roomData.status !== 'waiting') {
            console.warn("Cannot join room, it's already in progress or finished.");
            // Display a message to the user
            overlay.innerHTML = `<h1>Sala ${roomId.substring(0,6)} já está em jogo ou cheia!</h1><p>Tente outra sala.</p>`;
            overlay.style.display = 'flex';
            overlay.onclick = null; // Remove onclick to prevent reload on click
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000); // Hide message after 3 seconds
            return;
        }

        // Add current player to the room's players list
        const playerUpdate = {};
        playerUpdate[`players.${currentUserId}`] = {
            id: currentUserId,
            health: maxPlayerHealth,
            ammo: maxAmmo,
            position: camera.position.toArray(),
            rotation: camera.rotation.toArray(),
            kills: 0,
            deaths: 0,
        };

        await currentRoomRef.update(playerUpdate);
        console.log("Joined room:", roomId);

        // Start the game for this player
        startGame(true); // true indicates multiplayer game
        listenToRoomChanges(roomId); // Listen for real-time updates in this room

    } catch (error) {
        console.error("Error joining room:", error);
    }
}

// --- Listen to Room Changes (Player Positions, etc.) ---
function listenToRoomChanges(roomId) {
    if (unsubscribeFromRoom) {
        unsubscribeFromRoom(); // Unsubscribe from lobby listener
    }

    currentRoomRef = firebase.firestore().collection(`artifacts/${__app_id}/public/data/rooms`).doc(roomId);

    // This listener will update game state based on changes in Firestore
    unsubscribeFromRoom = currentRoomRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists) {
            const roomData = docSnapshot.data();
            // console.log("Room data updated:", roomData);

            // Update other players' positions, health, etc.
            if (roomData.players) {
                for (const playerId in roomData.players) {
                    if (playerId !== currentUserId) { // Don't update current player's own data
                        const playerData = roomData.players[playerId];
                        // TODO: Implement logic to update other players' 3D models in the scene
                        // For now, just log:
                        // console.log(`Player ${playerId} - Pos:`, playerData.position, "Health:", playerData.health);
                    }
                }
            }

            // TODO: Update enemies, bullets based on roomData.enemies, roomData.bullets
            // This will be more complex and requires a "host" or shared logic.
        } else {
            console.warn("Room no longer exists or you were removed.");
            gameOver("Sala Fechada"); // Treat as game over or return to lobby
        }
    }, error => {
        console.error("Error listening to room changes:", error);
    });
}


// --- Function to Start the Game (now handles single/multiplayer) ---
async function startGame(isMultiplayerMode) {
    // Hide all menu/lobby UI
    if (mainMenu) mainMenu.style.display = 'none';
    if (multiplayerLobby) multiplayerLobby.style.display = 'none';

    // Initial Three.js scene setup (same as before)
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

    // Configure UI (health bars, ammo)
    if (!playerHealthBar || !ammoDisplay || !enemyHealthBarsContainer || !crosshair || !overlay || !mobileControls || !touchLookArea) {
        console.error("ERROR: Some UI elements (health bar, ammo, overlay, crosshair, enemyHealthBars, mobileControls, touchLookArea) were not found! Check index.html");
        overlay.innerHTML = '<h1>Erro: Elementos da UI não encontrados!</h1><p>Verifique o console do navegador e o index.html.</p>';
        overlay.style.display = 'flex';
        if (gameplayMusic) gameplayMusic.pause();
        return;
    }
    updateHealthDisplay();
    updateAmmoDisplay();

    // Model loading
    const modelPromises = [];
    if (ENEMY_MODEL_URL) {
        modelPromises.push(loadModel(ENEMY_MODEL_URL).then(model => enemyModel = model));
    }
    if (WEAPON_MODEL_URL) {
        modelPromises.push(loadModel(WEAPON_MODEL_URL).then(model => weaponModel = model));
    }

    try {
        await Promise.all(modelPromises);
        console.log("3D models loaded successfully!");
    } catch (error) {
        console.error('FATAL ERROR: Falha ao carregar modelos 3D:', error);
        overlay.innerHTML = '<h1>Erro ao carregar modelos 3D!</h1><p>Verifique o console para detalhes e os caminhos dos arquivos. (Ex: chaves.glb, deagle.glb)</p>';
        overlay.style.display = 'flex';
        if (gameplayMusic) gameplayMusic.pause();
        return;
    }

    // Maze generation and spawn enemies ONLY in single player or if this player is the host
    if (!isMultiplayerMode || (isMultiplayerMode && currentRoomRef && (await currentRoomRef.get()).data().hostId === currentUserId)) {
        generateMaze(mazeSize, mazeSize);
        renderMaze();
        // If multiplayer, host will also initialize and sync enemies to Firestore
    } else {
        // In multiplayer, clients will load maze/enemies from host data
        // For now, just generate a dummy maze to see something
        generateMaze(mazeSize, mazeSize);
        renderMaze();
    }
    
    setupWeapon();

    // Initial player position
    let startX = 0, startY = 0;
    for (let y = 0; y < mazeSize; y++) {
        for (let x = 0; x < mazeSize; x++) {
            if (mazeGrid[y][x] === 1) {
                startX = x;
                startY = y;
                break;
            }
        }
        if (startX !== 0) break;
    }
    camera.position.set(startX * cellSize + cellSize / 2, playerHeight, startY * cellSize + cellSize / 2);

    // Input listeners
    setupInputListeners();

    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();

    // Game is now ready
    showGameUI();
    // Play gameplay music (triggered after user interaction in the menu)
    if (menuMusic && !menuMusic.paused) {
        menuMusic.pause();
        menuMusic.currentTime = 0;
        console.log("Menu music paused, starting gameplay music.");
    }
    playSound(gameplayMusic, true);

    // Set canMove to true after everything is initialized and UI is ready
    inputState.canMove = true;
    console.log("Game started! inputState.canMove set to true.");
}

// --- Input Handling Setup ---
function setupInputListeners() {
    if (isTouchDevice) {
        // Hide desktop crosshair
        if (crosshair) crosshair.style.display = 'none';
        // Show mobile controls
        if (mobileControls) mobileControls.style.display = 'block';
        // Show touch look area
        if (touchLookArea) touchLookArea.style.display = 'block';


        // Get joystick elements
        const joystickContainer = document.getElementById('joystickContainer');
        joystickKnob = document.getElementById('joystick');

        // Add touch listeners to the DEDICATED touch look area (NOT renderer.domElement)
        if (touchLookArea) {
            touchLookArea.addEventListener('touchstart', onTouchStart, { passive: false });
            touchLookArea.addEventListener('touchmove', onTouchMove, { passive: false });
            touchLookArea.addEventListener('touchend', onTouchEnd, { passive: false });
        } else {
            console.error("ERROR: 'touchLookArea' element not found! Cannot set up touch look listeners.");
        }
        
        // Add listeners for virtual buttons
        document.getElementById('jumpButton').addEventListener('click', () => {
            if (isOnGround && inputState.canMove) { // Only jump if game is active
                verticalVelocity = jumpForce;
                isJumping = true;
                isOnGround = false;
            }
        });
        document.getElementById('shootButton').addEventListener('click', shoot);
        document.getElementById('reloadButton').addEventListener('click', startReload);

        // Add specific touch listeners for the joystick container
        if (joystickContainer) {
            joystickContainer.addEventListener('touchstart', onJoystickTouchStart, { passive: false });
            joystickContainer.addEventListener('touchmove', onJoystickTouchMove, { passive: false });
            joystickContainer.addEventListener('touchend', onJoystickTouchEnd, { passive: false });
        } else {
             console.error("ERROR: Joystick container not found!");
        }

    } else {
        // Desktop: Hide mobile controls
        if (mobileControls) mobileControls.style.display = 'none';
        // Hide touch look area on desktop
        if (touchLookArea) touchLookArea.style.display = 'none';
        // Show desktop crosshair
        if (crosshair) crosshair.style.display = 'block';

        // Initialize PointerLockControls for desktop
        controls = new THREE.PointerLockControls(camera, renderer.domElement);
        scene.add(controls.getObject()); // Add controls object to scene for player movement

        // Request pointer lock on click for desktop
        renderer.domElement.addEventListener('click', function() {
            controls.lock();
        });

        // Event listeners for PointerLockControls state changes
        controls.addEventListener('lock', function() {
            console.log("PointerLockControls locked. Game active.");
            showGameUI();
            inputState.canMove = true; // Set game active flag
            if (menuMusic && !menuMusic.paused) {
                menuMusic.pause();
                menuMusic.currentTime = 0;
            }
            playSound(gameplayMusic, true);
        });

        controls.addEventListener('unlock', function() {
            console.log("PointerLockControls unlocked. Game paused/inactive.");
            hideGameUI();
            inputState.canMove = false; // Set game inactive flag
            if (gameplayMusic) gameplayMusic.pause();
        });

        // Desktop keyboard listeners (used with PointerLockControls)
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        document.addEventListener('mousedown', onMouseDown, false); // Mouse down for shooting
    }
}

// --- UI Display Functions ---
function showGameUI() {
    if (overlay) overlay.style.display = 'none';
    if (crosshair && !isTouchDevice) crosshair.style.display = 'block'; // Only show crosshair on desktop
    // Health and Ammo are always visible
}

function hideGameUI() {
    if (overlay) {
        if (overlay.innerHTML.indexOf('GAME OVER') === -1) {
            overlay.innerHTML = '<h1>Jogo Pausado</h1><p>Pressione ESC ou clique para continuar</p>';
        }
        overlay.style.display = 'flex';
    }
    if (crosshair) crosshair.style.display = 'none';
}


// --- Model Loading ---
function loadModel(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
            resolve(gltf.scene);
        }, undefined, (error) => {
            console.error(`Error loading 3D model: ${url}`, error);
            reject(error);
        });
    });
}

// --- Window Resize Handling ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Recalculate joystick center on resize for mobile
    if (isTouchDevice && joystickKnob) {
        const rect = document.getElementById('joystickContainer').getBoundingClientRect();
        joystickCenter.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
}

// --- Desktop Keyboard Input (used with PointerLockControls) ---
function onKeyDown(event) {
    keys[event.code] = true;
    if (event.code === 'Space' && isOnGround && inputState.canMove) {
        verticalVelocity = jumpForce;
        isJumping = true;
        isOnGround = false;
    }
    if (event.code === 'KeyR' && !isReloading && currentAmmo < maxAmmo && inputState.canMove) {
        startReload();
    }
}

function onKeyUp(event) {
    keys[event.code] = false;
}

// --- Desktop Mouse Input (used with PointerLockControls) ---
function onMouseDown(event) {
    // Only fire if pointer lock is active and left mouse button
    if (inputState.canMove && event.button === 0 && (document.pointerLockElement === renderer.domElement || document.mozPointerLockElement === renderer.domElement || document.webkitPointerLockElement === renderer.domElement)) {
        shoot();
    }
}

// --- Mobile Touch Input ---
function onTouchStart(event) {
    // Only capture a touch if the game is active (not paused/menu)
    if (!inputState.canMove) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        // Ensure this touch is for the look area, not a button (buttons have their own listeners)
        if (touch.target.id === 'touchLookArea') { 
            if (touchIdentifierLook === -1) { // Only if no other touch is controlling look
                touchIdentifierLook = touch.identifier;
                // Store initial touch position for look
                inputState.lastTouchX = touch.clientX; // Store for delta calculation
                inputState.lastTouchY = touch.clientY;
                event.preventDefault();
            }
        }
    }
}

function onTouchMove(event) {
    // Only process if game is active
    if (!inputState.canMove) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        // If this touch is for looking around
        if (touch.identifier === touchIdentifierLook) {
            // Calculate delta and apply to camera rotation
            camera.rotation.y += (touch.clientX - inputState.lastTouchX) * inputState.touchLookSensitivity;
            camera.rotation.x += (touch.clientY - inputState.lastTouchY) * inputState.touchLookSensitivity;

            // Clamp camera pitch to prevent flipping
            camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

            inputState.lastTouchX = touch.clientX;
            inputState.lastTouchY = touch.clientY;
            event.preventDefault();
        }
    }
}

function onTouchEnd(event) {
    // Only process if game is active
    if (!inputState.canMove) return;

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === touchIdentifierLook) {
            touchIdentifierLook = -1; // Reset look touch
            event.preventDefault();
        }
    }
}

function onJoystickTouchStart(event) {
    if (!inputState.canMove) return;

    event.preventDefault(); // Prevent default scrolling/zooming

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.target.id === 'joystickContainer' || touch.target.id === 'joystick') { // Ensure touch is on joystick
            if (touchIdentifierJoystick === -1) { // Only if no other touch is controlling joystick
                touchIdentifierJoystick = touch.identifier;

                const rect = event.currentTarget.getBoundingClientRect();
                joystickCenter.set(rect.left + rect.width / 2, rect.top + rect.height / 2);

                // Position the knob at the initial touch point
                joystickKnob.style.transform = `translate(${touch.clientX - joystickCenter.x - joystickKnob.offsetWidth / 2}px, ${touch.clientY - joystickCenter.y - joystickKnob.offsetHeight / 2}px)`;

                inputState.joystickActive = true;
                break; // Only handle the first touch for joystick
            }
        }
    }
}

function onJoystickTouchMove(event) {
    if (!inputState.canMove || !inputState.joystickActive) return;

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === touchIdentifierJoystick) { // Ensure this touch is for the joystick
            let dx = touch.clientX - joystickCenter.x;
            let dy = touch.clientY - joystickCenter.y;

            // Limit knob movement to joystick container radius
            const maxDistance = joystickContainer.offsetWidth / 2 - joystickKnob.offsetWidth / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > maxDistance) {
                dx *= maxDistance / distance;
                dy *= maxDistance / distance;
            }

            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

            // Determine movement based on joystick position
            // These directly set the `keys` for movement, consistent with desktop input
            keys['KeyW'] = dy < -10;
            keys['KeyS'] = dy > 10;
            keys['KeyA'] = dx < -10;
            keys['KeyD'] = dx > 10;

            break;
        }
    }
}

function onJoystickTouchEnd(event) {
    if (!inputState.canMove || !inputState.joystickActive) return;

    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (touch.identifier === touchIdentifierJoystick) { // Ensure this touch is for the joystick
            // Reset joystick knob position
            joystickKnob.style.transform = 'translate(0, 0)';
            
            // Reset movement input keys
            keys['KeyW'] = false;
            keys['KeyS'] = false;
            keys['KeyA'] = false;
            keys['KeyD'] = false;

            inputState.joystickActive = false;
            touchIdentifierJoystick = -1; // Release joystick touch
            break;
        }
    }
}

// --- Maze Generation ---
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

    // Optional: Add some random openings in walls to make it less restrictive
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            if (mazeGrid[y][x] === 0 && Math.random() < 0.05) {
                // Only create an opening if adjacent to a path
                if (mazeGrid[y+1][x] === 1 || mazeGrid[y-1][x] === 1 || mazeGrid[y][x+1] === 1 || mazeGrid[y][x-1] === 1) {
                    mazeGrid[y][x] = 1;
                }
            }
        }
    }
    mazeGrid[height - 2][width - 1] = 1; // Ensure an exit
}

// --- Maze Rendering ---
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
                // Spawn enemies in open areas, but not at the very start
                if (Math.random() < enemySpawnChance && !(x === 1 && y === 1)) {
                    spawnEnemy(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
                }
            }
        }
    }
}

// --- Weapon Setup ---
function setupWeapon() {
    if (weaponModel) {
        weaponMesh = weaponModel.clone();
        weaponMesh.scale.set(10, 10, 10); // Adjust scale as needed
        weaponMesh.position.set(0.6, -0.4, 1); // Adjust position relative to camera
        weaponMesh.rotation.set(-Math.PI / 10, Math.PI, Math.PI / 2); // Adjust rotation as needed

        originalWeaponRotation.copy(weaponMesh.rotation);

        weaponMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } else {
        // Fallback simple weapon if no model is provided
        const weaponGeometry = new THREE.BoxGeometry(0.5, 0.2, 2);
        const weaponMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
        weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
        weaponMesh.position.set(0.6, -0.4, -1); // Position relative to camera
    }
    camera.add(weaponMesh); // Add weapon to camera so it moves with the player
}

// --- Enemy Spawning ---
function spawnEnemy(x, z) {
    let enemy;
    if (enemyModel) {
        enemy = enemyModel.clone();
        enemy.scale.set(4, 4, 4); // Adjust scale of Chaves model
        enemy.position.set(x, 0, z); // Position at ground level
        enemy.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } else {
        // Fallback simple enemy if no model is provided
        const enemyGeometry = new THREE.BoxGeometry(cellSize * 0.8, cellSize * 0.8, cellSize * 0.8);
        enemy = new THREE.Mesh(enemyGeometry, new THREE.MeshLambertMaterial({ color: 0xFF0000 }));
        enemy.position.set(x, cellSize * 0.4, z); // Position centered on cell
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

// --- Enemy Health Bar UI ---
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

    // Check if enemy is visible (not behind a wall)
    const origin = camera.position.clone();
    const enemyWorldPosition = new THREE.Vector3();
    enemy.getWorldPosition(enemyWorldPosition);
    const direction = new THREE.Vector3().subVectors(enemyWorldPosition, origin).normalize();
    raycaster.set(origin, direction);

    // Limit raycast distance to just before the enemy for occlusion check
    raycaster.far = origin.distanceTo(enemyWorldPosition) - (cellSize * 0.2);

    const intersects = raycaster.intersectObjects(wallMeshes);

    if (intersects.length > 0) {
        healthBarEl.parentElement.style.display = 'none'; // Hide if obstructed
        return;
    }

    // Project 3D enemy position to 2D screen coordinates
    const vector = new THREE.Vector3();
    enemy.getWorldPosition(vector);
    vector.project(camera);

    // Hide if behind camera or too far
    const distanceToEnemy = camera.position.distanceTo(enemy.position);
    if (vector.z < -1 || vector.z > 1 || distanceToEnemy > 100) {
        healthBarEl.parentElement.style.display = 'none';
        return;
    }

    healthBarEl.parentElement.style.display = 'block';

    const x = (vector.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
    const y = (-vector.y * 0.5 + 0.5) * renderer.domElement.clientHeight;

    const offset = 50; // Offset above enemy's head
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

// --- Player Health Handling ---
function takeDamage(amount) {
    const currentTime = Date.now();
    if (currentTime - lastDamageTime > damageCooldown) {
        playerHealth -= amount;
        lastDamageTime = currentTime;
        if (playerHealth < 0) playerHealth = 0;
        updateHealthDisplay();
        playSound(damageSound, false); // Play damage sound, don't loop
        if (playerHealth === 0) {
            gameOver("Você foi derrotado!");
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

// --- Ammo Display ---
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

// --- Game Over Logic ---
function gameOver(message = "GAME OVER!") {
    inputState.canMove = false; // Stop game input
    if (gameplayMusic) gameplayMusic.pause();
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.innerHTML = `<h1>${message}</h1><p>Clique para Reiniciar</p>`;
        overlay.onclick = () => location.reload(); // Reload page to restart
    }
    // Also release pointer lock if active on desktop
    if (!isTouchDevice && controls && controls.isLocked) { // Check if controls exist and are locked
        controls.unlock();
    }
    if (currentRoomRef) {
        // If in multiplayer, leave the room (or handle end of game for the room)
        leaveRoom();
    }
}

// --- Leave Room Logic (for Multiplayer) ---
async function leaveRoom() {
    if (!currentRoomRef || !currentUserId) return;

    try {
        const roomDoc = await currentRoomRef.get();
        if (roomDoc.exists) {
            const roomData = roomDoc.data();
            const players = roomData.players || {};
            if (players[currentUserId]) {
                delete players[currentUserId]; // Remove current player from room

                if (Object.keys(players).length === 0) {
                    // If no players left, delete the room
                    await currentRoomRef.delete();
                    console.log("Room deleted as last player left.");
                } else {
                    // Update players list in Firestore
                    await currentRoomRef.update({ players: players });
                }
                console.log("Left room:", currentRoomRef.id);
            }
        }
    } catch (error) {
        console.error("Error leaving room:", error);
    } finally {
        if (unsubscribeFromRoom) {
            unsubscribeFromRoom();
            unsubscribeFromRoom = null;
        }
        currentRoomRef = null;
    }
}


// --- Reloading Logic ---
function startReload() {
    if (currentAmmo === maxAmmo || isReloading) {
        console.log("Ammo full or already reloading!");
        return;
    }
    isReloading = true;
    reloadStartTime = Date.now();
    if (weaponMesh) {
        originalWeaponRotation.copy(weaponMesh.rotation);
    }
    if (reloadSound) {
        playSound(reloadSound, false); // Play reload sound, don't loop
    } else {
        console.warn("Reload sound not found.");
    }

    console.log("Reloading...");

    setTimeout(() => {
        currentAmmo = maxAmmo;
        updateAmmoDisplay();
        isReloading = false;
        console.log("Reload complete!");

        if (weaponMesh) {
            // Restore original weapon rotation after reload animation (if any)
            weaponMesh.rotation.copy(originalWeaponRotation);
        }
    }, reloadTime);
}

// --- Shooting Logic ---
function shoot() {
    const currentTime = Date.now();
    if (isReloading) {
        console.log("Weapon is reloading!");
        return;
    }
    if (currentTime - lastShotTime < shootCooldown) {
        return;
    }
    if (currentAmmo <= 0) {
        console.log("Out of ammo! Press 'R' (desktop) or 'Recarregar' button (mobile) to reload.");
        return;
    }

    lastShotTime = currentTime;
    currentAmmo--;
    updateAmmoDisplay();
    if (shootSound) {
        playSound(shootSound, false); // Play shoot sound, don't loop
    } else {
        console.warn("Shoot sound not found.");
    }

    const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

    bullet.position.copy(camera.position);

    const forwardVector = new THREE.Vector3();
    camera.getWorldDirection(forwardVector);

    // Offset bullet spawn position to appear from the weapon
    const bulletSpawnOffset = new THREE.Vector3(0.5, -0.2, 0.8);
    bulletSpawnOffset.applyQuaternion(camera.quaternion);
    bullet.position.add(bulletSpawnOffset);


    bullet.userData.direction = forwardVector;
    bullet.userData.spawnTime = currentTime;
    bullet.userData.damage = 20;
    bullet.userData.hit = false; // Flag to check if bullet hit something

    scene.add(bullet);
    bullets.push(bullet);
}

// --- Audio Playback Function ---
function playSound(soundElement, loop = false) {
    if (soundElement) {
        // Only pause and reset if it's not the gameplay music and it's currently playing
        // or if it's the gameplay music and we explicitly want to restart it.
        if (soundElement !== gameplayMusic || !loop) {
             if (!soundElement.paused) {
                 soundElement.pause();
             }
             soundElement.currentTime = 0;
        }
        
        soundElement.loop = loop;

        const playPromise = soundElement.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // console.log(`Audio '${soundElement.id}' playing.`); // Keep quiet in production
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

// --- Animation Loop (Game Loop) ---
function animate() {
    requestAnimationFrame(animate);

    if (inputState.canMove) { // Only update game logic if game is active
        const prevPosition = camera.position.clone();

        // Player Movement (based on inputState)
        // If desktop, controls.getObject() moves the camera directly
        // If mobile, manual movement based on joystick
        if (isTouchDevice) {
            const moveVector = new THREE.Vector3();
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection); // Get current camera forward direction
            cameraDirection.y = 0; // Keep movement on the XZ plane
            cameraDirection.normalize();

            const rightVector = new THREE.Vector3();
            rightVector.crossVectors(cameraDirection, camera.up); // Get right vector

            if (keys['KeyW']) moveVector.add(cameraDirection);
            if (keys['KeyS']) moveVector.sub(cameraDirection);
            if (keys['KeyA']) moveVector.sub(rightVector);
            if (keys['KeyD']) moveVector.add(rightVector);

            moveVector.normalize(); // Normalize diagonal movement speed
            camera.position.addScaledVector(moveVector, playerSpeed);
        } else {
            // Desktop movement handled by PointerLockControls
            const moveSpeed = playerSpeed;
            if (keys['KeyW']) controls.moveForward(moveSpeed);
            if (keys['KeyS']) controls.moveForward(-moveSpeed);
            if (keys['KeyA']) controls.moveRight(-moveSpeed);
            if (keys['KeyD']) controls.moveRight(moveSpeed);
        }


        // Player Jump
        if (!isOnGround) {
            verticalVelocity -= gravity;
            camera.position.y += verticalVelocity;

            if (camera.position.y <= playerHeight) {
                camera.position.y = playerHeight;
                verticalVelocity = 0;
                isOnGround = true;
                isJumping = false;
            }
        }

        playerPointLight.position.set(camera.position.x, camera.position.y + 5, camera.position.z);

        // Player-Wall Collision
        const playerCurrentPos = camera.position.clone();
        const collisionDirections = [
            new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)
        ];

        let playerCollidedWithWall = false;
        for (const dir of collisionDirections) {
            const rayDirection = dir.clone().applyQuaternion(camera.quaternion); // Apply camera rotation
            raycaster.set(playerCurrentPos, rayDirection);
            raycaster.far = playerRadius; // Ray length equal to player radius

            const intersects = raycaster.intersectObjects(wallMeshes);
            if (intersects.length > 0 && intersects[0].distance < playerRadius) {
                playerCollidedWithWall = true;
                break;
            }
        }

        if (playerCollidedWithWall) {
            camera.position.copy(prevPosition); // Revert position if collided
        }

        // Camera Look is handled by PointerLockControls on desktop, and manually on mobile (onTouchMove)
        // No need to reset look deltas as direct camera rotation is used for mobile

        // Weapon Idle Animation
        if (weaponMesh && !isReloading) {
            weaponIdleOffset += weaponIdleSpeed;
            weaponMesh.position.y = -0.4 + Math.sin(weaponIdleOffset) * weaponIdleRange;
            weaponMesh.position.x = 0.6 + Math.cos(weaponIdleOffset * 0.5) * weaponIdleRange * 0.5;
        }

        // Enemy Movement and Player Collision
        enemies.forEach(enemy => {
            const enemyPrevPosition = enemy.position.clone();

            const directionToPlayer = new THREE.Vector3();
            directionToPlayer.subVectors(camera.position, enemy.position).normalize();

            enemy.position.x += directionToPlayer.x * enemySpeed;
            enemy.position.z += directionToPlayer.z * enemySpeed;

            enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z); // Make enemy face player

            // Enemy-Wall Collision
            const enemyCollisionRays = [
                new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
            ];

            let enemyCollidedWithWall = false;
            for (const dir of enemyCollisionRays) {
                raycaster.set(enemy.position, dir);
                raycaster.far = enemyCollisionRadius;
                const intersects = raycaster.intersectObjects(wallMeshes);
                if (intersects.length > 0 && intersects[0].distance < enemyCollisionRadius) {
                    enemyCollidedWithWall = true;
                    break;
                }
            }

            if (enemyCollidedWithWall) {
                enemy.position.copy(enemyPrevPosition);
            }

            // Enemy-Player Damage
            const distanceToPlayer = enemy.position.distanceTo(camera.position);
            if (distanceToPlayer < (playerRadius + enemyCollisionRadius)) {
                takeDamage(enemyDamage);
            }

            updateEnemyHealthBar(enemy); // Update enemy health bar position
        });

        // Bullet Movement and Collision
        const currentTime = Date.now();
        bullets = bullets.filter(bullet => {
            // Remove old bullets
            if (currentTime - bullet.userData.spawnTime > bulletLifeTime) {
                scene.remove(bullet);
                return false;
            }

            const bulletPrevPosition = bullet.position.clone();

            bullet.position.addScaledVector(bullet.userData.direction, bulletSpeed);

            // Check for bullet collision with walls
            const bulletTravelDirection = new THREE.Vector3().subVectors(bullet.position, bulletPrevPosition).normalize();
            raycaster.set(bulletPrevPosition, bulletTravelDirection);
            raycaster.far = bulletPrevPosition.distanceTo(bullet.position) + 0.1; // Check along the bullet's path

            const wallIntersects = raycaster.intersectObjects(wallMeshes);
            if (wallIntersects.length > 0) {
                scene.remove(bullet);
                return false; // Remove bullet if it hits a wall
            }

            // Check for bullet collision with enemies
            enemies.forEach(enemy => {
                if (bullet.userData.hit) return; // If already hit something, skip

                const distanceToEnemy = bullet.position.distanceTo(enemy.position);
                if (distanceToEnemy < enemyCollisionRadius) {
                    enemy.userData.health -= bullet.userData.damage;
                    updateEnemyHealthBar(enemy);
                    bullet.userData.hit = true; // Mark bullet as hit
                    scene.remove(bullet); // Remove bullet on hit

                    if (enemy.userData.health <= 0) {
                        scene.remove(enemy);
                        if (enemy.userData.healthBarElement) {
                            enemy.userData.healthBarElement.parentElement.remove();
                        }
                        enemies = enemies.filter(e => e.userData.id !== enemy.userData.id); // Remove dead enemy
                    }
                }
            });

            return !bullet.userData.hit; // Keep bullet if it hasn't hit yet
        });
    }

    // Weapon Reload Animation
    if (isReloading && weaponMesh) {
        const elapsedTime = Date.now() - reloadStartTime;
        const progress = Math.min(1, elapsedTime / reloadTime);

        // Simple weapon rotation during reload
        weaponMesh.rotation.z = originalWeaponRotation.z + (Math.PI * 2 * progress);

        if (progress >= 1) {
            weaponMesh.rotation.copy(originalWeaponRotation); // Snap back to original
        }
    }

    renderer.render(scene, camera);
}

// Start menu when window loads
window.onload = init;
