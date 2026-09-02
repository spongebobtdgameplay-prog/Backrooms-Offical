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
    this.LightPositions = []
    this.ActiveLights = []
    this.LastLightAssignment = -1
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
    const FloorMaterial = new THREE.MeshLambertMaterial({ color: 0x665f39, map: this.CreateCarpetTexture() })
    const CeilingMaterial = new THREE.MeshLambertMaterial({ color: 0xb0a968, map: this.CreateCeilingTexture() })
    const WallMaterial = new THREE.MeshLambertMaterial({ color: 0xafa55d, map: this.CreateWallpaperTexture() })

    const Floor = new THREE.Mesh(new THREE.PlaneGeometry(Width, Depth), FloorMaterial)
    Floor.rotation.x = -Math.PI / 2
    Floor.position.set(Width / 2 - this.CellSize / 2, 0, Depth / 2 - this.CellSize / 2)
    this.Group.add(Floor)

    const Ceiling = new THREE.Mesh(new THREE.PlaneGeometry(Width, Depth), CeilingMaterial)
    Ceiling.rotation.x = Math.PI / 2
    Ceiling.position.set(Width / 2 - this.CellSize / 2, this.WallHeight, Depth / 2 - this.CellSize / 2)
    this.Group.add(Ceiling)

    const HorizontalWalls = []
    const VerticalWalls = []

    for (let Z = 0; Z < this.Rows; Z += 1) {
      for (let X = 0; X < this.Columns; X += 1) {
        const Cell = this.Cells[Z][X]
        const CenterX = X * this.CellSize
        const CenterZ = Z * this.CellSize
        this.OpenCells.push(new THREE.Vector3(CenterX, 0, CenterZ))

        if (Cell.Walls.N) this.QueueWall(HorizontalWalls, CenterX, CenterZ - this.CellSize / 2, this.CellSize + this.WallThickness, this.WallThickness)
        if (Cell.Walls.W) this.QueueWall(VerticalWalls, CenterX - this.CellSize / 2, CenterZ, this.WallThickness, this.CellSize + this.WallThickness)
        if (Z === this.Rows - 1 && Cell.Walls.S) this.QueueWall(HorizontalWalls, CenterX, CenterZ + this.CellSize / 2, this.CellSize + this.WallThickness, this.WallThickness)
        if (X === this.Columns - 1 && Cell.Walls.E) this.QueueWall(VerticalWalls, CenterX + this.CellSize / 2, CenterZ, this.WallThickness, this.CellSize + this.WallThickness)

        if ((X + Z) % 2 === 0 && this.Random() > 0.18) this.LightPositions.push(new THREE.Vector3(CenterX, this.WallHeight - 0.2, CenterZ))
      }
    }

    this.CreateWallInstances(HorizontalWalls, VerticalWalls, WallMaterial)
    this.CreateFixtureInstances()
    this.CreateLightPool()
  }

  QueueWall(Target, X, Z, SizeX, SizeZ) {
    Target.push({ X, Z })
    this.Colliders.push({
      MinX: X - SizeX / 2,
      MaxX: X + SizeX / 2,
      MinZ: Z - SizeZ / 2,
      MaxZ: Z + SizeZ / 2
    })
  }

  CreateWallInstances(HorizontalWalls, VerticalWalls, Material) {
    const HorizontalGeometry = new THREE.BoxGeometry(this.CellSize + this.WallThickness, this.WallHeight, this.WallThickness)
    const VerticalGeometry = new THREE.BoxGeometry(this.WallThickness, this.WallHeight, this.CellSize + this.WallThickness)
    const Dummy = new THREE.Object3D()

    const HorizontalMesh = new THREE.InstancedMesh(HorizontalGeometry, Material, HorizontalWalls.length)
    for (let I = 0; I < HorizontalWalls.length; I += 1) {
      Dummy.position.set(HorizontalWalls[I].X, this.WallHeight / 2, HorizontalWalls[I].Z)
      Dummy.updateMatrix()
      HorizontalMesh.setMatrixAt(I, Dummy.matrix)
    }
    HorizontalMesh.instanceMatrix.needsUpdate = true
    HorizontalMesh.computeBoundingSphere()
    this.Group.add(HorizontalMesh)

    const VerticalMesh = new THREE.InstancedMesh(VerticalGeometry, Material, VerticalWalls.length)
    for (let I = 0; I < VerticalWalls.length; I += 1) {
      Dummy.position.set(VerticalWalls[I].X, this.WallHeight / 2, VerticalWalls[I].Z)
      Dummy.updateMatrix()
      VerticalMesh.setMatrixAt(I, Dummy.matrix)
    }
    VerticalMesh.instanceMatrix.needsUpdate = true
    VerticalMesh.computeBoundingSphere()
    this.Group.add(VerticalMesh)
  }

  CreateFixtureInstances() {
    const Geometry = new THREE.BoxGeometry(2.7, 0.05, 0.34)
    const Material = new THREE.MeshBasicMaterial({ color: 0xfff4a8 })
    const Fixtures = new THREE.InstancedMesh(Geometry, Material, this.LightPositions.length)
    const Dummy = new THREE.Object3D()

    for (let I = 0; I < this.LightPositions.length; I += 1) {
      Dummy.position.set(this.LightPositions[I].x, this.WallHeight - 0.06, this.LightPositions[I].z)
      Dummy.updateMatrix()
      Fixtures.setMatrixAt(I, Dummy.matrix)
    }

    Fixtures.instanceMatrix.needsUpdate = true
    Fixtures.computeBoundingSphere()
    this.Group.add(Fixtures)
  }

  CreateLightPool() {
    const LightCount = 7
    for (let I = 0; I < LightCount; I += 1) {
      const Light = new THREE.PointLight(0xffec8c, 0, 11, 2)
      Light.userData.BaseIntensity = 3.6
      Light.userData.FlickerOffset = this.Random() * 100
      Light.visible = false
      this.Group.add(Light)
      this.ActiveLights.push(Light)
    }
  }

  UpdateLights(Time, ViewerPosition) {
    if (!ViewerPosition || this.LightPositions.length === 0) return

    if (this.LastLightAssignment < 0 || Time - this.LastLightAssignment >= 0.12) {
      this.LastLightAssignment = Time
      const Used = new Set()

      for (const Light of this.ActiveLights) {
        let BestIndex = -1
        let BestDistance = Infinity

        for (let I = 0; I < this.LightPositions.length; I += 1) {
          if (Used.has(I)) continue
          const Position = this.LightPositions[I]
          const DeltaX = Position.x - ViewerPosition.x
          const DeltaZ = Position.z - ViewerPosition.z
          const Distance = DeltaX * DeltaX + DeltaZ * DeltaZ
          if (Distance < BestDistance) {
            BestDistance = Distance
            BestIndex = I
          }
        }

        if (BestIndex >= 0) {
          Used.add(BestIndex)
          Light.position.copy(this.LightPositions[BestIndex])
          Light.visible = BestDistance < 420
        } else {
          Light.visible = false
        }
      }
    }

    for (const Light of this.ActiveLights) {
      if (!Light.visible) continue
      const Pulse = Math.sin(Time * 2.1 + Light.userData.FlickerOffset)
      const Glitch = Math.sin(Time * 28 + Light.userData.FlickerOffset * 2.7)
      Light.intensity = Light.userData.BaseIntensity * (0.92 + Pulse * 0.025 + Math.max(0, Glitch - 0.97) * 1.4)
    }
  }

  CreateWallpaperTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 128
    Canvas.height = 128
    const Context = Canvas.getContext("2d")
    Context.fillStyle = "#aaa15e"
    Context.fillRect(0, 0, 128, 128)

    for (let X = 0; X < 128; X += 16) {
      Context.fillStyle = X % 32 === 0 ? "rgba(97, 89, 42, 0.12)" : "rgba(255, 248, 176, 0.08)"
      Context.fillRect(X, 0, 7, 128)
    }

    for (let I = 0; I < 700; I += 1) {
      const Shade = Math.floor(this.Random() * 35)
      Context.fillStyle = `rgba(${80 + Shade}, ${74 + Shade}, ${36 + Shade}, 0.055)`
      Context.fillRect(this.Random() * 128, this.Random() * 128, 1, 1)
    }

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(2, 1)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }

  CreateCarpetTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 128
    Canvas.height = 128
    const Context = Canvas.getContext("2d")
    Context.fillStyle = "#5e5939"
    Context.fillRect(0, 0, 128, 128)

    for (let I = 0; I < 2600; I += 1) {
      const Value = Math.floor(68 + this.Random() * 52)
      Context.fillStyle = `rgba(${Value}, ${Value - 7}, ${Math.max(20, Value - 38)}, 0.22)`
      Context.fillRect(this.Random() * 128, this.Random() * 128, 1, 1)
    }

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(this.Columns * 1.5, this.Rows * 1.5)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }

  CreateCeilingTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 128
    Canvas.height = 128
    const Context = Canvas.getContext("2d")
    Context.fillStyle = "#aaa567"
    Context.fillRect(0, 0, 128, 128)
    Context.strokeStyle = "rgba(70, 67, 38, 0.24)"
    Context.lineWidth = 2
    Context.strokeRect(1, 1, 126, 126)

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(this.Columns, this.Rows)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }
}
