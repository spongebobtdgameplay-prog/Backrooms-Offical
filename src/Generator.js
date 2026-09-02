import * as THREE from "three"

export class BackroomsGenerator {
  constructor(Scene, Seed = Date.now()) {
    this.Scene = Scene
    this.Seed = Seed >>> 0
    this.Columns = 15
    this.Rows = 15
    this.CellSize = 6
    this.WallThickness = 0.24
    this.WallHeight = 3.2
    this.Colliders = []
    this.OpenCells = []
    this.Cells = []
    this.Group = new THREE.Group()
    this.Scene.add(this.Group)
    this.RandomState = this.Seed || 1
  }

  Random() {
    this.RandomState = (1664525 * this.RandomState + 1013904223) >>> 0
    return this.RandomState / 4294967296
  }

  Build() {
    this.CreateMaze()
    this.BuildEnvironment()
    return {
      Colliders: this.Colliders,
      OpenCells: this.OpenCells,
      CellSize: this.CellSize,
      Rows: this.Rows,
      Columns: this.Columns
    }
  }

  CreateMaze() {
    this.Cells = Array.from({ length: this.Rows }, (_, Z) =>
      Array.from({ length: this.Columns }, (_, X) => ({
        X,
        Z,
        Visited: false,
        Walls: { N: true, E: true, S: true, W: true }
      }))
    )

    const Stack = []
    let Current = this.Cells[0][0]
    Current.Visited = true
    let VisitedCount = 1
    const Total = this.Rows * this.Columns

    while (VisitedCount < Total) {
      const Neighbors = []
      const X = Current.X
      const Z = Current.Z

      if (Z > 0 && !this.Cells[Z - 1][X].Visited) Neighbors.push(["N", this.Cells[Z - 1][X]])
      if (X < this.Columns - 1 && !this.Cells[Z][X + 1].Visited) Neighbors.push(["E", this.Cells[Z][X + 1]])
      if (Z < this.Rows - 1 && !this.Cells[Z + 1][X].Visited) Neighbors.push(["S", this.Cells[Z + 1][X]])
      if (X > 0 && !this.Cells[Z][X - 1].Visited) Neighbors.push(["W", this.Cells[Z][X - 1]])

      if (Neighbors.length > 0) {
        const [Direction, Next] = Neighbors[Math.floor(this.Random() * Neighbors.length)]
        this.RemoveWall(Current, Next, Direction)
        Stack.push(Current)
        Current = Next
        Current.Visited = true
        VisitedCount += 1
      } else {
        Current = Stack.pop()
      }
    }

    for (let I = 0; I < 46; I += 1) {
      const X = 1 + Math.floor(this.Random() * (this.Columns - 2))
      const Z = 1 + Math.floor(this.Random() * (this.Rows - 2))
      const Cell = this.Cells[Z][X]
      const Directions = ["N", "E", "S", "W"]
      const Direction = Directions[Math.floor(this.Random() * Directions.length)]
      if (Direction === "N") this.RemoveWall(Cell, this.Cells[Z - 1][X], "N")
      if (Direction === "E") this.RemoveWall(Cell, this.Cells[Z][X + 1], "E")
      if (Direction === "S") this.RemoveWall(Cell, this.Cells[Z + 1][X], "S")
      if (Direction === "W") this.RemoveWall(Cell, this.Cells[Z][X - 1], "W")
    }
  }

  RemoveWall(Current, Next, Direction) {
    if (!Next) return
    if (Direction === "N") {
      Current.Walls.N = false
      Next.Walls.S = false
    }
    if (Direction === "E") {
      Current.Walls.E = false
      Next.Walls.W = false
    }
    if (Direction === "S") {
      Current.Walls.S = false
      Next.Walls.N = false
    }
    if (Direction === "W") {
      Current.Walls.W = false
      Next.Walls.E = false
    }
  }

  BuildEnvironment() {
    const Width = this.Columns * this.CellSize
    const Depth = this.Rows * this.CellSize
    const FloorMaterial = new THREE.MeshStandardMaterial({ color: 0x665f39, roughness: 1 })
    const CeilingMaterial = new THREE.MeshStandardMaterial({ color: 0xb0a968, roughness: 0.95 })
    const WallMaterial = new THREE.MeshStandardMaterial({ color: 0xafa55d, roughness: 0.92 })

    const Floor = new THREE.Mesh(new THREE.PlaneGeometry(Width, Depth), FloorMaterial)
    Floor.rotation.x = -Math.PI / 2
    Floor.position.set(Width / 2 - this.CellSize / 2, 0, Depth / 2 - this.CellSize / 2)
    Floor.receiveShadow = true
    this.Group.add(Floor)

    const Ceiling = new THREE.Mesh(new THREE.PlaneGeometry(Width, Depth), CeilingMaterial)
    Ceiling.rotation.x = Math.PI / 2
    Ceiling.position.set(Width / 2 - this.CellSize / 2, this.WallHeight, Depth / 2 - this.CellSize / 2)
    this.Group.add(Ceiling)

    for (let Z = 0; Z < this.Rows; Z += 1) {
      for (let X = 0; X < this.Columns; X += 1) {
        const Cell = this.Cells[Z][X]
        const CenterX = X * this.CellSize
        const CenterZ = Z * this.CellSize
        this.OpenCells.push(new THREE.Vector3(CenterX, 0, CenterZ))

        if (Cell.Walls.N) this.CreateWall(CenterX, CenterZ - this.CellSize / 2, this.CellSize + this.WallThickness, this.WallThickness, WallMaterial)
        if (Cell.Walls.W) this.CreateWall(CenterX - this.CellSize / 2, CenterZ, this.WallThickness, this.CellSize + this.WallThickness, WallMaterial)
        if (Z === this.Rows - 1 && Cell.Walls.S) this.CreateWall(CenterX, CenterZ + this.CellSize / 2, this.CellSize + this.WallThickness, this.WallThickness, WallMaterial)
        if (X === this.Columns - 1 && Cell.Walls.E) this.CreateWall(CenterX + this.CellSize / 2, CenterZ, this.WallThickness, this.CellSize + this.WallThickness, WallMaterial)

        if ((X + Z) % 2 === 0 && this.Random() > 0.18) this.CreateLight(CenterX, CenterZ)
      }
    }
  }

  CreateWall(X, Z, SizeX, SizeZ, Material) {
    const Mesh = new THREE.Mesh(new THREE.BoxGeometry(SizeX, this.WallHeight, SizeZ), Material)
    Mesh.position.set(X, this.WallHeight / 2, Z)
    Mesh.castShadow = true
    Mesh.receiveShadow = true
    this.Group.add(Mesh)
    this.Colliders.push({
      MinX: X - SizeX / 2,
      MaxX: X + SizeX / 2,
      MinZ: Z - SizeZ / 2,
      MaxZ: Z + SizeZ / 2
    })
  }

  CreateLight(X, Z) {
    const Fixture = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.05, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfff6b0 })
    )
    Fixture.position.set(X, this.WallHeight - 0.06, Z)
    this.Group.add(Fixture)

    const Light = new THREE.PointLight(0xffef9a, 5.2, 12, 2.1)
    Light.position.set(X, this.WallHeight - 0.2, Z)
    this.Group.add(Light)

    Light.userData.BaseIntensity = Light.intensity
    Light.userData.FlickerOffset = this.Random() * 100
  }

  UpdateLights(Time) {
    for (const Child of this.Group.children) {
      if (!Child.isPointLight) continue
      const Pulse = Math.sin(Time * 2.4 + Child.userData.FlickerOffset)
      const Glitch = Math.sin(Time * 31 + Child.userData.FlickerOffset * 3)
      Child.intensity = Child.userData.BaseIntensity * (0.92 + Pulse * 0.035 + Math.max(0, Glitch - 0.95) * 0.9)
    }
  }
}
