const length = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const same = (a,b) => length(a,b)<1e-7;
function simplify(points) {
  const result=[];
  for(const point of points){
    if(result.length&&same(point,result.at(-1)))continue;
    while(result.length>1){
      const a=result.at(-2),b=result.at(-1);
      if(Math.abs((b.x-a.x)*(point.z-b.z)-(b.z-a.z)*(point.x-b.x))>1e-7)break;
      result.pop();
    }
    if(!result.length||!same(point,result.at(-1)))result.push(point);
  }
  return result;
}

// Clip each ink interval to its original straight segment. A dash may bend, but
// never shortcuts the corner; the renderer joins its pieces with a small sphere.
export function routePrimitives(input,dashed=false) {
  const points=simplify(input);
  if(points.length<2)return {segments:[],joints:[],arrow:null};
  const tip=points.at(-1),before=points.at(-2),tailLength=length(tip,before);
  const arrowLength=Math.min(.44,tailLength*.8);
  const direction={x:(tip.x-before.x)/tailLength,y:0,z:(tip.z-before.z)/tailLength};
  const center={x:tip.x-direction.x*arrowLength/2,y:tip.y,z:tip.z-direction.z*arrowLength/2};
  const spans=[];let total=0;
  for(let i=1;i<points.length;i++){
    const size=length(points[i-1],points[i]);
    spans.push({from:points[i-1],to:points[i],start:total,end:total+size,size});total+=size;
  }
  const end=total-arrowLength,intervals=[];
  if(dashed){
    for(let start=0;start<end;start+=.47)intervals.push([start,Math.min(end,start+.3)]);
    // A short collar meets the cone base even when the last dash would end in a gap.
    const collar=Math.max(0,end-.12),last=intervals.at(-1);
    if(last&&last[1]>=collar)last[1]=end;else intervals.push([collar,end]);
  }else intervals.push([0,end]);
  const segments=[],joints=[];
  const at=(span,distance)=>{
    if(Math.abs(distance-span.start)<1e-7)return {...span.from};
    if(Math.abs(distance-span.end)<1e-7)return {...span.to};
    const t=(distance-span.start)/span.size;
    return {x:span.from.x+(span.to.x-span.from.x)*t,y:span.from.y,z:span.from.z+(span.to.z-span.from.z)*t};
  };
  for(const [start,finish] of intervals)for(const span of spans){
    const a=Math.max(start,span.start),b=Math.min(finish,span.end);
    if(b-a>1e-7)segments.push({from:at(span,a),to:at(span,b)});
    if(span.end>start+1e-7&&span.end<finish-1e-7)joints.push({...span.to});
  }
  return {segments,joints,arrow:{tip:{...tip},center,direction,length:arrowLength,radius:Math.min(.24,arrowLength*.55)}};
}
export function segmentHitsBox(a,b,box) {
  if(Math.abs(a.x-b.x)<1e-7)return a.x>box.minX&&a.x<box.maxX&&Math.max(a.z,b.z)>box.minZ&&Math.min(a.z,b.z)<box.maxZ;
  if(Math.abs(a.z-b.z)<1e-7)return a.z>box.minZ&&a.z<box.maxZ&&Math.max(a.x,b.x)>box.minX&&Math.min(a.x,b.x)<box.maxX;
  return true;
}
function ports(point) {
  return [[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>({
    point:{x:point.x+x*1.62,z:point.z+z*1.62},stub:{x:point.x+x*2.02,z:point.z+z*2.02},
  }));
}
function sharedLength(a,b,c,d) {
  if(Math.abs(a.x-b.x)<1e-7&&Math.abs(c.x-d.x)<1e-7&&Math.abs(a.x-c.x)<1e-7)
    return Math.max(0,Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z))-Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z)));
  if(Math.abs(a.z-b.z)<1e-7&&Math.abs(c.z-d.z)<1e-7&&Math.abs(a.z-c.z)<1e-7)
    return Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));
  return 0;
}

// A small finite set of port/L/Z corridors, not a graph-layout engine.
export function routeEdges(edges,positions) {
  const boxes=[...positions.values()].map(p=>({minX:p.x-1.5,maxX:p.x+1.5,minZ:p.z-1.5,maxZ:p.z+1.5}));
  const xs=[...new Set([...positions.values()].flatMap(p=>[p.x-1.72,p.x+1.72]))];
  const zs=[...new Set([...positions.values()].flatMap(p=>[p.z-1.72,p.z+1.72]))];
  const used=[];
  return edges.map(edge=>{
    let best=null,bestScore=Infinity;
    for(const start of ports(positions.get(edge.from)))for(const end of ports(positions.get(edge.to))){
      if(same(start.point,end.point))continue;
      const a=start.stub,b=end.stub;
      const candidates=[
        [a,{x:b.x,z:a.z},b],[a,{x:a.x,z:b.z},b],
        ...xs.map(x=>[a,{x,z:a.z},{x,z:b.z},b]),
        ...zs.map(z=>[a,{x:a.x,z},{x:b.x,z},b]),
      ];
      for(const candidate of candidates){
        const points=simplify([start.point,...candidate,end.point]);
        // Leave enough final straight track for an arrow instead of a tiny stub.
        if(points.length<2||length(points.at(-2),points.at(-1))<.31)continue;
        let score=points.length*.1,blocked=false;
        for(let i=1;i<points.length;i++){
          const a=points[i-1],b=points[i];
          if(boxes.some(box=>segmentHitsBox(a,b,box))){blocked=true;break;}
          score+=length(a,b);
          for(const [c,d] of used)score+=sharedLength(a,b,c,d)*4;
        }
        if(!blocked&&score<bestScore){best=points;bestScore=score;}
      }
    }
    const raised=!best;
    if(!best){
      const start=ports(positions.get(edge.from))[0],end=ports(positions.get(edge.to))[0],x=Math.max(...xs)+1;
      best=simplify([start.point,start.stub,{x,z:start.stub.z},{x,z:end.stub.z},end.stub,end.point]);
    }
    const overlap=points=>points.slice(1).reduce((sum,b,i)=>sum+used.reduce((n,[c,d])=>n+sharedLength(points[i],b,c,d),0),0);
    if(!raised&&overlap(best)>1e-7){
      const normals=best.slice(1).map((b,i)=>{const a=best[i],size=length(a,b);return{x:-(b.z-a.z)/size,z:(b.x-a.x)/size};});
      // A bounded parallel lane keeps port height and endpoint direction intact.
      // If nearby platforms leave no room, retain the authored corridor.
      for(const offset of [.5,-.5]){
        const shifted=best.map((p,i)=>{const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)];return{x:p.x+offset*(i&&i<best.length-1?a.x+b.x:a.x),z:p.z+offset*(i&&i<best.length-1?a.z+b.z:a.z)};});
        if(shifted.slice(1).some((b,i)=>boxes.some(box=>segmentHitsBox(shifted[i],b,box))))continue;
        const tail=shifted.at(-1),before=shifted.at(-2),dest=positions.get(edge.to),head=shifted[0],after=shifted[1],source=positions.get(edge.from);
        if(length(tail,before)<.31||(tail.x-before.x)*(dest.x-tail.x)+(tail.z-before.z)*(dest.z-tail.z)<=0||(after.x-head.x)*(head.x-source.x)+(after.z-head.z)*(head.z-source.z)<=0)continue;
        if(overlap(shifted)<1e-7){best=shifted;break;}
      }
    }
    let longest=0,label=best[0];
    for(let i=1;i<best.length;i++){
      const a=best[i-1],b=best[i],distance=length(a,b);used.push([a,b]);
      if(distance>longest){longest=distance;label={x:(a.x+b.x)/2,z:(a.z+b.z)/2};}
    }
    return {edge,raised,points:best.map(p=>({...p,y:raised?2.15:1.03})),label:{...label,y:raised?2.9:1.75}};
  });
}
