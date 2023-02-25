import StatsPanel from './StatsPanel'

export default class StatsWrap {
  private mode: number = 0
  private container: HTMLDivElement
  private beginTime: number
  private prevTime: number
  private frames: number = 0
  private fpsPanel: StatsPanel
  private msPanel: StatsPanel
  private memPanel: StatsPanel | null

  constructor() {
    this.container = document.createElement('div')
    this.container.style.cssText = 'cursor:pointer;opacity:0.9'

    this.container.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        this.showPanel(++this.mode % this.container.children.length)
      },
      false
    )

    this.beginTime = (performance || Date).now()
    this.prevTime = this.beginTime
    this.fpsPanel = this.addPanel(new StatsPanel('FPS', '#0ff', '#002'))
    this.msPanel = this.addPanel(new StatsPanel('MS', '#0f0', '#002'))
    this.memPanel = null

    if (performance && (performance as any).memory) {
      this.memPanel = this.addPanel(new StatsPanel('MB', '#f08', '#201'))
    }

    this.showPanel(0)
  }

  public addPanel(panel: StatsPanel): StatsPanel {
    this.container.appendChild(panel.getDom())
    return panel
  }

  public showPanel(id: number) {
    for (var i = 0; i < this.container.children.length; i++) {
      ;(this.container.children[i] as HTMLCanvasElement).style.display =
        i === id ? 'block' : 'none'
    }
  }

  public getDom(): HTMLDivElement {
    return this.container
  }

  public begin(): void {
    this.beginTime = (performance || Date).now()
  }

  public update(): void {
    this.beginTime = this.end()
  }

  public end(): number {
    this.frames++

    let time = (performance || Date).now()

    this.msPanel.update(time - this.beginTime, 200)

    if (time > this.prevTime + 1000) {
      this.fpsPanel.update((this.frames * 1000) / (time - this.prevTime), 100)

      this.prevTime = time
      this.frames = 0

      if (this.memPanel) {
        var memory = (performance as any).memory
        this.memPanel.update(
          memory.usedJSHeapSize / 1048576,
          memory.jsHeapSizeLimit / 1048576
        )
      }
    }
    return time
  }

  public setMode(id: number) {
    this.showPanel(id)
  }
}
