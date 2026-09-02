const GameVersion = "0.2.0"
const CacheToken = new URL(import.meta.url).searchParams.get("cb") || Date.now().toString(36)
const StartButton = document.getElementById("StartButton")
const StartButtonText = document.getElementById("StartButtonText")
const LoadStatus = document.getElementById("LoadStatus")
const MenuVersion = document.getElementById("MenuVersion")
const HudVersion = document.getElementById("HudVersion")

MenuVersion.textContent = `V${GameVersion}`
HudVersion.textContent = `V${GameVersion}`

async function VerifyBuild() {
  try {
    const Response = await fetch(`./version.json?cb=${Date.now()}`, { cache: "no-store" })
    if (!Response.ok) return
    const Latest = await Response.json()
    if (Latest.version !== GameVersion) {
      const Url = new URL(location.href)
      Url.searchParams.set("build", `${Latest.version}-${Date.now()}`)
      location.replace(Url.toString())
    }
  } catch {}
}

VerifyBuild()

let Loading = false

StartButton.addEventListener("click", async () => {
  if (Loading) return
  Loading = true
  StartButton.disabled = true
  StartButtonText.textContent = "LOADING LEVEL 0"
  LoadStatus.textContent = "STARTING 3D ENGINE…"

  try {
    const Game = await import(`./main.js?cb=${CacheToken}`)
    Game.StartGame()
  } catch (Error) {
    console.error(Error)
    Loading = false
    StartButton.disabled = false
    StartButtonText.textContent = "RETRY"
    LoadStatus.textContent = "THE LEVEL FAILED TO LOAD"
  }
})
