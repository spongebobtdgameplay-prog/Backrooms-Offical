const GameVersion = "0.1.2"
const StartButton = document.getElementById("StartButton")
const StartButtonText = document.getElementById("StartButtonText")
const LoadStatus = document.getElementById("LoadStatus")
const MenuVersion = document.getElementById("MenuVersion")
const HudVersion = document.getElementById("HudVersion")

MenuVersion.textContent = `V${GameVersion}`
HudVersion.textContent = `V${GameVersion}`

let Loading = false

StartButton.addEventListener("click", async () => {
  if (Loading) return
  Loading = true
  StartButton.disabled = true
  StartButtonText.textContent = "LOADING LEVEL 0"
  LoadStatus.textContent = "STARTING 3D ENGINE…"

  try {
    const Game = await import("./main.js")
    Game.StartGame()
  } catch (Error) {
    console.error(Error)
    Loading = false
    StartButton.disabled = false
    StartButtonText.textContent = "RETRY"
    LoadStatus.textContent = "THE LEVEL FAILED TO LOAD"
  }
})
