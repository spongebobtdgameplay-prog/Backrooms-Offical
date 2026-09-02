export class AudioSystem {
  constructor() {
    this.Started = false
    this.RoomHum = this.CreateLoop("../assets/audio/room-hum.ogg", 0.16)
    this.StaticBed = this.CreateLoop("../assets/audio/static-noise.ogg", 0.025)
    this.Death = this.CreateOneShot("../assets/audio/entity-death.ogg", 0.58)
    this.StaticBurst = null
    this.TargetStaticVolume = 0.025
  }

  CreateLoop(Path, Volume) {
    const AudioElement = new Audio(new URL(Path, import.meta.url).href)
    AudioElement.loop = true
    AudioElement.preload = "auto"
    AudioElement.volume = Volume
    return AudioElement
  }

  CreateOneShot(Path, Volume) {
    const AudioElement = new Audio(new URL(Path, import.meta.url).href)
    AudioElement.preload = "auto"
    AudioElement.volume = Volume
    return AudioElement
  }

  async Start() {
    if (this.Started) return
    this.Started = true
    this.RoomHum.currentTime = 0
    this.StaticBed.currentTime = 0
    try {
      await Promise.all([this.RoomHum.play(), this.StaticBed.play()])
    } catch {}
  }

  Stop() {
    this.RoomHum.pause()
    this.StaticBed.pause()
    if (this.StaticBurst) {
      this.StaticBurst.pause()
      this.StaticBurst = null
    }
    this.Started = false
  }

  Update(EntityDistance) {
    if (!this.Started) return
    const Distance = Number.isFinite(EntityDistance) ? EntityDistance : 100
    const Threat = Math.max(0, Math.min(1, 1 - (Distance - 3) / 22))
    this.TargetStaticVolume = 0.025 + Threat * 0.11
    this.StaticBed.volume += (this.TargetStaticVolume - this.StaticBed.volume) * 0.08
    this.RoomHum.volume = 0.145 + Threat * 0.035
  }

  PlayShift() {
    if (!this.Started) return
    if (this.StaticBurst) this.StaticBurst.pause()
    const Burst = new Audio(new URL("../assets/audio/static-noise.ogg", import.meta.url).href)
    Burst.preload = "auto"
    Burst.volume = 0.24
    Burst.currentTime = 0
    this.StaticBurst = Burst
    Burst.play().catch(() => {})
    setTimeout(() => {
      if (this.StaticBurst !== Burst) return
      Burst.pause()
      this.StaticBurst = null
    }, 520)
  }

  PlayDeath() {
    if (!this.Started) return
    this.Death.currentTime = 0
    this.Death.play().catch(() => {})
  }
}
