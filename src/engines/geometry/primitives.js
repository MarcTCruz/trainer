/*
 * ============================================================
 * GEOMETRY PRIMITIVES — API CONTRACT
 * ============================================================
 *
 * PORTABILITY CONSTRAINT
 * ----------------------
 * This file is injected as SOURCE TEXT into a QuickJS WASM sandbox
 * before user code runs. Therefore: zero imports, zero Node/DOM
 * globals, no side-effects at load time. Only plain ECMAScript
 * (Math is safe). The `export` keywords are the ONLY ESM-specific
 * lines; the sandbox injector strips them before injection.
 *
 * FACTORIES
 * ---------
 * Point(x, y)            → { kind:'point', x, y }            (frozen)
 * Line(pointA, pointB)   → { kind:'line', a, b }             (frozen)
 * Circle(center, radius) → { kind:'circle', center, radius } (frozen)
 *
 * All returned objects are Object.freeze'd at creation — they cannot
 * be mutated after construction.
 *
 * INTERSECTION CONVENTION — INFINITE LINES
 * -----------------------------------------
 * Line represents an *infinite* line (not a segment). This matches
 * Euclid's Elements, where lines extend without bound and intersection
 * is determined purely by direction. A segment interpretation would
 * require additional endpoint-containment tests that are out of scope
 * here; that can be built on top as a higher-level predicate.
 *
 * intersect(shapeA, shapeB) → Point[]
 *   Returns the array of intersection points (may be empty).
 *   Argument order is symmetric: intersect(L,C) === intersect(C,L).
 *
 *   Handled pairs (unordered):
 *     line ∩ line   → [] (parallel or coincident) or [Point]
 *     line ∩ circle → [], [Point] (tangent), or [Point, Point]
 *     circle ∩ circle → [], [Point] (tangent), or [Point, Point]
 *
 * COINCIDENT/IDENTICAL SHAPES
 * ----------------------------
 * Coincident lines (same infinite line, different points) and identical
 * circles both yield infinitely many intersection points. We return []
 * rather than throwing; callers that need to detect this case should
 * compare shapes structurally before calling intersect.
 *
 * EPSILON
 * -------
 * Float comparisons use EPSILON = 1e-9 to absorb rounding error in
 * discriminants and dot-product checks. This value sits below any
 * meaningful geometric distance in a normalised coordinate space while
 * staying well above double-precision noise (~1e-15).
 *
 * ============================================================
 */

const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function Point(x, y) {
  return Object.freeze({ kind: 'point', x, y });
}

// a and b are Points that define the infinite line through them.
export function Line(pointA, pointB) {
  return Object.freeze({ kind: 'line', a: pointA, b: pointB });
}

// center is a Point; radius is a non-negative number.
export function Circle(centerPoint, radius) {
  return Object.freeze({ kind: 'circle', center: centerPoint, radius });
}

// ---------------------------------------------------------------------------
// Internal helpers — one named function per shape-pair kind
// ---------------------------------------------------------------------------

/*
 * Represent the infinite line through p1 and p2 in the implicit form
 *   ax + by + c = 0
 * with (a, b) normalised to unit length so that the coefficients are
 * stable for near-degenerate lines.
 */
function _lineCoeffs(line) {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  // Normal vector to the direction (dx, dy) is (-dy, dx).
  // Implicit: -dy·(x - a.x) + dx·(y - a.y) = 0
  //         → -dy·x + dx·y + (dy·a.x - dx·a.y) = 0
  const a = -dy;
  const b = dx;
  const c = dy * line.a.x - dx * line.a.y;
  const len = Math.sqrt(a * a + b * b);
  // len === 0 means the two defining points are identical — degenerate line.
  // Return un-normalised; callers handle via the determinant check.
  if (len < EPSILON) {
    return { a, b, c };
  }
  return { a: a / len, b: b / len, c: c / len };
}

function _intersectLineLine(l1, l2) {
  const c1 = _lineCoeffs(l1);
  const c2 = _lineCoeffs(l2);

  // Solve the 2×2 system:
  //   c1.a·x + c1.b·y = -c1.c
  //   c2.a·x + c2.b·y = -c2.c
  const det = c1.a * c2.b - c2.a * c1.b;

  // |det| < EPSILON → lines are parallel (or coincident — both return []).
  if (Math.abs(det) < EPSILON) {
    return [];
  }

  const x = (-c1.c * c2.b + c2.c * c1.b) / det;
  const y = (-c1.a * c2.c + c2.a * c1.c) / det;
  return [Point(x, y)];
}

function _intersectLineCircle(line, circle) {
  // Translate so the circle centre is at the origin; this keeps the
  // arithmetic clean and avoids catastrophic cancellation for large coords.
  const cx = circle.center.x;
  const cy = circle.center.y;
  const r = circle.radius;

  // Translated line points.
  const ax = line.a.x - cx;
  const ay = line.a.y - cy;
  const bx = line.b.x - cx;
  const by = line.b.y - cy;

  const dx = bx - ax;
  const dy = by - ay;

  // Parametric: P(t) = (ax + t·dx, ay + t·dy)
  // Substitute into x² + y² = r²:
  //   (ax + t·dx)² + (ay + t·dy)² = r²
  //   (dx²+dy²)·t² + 2(ax·dx+ay·dy)·t + (ax²+ay²-r²) = 0
  const A = dx * dx + dy * dy;
  const B = 2 * (ax * dx + ay * dy);
  const C = ax * ax + ay * ay - r * r;

  // A ≈ 0 means the two line-defining points are identical — degenerate.
  if (A < EPSILON) {
    return [];
  }

  const disc = B * B - 4 * A * C;

  if (disc < -EPSILON) {
    return []; // Line misses the circle entirely.
  }

  if (Math.abs(disc) <= EPSILON) {
    // Tangent — exactly one contact point.
    const t = -B / (2 * A);
    return [Point(ax + t * dx + cx, ay + t * dy + cy)];
  }

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-B - sqrtDisc) / (2 * A);
  const t2 = (-B + sqrtDisc) / (2 * A);
  return [
    Point(ax + t1 * dx + cx, ay + t1 * dy + cy),
    Point(ax + t2 * dx + cx, ay + t2 * dy + cy),
  ];
}

function _intersectCircleCircle(c1, c2) {
  const dx = c2.center.x - c1.center.x;
  const dy = c2.center.y - c1.center.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Identical circles → infinite intersections; return [] per contract.
  if (d < EPSILON && Math.abs(c1.radius - c2.radius) < EPSILON) {
    return [];
  }

  // One circle entirely inside the other, or entirely outside — no crossing.
  if (d > c1.radius + c2.radius + EPSILON) {
    return [];
  }
  if (d < Math.abs(c1.radius - c2.radius) - EPSILON) {
    return [];
  }

  // The radical axis: distance from c1's center to the radical line along d.
  //   a = (r1² - r2² + d²) / (2d)
  const r1 = c1.radius;
  const r2 = c2.radius;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);

  // Half-chord length from the radical axis to the intersection points.
  const hSq = r1 * r1 - a * a;

  // The midpoint M along d.
  const mx = c1.center.x + (a * dx) / d;
  const my = c1.center.y + (a * dy) / d;

  if (hSq < EPSILON) {
    // External or internal tangent — one contact point.
    return [Point(mx, my)];
  }

  const h = Math.sqrt(hSq);
  // Perpendicular direction to d.
  const px = (-dy / d) * h;
  const py = (dx / d) * h;
  return [
    Point(mx + px, my + py),
    Point(mx - px, my - py),
  ];
}

// ---------------------------------------------------------------------------
// Public intersection dispatcher
// ---------------------------------------------------------------------------

export function intersect(shapeA, shapeB) {
  // Normalise order so the specific helpers always receive (line, ...)
  // or (circle, circle) — this gives argument-order symmetry for free.
  if (shapeA.kind === 'circle' && shapeB.kind === 'line') {
    return _intersectLineCircle(shapeB, shapeA);
  }
  if (shapeA.kind === 'line' && shapeB.kind === 'circle') {
    return _intersectLineCircle(shapeA, shapeB);
  }
  if (shapeA.kind === 'line' && shapeB.kind === 'line') {
    return _intersectLineLine(shapeA, shapeB);
  }
  if (shapeA.kind === 'circle' && shapeB.kind === 'circle') {
    return _intersectCircleCircle(shapeA, shapeB);
  }
  // Unknown shape kinds — return empty rather than throwing, so sandbox
  // user code cannot crash the host via a bad type tag.
  return [];
}
