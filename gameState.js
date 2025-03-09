// Game state management class - will be key for multiplayer later
class GameState {
    constructor() {
        // Car state
        this.car = {
            position: { x: 0, y: 1, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            velocity: { x: 0, y: 0, z: 0 },
            angularVelocity: { x: 0, y: 0, z: 0 }
        };
        
        // Race state
        this.race = {
            started: false,
            finished: false,
            startTime: null,
            finishTime: null,
            elapsedTime: 0
        };
        
        // Track state (will expand in future MVPs)
        this.track = {
            id: "basic_track",
            checkpoints: [
                { id: "start", position: { x: 0, z: 24 } },
                { id: "finish", position: { x: 0, z: -24 } }
            ]
        };
    }
    
    // Update car state from physics
    updateFromPhysics(physicsBody) {
        this.car.position = { 
            x: physicsBody.position.x,
            y: physicsBody.position.y,
            z: physicsBody.position.z
        };
        
        this.car.rotation = {
            x: physicsBody.quaternion.x,
            y: physicsBody.quaternion.y,
            z: physicsBody.quaternion.z,
            w: physicsBody.quaternion.w
        };
        
        this.car.velocity = {
            x: physicsBody.velocity.x,
            y: physicsBody.velocity.y,
            z: physicsBody.velocity.z
        };
        
        this.car.angularVelocity = {
            x: physicsBody.angularVelocity.x,
            y: physicsBody.angularVelocity.y,
            z: physicsBody.angularVelocity.z
        };
    }
    
    // Update race timing
    updateRaceTime() {
        if (this.race.started && !this.race.finished) {
            this.race.elapsedTime = (Date.now() - this.race.startTime) / 1000;
        }
    }
    
    // Start the race
    startRace() {
        this.race.started = true;
        this.race.startTime = Date.now();
    }
    
    // Finish the race
    finishRace() {
        if (!this.race.finished) {
            this.race.finished = true;
            this.race.finishTime = Date.now();
            this.race.elapsedTime = (this.race.finishTime - this.race.startTime) / 1000;
        }
        return this.race.elapsedTime;
    }
    
    // Reset the race
    resetRace() {
        this.race.started = false;
        this.race.finished = false;
        this.race.startTime = null;
        this.race.finishTime = null;
        this.race.elapsedTime = 0;
    }
    
    // Get serialized state (will be important for multiplayer)
    getSerializableState() {
        return {
            car: this.car,
            race: this.race,
            track: this.track.id
        };
    }
}

// Export for use in game.js
export default GameState; 