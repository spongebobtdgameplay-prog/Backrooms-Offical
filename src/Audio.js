export class AudioSystem {
  constructor() {
    this.Started = false
    this.Context = null
    this.Master = null
    this.StaticGain = null
    this.HumGain = null
    this.NoiseBuffer = null
    this.NoiseSource = null
    this.HumOscillators = []
    this.Death = this.CreateOneShot("../assets/audio/entity-death.ogg", 0.52)
    this.Laugh = this.CreateOneShot("../assets/audio/entity-laugh.ogg", 0.16)
  }

  CreateOneShot(Path, Volume) {
    const AudioElement = new Audio(new URL(Path, import.meta.url).href)
    AudioElement.preload = "auto"
    AudioElement.volume = Volume
    return AudioElement
  }

  CreateNoiseBuffer(Context, Seconds = 2) {
    const FrameCount = Math.floor(Context.sampleRate * Seconds)
    const Buffer = Context.createBuffer(1, FrameCount, Context.sampleRate)
    const Data = Buffer.getChannelData(0)
    let Previous = 0

    for (let I = 0; I < FrameCount; I += 1) {
      const White = Math.random() * 2 - 1
      Previous = Previous * 0.82 + White * 0.18
      Data[I] = White * 0.42 + Previous * 0.58
    }

    return Buffer
  }

  BuildStaticBed() {
    const Context = this.Context
    this.NoiseBuffer = this.CreateNoiseBuffer(Context)

    const Source = Context.createBufferSource()
    Source.buffer = this.NoiseBuffer
    Source.loop = true

    const HighPass = Context.createBiquadFilter()
    HighPass.type = "highpass"
    HighPass.frequency.value = 900

    const LowPass = Context.createBiquadFilter()
    LowPass.type = "lowpass"
    LowPass.frequency.value = 7600

    const Gain = Context.createGain()
    Gain.gain.value = 0.014

    Source.connect(HighPass)
    HighPass.connect(LowPass)
    LowPass.connect(Gain)
    Gain.connect(this.Master)
    Source.start()

    this.NoiseSource = Source
    this.StaticGain = Gain
  }

  BuildFluorescentHum() {
    const Context = this.Context
    const Gain = Context.createGain()
    Gain.gain.value = 0.032
    Gain.connect(this.Master)
    this.HumGain = Gain

    const Frequencies = [
      [60, 0.42],
      [120, 0.2],
      [180, 0.085],
      [240, 0.038]
    ]

    for (const [Frequency, Level] of Frequencies) {
      const Oscillator = Context.createOscillator()
      const OscillatorGain = Context.createGain()
      Oscillator.type = Frequency === 60 ? "sine" : "triangle"
      Oscillator.frequency.value = Frequency + (Math.random() - 0.5) * 0.35
      OscillatorGain.gain.value = Level
      Oscillator.connect(OscillatorGain)
      OscillatorGain.connect(Gain)
      Oscillator.start()
      this.HumOscillators.push(Oscillator)
    }
  }

  async Start() {
    if (this.Started) {
      if (this.Context?.state === "suspended") {
        try {
          await this.Context.resume()
        } catch {}
      }
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    this.Context = new AudioContextClass()
    this.Master = this.Context.createGain()
    this.Master.gain.value = 0.72
    this.Master.connect(this.Context.destination)

    this.BuildStaticBed()
    this.BuildFluorescentHum()
    this.Started = true

    try {
      await this.Context.resume()
    } catch {}
  }

  Stop() {
    if (!this.Started) return
    try {
      this.NoiseSource?.stop()
    } catch {}

    for (const Oscillator of this.HumOscillators) {
      try {
        Oscillator.stop()
      } catch {}
    }

    this.HumOscillators = []
    this.NoiseSource = null
    this.Started = false

    if (this.Context && this.Context.state !== "closed") {
      this.Context.close().catch(() => {})
    }

    this.Context = null
  }

  Update(EntityDistance) {
    if (!this.Started || !this.Context) return

    const Distance = Number.isFinite(EntityDistance) ? EntityDistance : 100
    const Threat = Math.max(0, Math.min(1, 1 - (Distance - 3) / 22))
    const Now = this.Context.currentTime
    const StaticTarget = 0.014 + Threat * 0.082
    const HumTarget = 0.032 + Threat * 0.014

    this.StaticGain?.gain.setTargetAtTime(StaticTarget, Now, 0.12)
    this.HumGain?.gain.setTargetAtTime(HumTarget, Now, 0.18)
  }

  PlayNoiseBurst(Duration = 0.44, Volume = 0.18) {
    if (!this.Started || !this.Context || !this.NoiseBuffer) return

    const Context = this.Context
    const Source = Context.createBufferSource()
    Source.buffer = this.NoiseBuffer

    const Filter = Context.createBiquadFilter()
    Filter.type = "bandpass"
    Filter.frequency.value = 3100 + Math.random() * 1800
    Filter.Q.value = 0.55

    const Gain = Context.createGain()
    const Now = Context.currentTime
    Gain.gain.setValueAtTime(Volume, Now)
    Gain.gain.exponentialRampToValueAtTime(0.001, Now + Duration)

    Source.connect(Filter)
    Filter.connect(Gain)
    Gain.connect(this.Master)
    Source.start(Now, Math.random() * 0.8, Duration)
    Source.stop(Now + Duration + 0.02)
  }

  PlayShift(Form) {
    if (!this.Started) return
    this.PlayNoiseBurst(0.52, 0.22)

    if (Form === "demon") {
      this.Laugh.currentTime = 0
      this.Laugh.playbackRate = 0.82 + Math.random() * 0.09
      this.Laugh.play().catch(() => {})
    }
  }

  PlayDeath() {
    if (!this.Started) return
    this.PlayNoiseBurst(0.7, 0.3)
    this.Death.currentTime = 0
    this.Death.play().catch(() => {})
  }
}
