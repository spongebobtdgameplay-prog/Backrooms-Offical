import * as THREE from "three"

export class BackroomsGenerator {
  constructor(Scene, Seed = Date.now()) {
    this.Scene = Scene
    this.Seed = Seed >>> 0
    this.Columns = 15
    this.Rows = 15
    this.CellSize = 6
    this.WallThickness = 0.24
    this.WallHeight = 3.18
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

    for (let I = 0; I < 68; I += 1) {
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

    const FloorMaterial = new THREE.MeshLambertMaterial({
      color: 0xb3a46f,
      map: this.CreateCarpetTexture()
    })

    const CeilingMaterial = new THREE.MeshLambertMaterial({
      color: 0xd5cb8c,
      map: this.CreateCeilingTexture()
    })

    const WallMaterial = new THREE.MeshLambertMaterial({
      color: 0xe0d36f,
      map: this.CreateWallpaperTexture()
    })

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

        if (this.Random() > 0.46) {
          const OffsetX = (this.Random() - 0.5) * 2.15
          const OffsetZ = (this.Random() - 0.5) * 2.15
          this.LightPositions.push(new THREE.Vector3(CenterX + OffsetX, this.WallHeight - 0.2, CenterZ + OffsetZ))
        }
      }
    }

    this.CreateWallInstances(HorizontalWalls, VerticalWalls, WallMaterial)
    this.CreateTrimInstances(HorizontalWalls, VerticalWalls)
    this.CreateColumnInstances(WallMaterial)
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

  CreateTrimInstances(HorizontalWalls, VerticalWalls) {
    const Material = new THREE.MeshLambertMaterial({ color: 0xd7c783 })
    const Dummy = new THREE.Object3D()

    const HorizontalGeometry = new THREE.BoxGeometry(this.CellSize + this.WallThickness + 0.04, 0.13, this.WallThickness + 0.035)
    const VerticalGeometry = new THREE.BoxGeometry(this.WallThickness + 0.035, 0.13, this.CellSize + this.WallThickness + 0.04)

    const HorizontalBaseboards = new THREE.InstancedMesh(HorizontalGeometry, Material, HorizontalWalls.length)
    for (let I = 0; I < HorizontalWalls.length; I += 1) {
      Dummy.position.set(HorizontalWalls[I].X, 0.065, HorizontalWalls[I].Z)
      Dummy.updateMatrix()
      HorizontalBaseboards.setMatrixAt(I, Dummy.matrix)
    }
    HorizontalBaseboards.instanceMatrix.needsUpdate = true
    HorizontalBaseboards.computeBoundingSphere()
    this.Group.add(HorizontalBaseboards)

    const VerticalBaseboards = new THREE.InstancedMesh(VerticalGeometry, Material, VerticalWalls.length)
    for (let I = 0; I < VerticalWalls.length; I += 1) {
      Dummy.position.set(VerticalWalls[I].X, 0.065, VerticalWalls[I].Z)
      Dummy.updateMatrix()
      VerticalBaseboards.setMatrixAt(I, Dummy.matrix)
    }
    VerticalBaseboards.instanceMatrix.needsUpdate = true
    VerticalBaseboards.computeBoundingSphere()
    this.Group.add(VerticalBaseboards)
  }

  CreateColumnInstances(Material) {
    const Positions = []

    for (let Z = 1; Z < this.Rows - 1; Z += 1) {
      for (let X = 1; X < this.Columns - 1; X += 1) {
        if (this.Random() > 0.075) continue

        const CenterX = X * this.CellSize + (this.Random() > 0.5 ? 1.7 : -1.7)
        const CenterZ = Z * this.CellSize + (this.Random() > 0.5 ? 1.7 : -1.7)
        Positions.push({ X: CenterX, Z: CenterZ })

        this.Colliders.push({
          MinX: CenterX - 0.26,
          MaxX: CenterX + 0.26,
          MinZ: CenterZ - 0.26,
          MaxZ: CenterZ + 0.26
        })
      }
    }

    if (Positions.length === 0) return

    const Geometry = new THREE.BoxGeometry(0.52, this.WallHeight, 0.52)
    const Columns = new THREE.InstancedMesh(Geometry, Material, Positions.length)
    const Dummy = new THREE.Object3D()

    for (let I = 0; I < Positions.length; I += 1) {
      Dummy.position.set(Positions[I].X, this.WallHeight / 2, Positions[I].Z)
      Dummy.updateMatrix()
      Columns.setMatrixAt(I, Dummy.matrix)
    }

    Columns.instanceMatrix.needsUpdate = true
    Columns.computeBoundingSphere()
    this.Group.add(Columns)
  }

  CreateFixtureInstances() {
    const FrameGeometry = new THREE.BoxGeometry(1.95, 0.045, 0.74)
    const PanelGeometry = new THREE.BoxGeometry(1.72, 0.025, 0.54)
    const FrameMaterial = new THREE.MeshLambertMaterial({ color: 0xa89f69 })
    const PanelMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4b5 })
    const Frames = new THREE.InstancedMesh(FrameGeometry, FrameMaterial, this.LightPositions.length)
    const Panels = new THREE.InstancedMesh(PanelGeometry, PanelMaterial, this.LightPositions.length)
    const Dummy = new THREE.Object3D()

    for (let I = 0; I < this.LightPositions.length; I += 1) {
      Dummy.position.set(this.LightPositions[I].x, this.WallHeight - 0.055, this.LightPositions[I].z)
      Dummy.updateMatrix()
      Frames.setMatrixAt(I, Dummy.matrix)

      Dummy.position.y = this.WallHeight - 0.082
      Dummy.updateMatrix()
      Panels.setMatrixAt(I, Dummy.matrix)
    }

    Frames.instanceMatrix.needsUpdate = true
    Panels.instanceMatrix.needsUpdate = true
    Frames.computeBoundingSphere()
    Panels.computeBoundingSphere()
    this.Group.add(Frames, Panels)
  }

  CreateLightPool() {
    const LightCount = 4

    for (let I = 0; I < LightCount; I += 1) {
      const Light = new THREE.PointLight(0xffe98f, 0, 12.5, 1.85)
      Light.userData.BaseIntensity = 4.6
      Light.userData.FlickerOffset = this.Random() * 100
      Light.visible = false
      this.Group.add(Light)
      this.ActiveLights.push(Light)
    }
  }

  UpdateLights(Time, ViewerPosition) {
    if (!ViewerPosition || this.LightPositions.length === 0) return

    if (this.LastLightAssignment < 0 || Time - this.LastLightAssignment >= 0.15) {
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
          Light.visible = BestDistance < 520
        } else {
          Light.visible = false
        }
      }
    }

    for (const Light of this.ActiveLights) {
      if (!Light.visible) continue

      const Pulse = Math.sin(Time * 2.35 + Light.userData.FlickerOffset)
      const Glitch = Math.sin(Time * 35 + Light.userData.FlickerOffset * 2.4)
      const Drop = Glitch < -0.985 ? 0.26 : 1
      Light.intensity = Light.userData.BaseIntensity * (0.95 + Pulse * 0.018) * Drop
    }
  }

  CreateWallpaperTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 192
    Canvas.height = 192
    const Context = Canvas.getContext("2d")

    Context.fillStyle = "#d4c660"
    Context.fillRect(0, 0, Canvas.width, Canvas.height)

    for (let X = 0; X < Canvas.width; X += 24) {
      Context.fillStyle = "rgba(93, 83, 35, 0.10)"
      Context.fillRect(X, 0, 2, Canvas.height)

      Context.fillStyle = "rgba(255, 247, 158, 0.10)"
      Context.fillRect(X + 11, 0, 5, Canvas.height)

      for (let Y = 8; Y < Canvas.height; Y += 32) {
        Context.strokeStyle = "rgba(91, 82, 34, 0.10)"
        Context.lineWidth = 1
        Context.beginPath()
        Context.moveTo(X + 7, Y)
        Context.lineTo(X + 12, Y + 7)
        Context.lineTo(X + 17, Y)
        Context.stroke()

        Context.fillStyle = "rgba(108, 96, 39, 0.08)"
        Context.fillRect(X + 11, Y + 8, 2, 8)
      }
    }

    for (let I = 0; I < 130; I += 1) {
      const Alpha = 0.025 + this.Random() * 0.045
      Context.fillStyle = `rgba(70, 62, 24, ${Alpha})`
      Context.fillRect(this.Random() * 192, this.Random() * 192, 1 + this.Random() * 3, 1 + this.Random() * 7)
    }

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(3.1, 1.35)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }

  CreateCarpetTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 160
    Canvas.height = 160
    const Context = Canvas.getContext("2d")

    Context.fillStyle = "#8f8258"
    Context.fillRect(0, 0, Canvas.width, Canvas.height)

    for (let Y = 0; Y < Canvas.height; Y += 4) {
      Context.fillStyle = Y % 8 === 0 ? "rgba(71, 61, 35, 0.10)" : "rgba(229, 211, 151, 0.055)"
      Context.fillRect(0, Y, Canvas.width, 1)
    }

    for (let I = 0; I < 420; I += 1) {
      const Value = 72 + Math.floor(this.Random() * 45)
      Context.fillStyle = `rgba(${Value}, ${Math.max(45, Value - 10)}, ${Math.max(28, Value - 32)}, 0.14)`
      Context.fillRect(this.Random() * 160, this.Random() * 160, 1, 1)
    }

    for (let I = 0; I < 18; I += 1) {
      const X = this.Random() * 160
      const Y = this.Random() * 160
      const Radius = 6 + this.Random() * 18
      const Gradient = Context.createRadialGradient(X, Y, 0, X, Y, Radius)
      Gradient.addColorStop(0, "rgba(57, 54, 35, 0.16)")
      Gradient.addColorStop(1, "rgba(57, 54, 35, 0)")
      Context.fillStyle = Gradient
      Context.fillRect(X - Radius, Y - Radius, Radius * 2, Radius * 2)
    }

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(this.Columns * 2.4, this.Rows * 2.4)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }

  CreateCeilingTexture() {
    const Canvas = document.createElement("canvas")
    Canvas.width = 128
    Canvas.height = 128
    const Context = Canvas.getContext("2d")

    Context.fillStyle = "#d8d09b"
    Context.fillRect(0, 0, 128, 128)

    Context.strokeStyle = "rgba(86, 79, 48, 0.26)"
    Context.lineWidth = 3
    Context.strokeRect(1.5, 1.5, 125, 125)

    for (let I = 0; I < 60; I += 1) {
      Context.fillStyle = `rgba(86, 79, 48, ${0.025 + this.Random() * 0.035})`
      Context.fillRect(this.Random() * 128, this.Random() * 128, 1.5, 1.5)
    }

    const Texture = new THREE.CanvasTexture(Canvas)
    Texture.wrapS = THREE.RepeatWrapping
    Texture.wrapT = THREE.RepeatWrapping
    Texture.repeat.set(this.Columns * 5, this.Rows * 5)
    Texture.colorSpace = THREE.SRGBColorSpace
    return Texture
  }
}
