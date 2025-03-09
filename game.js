// Import necessary libraries
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import GameState from './gameState.js';
import NetworkManager from './network.js';

// Initialize game state and network manager
const gameState = new GameState();
const networkManager = new NetworkManager(gameState);

// Game state
let gameStarted = false;
let currentTrack = null;

// Track definitions
const tracks = {
    straight: {
        name: "Straight Track",
        description: "A simple straight track with a start and finish line",
        create: createStraightTrack,
        bounds: {
            left: -5,
            right: 5,
            top: -24.5,
            bottom: 24.5
        },
        startPosition: new THREE.Vector3(0, 0.5, 22),
        startRotation: 0
    },
    circle: {
        name: "Giant Circle Track",
        description: "A massive circular track with separate start and finish lines",
        create: createCircleTrack,
        bounds: {
            centerX: 0,
            centerZ: 0,
            innerRadius: 300,
            outerRadius: 315
        },
        // Start position will be calculated in the track creation function
        startPosition: new THREE.Vector3(0, 0.5, 0), 
        startRotation: 0 // Will be set in the track creation function
    }
};

// Track keyboard input
const keys = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false, 
    KeyW: false, 
    KeyS: false, 
    KeyA: false, 
    KeyD: false,
    KeyR: false, // Reset key
    Space: false // Emergency brake
};

// Set up key event listeners
window.addEventListener('keydown', (e) => { 
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true; 
});
window.addEventListener('keyup', (e) => { 
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false; 
});

// Physics configuration based on game design
const physicsConfig = {
    maxSpeed: 1,             // Maximum car speed
    acceleration: 0.002,       // Car acceleration rate (per frame)
    brakingForce: 0.003,       // Car braking force (per frame)
    emergencyBrakeForce: 0.006, // Stronger braking force for space bar
    friction: 0.00098,           // Car friction (affects slowdown)
    turnSpeed: 0.01           // Car turning speed (radians per frame)
};

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Create a perspective camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Create materials
const trackMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
const startLineMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const finishLineMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const carBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
const innerBoundaryMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
const outerBoundaryMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
const barrierMaterial = new THREE.MeshBasicMaterial({ color: 0x993300 }); // Brown barrier

// Track objects container
const trackObjects = {
    track: null,
    startLine: null,
    finishLine: null,
    boundaries: [],
    barriers: []
};

// Global reference to the menu container
let menuContainer;

// Functions to create tracks
function createStraightTrack() {
    // Clear any existing track objects
    clearTrack();
    
    // Create a straight track
    const trackGeometry = new THREE.PlaneGeometry(10, 50);
    trackObjects.track = new THREE.Mesh(trackGeometry, trackMaterial);
    trackObjects.track.rotation.x = -Math.PI / 2;
    scene.add(trackObjects.track);
    
    // Create start line
    const startGeometry = new THREE.PlaneGeometry(10, 1);
    trackObjects.startLine = new THREE.Mesh(startGeometry, startLineMaterial);
    trackObjects.startLine.rotation.x = -Math.PI / 2;
    trackObjects.startLine.position.z = 24; // Near the end of the track
    trackObjects.startLine.position.y = 0.01; // Slightly above track to prevent z-fighting
    scene.add(trackObjects.startLine);
    
    // Create finish line
    const finishGeometry = new THREE.PlaneGeometry(10, 1);
    trackObjects.finishLine = new THREE.Mesh(finishGeometry, finishLineMaterial);
    trackObjects.finishLine.rotation.x = -Math.PI / 2;
    trackObjects.finishLine.position.z = -24; // Near the other end of the track
    trackObjects.finishLine.position.y = 0.01; // Slightly above track to prevent z-fighting
    scene.add(trackObjects.finishLine);
    
    // Set the track boundaries reference
    trackBounds = tracks.straight.bounds;
    
    // Set car position for this track
    resetCar(tracks.straight.startPosition, tracks.straight.startRotation);
}

function createCircleTrack() {
    // Clear any existing track objects
    clearTrack();
    
    // Track parameters
    const innerRadius = tracks.circle.bounds.innerRadius; // 300
    const outerRadius = tracks.circle.bounds.outerRadius; // 315
    const trackWidth = outerRadius - innerRadius; // 15
    const segments = 128; // More segments for smoother circle
    
    // Create a circular track
    const trackGeometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
    trackObjects.track = new THREE.Mesh(trackGeometry, trackMaterial);
    trackObjects.track.rotation.x = -Math.PI / 2;
    scene.add(trackObjects.track);
    
    // Create inner and outer boundaries (visual only)
    const innerBoundaryGeometry = new THREE.RingGeometry(innerRadius - 0.2, innerRadius, segments);
    const innerBoundary = new THREE.Mesh(innerBoundaryGeometry, innerBoundaryMaterial);
    innerBoundary.rotation.x = -Math.PI / 2;
    innerBoundary.position.y = 0.02;
    scene.add(innerBoundary);
    trackObjects.boundaries.push(innerBoundary);
    
    const outerBoundaryGeometry = new THREE.RingGeometry(outerRadius, outerRadius + 0.2, segments);
    const outerBoundary = new THREE.Mesh(outerBoundaryGeometry, outerBoundaryMaterial);
    outerBoundary.rotation.x = -Math.PI / 2;
    outerBoundary.position.y = 0.02;
    scene.add(outerBoundary);
    trackObjects.boundaries.push(outerBoundary);
    
    // Define angles for start and finish lines (in radians)
    const startAngle = 15 * (Math.PI / 180); // 15 degrees
    const finishAngle = 340 * (Math.PI / 180); // 340 degrees
    const barrierAngle = 7 * (Math.PI / 180); // 7 degrees (slightly behind start)
    
    // Create start line - using a more visible approach with BoxGeometry
    const startLineWidth = trackWidth + 2; // Make it slightly wider than the track
    const startLineGeometry = new THREE.BoxGeometry(startLineWidth, 0.1, 3); // Make it 3 units wide for visibility
    trackObjects.startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
    
    // Calculate position for the start line
    const startMidRadius = (innerRadius + outerRadius) / 2;
    const startX = Math.cos(startAngle) * startMidRadius;
    const startZ = Math.sin(startAngle) * startMidRadius;
    trackObjects.startLine.position.set(startX, 0.05, startZ); // Positioned slightly above the track
    
    // Calculate rotation to align with radius
    const startLineRotation = -startAngle;
    trackObjects.startLine.rotation.y = startLineRotation;
    
    scene.add(trackObjects.startLine);
    
    // Create finish line - using a similar approach
    const finishLineWidth = trackWidth + 2; // Make it slightly wider than the track
    const finishLineGeometry = new THREE.BoxGeometry(finishLineWidth, 0.1, 3); // Make it 3 units wide for visibility
    trackObjects.finishLine = new THREE.Mesh(finishLineGeometry, finishLineMaterial);
    
    // Calculate position for the finish line
    const finishMidRadius = (innerRadius + outerRadius) / 2;
    const finishX = Math.cos(finishAngle) * finishMidRadius;
    const finishZ = Math.sin(finishAngle) * finishMidRadius;
    trackObjects.finishLine.position.set(finishX, 0.05, finishZ); // Positioned slightly above the track
    
    // Calculate rotation to align with radius
    const finishLineRotation = -finishAngle;
    trackObjects.finishLine.rotation.y = finishLineRotation;
    
    scene.add(trackObjects.finishLine);
    
    // Create a barrier behind the start line - make it wider than the track
    // Calculate the inner and outer points of the barrier, extending beyond the track edges
    const barrierExtension = 10; // Extend the barrier by 10 units on each side
    const barrierInnerX = Math.cos(barrierAngle) * (innerRadius - barrierExtension);
    const barrierInnerZ = Math.sin(barrierAngle) * (innerRadius - barrierExtension);
    const barrierOuterX = Math.cos(barrierAngle) * (outerRadius + barrierExtension);
    const barrierOuterZ = Math.sin(barrierAngle) * (outerRadius + barrierExtension);
    
    // Calculate the direction vector along the barrier
    const barrierDirX = barrierOuterX - barrierInnerX;
    const barrierDirZ = barrierOuterZ - barrierInnerZ;
    const barrierLength = Math.sqrt(barrierDirX * barrierDirX + barrierDirZ * barrierDirZ);
    
    // Create the barrier - taller and wider than before
    const barrierGeometry = new THREE.BoxGeometry(barrierLength, 5, 2);
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    
    // Position the barrier at the midpoint
    const barrierMidX = (barrierInnerX + barrierOuterX) / 2;
    const barrierMidZ = (barrierInnerZ + barrierOuterZ) / 2;
    barrier.position.set(barrierMidX, 2.5, barrierMidZ); // Positioned higher (2.5 instead of 1.5)
    
    // Calculate the rotation to align with the radial direction
    const barrierRotation = -Math.atan2(barrierDirZ, barrierDirX);
    barrier.rotation.y = barrierRotation;
    
    scene.add(barrier);
    trackObjects.barriers.push(barrier);
    
    // Add visual markers at the start and finish points for debugging
    const startMarkerGeometry = new THREE.SphereGeometry(3, 16, 16);
    const startMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    const startMarker = new THREE.Mesh(startMarkerGeometry, startMarkerMaterial);
    startMarker.position.set(startX, 3, startZ);
    scene.add(startMarker);
    trackObjects.boundaries.push(startMarker);
    
    const finishMarkerGeometry = new THREE.SphereGeometry(3, 16, 16);
    const finishMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
    const finishMarker = new THREE.Mesh(finishMarkerGeometry, finishMarkerMaterial);
    finishMarker.position.set(finishX, 3, finishZ);
    scene.add(finishMarker);
    trackObjects.boundaries.push(finishMarker);
    
    // Set car starting position just after the start line
    const carStartAngle = startAngle - 0.05 ; // Just past the start line
    const carMidRadius = (innerRadius + outerRadius) / 2;
    const carX = Math.cos(carStartAngle) * carMidRadius;
    const carZ = Math.sin(carStartAngle) * carMidRadius;
    
    // Calculate car rotation to face along the track (tangent to the circle)
    const carRotation = carStartAngle + Math.PI*0.85 ; // Tangent direction
    
    // Set the track's start position and rotation
    tracks.circle.startPosition = new THREE.Vector3(carX, 0.5, carZ);
    tracks.circle.startRotation = carRotation;
    
    // Set the track boundaries reference
    trackBounds = tracks.circle.bounds;
    
    // Set car position for this track
    resetCar(tracks.circle.startPosition, tracks.circle.startRotation);
    
    // Add some debug output to help troubleshoot
    console.log("Track created with following parameters:");
    console.log("Start line position:", startX, startZ);
    console.log("Finish line position:", finishX, finishZ);
    console.log("Barrier position:", barrierMidX, barrierMidZ);
    console.log("Car start position:", carX, carZ);
}

function clearTrack() {
    // Remove existing track objects from the scene
    if (trackObjects.track) scene.remove(trackObjects.track);
    if (trackObjects.startLine) scene.remove(trackObjects.startLine);
    if (trackObjects.finishLine) scene.remove(trackObjects.finishLine);
    
    // Remove any boundary objects
    trackObjects.boundaries.forEach(boundary => scene.remove(boundary));
    trackObjects.boundaries = [];
    
    // Remove any barrier objects
    trackObjects.barriers.forEach(barrier => scene.remove(barrier));
    trackObjects.barriers = [];
}

// SIMPLIFIED APPROACH: Create car with direct velocity control instead of physics
// Car visual model
const carGroup = new THREE.Group(); // Use a group for the entire car
scene.add(carGroup);

const carBodyGeometry = new THREE.BoxGeometry(2, 1, 4);
const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
carBody.position.y = 0.5; // Lift car body above the ground
carGroup.add(carBody);

// Add wheels (simple cylinders)
const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);

// Create 4 wheels
const frontLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
frontLeftWheel.rotation.z = Math.PI / 2; // Rotate to align with car
frontLeftWheel.position.set(-1, 0, -1.5); // Position at front-left of car
carBody.add(frontLeftWheel);

const frontRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
frontRightWheel.rotation.z = Math.PI / 2;
frontRightWheel.position.set(1, 0, -1.5);
carBody.add(frontRightWheel);

const rearLeftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
rearLeftWheel.rotation.z = Math.PI / 2;
rearLeftWheel.position.set(-1, 0, 1.5);
carBody.add(rearLeftWheel);

const rearRightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
rearRightWheel.rotation.z = Math.PI / 2;
rearRightWheel.position.set(1, 0, 1.5);
carBody.add(rearRightWheel);

// Car state
const car = {
    position: new THREE.Vector3(0, 0.5, 0),  // Will be set by the track
    rotation: new THREE.Euler(0, 0, 0),      // Current rotation
    velocity: new THREE.Vector3(0, 0, 0),    // Current velocity
    speed: 0,                                // Current speed
    direction: new THREE.Vector3(0, 0, -1),  // Forward direction vector
    onGround: true,                          // Is car on ground
    lap: 0,                                  // For circle track
    crossingStart: false,                    // Track when crossing start line
    crossingFinish: false                    // Track when crossing finish line
};

// Create a follow camera
// Camera follow settings
const cameraOffset = new THREE.Vector3(0, 5, 15); // Increased height and distance for better view of larger track
let cameraPreviousPosition = new THREE.Vector3();

// Position the camera initially
camera.position.set(0, 10, 50); // Higher and further back for the larger track
cameraPreviousPosition.copy(camera.position);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Track boundaries - will be set by the track
let trackBounds = tracks.straight.bounds;

// Reset car function with position parameters
function resetCar(position = tracks.straight.startPosition, rotation = tracks.straight.startRotation) {
    car.position.copy(position);
    car.velocity.set(0, 0, 0);    // Stop movement
    car.speed = 0;                // Reset speed
    car.rotation.set(0, rotation, 0); // Set rotation (y-axis)
    car.lap = 0;
    car.crossingStart = false;    // Reset crossing flags
    car.crossingFinish = false;   // Reset crossing flags
    carGroup.position.copy(car.position);
    carGroup.rotation.y = car.rotation.y;
}

// Game reset function
function resetGame() {
    // Reset car based on current track
    if (currentTrack === 'straight') {
        resetCar(tracks.straight.startPosition, tracks.straight.startRotation);
    } else if (currentTrack === 'circle') {
        resetCar(tracks.circle.startPosition, tracks.circle.startRotation);
    }
    
    // Reset timer
    startTime = null;
    raceStarted = false;
    finalTime = null;
    document.getElementById('timer').innerText = `Time: 0.00s`;
    
    // Reset game state for multiplayer readiness
    gameState.resetRace();
    
    // Remove finish notification if exists
    if (finishNotification) {
        document.body.removeChild(finishNotification);
        finishNotification = null;
    }
    
    clearTimeout(autoResetTimeout);
    
    // In multiplayer, notify server of race reset
    if (networkManager.isMultiplayer) {
        // This will be implemented in MVP3
        console.log("Would notify server of race reset in multiplayer mode");
    }
}

// Race timer variables
let startTime = null;
let raceStarted = false;
let finalTime = null;
let finishNotification = null;
let autoResetTimeout = null;

// Debug info
const debugInfo = document.createElement('div');
debugInfo.style.position = 'absolute';
debugInfo.style.top = '40px';
debugInfo.style.left = '10px';
debugInfo.style.color = 'white';
document.body.appendChild(debugInfo);

// Create brake indicator
const brakeIndicator = document.createElement('div');
brakeIndicator.style.position = 'absolute';
brakeIndicator.style.top = '50%';
brakeIndicator.style.left = '50%';
brakeIndicator.style.transform = 'translate(-50%, -50%)';
brakeIndicator.style.color = 'red';
brakeIndicator.style.fontWeight = 'bold';
brakeIndicator.style.fontSize = '24px';
brakeIndicator.style.display = 'none';
brakeIndicator.textContent = 'BRAKING!';
document.body.appendChild(brakeIndicator);

// Create the menu system
function createMenu() {
    menuContainer = document.createElement('div');
    menuContainer.id = 'menu-container';
    menuContainer.style.position = 'absolute';
    menuContainer.style.top = '50%';
    menuContainer.style.left = '50%';
    menuContainer.style.transform = 'translate(-50%, -50%)';
    menuContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    menuContainer.style.padding = '20px';
    menuContainer.style.borderRadius = '10px';
    menuContainer.style.color = 'white';
    menuContainer.style.fontFamily = 'Arial, sans-serif';
    menuContainer.style.textAlign = 'center';
    menuContainer.style.zIndex = '1000';
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'AIGaming Racing';
    title.style.marginBottom = '20px';
    menuContainer.appendChild(title);
    
    // Track selection
    const trackSelectionTitle = document.createElement('h2');
    trackSelectionTitle.textContent = 'Select Track:';
    trackSelectionTitle.style.marginBottom = '10px';
    menuContainer.appendChild(trackSelectionTitle);
    
    // Track options
    const trackContainer = document.createElement('div');
    trackContainer.style.display = 'flex';
    trackContainer.style.justifyContent = 'center';
    trackContainer.style.gap = '20px';
    trackContainer.style.marginBottom = '30px';
    
    // Add track buttons
    Object.keys(tracks).forEach(trackKey => {
        const track = tracks[trackKey];
        
        const trackBox = document.createElement('div');
        trackBox.style.border = '2px solid white';
        trackBox.style.padding = '15px';
        trackBox.style.borderRadius = '5px';
        trackBox.style.cursor = 'pointer';
        trackBox.style.width = '180px';
        
        const trackName = document.createElement('h3');
        trackName.textContent = track.name;
        trackBox.appendChild(trackName);
        
        const trackDesc = document.createElement('p');
        trackDesc.textContent = track.description;
        trackDesc.style.fontSize = '14px';
        trackBox.appendChild(trackDesc);
        
        // On click event
        trackBox.addEventListener('click', () => {
            startGame(trackKey);
        });
        
        // Hover effect
        trackBox.addEventListener('mouseover', () => {
            trackBox.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        trackBox.addEventListener('mouseout', () => {
            trackBox.style.backgroundColor = 'transparent';
        });
        
        trackContainer.appendChild(trackBox);
    });
    
    menuContainer.appendChild(trackContainer);
    
    // Controls section
    const controlsTitle = document.createElement('h2');
    controlsTitle.textContent = 'Controls:';
    controlsTitle.style.marginBottom = '10px';
    menuContainer.appendChild(controlsTitle);
    
    const controlsList = document.createElement('ul');
    controlsList.style.listStyleType = 'none';
    controlsList.style.padding = '0';
    
    const controls = [
        { key: 'Arrow Up / W', action: 'Accelerate' },
        { key: 'Arrow Down / S', action: 'Brake / Reverse' },
        { key: 'Arrow Left / A', action: 'Turn Left' },
        { key: 'Arrow Right / D', action: 'Turn Right' },
        { key: 'Space', action: 'Emergency Brake' },
        { key: 'R', action: 'Reset Car' }
    ];
    
    controls.forEach(control => {
        const item = document.createElement('li');
        item.style.marginBottom = '5px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        
        const keySpan = document.createElement('span');
        keySpan.textContent = control.key;
        keySpan.style.fontWeight = 'bold';
        keySpan.style.marginRight = '20px';
        
        const actionSpan = document.createElement('span');
        actionSpan.textContent = control.action;
        
        item.appendChild(keySpan);
        item.appendChild(actionSpan);
        controlsList.appendChild(item);
    });
    
    menuContainer.appendChild(controlsList);
    
    document.body.appendChild(menuContainer);
    
    // Hide in-game UI elements while in menu
    document.getElementById('timer').style.display = 'none';
    debugInfo.style.display = 'none';
}

// Start game with selected track
function startGame(trackKey) {
    currentTrack = trackKey;
    gameStarted = true;
    
    // Remove menu if it exists
    if (menuContainer && menuContainer.parentNode) {
        menuContainer.parentNode.removeChild(menuContainer);
    }
    
    // Show in-game UI
    document.getElementById('timer').style.display = 'block';
    debugInfo.style.display = 'block';
    
    // Clear any existing track before creating a new one
    clearTrack();
    
    // Create the selected track
    tracks[trackKey].create();
    
    // Start animation if not already running
    if (!animationRunning) {
        animationRunning = true;
        animate();
    }
}

// Animation loop
let animationRunning = false;

function animate() {
    // Only run if game has started
    if (!gameStarted) {
        requestAnimationFrame(animate);
        return;
    }
    
    requestAnimationFrame(animate);
    
    // Get key states
    const moveForward = keys.ArrowUp || keys.KeyW;
    const moveBackward = keys.ArrowDown || keys.KeyS;
    const turnLeft = keys.ArrowLeft || keys.KeyA;
    const turnRight = keys.ArrowRight || keys.KeyD;
    const resetKey = keys.KeyR;
    const emergencyBrake = keys.Space;
    
    // Start timer when player first accelerates
    if ((moveForward || moveBackward) && !raceStarted) {
        startTime = Date.now();
        raceStarted = true;
        // Update game state
        gameState.startRace();
    }
    
    // Update timer
    if (raceStarted && finalTime === null) {
        const elapsed = (Date.now() - startTime) / 1000; // Seconds
        document.getElementById('timer').innerText = `Time: ${elapsed.toFixed(2)}s`;
        // Update race time in game state
        gameState.updateRaceTime();
    }
    
    // Check if car has crossed the finish line
    let finishCrossed = false;
    
    if (currentTrack === 'straight') {
        // Straight track - finish line is at z < -24
        if (raceStarted && finalTime === null && car.position.z < -24) {
            finishCrossed = true;
        }
    } else if (currentTrack === 'circle') {
        // For circular track, calculate distance to finish line
        if (raceStarted && finalTime === null) {
            // Get finish line's orientation and width for better detection
            const finishDirection = new THREE.Vector3(
                Math.sin(trackObjects.finishLine.rotation.y),
                0,
                Math.cos(trackObjects.finishLine.rotation.y)
            );
            
            // Get vector from finish line to car
            const toCarVector = new THREE.Vector3();
            toCarVector.subVectors(car.position, trackObjects.finishLine.position);
            
            // Project this vector onto finish line direction to get distance
            const distanceAlongLine = toCarVector.dot(finishDirection);
            
            // Get perpendicular (across) distance using finish line's right direction
            const finishRight = new THREE.Vector3(
                Math.cos(trackObjects.finishLine.rotation.y),
                0,
                -Math.sin(trackObjects.finishLine.rotation.y)
            );
            
            const distanceAcrossLine = Math.abs(toCarVector.dot(finishRight));
            
            // Get finish line half-width
            const finishHalfWidth = trackObjects.finishLine.geometry.parameters.width / 2;
            
            // Check if car is crossing the finish line (within reasonable distance)
            const isCrossingFinish = Math.abs(distanceAlongLine) < 1.5 && distanceAcrossLine < finishHalfWidth;
            
            // Add debug output
            if (isCrossingFinish) {
                console.log("Car near finish line: ", {
                    distance: distanceAlongLine, 
                    across: distanceAcrossLine,
                    lap: car.lap
                });
            }
            
            // Track when we've crossed the finish line to prevent multiple detections
            if (isCrossingFinish && car.lap >= 1 && !car.crossingFinish) {
                finishCrossed = true;
                car.crossingFinish = true;
                console.log("FINISH LINE CROSSED!");
            } else if (Math.abs(distanceAlongLine) > 5) {
                car.crossingFinish = false;
            }
            
            // Check if passing start line to increment lap counter
            // Calculate distance from car to start line
            const dxStart = car.position.x - trackObjects.startLine.position.x;
            const dzStart = car.position.z - trackObjects.startLine.position.z;
            const distanceToStart = Math.sqrt(dxStart * dxStart + dzStart * dzStart);
            
            // Check if car is crossing the start line (within reasonable distance)
            const isCrossingStart = distanceToStart < 10;
            
            // Only increment lap if moving in the correct direction (based on velocity)
            if (isCrossingStart && !car.crossingStart) {
                // Calculate direction around the circle track
                const centerToCarX = car.position.x - trackBounds.centerX;
                const centerToCarZ = car.position.z - trackBounds.centerZ;
                const tangentX = -centerToCarZ; // Tangent is perpendicular to radius
                const tangentZ = centerToCarX;
                
                // Compare with car's velocity to see if moving in correct direction
                const movingInCorrectDirection = (tangentX * car.velocity.x + tangentZ * car.velocity.z) > 0;
                
                if (movingInCorrectDirection) {
                    car.lap++;
                    debugInfo.innerHTML += `<br>Lap ${car.lap} started!`;
                }
                car.crossingStart = true;
            } else if (distanceToStart > 15) {
                car.crossingStart = false;
            }
        }
    }
    
    // Handle finish line crossing
    if (finishCrossed) {
        // Use game state to record finish
        finalTime = gameState.finishRace();
        
        // Create finish notification
        finishNotification = document.createElement('div');
        finishNotification.style.position = 'absolute';
        finishNotification.style.top = '50%';
        finishNotification.style.left = '50%';
        finishNotification.style.transform = 'translate(-50%, -50%)';
        finishNotification.style.color = 'white';
        finishNotification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        finishNotification.style.padding = '20px';
        finishNotification.style.borderRadius = '10px';
        finishNotification.style.fontWeight = 'bold';
        finishNotification.style.fontSize = '24px';
        finishNotification.innerHTML = `Finish!<br>Time: ${finalTime.toFixed(2)}s<br>Resetting in 3 seconds...`;
        document.body.appendChild(finishNotification);
        
        document.getElementById('timer').innerText = `Final Time: ${finalTime.toFixed(2)}s`;
        
        // Auto reset after 3 seconds
        clearTimeout(autoResetTimeout);
        autoResetTimeout = setTimeout(() => {
            resetGame();
        }, 3000);
    
        // In multiplayer, we would notify the server here
        if (networkManager.isMultiplayer) {
            // This will be implemented in MVP3
            console.log("Would send race finish data to server in multiplayer mode");
            // networkManager.sendRaceFinish(finalTime);
        }
    }
    
    // Reset car if R key is pressed
    if (resetKey) {
        resetGame();
    }
    
    // DIRECT APPROACH: Update car movement based on keys
    // Turning
    if (turnLeft) {
        car.rotation.y += physicsConfig.turnSpeed;
    }
    if (turnRight) {
        car.rotation.y -= physicsConfig.turnSpeed;
    }
    
    // Update direction vector based on car rotation
    car.direction.set(0, 0, -1).applyEuler(car.rotation);
    
    // Handle Space Bar - Emergency Brake (only slows down to zero, doesn't reverse)
    if (emergencyBrake && car.speed > 0) {
        car.speed -= physicsConfig.emergencyBrakeForce;
        if (car.speed < 0) car.speed = 0;
        
        // Show brake indicator
        brakeIndicator.style.display = 'block';
    } else {
        // Hide brake indicator if not emergency braking
        brakeIndicator.style.display = 'none';
        
        // Normal acceleration/braking
        if (moveForward) {
            car.speed += physicsConfig.acceleration;
        }
        
        // Braking/reverse
        if (moveBackward) {
            if (car.speed > 0) {
                // Brake when moving forward
                car.speed -= physicsConfig.brakingForce;
            } else {
                // Reverse when stopped or already going backward
                car.speed -= physicsConfig.acceleration / 2; // Slower acceleration for reverse
            }
        }
    }
    
    // Apply speed limits
    car.speed = Math.max(-physicsConfig.maxSpeed / 2, Math.min(physicsConfig.maxSpeed, car.speed));
    
    // Apply friction (natural deceleration)
    if (!moveForward && !moveBackward && !emergencyBrake) {
        car.speed *= physicsConfig.friction;
        
        // If speed is very small, just stop the car
        if (Math.abs(car.speed) < 0.001) {
            car.speed = 0;
        }
    }
    
    // Apply velocity based on speed and direction
    car.velocity.copy(car.direction).multiplyScalar(car.speed);
    
    // Update position based on velocity
    car.position.add(car.velocity);
    
    // Apply track boundaries based on track type
    if (currentTrack === 'straight') {
        // Straight track boundaries
        if (car.position.x < trackBounds.left) {
            car.position.x = trackBounds.left;
            car.velocity.x = 0;
        }
        if (car.position.x > trackBounds.right) {
            car.position.x = trackBounds.right;
            car.velocity.x = 0;
        }
        if (car.position.z < trackBounds.top) {
            car.position.z = trackBounds.top;
            car.velocity.z = 0;
        }
        if (car.position.z > trackBounds.bottom) {
            car.position.z = trackBounds.bottom;
            car.velocity.z = 0;
        }
    } else if (currentTrack === 'circle') {
        // Circle track boundaries - check distance from center
        const dx = car.position.x - trackBounds.centerX;
        const dz = car.position.z - trackBounds.centerZ;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
        
        if (distanceFromCenter < trackBounds.innerRadius) {
            // Inside inner boundary - push out
            const angle = Math.atan2(dz, dx);
            car.position.x = trackBounds.centerX + Math.cos(angle) * trackBounds.innerRadius;
            car.position.z = trackBounds.centerZ + Math.sin(angle) * trackBounds.innerRadius;
            
            // Reflect velocity a bit
            car.speed *= 0.9;
        } else if (distanceFromCenter > trackBounds.outerRadius) {
            // Outside outer boundary - push in
            const angle = Math.atan2(dz, dx);
            car.position.x = trackBounds.centerX + Math.cos(angle) * trackBounds.outerRadius;
            car.position.z = trackBounds.centerZ + Math.sin(angle) * trackBounds.outerRadius;
            
            // Reflect velocity a bit
            car.speed *= 0.9;
        }
        
        // Check for barrier collision for circular track
        for (const barrier of trackObjects.barriers) {
            // Get barrier's forward direction (based on its rotation)
            const barrierForward = new THREE.Vector3(
                Math.sin(barrier.rotation.y),
                0,
                Math.cos(barrier.rotation.y)
            );
            
            // Get barrier's right direction (perpendicular to forward)
            const barrierRight = new THREE.Vector3(
                Math.cos(barrier.rotation.y),
                0,
                -Math.sin(barrier.rotation.y)
            );
            
            // Vector from barrier center to car
            const toCarVector = new THREE.Vector3();
            toCarVector.subVectors(car.position, barrier.position);
            
            // Project onto barrier's right axis to get how far along the barrier we are
            const rightProjection = toCarVector.dot(barrierRight);
            
            // Get barrier's half-width (half of its geometry's x dimension)
            const barrierHalfWidth = barrier.geometry.parameters.width / 2;
            
            // Check if car is within the barrier's width
            if (Math.abs(rightProjection) <= barrierHalfWidth) {
                // Project onto barrier's forward axis to get distance from barrier
                const forwardProjection = toCarVector.dot(barrierForward);
                
                // Check if car is close enough to barrier to collide
                if (Math.abs(forwardProjection) < 3) {
                    // Move car away from barrier
                    const pushDistance = 3 - Math.abs(forwardProjection);
                    const pushDirection = forwardProjection >= 0 ? 1 : -1;
                    
                    car.position.x += barrierForward.x * pushDistance * pushDirection;
                    car.position.z += barrierForward.z * pushDistance * pushDirection;
                    
                    // Reduce speed on collision
                    car.speed *= 0.8;
                }
            }
        }
    }
    
    // Update car visuals
    carGroup.position.copy(car.position);
    carGroup.rotation.y = car.rotation.y;
    
    // Animate wheel rotation based on speed
    const wheelRotationSpeed = car.speed * 0.2;
    frontLeftWheel.rotation.x += wheelRotationSpeed;
    frontRightWheel.rotation.x += wheelRotationSpeed;
    rearLeftWheel.rotation.x += wheelRotationSpeed;
    rearRightWheel.rotation.x += wheelRotationSpeed;
    
    // Update camera to follow car
    const idealOffset = new THREE.Vector3();
    idealOffset.copy(cameraOffset);
    idealOffset.applyEuler(car.rotation);
    idealOffset.add(car.position);
    
    // Smoothly interpolate camera position (lerp)
    cameraPreviousPosition.lerp(idealOffset, 0.1);
    camera.position.copy(cameraPreviousPosition);
    
    // Make camera look at the car
    camera.lookAt(
        car.position.x,
        car.position.y + 0.5, // Look slightly above the car
        car.position.z
    );
    
    // Show debug info
    debugInfo.innerHTML = `
        Speed: ${Math.round(car.speed * 10) / 10}<br>
        Position: ${Math.round(car.position.x)}, ${Math.round(car.position.y)}, ${Math.round(car.position.z)}<br>
        Track: ${tracks[currentTrack].name}<br>
        ${currentTrack === 'circle' ? `Lap: ${car.lap}/1<br>` : ''}
        Controls: ${moveForward ? 'Accelerating' : ''} ${moveBackward ? 'Braking' : ''} 
                  ${turnLeft ? 'Left' : ''} ${turnRight ? 'Right' : ''} 
                  ${emergencyBrake ? 'EMERGENCY BRAKE' : ''}
    `;
    
    // Render the scene
    renderer.render(scene, camera);

    // Update physics world
    world.step(timeStep);
    
    // Update game state from physics
    if (carBody) {
        gameState.updateFromPhysics(carBody);
    }
    
    // For future multiplayer functionality - send updates to server
    if (networkManager.isMultiplayer) {
        networkManager.sendPlayerState();
    }
}

// Show the menu on game start
createMenu();

// Start animation loop (will wait for track selection)
animate(); 