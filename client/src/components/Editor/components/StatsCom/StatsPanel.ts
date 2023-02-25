class StatsPanel {
  private static PR = Math.round(window.devicePixelRatio || 1)
  private pr: number = StatsPanel.PR + 1
  private min: number = Infinity
  private max: number = 0
  private _height: number
  private _width: number
  private _text_x: number
  private _text_y: number
  private _graph_x: number
  private _graph_y: number
  private _graph_width: number
  private _graph_height: number
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D

  private name: string
  private fg: string
  private bg: string

  constructor(name: string, fg: string, bg: string) {
    this._height = 48 * this.pr
    this._width = 80 * this.pr
    this._text_x = 3 * this.pr
    this._text_y = 2 * this.pr
    this._graph_x = 3 * this.pr
    this._graph_y = 15 * this.pr
    this._graph_width = 74 * this.pr
    this._graph_height = 30 * this.pr

    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')!
    this.name = name
    this.fg = fg
    this.bg = bg

    this.init()
  }

  private init(): void {
    const canvas = this.canvas,
      context = this.context

    canvas.width = this._width
    canvas.height = this._height
    // canvas.style.cssText = 'width:80px;height:48px'
    context.font = 'bold ' + 9 * this.pr + 'px Helvetica,Arial,sans-serif'
    context.textBaseline = 'top'

    context.fillStyle = this.bg
    context.fillRect(0, 0, this._width, this._height)

    context.fillStyle = this.fg
    context.fillText(this.name, this._text_x, this._text_y)
    context.fillRect(
      this._graph_x,
      this._graph_y,
      this._graph_width,
      this._graph_height
    )

    context.fillStyle = this.bg
    context.globalAlpha = 0.9
    context.fillRect(
      this._graph_x,
      this._graph_y,
      this._graph_width,
      this._graph_height
    )
  }

  public getDom(): HTMLCanvasElement {
    return this.canvas
  }

  public update(value: number, maxValue: number): void {
    const context = this.context
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)

    context.fillStyle = this.bg
    context.globalAlpha = 1
    context.fillRect(0, 0, this._width, this._graph_y)
    context.fillStyle = this.fg
    context.fillText(
      Math.round(value) +
        ' ' +
        this.name +
        ' (' +
        Math.round(this.min) +
        '-' +
        Math.round(this.max) +
        ')',
      this._text_x,
      this._text_y
    )

    context.drawImage(
      this.canvas,
      this._graph_x + this.pr,
      this._graph_y,
      this._graph_width - this.pr,
      this._graph_height,
      this._graph_x,
      this._graph_y,
      this._graph_width - this.pr,
      this._graph_height
    )

    context.fillRect(
      this._graph_x + this._graph_width - this.pr,
      this._graph_y,
      this.pr,
      this._graph_height
    )

    context.fillStyle = this.bg
    context.globalAlpha = 0.9
    context.fillRect(
      this._graph_x + this._graph_width - this.pr,
      this._graph_y,
      this.pr,
      Math.round((1 - value / maxValue) * this._graph_height)
    )
  }
}

export default StatsPanel
