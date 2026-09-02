import * as THREE from "three"
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js"

const CacheToken = new URL(import.meta.url).searchParams.get("cb") || Date.now().toString(36)
const { default: CollisionUtility } = await import(`./CollisionUtility.js?cb=${CacheToken}`)

export class Entity {
  constructor(Scene, StartPosition, World, Options = {}) {
    this.Scene = Scene
    this.World = World
    this.Options = Options
    this.Position = StartPosition.clone()
    this.Position.y = 0
    this.Speed = 2.35
    this.Radius = 0.43
    this.Active = false
    this.RepathTimer = 0
    this.RepathInterval = 0.34
    this.TargetCellKey = ""
    this.Path = []
    this.PathIndex = 0
    this.Direction = new THREE.Vector3()
    this.DesiredMove = new THREE.Vector3()
    this.LookTarget = new THREE.Vector3()
    this.PushResult = new THREE.Vector3()
    this.CollisionProbe = new THREE.Vector3()
    this.Root = new THREE.Group()
    this.Root.name = "Level0Shapeshifter"
    this.Root.position.copy(this.Position)
    this.Root.visible = false
    this.Scene.add(this.Root)
    this.Loader = new GLTFLoader()
    this.Forms = new Map()
    this.CurrentForm = "ghost"
    this.PreviousForm = ""
    this.ShiftProgress = 1
    this.ShiftDuration = 0.42
    this.ShiftTimer = 6 + Math.random() * 4
    this.ModelReady = false
    this.LoadModels()
  }

  async LoadModels() {
    const Definitions = [
      ["ghost", "../assets/models/entity-ghost.glb"],
      ["demon", "../assets/models/entity-demon.glb"]
    ]

    const Results = await Promise.allSettled(
      Definitions.map(async ([Name, Path]) => {
        const Url = new URL(Path, import.meta.url)
        Url.searchParams.set("cb", CacheToken)
        const Gltf = await this.Loader.loadAsync(Url.href)
        return [Name, this.PrepareForm(Name, Gltf)]
      })
    )

    for (const Result of Results) {
      if (Result.status !== "fulfilled") continue
      const [Name, Form] = Result.value
      this.Forms.set(Name, Form)
    }

    this.ModelReady = this.Forms.size > 0
    if (!this.ModelReady) {
      this.CreateFallbackForm()
      this.ModelReady = true
    }

    if (!this.Forms.has(this.CurrentForm)) this.CurrentForm = this.Forms.keys().next().value
    this.ApplyFormVisibility()
  }

  PrepareForm(Name, Gltf) {
    const Container = new THREE.Group()
    Container.name = `EntityForm_${Name}`
    const Model = Gltf.scene
    Model.updateMatrixWorld(true)

    const InitialBounds = new THREE.Box3().setFromObject(Model)
    const InitialSize = InitialBounds.getSize(new THREE.Vector3())
    const TargetHeight = Name === "demon" ? 2.35 : 2.18
    const Scale = TargetHeight / Math.max(InitialSize.y, 0.001)
    Model.scale.setScalar(Scale)
    Model.updateMatrixWorld(true)

    let Bounds = new THREE.Box3().setFromObject(Model)
    const Center = Bounds.getCenter(new THREE.Vector3())
    Model.position.x -= Center.x
    Model.position.z -= Center.z
    Model.updateMatrixWorld(true)
    Bounds = new THREE.Box3().setFromObject(Model)
    Model.position.y -= Bounds.min.y
    Model.updateMatrixWorld(true)

    Model.traverse(Object => {
      if (!Object.isMesh) return
      Object.castShadow = true
      Object.receiveShadow = true
      Object.frustumCulled = true
      const Materials = Array.isArray(Object.material) ? Object.material : [Object.material]
      for (const Material of Materials) {
        if (!Material) continue
        Material.side = THREE.FrontSide
        if ("roughness" in Material) Material.roughness = Math.max(Material.roughness ?? 0.65, 0.7)
        if ("metalness" in Material) Material.metalness = Math.min(Material.metalness ?? 0, 0.08)
        Material.needsUpdate = true
      }
    })

    Container.add(Model)
    Container.visible = false
    this.Root.add(Container)

    const Mixer = new THREE.AnimationMixer(Model)
    const Action = this.SelectMovementAction(Mixer, Gltf.animations || [])
    if (Action) Action.play()

    return {
      Name,
      Container,
      Model,
      Mixer,
      Action,
      BaseScale: new THREE.Vector3(1, 1, 1)
    }
  }

  SelectMovementAction(Mixer, Clips) {
    if (!Clips.length) return null
    const Preferred = [/run/i, /walk/i, /move/i, /idle/i]
    let Clip = null

    for (const Pattern of Preferred) {
      Clip = Clips.find(Item => Pattern.test(Item.name))
      if (Clip) break
    }

    if (!Clip) Clip = Clips[0]

    const Action = Mixer.clipAction(Clip)
    Action.enabled = true
    Action.setLoop(THREE.LoopRepeat, Infinity)
    Action.timeScale = 1.12
    return Action
  }

  CreateFallbackForm() {
    const Container = new THREE.Group()
    const Material = new THREE.MeshStandardMaterial({
      color: 0x19170f,
      roughness: 0.92,
      emissive: 0x090806,
      emissiveIntensity: 0.16
    })
    const Body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.45, 5, 10), Material)
    Body.position.y = 1.05
    Body.castShadow = true
    Body.receiveShadow = true
    Container.add(Body)
    Container.visible = false
    this.Root.add(Container)

    this.Forms.set("ghost", {
      Name: "ghost",
      Container,
      Model: Body,
      Mixer: null,
      Action: null,
      BaseScale: new THREE.Vector3(1, 1, 1)
    })
  }

  ApplyFormVisibility() {
    for (const [Name, Form] of this.Forms) {
      Form.Container.visible = this.Active && (Name === this.CurrentForm || Name === this.PreviousForm)
    }
  }

  Release() {
    this.Active = true
    this.Root.visible = true
    this.ApplyFormVisibility()
    this.RepathTimer = 0
  }

  GetDistance(PlayerPosition) {
    const DeltaX = PlayerPosition.x - this.Position.x
    const DeltaZ = PlayerPosition.z - this.Position.z
    return Math.hypot(DeltaX, DeltaZ)
  }

  GetCell(Position) {
    const X = THREE.MathUtils.clamp(Math.round(Position.x / this.World.CellSize), 0, this.World.Columns - 1)
    const Z = THREE.MathUtils.clamp(Math.round(Position.z / this.World.CellSize), 0, this.World.Rows - 1)
    return this.World.Cells[Z][X]
  }

  CellKey(Cell) {
    return `${Cell.X},${Cell.Z}`
  }

  GetNeighbors(Cell) {
    const Neighbors = []
    const X = Cell.X
    const Z = Cell.Z

    if (!Cell.Walls.N && Z > 0) Neighbors.push(this.World.Cells[Z - 1][X])
    if (!Cell.Walls.E && X < this.World.Columns - 1) Neighbors.push(this.World.Cells[Z][X + 1])
    if (!Cell.Walls.S && Z < this.World.Rows - 1) Neighbors.push(this.World.Cells[Z + 1][X])
    if (!Cell.Walls.W && X > 0) Neighbors.push(this.World.Cells[Z][X - 1])

    return Neighbors
  }

  BuildPath(TargetPosition) {
    const Start = this.GetCell(this.Position)
    const Goal = this.GetCell(TargetPosition)
    const GoalKey = this.CellKey(Goal)
    this.TargetCellKey = GoalKey

    if (Start === Goal) {
      this.Path = [new THREE.Vector3(TargetPosition.x, 0, TargetPosition.z)]
      this.PathIndex = 0
      return
    }

    const Open = [Start]
    const OpenKeys = new Set([this.CellKey(Start)])
    const CameFrom = new Map()
    const GScore = new Map([[this.CellKey(Start), 0]])
    const FScore = new Map([[this.CellKey(Start), this.Heuristic(Start, Goal)]])

    while (Open.length > 0) {
      let BestIndex = 0
      let BestScore = FScore.get(this.CellKey(Open[0])) ?? Infinity

      for (let I = 1; I < Open.length; I += 1) {
        const Score = FScore.get(this.CellKey(Open[I])) ?? Infinity
        if (Score < BestScore) {
          BestScore = Score
          BestIndex = I
        }
      }

      const Current = Open.splice(BestIndex, 1)[0]
      const CurrentKey = this.CellKey(Current)
      OpenKeys.delete(CurrentKey)

      if (Current === Goal) {
        this.Path = this.ReconstructPath(CameFrom, Current)
        this.Path.push(new THREE.Vector3(TargetPosition.x, 0, TargetPosition.z))
        this.PathIndex = 0
        return
      }

      for (const Neighbor of this.GetNeighbors(Current)) {
        const NeighborKey = this.CellKey(Neighbor)
        const Tentative = (GScore.get(CurrentKey) ?? Infinity) + 1
        if (Tentative >= (GScore.get(NeighborKey) ?? Infinity)) continue

        CameFrom.set(NeighborKey, Current)
        GScore.set(NeighborKey, Tentative)
        FScore.set(NeighborKey, Tentative + this.Heuristic(Neighbor, Goal))

        if (!OpenKeys.has(NeighborKey)) {
          Open.push(Neighbor)
          OpenKeys.add(NeighborKey)
        }
      }
    }

    this.Path = []
    this.PathIndex = 0
  }

  Heuristic(Cell, Goal) {
    return Math.abs(Cell.X - Goal.X) + Math.abs(Cell.Z - Goal.Z)
  }

  ReconstructPath(CameFrom, Current) {
    const Cells = [Current]
    let CurrentKey = this.CellKey(Current)

    while (CameFrom.has(CurrentKey)) {
      Current = CameFrom.get(CurrentKey)
      Cells.push(Current)
      CurrentKey = this.CellKey(Current)
    }

    Cells.reverse()
    if (Cells.length > 1) Cells.shift()

    return Cells.map(Cell => new THREE.Vector3(
      Cell.X * this.World.CellSize,
      0,
      Cell.Z * this.World.CellSize
    ))
  }

  UpdatePath(Delta, PlayerPosition) {
    this.RepathTimer -= Delta
    const PlayerCell = this.GetCell(PlayerPosition)
    const PlayerCellKey = this.CellKey(PlayerCell)

    if (this.RepathTimer <= 0 || PlayerCellKey !== this.TargetCellKey || this.PathIndex >= this.Path.length) {
      this.RepathTimer = this.RepathInterval
      this.BuildPath(PlayerPosition)
    }
  }

  MoveAlongPath(Delta) {
    if (this.PathIndex >= this.Path.length) return

    let Target = this.Path[this.PathIndex]
    let DistanceToTarget = this.Position.distanceTo(Target)

    while (DistanceToTarget < 0.42 && this.PathIndex < this.Path.length - 1) {
      this.PathIndex += 1
      Target = this.Path[this.PathIndex]
      DistanceToTarget = this.Position.distanceTo(Target)
    }

    this.Direction.subVectors(Target, this.Position)
    this.Direction.y = 0
    const DirectionLength = this.Direction.length()
    if (DirectionLength <= 0.001) return

    this.Direction.divideScalar(DirectionLength)
    const Step = Math.min(this.Speed * Delta, DirectionLength)
    this.DesiredMove.copy(this.Direction).multiplyScalar(Step)

    const Resolved = CollisionUtility.ResolveHorizontalMove(
      this.Position,
      this.DesiredMove,
      this.Radius,
      this.World.Colliders,
      {
        AllowSlide: true,
        MaxIterations: 4,
        Skin: 0.012,
        MaxSweepSteps: 28,
        BinarySteps: 10,
        SlideIntentThreshold: 0.06
      }
    )

    this.Position.copy(Resolved.Position)
    this.Position.y = 0

    this.CollisionProbe.copy(this.Position)
    this.CollisionProbe.y = 1.08

    const Push = CollisionUtility.PushPointOutOfWorld(
      this.CollisionProbe,
      this.Radius,
      this.World.Colliders,
      this.PushResult,
      { Skin: 0.012 }
    )

    if (Push.Hit) {
      this.Position.x = Push.Point.x
      this.Position.z = Push.Point.z
      this.Position.y = 0
    }

    this.Root.position.copy(this.Position)

    this.LookTarget.copy(this.Position).add(this.Direction)
    this.Root.lookAt(this.LookTarget.x, this.Root.position.y, this.LookTarget.z)

    if (Resolved.Hit && Resolved.Resolved.lengthSq() < this.DesiredMove.lengthSq() * 0.08) {
      this.RepathTimer = 0
    }
  }

  UpdateShapeshift(Delta, Distance) {
    this.ShiftTimer -= Delta

    let DesiredForm = this.CurrentForm
    if (Distance < 10.5 && this.Forms.has("demon")) DesiredForm = "demon"
    else if (Distance > 15.5 && this.Forms.has("ghost")) DesiredForm = "ghost"
    else if (this.ShiftTimer <= 0) {
      if (this.CurrentForm === "ghost" && this.Forms.has("demon")) DesiredForm = "demon"
      else if (this.CurrentForm === "demon" && this.Forms.has("ghost")) DesiredForm = "ghost"
    }

    if (DesiredForm !== this.CurrentForm && this.ShiftProgress >= 1) {
      this.PreviousForm = this.CurrentForm
      this.CurrentForm = DesiredForm
      this.ShiftProgress = 0
      this.ShiftTimer = 6 + Math.random() * 5
      this.ApplyFormVisibility()
      this.Options.OnShift?.(DesiredForm)
    }

    if (this.ShiftProgress < 1) {
      this.ShiftProgress = Math.min(1, this.ShiftProgress + Delta / this.ShiftDuration)
      const Ease = this.ShiftProgress * this.ShiftProgress * (3 - 2 * this.ShiftProgress)
      const Previous = this.Forms.get(this.PreviousForm)
      const Current = this.Forms.get(this.CurrentForm)

      if (Previous) {
        const PreviousScale = Math.max(0.02, 1 - Ease)
        Previous.Container.scale.set(1 + Ease * 0.22, PreviousScale, 1 + Ease * 0.22)
      }

      if (Current) {
        const CurrentScale = 0.48 + Ease * 0.52
        Current.Container.scale.set(0.76 + Ease * 0.24, CurrentScale, 0.76 + Ease * 0.24)
      }

      if (this.ShiftProgress >= 1) {
        if (Previous) {
          Previous.Container.visible = false
          Previous.Container.scale.copy(Previous.BaseScale)
        }

        if (Current) {
          Current.Container.visible = this.Active
          Current.Container.scale.copy(Current.BaseScale)
        }

        this.PreviousForm = ""
      }
    }
  }

  UpdateAnimations(Delta) {
    for (const Form of this.Forms.values()) {
      if (!Form.Container.visible || !Form.Mixer) continue
      Form.Mixer.update(Delta)
    }
  }

  Update(Delta, PlayerPosition) {
    if (!this.Active) return false

    const Distance = this.GetDistance(PlayerPosition)
    this.UpdatePath(Delta, PlayerPosition)
    this.MoveAlongPath(Delta)
    this.UpdateShapeshift(Delta, Distance)
    this.UpdateAnimations(Delta)

    return this.GetDistance(PlayerPosition) < 0.9
  }
}
