import * as THREE from "three"

export class Entity {
  constructor(Scene, StartPosition) {
    this.Scene = Scene
    this.Position = StartPosition.clone()
    this.Active = false
    this.Speed = 2.15
    this.RepathTimer = 0
    this.TargetPoint = StartPosition.clone()
    this.Direction = new THREE.Vector3()
    this.Mesh = this.CreateMesh()
    this.Mesh.position.copy(this.Position)
    this.Scene.add(this.Mesh)
  }

  CreateMesh() {
    const Group = new THREE.Group()
    const Material = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 1 })
    const Head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), Material)
    const Body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.35, 4, 10), Material)
    Head.position.y = 2.15
    Body.position.y = 1.1
    Group.add(Head, Body)

    const EyeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9c955 })
    const EyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), EyeMaterial)
    const EyeRight = EyeLeft.clone()
    EyeLeft.position.set(-0.1, 2.18, -0.29)
    EyeRight.position.set(0.1, 2.18, -0.29)
    Group.add(EyeLeft, EyeRight)

    Group.visible = false
    return Group
  }

  Release() {
    this.Active = true
    this.Mesh.visible = true
  }

  Update(Delta, PlayerPosition) {
    if (!this.Active) return false

    this.Direction.subVectors(PlayerPosition, this.Position)
    this.Direction.y = 0
    const Distance = this.Direction.length()

    if (Distance > 0.001) {
      this.Direction.normalize()
      this.Position.addScaledVector(this.Direction, this.Speed * Delta)
    }

    this.Mesh.position.copy(this.Position)
    this.Mesh.lookAt(PlayerPosition.x, this.Mesh.position.y + 1.1, PlayerPosition.z)

    return Distance < 0.85
  }
}
