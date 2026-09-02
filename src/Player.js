import * as THREE from "three"

export class PlayerController {
  constructor(Camera, DomElement, Colliders) {
    this.Camera = Camera
    this.DomElement = DomElement
    this.Colliders = Colliders
    this.Position = new THREE.Vector3(0, 1.65, 0)
    this.Yaw = 0
    this.Pitch = 0
    this.TargetYaw = 0
    this.TargetPitch = 0
    this.MouseDeltaX = 0
    this.MouseDeltaY = 0
    this.Roll = 0
    this.Bob = 0
    this.BobTime = 0
    this.Radius = 0.38
    this.WalkSpeed = 4.3
    this.SprintSpeed = 6.8
    this.Stamina = 1
    this.Keys = new Set()
    this.Locked = false
    this.Modal = false
    this.Forward = new THREE.Vector3()
    this.Right = new THREE.Vector3()
    this.Move = new THREE.Vector3()
    this.SetupInput()
  }

  SetupInput() {
    window.addEventListener("keydown", Event => {
      if (!this.IsMovementKey(Event.code)) return
      this.Keys.add(Event.code)
    }, { passive: true })

    window.addEventListener("keyup", Event => {
      if (!this.IsMovementKey(Event.code)) return
      this.Keys.delete(Event.code)
    }, { passive: true })

    window.addEventListener("blur", () => {
      this.Keys.clear()
      this.MouseDeltaX = 0
      this.MouseDeltaY = 0
    })

    document.addEventListener("pointerlockchange", () => {
      this.Locked = document.pointerLockElement === this.DomElement
      this.MouseDeltaX = 0
      this.MouseDeltaY = 0
      window.dispatchEvent(new CustomEvent("gamepointerlock", { detail: this.Locked }))
    })

    const CaptureLook = Event => {
      if (!this.Locked) return
      const MovementX = Number.isFinite(Event.movementX) ? Event.movementX : 0
      const MovementY = Number.isFinite(Event.movementY) ? Event.movementY : 0
      this.MouseDeltaX += MovementX
      this.MouseDeltaY += MovementY
    }

    document.addEventListener("pointerrawupdate", CaptureLook, { capture: true, passive: true })
    document.addEventListener("mousemove", CaptureLook, { capture: true, passive: true })
  }

  IsMovementKey(Code) {
    return Code === "KeyW" ||
      Code === "KeyA" ||
      Code === "KeyS" ||
      Code === "KeyD" ||
      Code === "ShiftLeft" ||
      Code === "ShiftRight"
  }

  Lock() {
    if (document.pointerLockElement === this.DomElement) return

    try {
      const Result = this.DomElement.requestPointerLock({ unadjustedMovement: true })
      if (Result && typeof Result.catch === "function") {
        Result.catch(() => {
          try {
            const Fallback = this.DomElement.requestPointerLock()
            if (Fallback && typeof Fallback.catch === "function") Fallback.catch(() => {})
          } catch {}
        })
      }
    } catch {
      try {
        const Fallback = this.DomElement.requestPointerLock()
        if (Fallback && typeof Fallback.catch === "function") Fallback.catch(() => {})
      } catch {}
    }
  }

  SetPosition(Position) {
    this.Position.copy(Position)
    this.Position.y = 1.65
    this.Camera.position.copy(this.Position)
  }

  UpdateLook(Delta) {
    if (this.Locked) {
      this.TargetYaw -= this.MouseDeltaX * 0.00175
      this.TargetPitch -= this.MouseDeltaY * 0.00165
      this.TargetPitch = Math.max(-1.45, Math.min(1.45, this.TargetPitch))
    }

    this.MouseDeltaX = 0
    this.MouseDeltaY = 0

    const LookBlend = 1 - Math.exp(-Delta * 28)
    this.Yaw += (this.TargetYaw - this.Yaw) * LookBlend
    this.Pitch += (this.TargetPitch - this.Pitch) * LookBlend
  }

  UpdateMovement(Delta) {
    const ForwardInput = (this.Keys.has("KeyW") ? 1 : 0) - (this.Keys.has("KeyS") ? 1 : 0)
    const SideInput = (this.Keys.has("KeyD") ? 1 : 0) - (this.Keys.has("KeyA") ? 1 : 0)
    const Moving = ForwardInput !== 0 || SideInput !== 0
    const WantsSprint = (this.Keys.has("ShiftLeft") || this.Keys.has("ShiftRight")) &&
      ForwardInput > 0 &&
      this.Stamina > 0.03
    const Speed = WantsSprint ? this.SprintSpeed : this.WalkSpeed

    if (WantsSprint && Moving) this.Stamina = Math.max(0, this.Stamina - Delta * 0.18)
    else this.Stamina = Math.min(1, this.Stamina + Delta * 0.13)

    this.Forward.set(-Math.sin(this.Yaw), 0, -Math.cos(this.Yaw))
    this.Right.set(Math.cos(this.Yaw), 0, -Math.sin(this.Yaw))
    this.Move.set(0, 0, 0)
    this.Move.addScaledVector(this.Forward, ForwardInput)
    this.Move.addScaledVector(this.Right, SideInput)

    if (this.Move.lengthSq() > 0) {
      this.Move.normalize().multiplyScalar(Speed * Delta)
      this.TryMove(this.Move.x, 0)
      this.TryMove(0, this.Move.z)
    }

    const MotionBlend = 1 - Math.exp(-Delta * 14)
    if (Moving) this.BobTime += Delta * (WantsSprint ? 10.8 : 7.8)

    const TargetBob = Moving ? Math.sin(this.BobTime * 2) * (WantsSprint ? 0.026 : 0.018) : 0
    const TargetRoll = Moving ? -SideInput * 0.012 + Math.sin(this.BobTime) * 0.004 : 0
    this.Bob += (TargetBob - this.Bob) * MotionBlend
    this.Roll += (TargetRoll - this.Roll) * MotionBlend

    const TargetFov = WantsSprint && Moving ? 76 : 73
    const NewFov = this.Camera.fov + (TargetFov - this.Camera.fov) * (1 - Math.exp(-Delta * 8))

    if (Math.abs(NewFov - this.Camera.fov) > 0.002) {
      this.Camera.fov = NewFov
      this.Camera.updateProjectionMatrix()
    }
  }

  UpdateCameraTransform() {
    this.Camera.position.set(this.Position.x, this.Position.y + this.Bob, this.Position.z)
    this.Camera.rotation.order = "YXZ"
    this.Camera.rotation.y = this.Yaw
    this.Camera.rotation.x = this.Pitch
    this.Camera.rotation.z = this.Roll
  }

  Update(Delta) {
    this.UpdateLook(Delta)
    this.UpdateMovement(Delta)
    this.UpdateCameraTransform()
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
      const DeltaX = X - ClosestX
      const DeltaZ = Z - ClosestZ

      if (DeltaX * DeltaX + DeltaZ * DeltaZ < this.Radius * this.Radius) return true
    }

    return false
  }
}
