import { Scene, MeshBasicMaterial, Mesh, SphereGeometry, Object3D, Vector2, Box2, MeshNormalMaterial, Material, MeshLambertMaterial, TextureLoader, Quaternion, Vector3, Euler, Camera } from "three";
import { Scene, MeshBasicMaterial, Mesh, SphereGeometry, Object3D, Vector2, Box2, MeshNormalMaterial, Material, MeshLambertMaterial, TextureLoader, Quaternion, Vector3, Euler, MeshToonMaterial, NearestFilter } from "three";
import { Time } from "./Time";
import mouseTexture from "../assets/mouse_texture.png";
import toonTexture from "../assets/threeTone_bright.jpg";
import { InputManager } from "./InputManager";

export type SerializedPlayerData = {
    position: Vector3,
    velocity: Vector3
}

export class GreenCube {
    material : Material;
    debugSphere : Mesh;
    public object : Object3D;
    visualRotationSpeedMultiplier : number = 1;
    velocity : Vector3;
    radius : number = 1;
    scene: Scene;
    maxSpeed : number = 40;

    // composite body
    body: Mesh;

    const = {
        right: new Vector3(1,0,0),
        forward: new Vector3(0,0,-1),
    }

    var = {
        rot1: new Quaternion(),
        rot2: new Quaternion(),
        v1: new Vector3(),
    }

    smoothing = {
        wantedPosition: new Vector3(),
        lastInfoTime: 0,
        lerpTime: 0.3, // const
        lerping: false,
    }

    constructor(scene : Scene, loader : TextureLoader)
    {
        const toonRamp = loader.load(toonTexture, (texture) => {
            texture.minFilter = NearestFilter;
            texture.magFilter = NearestFilter;
        });
        this.debugSphere = new Mesh(new SphereGeometry( this.radius, 12, 12 ), new MeshBasicMaterial( { color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.3}) );
        this.debugSphere.position.y += this.radius;
        this.debugSphere.visible = false;

        
        this.material = new MeshToonMaterial( { color: 0xaaaaaa, gradientMap: toonRamp});

        this.body = new Mesh(new SphereGeometry( 0.8, 12, 12 ), this.material );
        this.body.position.y = this.radius;


        this.object = new Object3D();
        this.object.add(this.debugSphere);
        this.object.add(this.body);
        this.object.position.x += Math.random()* 5 - 2.5;
        this.object.position.z += Math.random()* 5 - 2.5;
        scene.add( this.object );
        this.scene = scene;

        this.velocity = new Vector3();
    }

    update(time : Time, worldBoundaries : Box2, input? : InputManager, camera? : Object3D)
    {
        let positionBefore = this.var.v1.copy(this.object.position);

        if (input && camera) { // Local players
            const inputVelocity = new Vector3(input.trackball.velocity.x, 0, -input.trackball.velocity.y)
            const relativeRight = new Vector3(1, 0, 0)
            relativeRight.applyQuaternion(camera.quaternion)
            relativeRight.y = 0
            relativeRight.normalize()
            const trackballRight = relativeRight.clone()
            trackballRight.multiplyScalar(input.trackball.velocity.x)

            const relativeForward = new Vector3(0, 0, 1)
            relativeForward.applyQuaternion(camera.quaternion)
            relativeForward.y = 0
            relativeForward.normalize()
            const trackballForward = relativeForward.clone()
            trackballForward.multiplyScalar(input.trackball.velocity.y)
            
            this.velocity.set(0, 0, 0);
            this.velocity.add(trackballRight)
            this.velocity.add(trackballForward)

            relativeRight.multiplyScalar(this.maxSpeed)
            relativeForward.multiplyScalar(this.maxSpeed)

            if (input.left.pressed)
                this.velocity.sub(relativeRight)
            if (input.right.pressed)
                this.velocity.add(relativeRight)
            
            // this.velocity.y = 0;
            // this.velocity.y = inputVelocity.y
            if (input.down.pressed)
                this.velocity.add(relativeForward)
            if (input.up.pressed)
                this.velocity.sub(relativeForward)

           this.velocity.clampLength(0, this.maxSpeed)
            
            if (input.debugButton.pressedThisFrame) {
                this.debugSphere.visible = !this.debugSphere.visible;
            }
        }

        if (!input && this.smoothing.lerping) { // Other players and interpolating
            let lerpTime = time.time - this.smoothing.lastInfoTime;
            let lerpFactor = Math.min(1, Math.max(0, lerpTime/this.smoothing.lerpTime));

            this.smoothing.wantedPosition.x += this.velocity.x * time.deltaTime;
            this.smoothing.wantedPosition.z += this.velocity.z * time.deltaTime;

            this.object.position.lerp(this.smoothing.wantedPosition, lerpFactor);
            
            if (lerpFactor >= 1)
                this.smoothing.lerping = false;
        }
        else {
            this.object.position.x += this.velocity.x * time.deltaTime;
            this.object.position.z += this.velocity.z * time.deltaTime;
        }

        // Move and collide against AABB world boundaries 
        if (this.object.position.x + this.radius > worldBoundaries.max.x)
        {
            this.object.position.x = worldBoundaries.max.x - this.radius;
        }
        else if (this.object.position.x - this.radius < worldBoundaries.min.x) {
            this.object.position.x = worldBoundaries.min.x + this.radius;
        }
        if (this.object.position.z + this.radius > worldBoundaries.max.y)
        {
            this.object.position.z = worldBoundaries.max.y - this.radius;
        }
        else if (this.object.position.z - this.radius < worldBoundaries.min.y) {
            this.object.position.z = worldBoundaries.min.y + this.radius;
        }

        // Visually update
        let frameDisplacement = positionBefore.sub(this.object.position).multiplyScalar(-1);

        if (this.debugSphere.visible) {
            // debug sphere
            let zMovementRotation = this.var.rot1.setFromAxisAngle(this.const.right, frameDisplacement.z / this.radius * this.visualRotationSpeedMultiplier);
            let xMovementRotation = this.var.rot2.setFromAxisAngle(this.const.forward, frameDisplacement.x / this.radius * this.visualRotationSpeedMultiplier);
            zMovementRotation.multiply(xMovementRotation);
            this.debugSphere.quaternion.premultiply(zMovementRotation);
        }
    }

    serializePlayerData() : SerializedPlayerData {
        return {
            position : this.object.position,
            velocity: this.velocity
        }
    }

    onRemotePlayerData(data : SerializedPlayerData, timeSinceItWasSent : number, time : Time)
    {
        this.smoothing.wantedPosition.copy(data.position);
        this.smoothing.lastInfoTime = time.time;
        this.smoothing.lerping = true;
        this.velocity.copy(data.velocity);
        //console.log(`timeSinceItWasSent (seconds): ${timeSinceItWasSent}`);
    }

    dispose() {
        this.debugSphere.geometry.dispose();
        this.scene.remove(this.object);
    }
}
