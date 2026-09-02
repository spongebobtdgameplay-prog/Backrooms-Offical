export class GameState {
  constructor() {
    this.BreakersRequired = 3
    this.BreakersActive = 0
    this.Started = false
    this.Ended = false
    this.EntityReleased = false
  }

  ActivateBreaker() {
    if (this.Ended) return
    this.BreakersActive += 1
    if (this.BreakersActive >= 1) this.EntityReleased = true
  }

  CanExit() {
    return this.BreakersActive >= this.BreakersRequired
  }
}
