import * as THREE from "three"

export class PlayerController {
  constructor(Camera, DomElement, Colliders) {
    this.Camera = Camera
    this.DomElement = DomElement
    this.Colliders = Colliders
    this.Position = new THREE.Vector3(0, 1.65, 0)
    this.Velocity = new THREE.Vector3()
    this.Yaw = 0
    this.Pitch = 0
    this.Radius = 0.38
    this.WalkSpeed = 4.3
    this.SprintSpeed = 7.0
    this.Stamina = 1
    this.Keys = new Set()
    this.Locked = false
    this.BobTime = 0
    this.SetupInput()
  }

  SetupInput() {
    window.addEventListener("keydown", Event => this.Keys.add(Event.code))
    window.addEventListener("keyup", Event => this.Keys.delete(Event.code))
    document.addEventListener("pointerlockchange", () => {
      this.Locked = document.pointerLockElement === this.DomElement
    })
    window.addEventListener("mousemove", Event => {
      if (!this.Locked) return
      this.Yaw -= Event.movementX * 0.0022
      this.Pitch -= Event.movementY * 0.002
      this.Pitch = Math.max(-1.47, Math.min(1.47, this.Pitch))
    })
  }

  Lock() {
    this.DomElement.requestPointerLock()
  }

  SetPosition(Position) {
    this.Position.copy(Position)
    this.Position.y = 1.65
    this.Camera.position.copy(this.Position)
  }

  Update(Delta) {
    const ForwardInput = (this.Keys.has("KeyW") ? 1 : 0) - (this.Keys.has("KeyS") ? 1 : 0)
    const SideInput = (this.Keys.has("KeyD") ? 1 : 0) - (this.Keys.has("KeyA") ? 1 : 0)
    const Moving = ForwardInput !== 0 || SideInput !== 0
    const WantsSprint = this.Keys.has("ShiftLeft") && ForwardInput > 0 && this.Stamina > 0.03
    const Speed = WantsSprint ? this.SprintSpeed : this.WalkSpeed

    if (WantsSprint && Moving) this.Stamina = Math.max(0, this.Stamina - Delta * 0.19)
    else this.Stamina = Math.min(1, this.Stamina + Delta * 0.12)

    const Forward = new THREE.Vector3(-Math.sin(this.Yaw), 0, -Math.cos(this.Yaw))
    const Right = new THREE.Vector3(Math.cos(this.Yaw), 0, -Math.sin(this.Yaw))
    const Move = new THREE.Vector3()
    Move.addScaledVector(Forward, ForwardInput)
    Move.addScaledVector(Right, SideInput)

    if (Move.lengthSq() > 0) Move.normalize().multiplyScalar(Speed * Delta)

    this.TryMove(Move.x, 0)
    this.TryMove(0, Move.z)

    if (Moving) this.BobTime += Delta * (WantsSprint ? 12 : 8)
    const Bob = Moving ? Math.sin(this.BobTime) * 0.025 : 0

    this.Camera.position.set(this.Position.x, this.Position.y + Bob, this.Position.z)
    this.Camera.rotation.order = "YXZ"
    this.Camera.rotation.y = this.Yaw
    this.Camera.rotation.x = this.Pitch
  }

  TryMove(DeltaX, DeltaZ) {
    const NextX = this.Position.x + DeltaX
    const NextZ = this.Position.z + DeltaZ
    if (!this.Collides(NextX, NextZ)) {
      this.Position.x = NextX
      this.Position.z = NextZ
    }
  }

  Collides(X, Z) {
    for (const Box of this.Colliders) {
      const ClosestX = Math.max(Box.MinX, Math.min(X, Box.MaxX))
      const ClosestZ = Math.max(Box.MinZ, Math.min(Z, Box.MaxZ))
      const Dx = X - ClosestX
      const Dz = Z - ClosestZ
      if (Dx * Dx + Dz * Dz < this.Radius * this.Radius) return true
    }
    return false
  }
}
