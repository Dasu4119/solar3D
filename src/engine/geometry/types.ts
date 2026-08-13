export type Point2D = { x: number; y: number };
export type Size2D = { width: number; height: number };
export type Bounds2D = { min: Point2D; max: Point2D };
export type Polygon2D = Point2D[];

export type Transform2D = {
  position: Point2D;
  rotation: number;
  scale: Point2D;
};
