import * as THREE from "three"

const CacheToken = new URL(import.meta.url).searchParams.get("cb") || Date.now().toString(36)
const [
  { BackroomsGenerator },
  { PlayerController },
  { Entity },
  { GameState },
  { AudioSystem }
] = await Promise.all([
  import(`./Generator.js?cb=${CacheToken}`),
  import(`./Player.js?cb=${CacheToken}`),
  import(`./Entity.js?cb=${CacheToken}`),
  import(`./GameState.js?cb=${CacheToken}`),
  import(`./Audio.js?cb=${CacheToken}`)
])

const StartScreen = document.getElementById("StartScreen")
const Hud = document.getElementById("Hud")
const Objective = document.getElementById("Objective")
const StaminaBar = document.getElementById("StaminaBar")
const Fps = document.getElementById("Fps")
const CursorNotice = document.getElementById("CursorNotice")
const Prompt = document.getElementById("Prompt")
const Message = document.getElementById("Message")
const EndScreen = document.getElementById("EndScreen")
const EndTitle = document.getElementById("EndTitle")
const EndText = document.getElementById("EndText")
const EndEyebrow = document.getElementById("EndEyebrow")
const RestartButton = document.getElementById("RestartButton")

const Scene = new THREE.Scene()
Scene.background = new THREE.Color(0xb7b08b)
Scene.fog = new THREE.Fog(0xb7b08b, 26, 72)

const Camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, 0.05, 76)
const Renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance", precision: "mediump" })
Renderer.setSize(innerWidth, innerHeight)
Renderer.setPixelRatio(Math.min(devicePixelRatio, 1))
Renderer.shadowMap.enabled = true
Renderer.shadowMap.type = THREE.PCFSoftShadowMap
Renderer.shadowMap.autoUpdate = false
Renderer.outputColorSpace = THREE.SRGBColorSpace
Renderer.toneMapping = THREE.NoToneMapping
Renderer.toneMappingExposure = 1.0
document.getElementById("Game").prepend(Renderer.domElement)

const Ambient = new THREE.AmbientLight(0xfff2cf, 0.46)
const Hemisphere = new THREE.HemisphereLight(0xfff6dc, 0x625f50, 0.34)
Scene.add(Ambient, Hemisphere)

const State = new GameState()
const Audio = new AudioSystem()
const Generator = new BackroomsGenerator(Scene, Math.floor(Math.random() * 0xffffffff))
const World = Generator.Build()
const Player = new PlayerController(Camera, Renderer.domElement, World.Colliders)

const StartPosition = new THREE.Vector3(0, 1.65, 0)
Player.SetPosition(StartPosition)

const Breakers = []
const UsedIndices = new Set([0])

function PickOpenCell(MinDistanceFromStart = 0) {
  for (let Attempts = 0; Attempts < 300; Attempts += 1) {
    const Index = Math.floor(Math.random() * World.OpenCells.length)
    if (UsedIndices.has(Index)) continue
    const Position = World.OpenCells[Index]
    if (Position.distanceTo(StartPosition) < MinDistanceFromStart) continue
    UsedIndices.add(Index)
    return Position.clone()
  }
  return World.OpenCells[World.OpenCells.length - 1].clone()
}

function CreateBreaker(Position) {
  const Group = new THREE.Group()
  const Panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x393727, roughness: 0.8 })
  )
  Panel.position.y = 1.35
  Panel.castShadow = true
  Panel.receiveShadow = true
  Group.add(Panel)

  const Switch = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.34, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xb7402e, emissive: 0x3a0904, roughness: 0.7 })
  )
  Switch.position.set(0, 1.35, -0.14)
  Switch.castShadow = true
  Switch.receiveShadow = true
  Group.add(Switch)

  Group.position.copy(Position)
  Group.userData.Active = false
  Group.userData.Switch = Switch
  Scene.add(Group)
  Breakers.push(Group)
}

for (let I = 0; I < 3; I += 1) CreateBreaker(PickOpenCell(24))

const ExitPosition = PickOpenCell(38)
const ExitGroup = new THREE.Group()
const ExitFrame = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 2.6, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x25251c, roughness: 0.75 })
)
ExitFrame.position.y = 1.3
ExitFrame.castShadow = true
ExitFrame.receiveShadow = true
ExitGroup.add(ExitFrame)

const ExitDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.38, 2.25, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x87804e, emissive: 0x000000, roughness: 0.9 })
)
ExitDoor.position.set(0, 1.18, -0.2)
ExitDoor.castShadow = true
ExitDoor.receiveShadow = true
ExitGroup.add(ExitDoor)

ExitGroup.position.copy(ExitPosition)
Scene.add(ExitGroup)

const EntityPosition = PickOpenCell(50)
const Hunter = new Entity(Scene, EntityPosition, World, {
  OnShift: Form => Audio.PlayShift(Form)
})

let NearestInteractable = null
let MessageTimer = 0
let LastTime = performance.now()
let FrameCounter = 0
let FpsTimer = 0
let ShadowRefreshTimer = 0

function ShowMessage(Text, Duration = 1.7) {
  Message.textContent = Text
  Message.style.opacity = "1"
  MessageTimer = Duration
}

function UpdateInteraction() {
  NearestInteractable = null
  Prompt.textContent = ""
  let BestDistance = 2.1

  for (const Breaker of Breakers) {
    if (Breaker.userData.Active) continue
    const Distance = Player.Position.distanceTo(Breaker.position)
    if (Distance < BestDistance) {
      BestDistance = Distance
      NearestInteractable = Breaker
      Prompt.textContent = "[ E ] ACTIVATE BREAKER"
    }
  }

  const ExitDistance = Player.Position.distanceTo(ExitGroup.position)
  if (ExitDistance < BestDistance) {
    NearestInteractable = ExitGroup
    Prompt.textContent = State.CanExit() ? "[ E ] OPEN EXIT" : "EXIT HAS NO POWER"
  }
}

function Interact() {
  if (!State.Started || State.Ended || !NearestInteractable) return

  if (Breakers.includes(NearestInteractable)) {
    if (NearestInteractable.userData.Active) return
    NearestInteractable.userData.Active = true
    NearestInteractable.userData.Switch.material.color.setHex(0x3bb44c)
    NearestInteractable.userData.Switch.material.emissive.setHex(0x073d10)
    State.ActivateBreaker()
    Objective.textContent = `RESTORE POWER · ${State.BreakersActive}/${State.BreakersRequired}`

    if (State.BreakersActive === 1) {
      Hunter.Release()
      ShowMessage("SOMETHING HEARD THAT")
    } else if (State.CanExit()) {
      ExitDoor.material.emissive.setHex(0x163d17)
      ShowMessage("EXIT POWER RESTORED")
    } else {
      ShowMessage("BREAKER ONLINE")
    }
    return
  }

  if (NearestInteractable === ExitGroup && State.CanExit()) EndGame(true)
}

function EndGame(Escaped) {
  State.Ended = true
  if (Escaped) Audio.Stop()
  else {
    Audio.PlayDeath()
    setTimeout(() => Audio.Stop(), 900)
  }
  document.exitPointerLock()
  Hud.classList.add("Hidden")
  EndScreen.classList.remove("Hidden")

  if (Escaped) {
    EndEyebrow.textContent = "LEVEL 0 COMPLETE"
    EndTitle.textContent = "YOU ESCAPED"
    EndText.textContent = "You found power and reached the exit before the halls closed in."
  } else {
    EndEyebrow.textContent = "LEVEL 0"
    EndTitle.textContent = "YOU WERE FOUND"
    EndText.textContent = "The fluorescent halls go quiet."
  }
}

window.addEventListener("keydown", Event => {
  if (Event.code === "KeyE") Interact()
})

Renderer.domElement.addEventListener("click", () => {
  if (State.Started && !State.Ended) {
    Audio.Start()
    if (!Player.Locked) Player.Lock()
  }
})

RestartButton.addEventListener("click", () => location.reload())

window.addEventListener("gamepointerlock", Event => {
  if (!State.Started || State.Ended) return
  CursorNotice.classList.toggle("Hidden", Event.detail)
})

export function StartGame() {
  if (State.Started) return

  const FocusedElement = document.activeElement
  if (FocusedElement && typeof FocusedElement.blur === "function") FocusedElement.blur()

  Renderer.domElement.tabIndex = -1
  Renderer.domElement.dataset.modal = "false"
  State.Started = true
  StartScreen.classList.add("Hidden")
  Hud.classList.remove("Hidden")
  LastTime = performance.now()
  Audio.Start()
  requestAnimationFrame(Update)
  CursorNotice.classList.remove("Hidden")
  Player.Lock()
}

function Update(Time) {
  const Delta = Math.min((Time - LastTime) / 1000, 0.05)
  LastTime = Time

  if (State.Started && !State.Ended) {
    Player.Update(Delta)
    UpdateInteraction()
    Generator.UpdateLights(Time / 1000, Player.Position)
    if (Generator.ConsumeShadowUpdate()) Renderer.shadowMap.needsUpdate = true

    let EntityDistance = Infinity
    if (State.EntityReleased) {
      const Caught = Hunter.Update(Delta, Player.Position)
      EntityDistance = Hunter.GetDistance(Player.Position)
      ShadowRefreshTimer -= Delta
      if (ShadowRefreshTimer <= 0) {
        ShadowRefreshTimer = 0.12
        Renderer.shadowMap.needsUpdate = true
      }
      if (Caught) EndGame(false)
    }

    Audio.Update(EntityDistance)

    StaminaBar.style.transform = `scaleX(${Player.Stamina})`

    FrameCounter += 1
    FpsTimer += Delta
    if (FpsTimer >= 0.5) {
      Fps.textContent = `${Math.round(FrameCounter / FpsTimer)} FPS`
      FrameCounter = 0
      FpsTimer = 0
    }

    if (MessageTimer > 0) {
      MessageTimer -= Delta
      if (MessageTimer <= 0) Message.style.opacity = "0"
    }
  }

  Renderer.render(Scene, Camera)
  requestAnimationFrame(Update)
}

window.addEventListener("resize", () => {
  Camera.aspect = innerWidth / innerHeight
  Camera.updateProjectionMatrix()
  Renderer.setSize(innerWidth, innerHeight)
  Renderer.setPixelRatio(Math.min(devicePixelRatio, 1))
})
