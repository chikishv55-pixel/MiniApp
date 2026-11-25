// Общая геометрия кузова для «Перекупщика Джо»: игра (flip.html) и запекалка (scripts/flip/bake-vis.mjs).
// Маска кузова — S×S пикселей по UV. Ржавчина/грязь живут только в «видимых» пикселях: тех, что можно
// увидеть с какой-нибудь позиции камеры, куда игрок может повернуть машину. Днище, нутро арок за шинами,
// стык кабины с кузовом — не в счёт, иначе прогресс работы никогда не дойдёт до нуля.
import * as THREE from 'three'

export const STEP = 3 // шаг сетки точек по маске, px

// Треугольники кузова: вершины в мире, UV в пикселях маски, сколько пикселей маски на метр.
export function bodyTris(body, S) {
  body.updateMatrixWorld(true)
  const g = body.geometry, pos = g.attributes.position, uv = g.attributes.uv, idx = g.index
  const n = idx ? idx.count : pos.count
  const at = (i) => (idx ? idx.getX(i) : i)
  const tris = [], byFace = []
  for (let i = 0; i < n; i += 3) {
    const v = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, at(i + k)).applyMatrix4(body.matrixWorld))
    const u = [0, 1, 2].map((k) => new THREE.Vector2(uv.getX(at(i + k)) * S, uv.getY(at(i + k)) * S))
    const area = new THREE.Triangle(...v).getArea()
    const det = (u[1].x - u[0].x) * (u[2].y - u[0].y) - (u[2].x - u[0].x) * (u[1].y - u[0].y)
    if (area < 1e-6 || Math.abs(det) < 1e-6) continue
    const normal = new THREE.Triangle(...v).getNormal(new THREE.Vector3())
    const t = { v, u, det, area, normal, pxPerM: Math.sqrt(Math.abs(det) / 2 / area) }
    tris.push(t)
    byFace[i / 3] = t
  }
  return { tris, byFace }
}

// Точки сетки внутри треугольника: cb(x, y, worldPoint)
export function forEachSample(t, cb) {
  const { u, v, det } = t
  const p = new THREE.Vector3()
  const e1 = v[1].clone().sub(v[0]), e2 = v[2].clone().sub(v[0])
  const x0 = Math.floor(Math.min(u[0].x, u[1].x, u[2].x) / STEP) * STEP, x1 = Math.max(u[0].x, u[1].x, u[2].x)
  const y0 = Math.floor(Math.min(u[0].y, u[1].y, u[2].y) / STEP) * STEP, y1 = Math.max(u[0].y, u[1].y, u[2].y)
  for (let y = y0 + STEP / 2; y < y1; y += STEP) for (let x = x0 + STEP / 2; x < x1; x += STEP) {
    const a = ((x - u[0].x) * (u[2].y - u[0].y) - (u[2].x - u[0].x) * (y - u[0].y)) / det
    const b = ((u[1].x - u[0].x) * (y - u[0].y) - (x - u[0].x) * (u[1].y - u[0].y)) / det
    if (a < 0 || b < 0 || a + b > 1) continue
    p.copy(v[0]).addScaledVector(e1, a).addScaledVector(e2, b)
    cb(x, y, p)
  }
}

// Медленно (секунды): лучи от каждой точки к 36 позициям камеры. Поэтому запекается заранее.
export function bakeCover(body, parts, S) {
  const { tris } = bodyTris(body, S)
  const sides = parts.map((o) => o.material.side)
  parts.forEach((o) => (o.material.side = THREE.DoubleSide)) // луч изнутри стыка должен упереться в грань
  const rc = new THREE.Raycaster(), dir = new THREE.Vector3(), from = new THREE.Vector3()
  const eyes = []
  for (const pitch of [0.12, 0.55, 1.1]) for (let k = 0; k < 12; k++) {
    const yaw = (k / 12) * Math.PI * 2, d = 9
    eyes.push(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * d, 0.6 + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d))
  }
  const cover = new Uint8Array(S * S)
  for (const t of tris) {
    if (t.normal.y < -0.5) continue // днище
    forEachSample(t, (x, y, p) => {
      for (const e of eyes) {
        dir.copy(e).sub(p)
        const len = dir.length()
        dir.divideScalar(len)
        if (dir.dot(t.normal) < 0.35) continue // под острым углом пальцем не попасть
        rc.set(from.copy(p).addScaledVector(t.normal, 0.004), dir)
        rc.far = len
        if (rc.intersectObjects(parts, false).length) continue
        markBlock(cover, S, x, y)
        return
      }
    })
  }
  parts.forEach((o, i) => (o.material.side = sides[i]))
  return cover
}

function markBlock(cover, S, x, y) {
  const h = STEP / 2
  for (let Y = Math.round(y - h); Y < Math.round(y + h); Y++) for (let X = Math.round(x - h); X < Math.round(x + h); X++)
    if (X >= 0 && Y >= 0 && X < S && Y < S) cover[Y * S + X] = 1
}
