import { MiniMap, Rectangle, type EventArgs } from '@antv/x6'

const OVERVIEW_PAD = 14
/** 缩略图按「大地图」展示时的最小视野（图坐标），避免单节点贴满缩略区 */
const MIN_OVERVIEW_W = 680
const MIN_OVERVIEW_H = 500
/** 相对内容包围盒再放大的倍数，让节点在缩略图里更接近「点」、表达在大图中的位置 */
const OVERVIEW_MARGIN_FACTOR = 2.35

/**
 * - 无 Scroller 时：补全 MiniMap 在 scale/translate 时未调用 updatePaper 的问题（与主画布缩放同步）。
 * - 缩略图内容：用大于内容包围盒的「虚拟画布」做 zoomToRect，固定 world 坐标系；
 *   只有内容变化（节点增删）时才重算 overview，平移/缩放只移动视口指示框，
 *   使小图真正表达「当前视口在大画布中的位置」。
 */
export class FixedMiniMap extends MiniMap {
  protected onTransform(options: { ui?: boolean }) {
    if (!this.scroller) {
      // 主画布平移/缩放：overview 坐标系保持稳定，只刷新视口指示框
      this.updateViewport()
      return
    }
    super.onTransform(options as { ui: boolean })
  }

  protected onModelUpdated() {
    if (this.scroller) {
      super.onModelUpdated()
      return
    }
    // 内容变化时重新建立 world 坐标系，再更新视口框
    this.minimapZoomOverview()
    this.updateViewport()
  }

  protected updatePaper(w: number | EventArgs['resize'], h?: number) {
    let width: number
    let height: number
    if (typeof w === 'object') {
      width = w.width
      height = w.height
    } else {
      width = w
      height = h as number
    }

    const origin = this.sourceGraph.options
    const scale = this.sourceGraph.transform.getScale()
    const maxWidth = this.options.width - 2 * this.options.padding
    const maxHeight = this.options.height - 2 * this.options.padding

    width /= scale.sx
    height /= scale.sy

    this.ratio = Math.min(maxWidth / width, maxHeight / height)

    const ratio = this.ratio
    const x = (origin.x * ratio) / scale.sx
    const y = (origin.y * ratio) / scale.sy

    width *= ratio
    height *= ratio
    this.targetGraph.resize(width, height)
    this.targetGraph.translate(x, y)

    if (this.scroller) {
      this.targetGraph.scale(ratio, ratio)
    }
    // 无 scroller 时不在此处调 minimapZoomOverview，交由 onModelUpdated 统一处理

    this.updateViewport()
    return this
  }

  /** 将节点放在更大的视野里呈现，表达「在大图中的位置」而非 1:1 卡片克隆 */
  private minimapZoomOverview() {
    const bbox = this.targetGraph.getContentArea()
    if (!bbox.width || !bbox.height) {
      this.targetGraph.zoomToFit({ padding: OVERVIEW_PAD })
      return
    }
    const box = Rectangle.create(bbox)
    const c = box.getCenter()
    const tw = Math.max(box.width * OVERVIEW_MARGIN_FACTOR, MIN_OVERVIEW_W)
    const th = Math.max(box.height * OVERVIEW_MARGIN_FACTOR, MIN_OVERVIEW_H)
    const overview = Rectangle.create(c.x - tw / 2, c.y - th / 2, tw, th)
    this.targetGraph.zoomToRect(overview, { padding: OVERVIEW_PAD })
  }
}
