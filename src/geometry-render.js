// Named constants — no magic values scattered in draw code
const CANVAS_PADDING = 32;
const POINT_RADIUS = 4;
const POINT_COLOR = '#64ffda';   // --accent
const LINE_COLOR = '#a78bfa';    // purple accent
const CIRCLE_COLOR = '#ffb74d';  // --warning
const CANVAS_BG = '#1a1a2e';     // --bg-card

// Flatten: accept single shape or array; filter to known kinds.
function normalizeShapes(raw) {
  const arr = Array.isArray(raw) ? raw.flat(Infinity) : [raw];
  return arr.filter(s => s && typeof s === 'object' && ['point', 'line', 'circle'].includes(s.kind));
}

// Collect all "anchor" points: point coords, line endpoints, circle centers±radius.
function anchorPoints(shapes) {
  const pts = [];
  for (const s of shapes) {
    if (s.kind === 'point') pts.push({ x: s.x, y: s.y });
    if (s.kind === 'line') { pts.push({ x: s.a.x, y: s.a.y }); pts.push({ x: s.b.x, y: s.b.y }); }
    if (s.kind === 'circle') {
      pts.push({ x: s.center.x + s.radius, y: s.center.y });
      pts.push({ x: s.center.x - s.radius, y: s.center.y });
      pts.push({ x: s.center.x, y: s.center.y + s.radius });
      pts.push({ x: s.center.x, y: s.center.y - s.radius });
    }
  }
  return pts;
}

// Compute world bounding box; fall back to a unit box for empty/degenerate input.
function boundingBox(pts) {
  if (!pts.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  let minX = pts[0].x, maxX = pts[0].x, minY = pts[0].y, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // Ensure non-zero range.
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  return { minX, maxX: minX + rangeX, minY, maxY: minY + rangeY };
}

// Build a world→canvas transform that fits all shapes in the canvas while:
//   - preserving aspect ratio
//   - flipping Y (math y-up → canvas y-down)
//   - adding padding
function buildTransform(bbox, canvasW, canvasH) {
  const drawW = canvasW - 2 * CANVAS_PADDING;
  const drawH = canvasH - 2 * CANVAS_PADDING;
  const rangeX = bbox.maxX - bbox.minX;
  const rangeY = bbox.maxY - bbox.minY;
  // Uniform scale (preserves aspect ratio)
  const scale = Math.min(drawW / rangeX, drawH / rangeY);
  // Center the world content in the draw area
  const offsetX = CANVAS_PADDING + (drawW - rangeX * scale) / 2;
  const offsetY = CANVAS_PADDING + (drawH - rangeY * scale) / 2;
  return { scale, offsetX, offsetY, bbox };
}

function worldToCanvas(wx, wy, transform) {
  const { scale, offsetX, offsetY, bbox } = transform;
  // Flip Y: canvas y increases downward, world y increases upward
  const cx = offsetX + (wx - bbox.minX) * scale;
  const cy = offsetY + (bbox.maxY - wy) * scale;
  return { cx, cy };
}

function drawPoint(ctx, shape, transform) {
  const { cx, cy } = worldToCanvas(shape.x, shape.y, transform);
  ctx.beginPath();
  ctx.arc(cx, cy, POINT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = POINT_COLOR;
  ctx.fill();
}

// Draw the segment between the two defining points (a→b).
// Rationale: drawing an "infinite" line that extends to canvas edges is trickier
// and hides the construction intent; Euclid's construction relies on the
// chosen segment length (e.g. AB is the given side), so showing a→b is
// both simpler and more informative for the exercises here.
function drawLine(ctx, shape, transform) {
  const { cx: ax, cy: ay } = worldToCanvas(shape.a.x, shape.a.y, transform);
  const { cx: bx, cy: by } = worldToCanvas(shape.b.x, shape.b.y, transform);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCircle(ctx, shape, transform) {
  const { cx, cy } = worldToCanvas(shape.center.x, shape.center.y, transform);
  // Radius in canvas space (scale only; no Y-flip needed for magnitude)
  const cr = shape.radius * transform.scale;
  ctx.beginPath();
  ctx.arc(cx, cy, cr, 0, Math.PI * 2);
  ctx.strokeStyle = CIRCLE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const DRAWERS = {
  point: drawPoint,
  line: drawLine,
  circle: drawCircle,
};

/**
 * renderGeometry(canvas, shapes)
 *
 * Renders geometry shapes onto the given canvas element.
 * shapes: a shape POJO, an array of shape POJOs, or a nested array.
 * Pure-ish: no global state; only touches canvas's 2d context.
 */
export function renderGeometry(canvas, shapes) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const normalized = normalizeShapes(shapes);
  if (!normalized.length) return;

  const pts = anchorPoints(normalized);
  const bbox = boundingBox(pts);
  const transform = buildTransform(bbox, canvas.width, canvas.height);

  for (const shape of normalized) {
    const draw = DRAWERS[shape.kind];
    if (draw) draw(ctx, shape, transform);
  }
}
