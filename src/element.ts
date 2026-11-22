import { LineElement } from 'chart.js';

export interface RidgePoint {
  x: number;
  y: number;
}

/**
 * A single ridge: a smoothed line (inherited from `LineElement`) with the area
 * between the line and its baseline filled.
 */
export class RidgeElement extends LineElement {
  static id = 'ridge';

  static defaults = {
    backgroundColor: 'rgba(54, 162, 235, 0.7)',
    borderColor: 'rgb(54, 162, 235)',
    borderWidth: 1.5,
    cubicInterpolationMode: 'monotone',
    tension: 0.4,
  };

  declare points: RidgePoint[];

  /** Pixel position of the ridge baseline. */
  declare base: number;

  draw(ctx: CanvasRenderingContext2D) {
    const { points, base, options } = this;
    if (!points?.length) {
      return;
    }

    ctx.save();

    ctx.beginPath();
    this.path(ctx);
    ctx.lineTo(points[points.length - 1].x, base);
    ctx.lineTo(points[0].x, base);
    ctx.closePath();
    ctx.fillStyle = options.backgroundColor;
    ctx.fill();

    if (options.borderWidth) {
      ctx.beginPath();
      this.path(ctx);
      ctx.lineWidth = options.borderWidth;
      ctx.strokeStyle = options.borderColor;
      ctx.lineCap = options.borderCapStyle;
      ctx.lineJoin = options.borderJoinStyle;
      ctx.lineDashOffset = options.borderDashOffset;
      ctx.setLineDash(options.borderDash);
      ctx.stroke();
    }

    ctx.restore();
  }

  inXRange(mouseX: number) {
    const { points } = this;
    return points?.length > 0 && mouseX >= points[0].x && mouseX <= points[points.length - 1].x;
  }

  inYRange(mouseY: number) {
    // `y` is the ridge peak (set by the controller), `base` its baseline
    return mouseY >= this.y && mouseY <= this.base;
  }

  inRange(mouseX: number, mouseY: number) {
    if (!this.inXRange(mouseX)) {
      return false;
    }
    const { points, base } = this;
    const next = Math.max(
      1,
      points.findIndex((point) => point.x >= mouseX)
    );
    const a = points[next - 1];
    const b = points[next] ?? a;
    const top = b.x === a.x ? a.y : a.y + ((b.y - a.y) * (mouseX - a.x)) / (b.x - a.x);
    return mouseY >= Math.min(top, base) && mouseY <= Math.max(top, base);
  }

  getCenterPoint(useFinalPosition: boolean) {
    return this.tooltipPosition(useFinalPosition);
  }
}
