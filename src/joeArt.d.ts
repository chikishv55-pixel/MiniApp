type Ctx = CanvasRenderingContext2D
export type EnemyLook = { boss?: boolean; btype?: number; col: string; col2: string; hat: number; armor?: boolean }

export function box(c: Ctx, col: string, x: number, y: number, w: number, h: number, r?: number): void
export function drawGun(c: Ctx, id: number): void
export function drawSkin(c: Ctx, id: number): void
export function drawEnemy(c: Ctx, e: EnemyLook): void
export function drawDude(
  c: Ctx,
  x: number,
  y: number,
  dir: number,
  s: number,
  look: (c: Ctx) => void,
  gun: number,
  aim: number,
  kick: number,
  rot: number,
): void
