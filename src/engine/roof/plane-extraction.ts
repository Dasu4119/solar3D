export type RoofVertex = { x: number; y: number; z: number };
export type RoofTriangle = { a: number; b: number; c: number };
export type RoofMesh = { vertices: RoofVertex[]; triangles: RoofTriangle[] };
export type RoofPlane = {
  id: string;
  areaM2: number;
  normal: RoofVertex;
  pitchDeg: number;
  azimuthDeg: number;
  triangleIndices: number[];
  vertexIndices: number[];
};

export type PlaneExtractionOptions = {
  minAreaM2?: number;
  normalTolerance?: number;
};

const EPS = 1e-9;

function cross(a: RoofVertex, b: RoofVertex): RoofVertex {
  return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x };
}
function sub(a: RoofVertex, b: RoofVertex): RoofVertex { return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}; }
function length(v: RoofVertex): number { return Math.hypot(v.x,v.y,v.z); }
function normalize(v: RoofVertex): RoofVertex {
  const l=length(v); return l<EPS ? {x:0,y:0,z:0} : {x:v.x/l,y:v.y/l,z:v.z/l};
}
function dot(a: RoofVertex,b: RoofVertex): number { return a.x*b.x+a.y*b.y+a.z*b.z; }
function canonical(v: RoofVertex): RoofVertex { return v.z < 0 ? {x:-v.x,y:-v.y,z:-v.z} : v; }
function round(n:number, digits=6): number { const p=10**digits; return Math.round(n*p)/p; }

export function roofPlaneOrientation(input: RoofVertex) {
  const n=canonical(normalize(input));
  const pitchDeg=Math.acos(Math.min(1,Math.max(-1,n.z)))*180/Math.PI;
  let azimuthDeg=(Math.atan2(n.x,n.y)*180/Math.PI+360)%360;
  if (Math.abs(azimuthDeg-360)<1e-9) azimuthDeg=0;
  return { pitchDeg, azimuthDeg };
}

export function extractRoofPlanes(mesh: RoofMesh, options: PlaneExtractionOptions = {}): RoofPlane[] {
  const minArea=options.minAreaM2 ?? 0.01;
  const tolerance=options.normalTolerance ?? 1e-3;
  const valid: { index:number; area:number; normal:RoofVertex; vertices:number[] }[]=[];

  mesh.triangles.forEach((t,index)=>{
    const a=mesh.vertices[t.a], b=mesh.vertices[t.b], c=mesh.vertices[t.c];
    if (!a || !b || !c) return;
    const cr=cross(sub(b,a),sub(c,a));
    const area=length(cr)/2;
    if (area < minArea) return;
    valid.push({index,area,normal:canonical(normalize(cr)),vertices:[t.a,t.b,t.c]});
  });

  const groups: typeof valid[]=[];
  for (const tri of valid) {
    let group=groups.find(g => dot(g[0].normal,tri.normal) >= 1-tolerance);
    if (!group) { group=[]; groups.push(group); }
    group.push(tri);
  }

  return groups.map((group,i)=>{
    const totalArea=group.reduce((s,t)=>s+t.area,0);
    const weighted=normalize(group.reduce((n,t)=>({x:n.x+t.normal.x*t.area,y:n.y+t.normal.y*t.area,z:n.z+t.normal.z*t.area}),{x:0,y:0,z:0}));
    const normal=canonical(weighted);
    const orientation=roofPlaneOrientation(normal);
    const triangleIndices=group.map(t=>t.index).sort((a,b)=>a-b);
    const vertexIndices=[...new Set(group.flatMap(t=>t.vertices))].sort((a,b)=>a-b);
    const id=`plane-${i}-${triangleIndices.join('-')}`;
    return {id,areaM2:round(totalArea),normal,pitchDeg:orientation.pitchDeg,azimuthDeg:orientation.azimuthDeg,triangleIndices,vertexIndices};
  }).sort((a,b)=>a.triangleIndices[0]-b.triangleIndices[0]);
}
