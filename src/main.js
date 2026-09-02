import * as THREE from "three"
import { BackroomsGenerator } from "./Generator.js"
import { PlayerController } from "./Player.js"
import { Entity } from "./Entity.js"
import { GameState } from "./GameState.js"

const StartScreen = document.getElementById("StartScreen")
const StartButton = document.getElementById("StartButton")
const Hud = document.getElementById("Hud")
const Objective = document.getElementById("Objective")
const StaminaBar = document.getElementById("StaminaBar")
const Prompt = document.getElementById("Prompt")
const Message = document.getElementById("Message")
const EndScreen = document.getElementById("EndScreen")
const EndTitle = document.getElementById("EndTitle")
const EndText = document.getElementById("EndText")
const EndEyebrow = document.getElementById("EndEyebrow")
const RestartButton = document.getElementById("RestartButton")

const Scene = new THREE.Scene()
Scene.background = new THREE.Color(0x11100a)
Scene.fog = new THREE.FogExp2(0x11100a, 0.022)

const Camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 120)
const Renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
Renderer.setSize(innerWidth, innerHeight)
Renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
Renderer.shadowMap.enabled = true
Renderer.shadowMap.type = THREE.PCFSoftShadowMap
Renderer.outputColorSpace = THREE.SRGBColorSpace
Renderer.toneMapping = THREE.ACESFilmicToneMapping
Renderer.toneMappingExposure = 0.8
document.getElementById("Game").prepend(Renderer.domElement)

const Ambient = new THREE.AmbientLight(0x766f43, 0.42)
Scene.add(Ambient)

const State = new GameState()
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
  Group.add(Panel)

  const Switch = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.34, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xb7402e, emissive: 0x3a0904, roughness: 0.7 })
  )
  Switch.position.set(0, 1.35, -0.14)
  Group.add(Switch)

  const Glow = new THREE.PointLight(0xff543b, 1.5, 3)
  Glow.position.set(0, 1.35, -0.35)
  Group.add(Glow)

  Group.position.copy(Position)
  Group.userData.Active = false
  Group.userData.Switch = Switch
  Group.userData.Glow = Glow
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
ExitGroup.add(ExitFrame)

const ExitDoor = new THREE.Mesh(
  new THREE.BoxGeometry(1.38, 2.25, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x87804e, emissive: 0x000000, roughness: 0.9 })
)
ExitDoor.position.set(0, 1.18, -0.2)
ExitGroup.add(ExitDoor)

const ExitLight = new THREE.PointLight(0x75ff86, 0, 5)
ExitLight.position.set(0, 2.5, -0.45)
ExitGroup.add(ExitLight)
ExitGroup.position.copy(ExitPosition)
Scene.add(ExitGroup)

const EntityPosition = PickOpenCell(50)
const Hunter = new Entity(Scene, EntityPosition)

let NearestInteractable = null
let MessageTimer = 0
let LastTime = performance.now()

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
    NearestInteractable.userData.Glow.color.setHex(0x5dff73)
    State.ActivateBreaker()
    Objective.textContent = `Breakers: ${State.BreakersActive} / ${State.BreakersRequired}`

    if (State.BreakersActive === 1) {
      Hunter.Release()
      ShowMessage("SOMETHING HEARD THAT")
    } else if (State.CanExit()) {
      ExitDoor.material.emissive.setHex(0x163d17)
      ExitLight.intensity = 4
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
  if (State.Started && !State.Ended && !Player.Locked) Player.Lock()
})

StartButton.addEventListener("click", () => {
  State.Started = true
  StartScreen.classList.add("Hidden")
  Hud.classList.remove("Hidden")
  Player.Lock()
})

RestartButton.addEventListener("click", () => location.reload())

function Update(Time) {
  const Delta = Math.min((Time - LastTime) / 1000, 0.05)
  LastTime = Time

  if (State.Started && !State.Ended) {
    Player.Update(Delta)
    UpdateInteraction()
    Generator.UpdateLights(Time / 1000)

    if (State.EntityReleased) {
      const Caught = Hunter.Update(Delta, Player.Position)
      if (Caught) EndGame(false)
    }

    StaminaBar.style.transform = `scaleX(${Player.Stamina})`

    if (MessageTimer > 0) {
      MessageTimer -= Delta
      if (MessageTimer <= 0) Message.style.opacity = "0"
    }
  }

  Renderer.render(Scene, Camera)
  requestAnimationFrame(Update)
}

requestAnimationFrame(Update)

window.addEventListener("resize", () => {
  Camera.aspect = innerWidth / innerHeight
  Camera.updateProjectionMatrix()
  Renderer.setSize(innerWidth, innerHeight)
  Renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
})
