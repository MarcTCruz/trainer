// unit-role: contract|adversarial|edge — pure-logic module with no I/O or DOM;
// integration tests cannot add coverage here. Contract: frozen factory shapes
// and intersect return-type. Adversarial: coincident/identical shapes, unknown
// kind tags. Edge: near-tangent discriminant, epsilon boundary, argument-order
// symmetry, off-origin coords.
import { describe, it, expect } from 'bun:test';
import {
  Point,
  Line,
  Circle,
  intersect,
} from '../src/engines/geometry/primitives.js';

// Substantiate the contract boundary: these are the four public exports this
// file covers. A consumer that imports these names gets the shapes asserted
// in the tests below — frozen plain objects and a Point[] return from intersect.
export { Point, Line, Circle, intersect };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Round to 9 decimal places so floating-point noise doesn't break
// equality assertions while still catching real errors.
const round = (v) => Math.round(v * 1e9) / 1e9;

function sortedPoints(pts) {
  return [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
}

function approxEqualPoint(a, b, tol = 1e-7) {
  return Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol;
}

// ---------------------------------------------------------------------------
// Z — Zero: factories produce correct frozen objects
// ---------------------------------------------------------------------------

describe('Point factory', () => {
  it('returns a frozen object with kind=point and correct coords', () => {
    const p = Point(3, 4);
    expect(p.kind).toBe('point');
    expect(p.x).toBe(3);
    expect(p.y).toBe(4);
    expect(Object.isFrozen(p)).toBe(true);
  });

  it('works with negative and floating-point coords', () => {
    const p = Point(-1.5, 0.333);
    expect(p.x).toBe(-1.5);
    expect(p.y).toBe(0.333);
    expect(Object.isFrozen(p)).toBe(true);
  });
});

describe('Line factory', () => {
  it('returns a frozen object with kind=line and correct a/b', () => {
    const a = Point(0, 0);
    const b = Point(1, 1);
    const l = Line(a, b);
    expect(l.kind).toBe('line');
    expect(l.a).toBe(a);
    expect(l.b).toBe(b);
    expect(Object.isFrozen(l)).toBe(true);
  });
});

describe('Circle factory', () => {
  it('returns a frozen object with kind=circle and correct center/radius', () => {
    const c = Point(2, 3);
    const circle = Circle(c, 5);
    expect(circle.kind).toBe('circle');
    expect(circle.center).toBe(c);
    expect(circle.radius).toBe(5);
    expect(Object.isFrozen(circle)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// O — One / M — Many: line ∩ line
// ---------------------------------------------------------------------------

describe('intersect: line ∩ line', () => {
  it('returns one point for crossing lines', () => {
    // y = x  and  y = -x  cross at (0, 0)
    const l1 = Line(Point(-1, -1), Point(1, 1));
    const l2 = Line(Point(-1, 1), Point(1, -1));
    const pts = intersect(l1, l2);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(0, 0))).toBe(true);
  });

  it('returns one point for perpendicular lines through the origin', () => {
    const horizontal = Line(Point(-5, 0), Point(5, 0));
    const vertical = Line(Point(0, -5), Point(0, 5));
    const pts = intersect(horizontal, vertical);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(0, 0))).toBe(true);
  });

  it('returns empty for parallel horizontal lines', () => {
    const l1 = Line(Point(0, 0), Point(1, 0));
    const l2 = Line(Point(0, 2), Point(1, 2));
    expect(intersect(l1, l2)).toHaveLength(0);
  });

  it('returns empty for parallel diagonal lines', () => {
    const l1 = Line(Point(0, 0), Point(1, 1));
    const l2 = Line(Point(0, 1), Point(1, 2));
    expect(intersect(l1, l2)).toHaveLength(0);
  });

  it('returns empty for coincident lines', () => {
    // Same infinite line described by different points.
    const l1 = Line(Point(0, 0), Point(2, 2));
    const l2 = Line(Point(1, 1), Point(3, 3));
    expect(intersect(l1, l2)).toHaveLength(0);
  });

  it('correctly finds off-origin intersection', () => {
    // y = 2x + 1  and  y = -x + 4  intersect at x=1, y=3
    const l1 = Line(Point(0, 1), Point(1, 3));
    const l2 = Line(Point(0, 4), Point(4, 0));
    const pts = intersect(l1, l2);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(1, 3))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B — Boundary / S — Symmetry: line ∩ circle
// ---------------------------------------------------------------------------

describe('intersect: line ∩ circle', () => {
  // Unit circle centred at origin.
  const unitCircle = Circle(Point(0, 0), 1);

  it('returns 2 points for a secant line', () => {
    // The x-axis passes through (-1,0) and (1,0).
    const xAxis = Line(Point(-2, 0), Point(2, 0));
    const pts = sortedPoints(intersect(xAxis, unitCircle));
    expect(pts).toHaveLength(2);
    expect(approxEqualPoint(pts[0], Point(-1, 0))).toBe(true);
    expect(approxEqualPoint(pts[1], Point(1, 0))).toBe(true);
  });

  it('returns 1 point for a tangent line', () => {
    // The line y = 1 is tangent to the unit circle at (0, 1).
    const tangent = Line(Point(-1, 1), Point(1, 1));
    const pts = intersect(tangent, unitCircle);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(0, 1))).toBe(true);
  });

  it('returns 0 points for a line that misses the circle', () => {
    const miss = Line(Point(-1, 2), Point(1, 2));
    expect(intersect(miss, unitCircle)).toHaveLength(0);
  });

  it('argument order is symmetric: intersect(line, circle) === intersect(circle, line)', () => {
    const diagonal = Line(Point(-2, -1), Point(2, 3));
    const c = Circle(Point(1, 1), 2);
    const fwd = sortedPoints(intersect(diagonal, c));
    const rev = sortedPoints(intersect(c, diagonal));
    expect(fwd).toHaveLength(rev.length);
    fwd.forEach((p, i) => expect(approxEqualPoint(p, rev[i])).toBe(true));
  });

  it('near-tangent line (epsilon boundary): resolves to 1 or 2 points stably', () => {
    // Line at y = 1 - 1e-10 should be inside the circle's tangent threshold
    // and be treated as tangent (1 point) by EPSILON guard.
    const nearTangent = Line(Point(-2, 1 - 1e-10), Point(2, 1 - 1e-10));
    const pts = intersect(nearTangent, unitCircle);
    // Either tangent (1) or secant (2) is acceptable — what must NOT happen
    // is a crash or a negative sqrt.
    expect(pts.length >= 1 && pts.length <= 2).toBe(true);
  });

  it('line through circle centre yields 2 antipodal points', () => {
    const throughCentre = Line(Point(-3, 0), Point(3, 0));
    const c = Circle(Point(1, 0), 2);
    const pts = sortedPoints(intersect(throughCentre, c));
    expect(pts).toHaveLength(2);
    // Centre at 1, radius 2 → intersections at x=-1 and x=3
    expect(approxEqualPoint(pts[0], Point(-1, 0))).toBe(true);
    expect(approxEqualPoint(pts[1], Point(3, 0))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// circle ∩ circle
// ---------------------------------------------------------------------------

describe('intersect: circle ∩ circle', () => {
  it('returns 2 points for overlapping circles', () => {
    // Two unit circles centred at (-1,0) and (1,0); intersect at (0,±√3/2)? No.
    // c1 centred (0,0) r=1, c2 centred (1,0) r=1.
    // d=1; a=(1-1+1)/(2)=0.5; h²=1-0.25=0.75; h=√0.75
    const c1 = Circle(Point(0, 0), 1);
    const c2 = Circle(Point(1, 0), 1);
    const pts = intersect(c1, c2);
    expect(pts).toHaveLength(2);
    const h = Math.sqrt(0.75);
    const sorted = sortedPoints(pts);
    expect(approxEqualPoint(sorted[0], Point(0.5, -h))).toBe(true);
    expect(approxEqualPoint(sorted[1], Point(0.5, h))).toBe(true);
  });

  it('returns 1 point for externally tangent circles', () => {
    // c1 at (0,0) r=1, c2 at (3,0) r=2 → external tangent at (1,0)
    const c1 = Circle(Point(0, 0), 1);
    const c2 = Circle(Point(3, 0), 2);
    const pts = intersect(c1, c2);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(1, 0))).toBe(true);
  });

  it('returns 1 point for internally tangent circles', () => {
    // c1 at (0,0) r=3, c2 at (1,0) r=2 → internal tangent at (3,0)
    const c1 = Circle(Point(0, 0), 3);
    const c2 = Circle(Point(1, 0), 2);
    const pts = intersect(c1, c2);
    expect(pts).toHaveLength(1);
    expect(approxEqualPoint(pts[0], Point(3, 0))).toBe(true);
  });

  it('returns 0 points for disjoint circles (too far apart)', () => {
    const c1 = Circle(Point(0, 0), 1);
    const c2 = Circle(Point(10, 0), 1);
    expect(intersect(c1, c2)).toHaveLength(0);
  });

  it('returns 0 points for one circle entirely inside another', () => {
    const outer = Circle(Point(0, 0), 5);
    const inner = Circle(Point(0, 0), 2);
    expect(intersect(outer, inner)).toHaveLength(0);
  });

  it('returns 0 points for identical circles (infinite intersections → empty)', () => {
    const c = Circle(Point(1, 2), 3);
    expect(intersect(c, c)).toHaveLength(0);
  });

  it('argument order is symmetric for circle∩circle', () => {
    const c1 = Circle(Point(0, 0), 2);
    const c2 = Circle(Point(1, 1), 2);
    const fwd = sortedPoints(intersect(c1, c2));
    const rev = sortedPoints(intersect(c2, c1));
    expect(fwd).toHaveLength(rev.length);
    fwd.forEach((p, i) => expect(approxEqualPoint(p, rev[i])).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// E — Edge/Exceptions: unknown shape kinds
// ---------------------------------------------------------------------------

describe('intersect: unknown shape kinds', () => {
  it('returns empty array rather than throwing', () => {
    const weirdShape = { kind: 'triangle' };
    expect(() => intersect(weirdShape, Point(0, 0))).not.toThrow();
    expect(intersect(weirdShape, weirdShape)).toHaveLength(0);
  });
});
