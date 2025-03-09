// Import necessary libraries
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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
    maxSpeed: 20,             // Maximum car speed
    acceleration: 0.02,       // Car acceleration rate (per frame)
    brakingForce: 0.3,        // Car braking force (per frame)
    emergencyBrakeForce: 0.6, // Stronger braking force for space bar
    friction: 0.98,           // Car friction (affects slowdown)
    turnSpeed: 0.03           // Car turning speed (radians per frame)
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

// Create a basic track with start and finish lines
// Track geometry (straight road)
const trackGeometry = new THREE.PlaneGeometry(10, 50);
const track = new THREE.Mesh(trackGeometry, trackMaterial);
track.rotation.x = -Math.PI / 2;
scene.add(track);

// Start line
const startGeometry = new THREE.PlaneGeometry(10, 1);
const startLine = new THREE.Mesh(startGeometry, startLineMaterial);
startLine.rotation.x = -Math.PI / 2;
startLine.position.z = 24; // Near the end of the track
startLine.position.y = 0.01; // Slightly above track to prevent z-fighting
scene.add(startLine);

// Finish line
const finishGeometry = new THREE.PlaneGeometry(10, 1);
const finishLine = new THREE.Mesh(finishGeometry, finishLineMaterial);
finishLine.rotation.x = -Math.PI / 2;
finishLine.position.z = -24; // Near the other end of the track
finishLine.position.y = 0.01; // Slightly above track to prevent z-fighting
scene.add(finishLine);

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
    position: new THREE.Vector3(0, 0.5, 22), // Start position
    rotation: new THREE.Euler(0, 0, 0),      // Current rotation
    velocity: new THREE.Vector3(0, 0, 0),    // Current velocity
    speed: 0,                                // Current speed
    direction: new THREE.Vector3(0, 0, -1),  // Forward direction vector
    onGround: true                           // Is car on ground
};

// Set initial car position
carGroup.position.copy(car.position);

// Create a follow camera
// Camera follow settings
const cameraOffset = new THREE.Vector3(0, 3, 8); // Height and distance behind car
let cameraPreviousPosition = new THREE.Vector3();
cameraPreviousPosition.copy(camera.position);

// Position the camera initially
camera.position.set(0, 5, 30); // Start behind the car
camera.lookAt(0, 0, 20);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Track boundaries
const trackBounds = {
    left: -5,
    right: 5,
    top: -24.5,
    bottom: 24.5
};

// Reset car function
function resetCar() {
    car.position.set(0, 0.5, 22); // Back to start
    car.velocity.set(0, 0, 0);    // Stop movement
    car.speed = 0;                // Reset speed
    car.rotation.y = 0;           // Reset rotation
    carGroup.position.copy(car.position);
    carGroup.rotation.y = car.rotation.y;
}

// Game reset function
function resetGame() {
    resetCar();
    // Reset timer
    startTime = null;
    raceStarted = false;
    finalTime = null;
    document.getElementById('timer').innerText = `Time: 0.00s`;
    // Remove finish notification if exists
    if (finishNotification) {
        document.body.removeChild(finishNotification);
        finishNotification = null;
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

// Animation loop
function animate() {
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
    }
    
    // Update timer
    if (raceStarted && finalTime === null) {
        const elapsed = (Date.now() - startTime) / 1000; // Seconds
        document.getElementById('timer').innerText = `Time: ${elapsed.toFixed(2)}s`;
    }
    
    // Check finish line crossing
    if (raceStarted && finalTime === null && car.position.z < -24) {
        finalTime = (Date.now() - startTime) / 1000;
        
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
        if (Math.abs(car.speed) < 0.01) {
            car.speed = 0;
        }
    }
    
    // Apply velocity based on speed and direction
    car.velocity.copy(car.direction).multiplyScalar(car.speed);
    
    // Update position based on velocity
    car.position.add(car.velocity);
    
    // Apply simple track boundaries
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
        Controls: ${moveForward ? 'Accelerating' : ''} ${moveBackward ? 'Braking' : ''} 
                  ${turnLeft ? 'Left' : ''} ${turnRight ? 'Right' : ''} 
                  ${emergencyBrake ? 'EMERGENCY BRAKE' : ''}
    `;
    
    // Render the scene
    renderer.render(scene, camera);
}

// Start the animation loop
animate(); 