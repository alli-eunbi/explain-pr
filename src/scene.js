import * as THREE from 'three';
import { t } from './i18n.js';
export const available = true;
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { followCameraOffset, followCameraTarget, FOLLOW_VIEW_HEIGHT, FOLLOW_FOV, travelHeading, arrivalHeading } from './chase-camera.js';
import { placeLabel, labelWidth } from './label-layout.js';
import { routeEdges, routePrimitives } from './edge-routing.js';

const STYLE = `
.logic-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.node-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.node-overlay{position:absolute;left:0;top:0;width:136px;padding:5px 4px 7px!important;border:0!important;box-shadow:none!important;background:none!important;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;color:#27344b;text-align:center;line-height:1.3;border-radius:10px;font-family:inherit;transition:color .15s;touch-action:manipulation}
.node-overlay:hover{background:#ffffff66!important}.node-overlay:focus-visible{outline:3px solid #d79a24!important;outline-offset:4px!important;background:#ffffffb8!important}
.node-overlay .step-number{color:inherit;display:block;font-size:25px;font-weight:750;letter-spacing:-.8px;line-height:1.05;margin-bottom:5px;font-variant-numeric:tabular-nums}
.node-overlay .step-title{display:block;font-size:14px;font-weight:720;line-height:1.4;white-space:normal;word-break:keep-all;overflow-wrap:anywhere}
.node-overlay .step-note{display:block;font-size:11px;color:#77828e;margin-top:5px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}
.node-overlay.selected{color:white;text-shadow:0 1px 2px #00727b35}.node-overlay.selected .step-note{color:#daffff}.node-overlay.branch .step-number{color:#a47126}.node-overlay.selected.branch .step-number{color:white}
.node-overlay .step-alert{position:absolute;top:-11px;right:6px;display:grid;place-items:center;width:23px;height:23px;background:#e4a32d;color:white;border:3px solid #fff8e8;border-radius:50%;font-size:14px;font-weight:800;box-shadow:0 3px 5px #a8781930}
.edge-overlay{position:absolute;pointer-events:auto;font-family:inherit;font-size:12px;font-weight:650;line-height:1.4;color:#075f72;background:#f5fffff5;border:1px solid #1490a1;padding:5px 7px;border-radius:7px;transform:translate(-50%,-50%);text-align:center;white-space:normal;overflow-wrap:anywhere;word-break:keep-all;z-index:3}.edge-overlay.failure{color:#9a510a;background:#fff8ebf5;border-color:#cd781c}.edge-overlay small{display:block;font-size:10px;line-height:1.3;opacity:.8;margin-top:3px}
.node-overlay.route-preview:not(.selected){outline:2px dashed #0b909b!important;outline-offset:5px!important}.edge-overlay.route-preview{color:#fff;background:#087d87;box-shadow:0 0 0 2px #ffffffc9}.edge-overlay.failure.route-preview{background:#a76c14}
.node-overlay.label-offset{background:#fffffff0!important;box-shadow:0 3px 10px #183b4318!important;color:#27344b;text-shadow:none}.node-overlay.label-offset.selected{background:#087d87f5!important;color:white}.node-label-leader{position:absolute;height:2px;background:#08929ba8;transform-origin:0 50%;pointer-events:none;z-index:1}
.compact .node-overlay .step-title,.compact .node-overlay .step-note,.node-overlay.compact .step-title,.node-overlay.compact .step-note{display:none!important}.compact .node-overlay .step-number,.node-overlay.compact .step-number{font-size:20px}.compact .node-overlay .step-alert{top:-8px;right:-5px;width:18px;height:18px;font-size:11px}.compact .actor-label{font-size:10px;padding:5px 8px}.actor-label{position:absolute;left:0;top:0;pointer-events:none;transform:translate(-50%,-100%);background:linear-gradient(140deg,#029ba5,#08757e);border:1px solid #008b97;color:white;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:750;line-height:1.2;white-space:nowrap;box-shadow:0 5px 12px #08798025}.actor-label:after{content:'';position:absolute;bottom:-5px;left:calc(50% - 5px);width:9px;height:9px;background:#087c85;transform:rotate(45deg);border-radius:1px}
.scene-pan-help{position:absolute;left:21px;bottom:157px;pointer-events:none;font-family:inherit;font-size:11px;line-height:1.5;color:#8a989c;max-width:300px}.scene-fallback-note{position:absolute;left:20px;right:20px;top:15px;color:#75838d;font-size:12px;text-align:center}.node-layer.fallback{height:auto!important;inset:65px 18px 160px;display:flex;flex-wrap:wrap;align-content:flex-start;gap:20px;overflow:auto;pointer-events:auto}.fallback .node-overlay{position:relative!important;transform:none!important;left:auto!important;top:auto!important;flex:0 0 145px;min-height:120px;background:#fff!important;box-shadow:0 12px 25px #193f3c12!important;border:1px solid #dfebeb!important;padding:18px!important}.fallback .node-overlay.selected{background:#078b97!important}.fallback .edge-overlay{display:none}
@media(max-width:600px){.node-overlay{width:118px}.node-overlay .step-number{font-size:22px}.node-overlay .step-title{font-size:13px}.node-overlay .step-note{font-size:10px}.scene-pan-help{left:15px;bottom:166px;max-width:190px;font-size:10px}.actor-label{font-size:11px;padding:6px 9px}}
@media(prefers-reduced-motion:reduce){.node-overlay{transition:none}}
@media(max-width:600px){.following:not(.fallback) .node-overlay .step-note{display:none}}
`;

function textElement(tag, className, text) {
  const element=document.createElement(tag);element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}

// The normal spine only determines spatial placement. The app, never this
// renderer, decides whether an edge may be followed and owns navigation history.
export function layout(flow) {
  const positions=new Map(),spine=[],seen=new Set();let id=flow.entry;
  while(id&&!seen.has(id)){
    spine.push(id);seen.add(id);
    id=flow.edges.find(edge=>edge.from===id&&edge.kind==='normal'&&!seen.has(edge.to))?.to;
  }
  spine.forEach((nodeId,index)=>positions.set(nodeId,new THREE.Vector3(index*3.65,0,0)));
  const pending=flow.nodes.filter(n=>!seen.has(n.id));
  let lane=0;
  // Parents already placed keep their child branches close. Defer remaining
  // nodes until their parent is placed; the fallback also accommodates cycles.
  while(pending.length){
    let index=pending.findIndex(n=>flow.edges.some(e=>e.to===n.id&&positions.has(e.from)));
    if(index<0)index=0;
    const n=pending.splice(index,1)[0];
    const edge=flow.edges.find(e=>e.to===n.id&&positions.has(e.from));
    const parent=edge?positions.get(edge.from):new THREE.Vector3(lane++*3.65,0,0);
    let p=parent.clone().add(new THREE.Vector3(.8,0,3.65));
    while([...positions.values()].some(v=>Math.abs(v.x-p.x)<3.3&&Math.abs(v.z-p.z)<3.3))p.z+=3.65;
    positions.set(n.id,p);
  }
  return {positions,spine:new Set(spine)};
}

export function createScene({container,onInspect,reducedMotion=false}) {
  const style=textElement('style','',STYLE);container.append(style);
  const canvas=document.createElement('canvas');canvas.id='scene';canvas.className='logic-canvas';canvas.setAttribute('aria-label',t('scene.aria'));canvas.tabIndex=0;container.append(canvas);
  const layer=textElement('div','node-layer');container.append(layer);
  const actorLabel=textElement('div','actor-label',t('scene.actor'));actorLabel.hidden=true;layer.append(actorLabel);
  const panHelp=textElement('div','scene-pan-help',t('scene.panHelp'));container.append(panHelp);
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOff=()=>reducedMotion||media.matches;
  let renderer=null,destroyed=false,frame=0,animation=null,flow=null,selected=null,mode='overview';
  let positions=new Map(),spine=new Set(),platforms=new Map(),overlays=new Map(),edgeObjects=[];
  const labelLeaders=new Map();
  let preview=null,walkedEdges=[];
  let cameraHeading=0,routeSignature='';
  const flowGeometries=new Set(),flowMaterials=new Set();
  let mapGroup=null,robot=null,robotShadow=null,robotParts=null,fitHeight=12,viewHeight=12,zoom=1,needsPan=false;
  let width=1,height=1,usableHeight=1,safeBottom=140;
  const overviewDirection=new THREE.Vector3(-11,14,12).normalize();
  const followDirection=new THREE.Vector3().copy(followCameraOffset(1));
  const cameraDirection=followDirection.clone();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),cameraDirection).normalize();
  const up=new THREE.Vector3().crossVectors(cameraDirection,right).normalize();
  const target=new THREE.Vector3(),homeTarget=new THREE.Vector3();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#fafbf9');
  const overviewCamera=new THREE.OrthographicCamera(-10,10,10,-10,.1,250);
  const followCamera=new THREE.PerspectiveCamera(FOLLOW_FOV,1,.1,250);
  let camera=overviewCamera;
  const disposableGeometries=new Set(),disposableMaterials=new Set(),disposableTextures=new Set();
  function geometry(g){disposableGeometries.add(g);return g;}
  function material(m){disposableMaterials.add(m);return m;}
  const white=material(new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.32,metalness:0,clearcoat:.4,clearcoatRoughness:.22}));
  const pale=material(new THREE.MeshPhysicalMaterial({color:'#c0e8e5',roughness:.4,metalness:.025,clearcoat:.3}));
  const teal=material(new THREE.MeshPhysicalMaterial({color:'#007480',roughness:.44,metalness:.06,clearcoat:.22,clearcoatRoughness:.35}));
  const cream=material(new THREE.MeshPhysicalMaterial({color:'#fff0d3',roughness:.4,clearcoat:.4}));
  const previewTeal=material(new THREE.MeshPhysicalMaterial({color:'#62d6ce',roughness:.4,clearcoat:.4}));
  const previewAmber=material(new THREE.MeshPhysicalMaterial({color:'#ffc967',roughness:.4,clearcoat:.4}));
  const footMaterial=material(new THREE.MeshStandardMaterial({color:'#d6d9d3',roughness:.75}));
  const trimMaterial=material(new THREE.MeshStandardMaterial({color:'#89ccc7',roughness:.5}));
  const edgeTeal=material(new THREE.MeshPhysicalMaterial({color:'#008e98',roughness:.36,clearcoat:.35}));
  const edgeMuted=material(new THREE.MeshStandardMaterial({color:'#087e95',roughness:.4}));
  const edgeAmber=material(new THREE.MeshPhysicalMaterial({color:'#d77b16',roughness:.35,clearcoat:.4}));
  const stageGeometry=geometry(new RoundedBoxGeometry(2.8,.72,2.8,4,.19));
  const baseGeometry=geometry(new RoundedBoxGeometry(2.79,.38,2.79,3,.14));
  const trimGeometry=geometry(new RoundedBoxGeometry(2.805,.4,2.805,3,.13));
  const planeGeometry=geometry(new THREE.PlaneGeometry(1,1));
  const sphereGeometry=geometry(new THREE.SphereGeometry(1,24,18));
  const routeCylinderGeometry=geometry(new THREE.CylinderGeometry(1,1,1,10));
  const routeJointGeometry=geometry(new THREE.SphereGeometry(1,10,8));
  const routeArrowGeometry=geometry(new THREE.ConeGeometry(1,1,12));
  const limbGeometry=geometry(new THREE.CapsuleGeometry(.11,.23,5,10));
  const contactCanvas=document.createElement('canvas');contactCanvas.width=128;contactCanvas.height=128;
  const context=contactCanvas.getContext('2d');const gradient=context.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(53,74,72,.48)');gradient.addColorStop(.45,'rgba(53,74,72,.25)');gradient.addColorStop(1,'rgba(53,74,72,0)');context.fillStyle=gradient;context.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(contactCanvas);disposableTextures.add(shadowTexture);
  const contactMaterial=material(new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.8}));

  try {
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    container.dataset.renderer='webgl';
  } catch {
    container.dataset.renderer='fallback';canvas.hidden=true;layer.classList.add('fallback');panHelp.hidden=true;
    container.append(textElement('p','scene-fallback-note',t('scene.fallback')));
  }
  const ambient=new THREE.HemisphereLight('#ffffff','#c4d3d0',1.65);scene.add(ambient);
  const key=new THREE.DirectionalLight('#fff8eb',2.55);key.position.set(-8,18,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0003;key.shadow.normalBias=.04;key.shadow.radius=4;key.shadow.camera.near=.5;key.shadow.camera.far=80;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight('#d9ffff',.65);fill.position.set(8,7,-8);scene.add(fill);
  const ground=new THREE.Mesh(geometry(new THREE.PlaneGeometry(250,250)),material(new THREE.MeshStandardMaterial({color:'#fafbf8',roughness:.88,metalness:0})));ground.rotation.x=-Math.PI/2;ground.position.y=-.018;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(180,120,'#eef0eb','#eef0eb');grid.position.y=-.012;grid.material.transparent=true;grid.material.opacity=.6;scene.add(grid);
  disposableGeometries.add(grid.geometry);disposableMaterials.add(grid.material);

  function mesh(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function sphere(parent,m,x,y,z,sx,sy=sx,sz=sx){const o=mesh(sphereGeometry,m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
  function makeRobot(){
    const beforeGeometry=new Set(disposableGeometries),beforeMaterial=new Set(disposableMaterials);
    const group=new THREE.Group();group.rotation.y=-.38;
    const shell=material(new THREE.MeshPhysicalMaterial({color:'#fcffff',roughness:.28,clearcoat:.7}));
    const dark=material(new THREE.MeshPhysicalMaterial({color:'#133d49',roughness:.2,clearcoat:.8}));
    const accent=material(new THREE.MeshPhysicalMaterial({color:'#23b8bb',roughness:.24,clearcoat:.6}));
    const joint=material(new THREE.MeshStandardMaterial({color:'#8ca8ac',roughness:.6}));
    const eye=material(new THREE.MeshStandardMaterial({color:'#8afff6',emissive:'#45e4e7',emissiveIntensity:.8,roughness:.3}));
    const torso=mesh(geometry(new RoundedBoxGeometry(.52,.54,.39,3,.15)),shell,group,0,.78,0);
    mesh(geometry(new RoundedBoxGeometry(.38,.39,.2,3,.085)),accent,group,0,.82,-.27);
    sphere(group,joint,0,1.06,0,.15,.12,.15);
    sphere(group,shell,0,1.36,.025,.55,.45,.46);
    const face=mesh(geometry(new RoundedBoxGeometry(.75,.4,.12,4,.14)),dark,group,0,1.35,.435);face.rotation.x=-.08;
    sphere(group,eye,-.17,1.38,.508,.092,.106,.033);sphere(group,eye,.17,1.38,.508,.092,.106,.033);
    const cheek=material(new THREE.MeshStandardMaterial({color:'#ffbfc9',emissive:'#ff6d96',emissiveIntensity:.5,roughness:.45}));
    sphere(group,cheek,-.3,1.23,.498,.07,.04,.025);sphere(group,cheek,.3,1.23,.498,.07,.04,.025);
    sphere(group,accent,-.525,1.36,.02,.095,.19,.19);sphere(group,accent,.525,1.36,.02,.095,.19,.19);
    sphere(group,eye,-.57,1.36,.035,.053,.105,.105);sphere(group,eye,.57,1.36,.035,.053,.105,.105);
    const antenna=mesh(geometry(new THREE.CylinderGeometry(.022,.022,.14,8)),accent,group,-.13,1.84,-.06);sphere(group,eye,-.13,1.93,-.06,.065);
    const legs=[],arms=[];
    for(const sign of [-1,1]){
      const leg=new THREE.Group();leg.position.set(sign*.15,.45,0);group.add(leg);
      sphere(leg,joint,0,-.015,0,.105);const shin=mesh(limbGeometry,shell,leg,0,-.17,.015);shin.scale.y=.7;sphere(leg,shell,0,-.34,.1,.16,.11,.23);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(sign*.32,.98,0);arm.rotation.z=sign*.29;group.add(arm);
      sphere(arm,joint,0,0,0,.1);const sleeve=mesh(limbGeometry,shell,arm,0,-.16,0);sleeve.scale.y=.65;sphere(arm,accent,0,-.3,.045,.13,.13,.13);arms.push(arm);
    }
    sphere(group,accent,0,.84,.211,.065,.045,.023);
    group.scale.setScalar(1.3);robotParts={legs,arms,torso,antenna};
    for(const g of disposableGeometries)if(!beforeGeometry.has(g))flowGeometries.add(g);
    for(const m of disposableMaterials)if(!beforeMaterial.has(m))flowMaterials.add(m);
    return group;
  }

  function clearMap(){
    stop();if(mapGroup){scene.remove(mapGroup);mapGroup.traverse(o=>{if(o.userData.ownedGeometry){o.geometry.dispose();disposableGeometries.delete(o.geometry);}});}
    for(const g of flowGeometries){g.dispose();disposableGeometries.delete(g);}flowGeometries.clear();
    for(const m of flowMaterials){m.dispose();disposableMaterials.delete(m);}flowMaterials.clear();
    platforms.clear();overlays.clear();labelLeaders.clear();edgeObjects=[];layer.replaceChildren(actorLabel);actorLabel.hidden=true;
    robot=null;robotShadow=null;robotParts=null;selected=null;preview=null;walkedEdges=[];cameraHeading=0;routeSignature='';container.dataset.previewNode='';
  }
  function addOverlay(n,index,isBranch){
    const leader=textElement('span','node-label-leader');leader.hidden=true;layer.append(leader);labelLeaders.set(n.id,leader);
    const button=textElement('button','node-overlay'+(isBranch?' branch':''));button.type='button';button.dataset.node=n.id;
    button.setAttribute('aria-label',`${index+1}. ${n.title}${n.changed===true?t('scene.changedSuffix'):n.changed===null?t('scene.unknownSuffix'):''}`);button.setAttribute('aria-pressed','false');
    button.title=n.title;button.append(textElement('span','step-number',String(index+1).padStart(2,'0')),textElement('span','step-title',n.title),textElement('span','step-note',n.changed===true?t('scene.changedLogic'):n.changed===null?t('scene.unknownLogic'):t('scene.existingLogic')));
    if(flow.findings.some(f=>f.nodeId===n.id))button.append(textElement('span','step-alert','!'));
    button.addEventListener('click',()=>onInspect(n.id));
    button.addEventListener('focus',()=>{if(renderer&&needsPan&&selected!==n.id){target.copy(positions.get(n.id));target.y=.8;updateCamera();render();}});
    layer.append(button);overlays.set(n.id,button);
  }
  function bridge(route,index){
    const {edge}=route,failure=edge.kind==='failure',group=new THREE.Group();mapGroup.add(group);
    const points=route.points.map(p=>new THREE.Vector3(p.x,p.y,p.z));
    const mat=failure?edgeAmber:edgeMuted,radius=failure?.1:.13;
    const pieces=[],shape=routePrimitives(route.points,failure),upAxis=new THREE.Vector3(0,1,0);
    for(const segment of shape.segments){
      const a=new THREE.Vector3().copy(segment.from),b=new THREE.Vector3().copy(segment.to),direction=b.clone().sub(a);
      const tube=mesh(routeCylinderGeometry,mat,group);tube.position.copy(a).add(b).multiplyScalar(.5);
      tube.scale.set(radius,direction.length(),radius);tube.quaternion.setFromUnitVectors(upAxis,direction.normalize());pieces.push(tube);
    }
    for(const point of shape.joints){const joint=mesh(routeJointGeometry,mat,group);joint.position.copy(point);joint.scale.setScalar(radius);pieces.push(joint);}
    if(shape.arrow){const arrow=mesh(routeArrowGeometry,mat,group);arrow.position.copy(shape.arrow.center);arrow.scale.set(shape.arrow.radius,shape.arrow.length,shape.arrow.radius);arrow.quaternion.setFromUnitVectors(upAxis,new THREE.Vector3().copy(shape.arrow.direction));pieces.push(arrow);}
    const label=textElement('div','edge-overlay'+(failure?' failure':''),edge.label);label.title=edge.label;label.dataset.from=edge.from;
    const number=id=>String(flow.nodes.findIndex(node=>node.id===id)+1).padStart(2,'0');
    label.append(textElement('small','',`${number(edge.from)} → ${number(edge.to)}${failure?t('scene.failureSuffix'):''}`));layer.append(label);
    const leader=textElement('span','node-label-leader');leader.hidden=true;leader.style.background=failure?'#cd781c':'#087e95';layer.append(leader);
    const labelPosition=new THREE.Vector3(route.label.x,route.label.y,route.label.z);
    edgeObjects.push({edge,pieces,label,leader,labelPosition,points,index});
  }
  function setFlow(nextFlow){
    if(destroyed)return;clearMap();flow=nextFlow;container.dataset.currentNode='';
    ({positions,spine}=layout(flow));mapGroup=new THREE.Group();scene.add(mapGroup);
    flow.nodes.forEach((n,index)=>{
      const position=positions.get(n.id),branch=!spine.has(n.id),group=new THREE.Group();group.position.copy(position);mapGroup.add(group);
      const foot=mesh(baseGeometry,footMaterial,group,0,.21,0);
      mesh(trimGeometry,branch?cream:trimMaterial,group,0,.56,0);
      const normalMaterial=branch?cream:n.changed===true?pale:white;
      const top=mesh(stageGeometry,normalMaterial,group,0,.99,0);
      const contact=mesh(planeGeometry,contactMaterial,group,0,.002,.1);contact.rotation.x=-Math.PI/2;contact.scale.set(4.4,4.4,1);contact.castShadow=false;contact.receiveShadow=false;
      platforms.set(n.id,{group,top,foot,normalMaterial});addOverlay(n,index,branch);
    });
    routeEdges(flow.edges,positions).forEach(bridge);
    if(flow.nodes.length){robot=makeRobot();mapGroup.add(robot);robot.visible=false;robotShadow=mesh(planeGeometry,contactMaterial,mapGroup);robotShadow.rotation.x=-Math.PI/2;robotShadow.scale.set(1.3,1.3,1);robotShadow.castShadow=false;robotShadow.receiveShadow=false;robotShadow.visible=false;}
    panHelp.hidden=!renderer||!flow.nodes.length;
    resize();zoom=1;frameMap();updateCamera();render();
  }

  function mapBounds(){
    const box=new THREE.Box3();for(const p of positions.values()){box.expandByPoint(p.clone().add(new THREE.Vector3(-1.6,0,-1.6)));box.expandByPoint(p.clone().add(new THREE.Vector3(1.6,3.55,1.6)));}for(const edge of edgeObjects)for(const point of edge.points)box.expandByPoint(point);return box;
  }
  function cameraBasis(){
    cameraDirection.copy(mode==='follow'?followDirection:overviewDirection);
    right.crossVectors(new THREE.Vector3(0,1,0),cameraDirection).normalize();
    up.crossVectors(cameraDirection,right).normalize();
  }
  function followTarget(nodeId){
    return new THREE.Vector3().copy(followCameraTarget(positions.get(nodeId)));
  }
  function heading(nodeId,previous){
    if(previous===nodeId)return cameraHeading;
    const travel=previous?travelHeading(positions.get(previous),positions.get(nodeId),cameraHeading):cameraHeading;
    const next=flow.edges.filter(edge=>edge.from===nodeId&&edge.to!==nodeId).map(edge=>positions.get(edge.to));
    return arrivalHeading(positions.get(nodeId),next,travel);
  }
  function frameMap(){
    if(!positions.size)return;cameraBasis();
    const box=mapBounds(),center=box.getCenter(new THREE.Vector3());
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const point of positions.values())for(const x of [-1.6,1.6])for(const y of [0,3.55])for(const z of [-1.6,1.6]){const v=point.clone().add(new THREE.Vector3(x,y,z)).sub(center),px=v.dot(right),py=v.dot(up);minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
    for(const edge of edgeObjects)for(const point of [...edge.points,edge.labelPosition]){const v=point.clone().sub(center);minX=Math.min(minX,v.dot(right));maxX=Math.max(maxX,v.dot(right));minY=Math.min(minY,v.dot(up));maxY=Math.max(maxY,v.dot(up));}
    fitHeight=Math.max(maxY-minY+.7,(maxX-minX+1.3)/(width/usableHeight));
    // On large reports keep physical tiles and HTML titles readable. Panning
    // and keyboard focus reveal offscreen parts without dropping any node.
    const readableHeight=usableHeight*2.5/108;
    const readableView=Math.max(7.5,readableHeight);needsPan=fitHeight>readableView+1&&(flow.nodes.length>8||width<620);
    viewHeight=mode==='follow'?FOLLOW_VIEW_HEIGHT:fitHeight;
    if(mode==='follow')needsPan=true;
    homeTarget.copy(center).addScaledVector(right,(minX+maxX)/2).addScaledVector(up,(minY+maxY)/2);target.copy(homeTarget);
    if(mode==='follow'&&positions.has(selected||flow.entry))target.copy(followTarget(selected||flow.entry));
    panHelp.textContent=mode==='follow'?t('scene.panFollow'):t('scene.panHelp');
    const radius=Math.min(50,Math.max(13,box.getSize(new THREE.Vector3()).length()));key.position.copy(center).add(new THREE.Vector3(-8,18,7));key.target.position.copy(center);key.shadow.camera.left=-radius;key.shadow.camera.right=radius;key.shadow.camera.top=radius;key.shadow.camera.bottom=-radius;key.shadow.camera.updateProjectionMatrix();
  }
  function updateCamera(){
    const aspect=width/usableHeight;cameraBasis();
    camera=mode==='follow'?followCamera:overviewCamera;
    if(mode==='follow')camera.aspect=aspect;
    else{camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;}
    const distance=mode==='follow'?viewHeight/(2*Math.tan(THREE.MathUtils.degToRad(followCamera.fov/2))):45;
    camera.zoom=zoom;camera.position.copy(target).addScaledVector(cameraDirection,distance);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    container.dataset.cameraMode=mode;container.dataset.cameraPitch=String(THREE.MathUtils.radToDeg(Math.atan2(cameraDirection.y,Math.hypot(cameraDirection.x,cameraDirection.z))));
    container.dataset.cameraHeading=String(Math.atan2(cameraDirection.x,cameraDirection.z));
    container.dataset.cameraPosition=JSON.stringify(camera.position.toArray());
    container.dataset.robotPosition=robot?JSON.stringify(robot.position.toArray()):'';
    container.dataset.robotHeading=robot?String(robot.rotation.y):'';
  }
  function project(point){const v=point.clone().project(camera);return {x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*usableHeight,visible:[v.x,v.y,v.z].every(Number.isFinite)&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z>=-1&&v.z<=1};}
  function getRoutes(){
    if(!flow||!selected)return [];
    const screen=id=>{
      if(renderer&&!canvas.hidden)return project(positions.get(id).clone().add(new THREE.Vector3(.17,1.37,.27)));
      const bounds=overlays.get(id).getBoundingClientRect();return {x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,visible:true};
    };
    const origin=screen(selected);
    return flow.edges.filter(edge=>edge.from===selected).map(edge=>{const point=screen(edge.to);return {edge,x:point.x-origin.x,y:point.y-origin.y,visible:origin.visible&&point.visible};});
  }
  function notifyRoutes(){
    const routes=getRoutes(),signature=mode+selected+JSON.stringify(routes.map(route=>[flow.edges.indexOf(route.edge),Math.round(route.x),Math.round(route.y),route.visible]));
    container.dataset.routes=JSON.stringify(routes.map(route=>({to:route.edge.to,label:route.edge.label,x:route.x,y:route.y,visible:route.visible})));
    if(signature===routeSignature)return;routeSignature=signature;
    container.dispatchEvent(new Event('routeschange'));
  }
  function updateLabels(){
    if(!renderer||canvas.hidden||!flow)return;
    layer.classList.remove('compact');
    layer.classList.toggle('following',mode==='follow');
    const near=new Set([selected,...flow.edges.filter(edge=>edge.from===selected).map(edge=>edge.to)]);
    const dock=container.parentElement.querySelector('.navigation-dock');
    const labelHeight=Math.min(usableHeight,dock?dock.getBoundingClientRect().top-container.getBoundingClientRect().top-8:usableHeight);
    const obstacles=[];
    if(robot?.visible){
      robot.updateMatrixWorld(true);
      const head=robot.localToWorld(new THREE.Vector3(0,1.36,.025)),center=project(head);
      const radiusX=Math.abs(project(head.clone().addScaledVector(right,.85)).x-center.x);
      const radiusY=Math.abs(project(head.clone().addScaledVector(up,.85)).y-center.y);
      const foot=project(robot.position);
      const avatar={x:center.x-radiusX-8,y:center.y-radiusY-8,width:radiusX*2+16,height:Math.max(center.y+radiusY,foot.y)-center.y+radiusY+16};
      obstacles.push(avatar);container.dataset.avatarBounds=JSON.stringify(avatar);
    }else container.dataset.avatarBounds='';
    for(const [id,button] of overlays){
      const origin=positions.get(id),screen=project(origin.clone().add(new THREE.Vector3(.17,1.37,.27))),compact=mode==='follow'&&!near.has(id);
      const corners=[[-1.4,-1.4],[-1.4,1.4],[1.4,-1.4],[1.4,1.4]].map(([x,z])=>project(origin.clone().add(new THREE.Vector3(x,1.35,z))).x);
      button.classList.toggle('compact',compact);button.classList.remove('label-offset');button.style.width=(compact?42:labelWidth(Math.max(...corners)-Math.min(...corners),width))+'px';
      const w=button.offsetWidth,h=button.offsetHeight;
      const original={x:screen.x-w/2,y:screen.y-h/2,width:w,height:h};
      const placed=!compact&&screen.visible?(placeLabel(original,obstacles,{width,height:labelHeight,top:60})||original):original;
      if(!compact&&screen.visible)obstacles.push(placed);
      const offset=Math.hypot(placed.x-original.x,placed.y-original.y)>8;
      button.classList.toggle('label-offset',offset);button.style.left=placed.x+w/2+'px';button.style.top=placed.y+h/2+'px';button.style.visibility=screen.visible?'visible':'hidden';button.style.zIndex=id===selected?'5':'2';
      const leader=labelLeaders.get(id);leader.hidden=!offset||!screen.visible;
      if(!leader.hidden){const dx=placed.x+w/2-screen.x,dy=placed.y+h/2-screen.y;leader.style.left=screen.x+'px';leader.style.top=screen.y+'px';leader.style.width=Math.hypot(dx,dy)+'px';leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;}
    }
    for(const obj of edgeObjects){
      const p=project(obj.labelPosition),visible=p.visible&&(mode!=='follow'||obj.edge.from===selected);
      const projected=obj.points.map(point=>project(point).x);
      obj.label.style.width=Math.max(140,Math.min(260,labelWidth(Math.max(...projected)-Math.min(...projected),width)))+'px';
      const w=obj.label.offsetWidth,h=obj.label.offsetHeight,original={x:p.x-w/2,y:p.y-h/2,width:w,height:h};
      const placed=visible?(placeLabel(original,obstacles,{width,height:labelHeight,top:60})||original):original;
      if(visible)obstacles.push(placed);
      obj.label.style.left=placed.x+w/2+'px';obj.label.style.top=placed.y+h/2+'px';obj.label.style.visibility=visible?'visible':'hidden';
      const dx=placed.x+w/2-p.x,dy=placed.y+h/2-p.y;
      obj.leader.hidden=!visible||Math.hypot(dx,dy)<8;
      if(!obj.leader.hidden){obj.leader.style.left=p.x+'px';obj.leader.style.top=p.y+'px';obj.leader.style.width=Math.hypot(dx,dy)+'px';obj.leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;}
    }
    if(robot&&robot.visible){const p=project(robot.position.clone().add(new THREE.Vector3(0,2.72,0)));actorLabel.style.left=p.x+'px';actorLabel.style.top=p.y+'px';actorLabel.style.visibility=p.visible?'visible':'hidden';}
  }
  function render(){if(destroyed)return;if(renderer){renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);renderer.clear();renderer.setViewport(0,height-usableHeight,width,usableHeight);renderer.setScissor(0,height-usableHeight,width,usableHeight);renderer.setScissorTest(true);renderer.render(scene,camera);renderer.setScissorTest(false);updateLabels();}notifyRoutes();}
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;if(animation&&robot){robot.position.copy(animation.to);robot.rotation.z=0;robot.rotation.y=animation.headingTo;cameraHeading=animation.headingTo;target.copy(animation.cameraTo);pose(0);}animation=null;container.dataset.animating='false';}
  function pose(t){if(!robotParts)return;const sway=Math.sin(t*Math.PI)*.5;robotParts.legs[0].rotation.x=sway;robotParts.legs[1].rotation.x=sway;robotParts.arms[0].rotation.z=-.29-sway;robotParts.arms[1].rotation.z=.29+sway;const squash=t>.8?Math.sin((t-.8)*Math.PI/.2)*.14:0;robot.scale.set(1.3*(1+squash*.6),1.3*(1-squash),1.3*(1+squash*.6));}
  function robotAt(nodeId){return positions.get(nodeId).clone().add(new THREE.Vector3(-.67,1.35,-.68));}
  function tick(now){
    frame=0;if(!animation||destroyed)return;
    const t=Math.min(1,(now-animation.start)/760),ease=1-Math.pow(1-t,3);
    robot.position.lerpVectors(animation.from,animation.to,ease);robot.position.y+=Math.sin(Math.min(1,t/.84)*Math.PI)*1.1;
    robot.rotation.z=Math.sin(t*Math.PI)*-.13;robot.rotation.y=THREE.MathUtils.lerp(animation.headingFrom,animation.headingTo,ease);pose(t);
    cameraHeading=THREE.MathUtils.lerp(animation.headingFrom,animation.headingTo,ease);
    target.lerpVectors(animation.cameraFrom,animation.cameraTo,ease);updateCamera();
    robotShadow.position.set(robot.position.x,1.358,robot.position.z);robotShadow.scale.setScalar(1.2-Math.sin(t*Math.PI)*.3);
    render();
    if(t<1)frame=requestAnimationFrame(tick);else {robot.position.copy(animation.to);robot.rotation.z=0;pose(0);animation=null;container.dataset.animating='false';render();}
  }
  function select(nodeId,{animate=false,visitedIds=[],visitedEdges=[]}={}){
    if(destroyed||!positions.has(nodeId))return;
    const previous=selected;stop();selected=nodeId;preview=null;walkedEdges=visitedEdges;container.dataset.currentNode=nodeId;
    for(const [id,platform] of platforms){platform.top.material=id===nodeId?teal:platform.normalMaterial;const b=overlays.get(id);b.classList.toggle('selected',id===nodeId);b.classList.toggle('visited',visitedIds.includes(id));b.setAttribute('aria-pressed',String(id===nodeId));}
    for(const obj of edgeObjects){const walked=visitedEdges.includes(obj.edge);for(const piece of obj.pieces)piece.material=obj.edge.kind==='failure'?edgeAmber:walked?edgeTeal:edgeMuted;}
    paintPreview();
    if(!renderer)return;
    const end=robotAt(nodeId),start=previous&&robot.visible?robot.position.clone():end.clone();robot.visible=true;robotShadow.visible=true;actorLabel.hidden=false;
    const facing=heading(nodeId,previous);
    const headingTo=robot.rotation.y+Math.atan2(Math.sin(facing-robot.rotation.y),Math.cos(facing-robot.rotation.y));
    const cameraEnd=mode==='follow'?followTarget(nodeId):target.clone();
    if(animate&&previous&&!motionOff()){
      animation={start:performance.now(),from:start,to:end,cameraFrom:target.clone(),cameraTo:cameraEnd,headingFrom:robot.rotation.y,headingTo};container.dataset.animating='true';frame=requestAnimationFrame(tick);
    }else{robot.position.copy(end);robot.rotation.z=0;robot.rotation.y=headingTo;cameraHeading=headingTo;pose(0);target.copy(cameraEnd);robotShadow.position.set(end.x,1.358,end.z);robotShadow.scale.set(1.3,1.3,1);updateCamera();render();}
  }
  function paintPreview(){
    container.dataset.previewNode=preview?.to||'';
    for(const [id,button] of overlays){
      button.classList.toggle('route-preview',preview?.to===id);
      const platform=platforms.get(id);
      if(platform)platform.top.material=id===selected?teal:preview?.to===id?(preview.kind==='failure'?previewAmber:previewTeal):platform.normalMaterial;
    }
    for(const obj of edgeObjects){
      const active=obj.edge===preview;
      obj.label.classList.toggle('route-preview',active);
      for(const piece of obj.pieces)piece.material=active?(obj.edge.kind==='failure'?previewAmber:edgeTeal):obj.edge.kind==='failure'?edgeAmber:walkedEdges.includes(obj.edge)?edgeTeal:edgeMuted;
    }
  }
  function previewEdge(edge){
    const next=mode==='follow'&&edge?.from===selected&&flow?.edges.includes(edge)?edge:null;
    if(next===preview)return;
    preview=next;
    paintPreview();render();
  }
  function fit(){if(destroyed)return;stop();mode='overview';zoom=1;frameMap();updateCamera();render();}
  function setMode(next){mode=next==='overview'?'overview':'follow';stop();zoom=1;frameMap();updateCamera();render();}
  function zoomBy(factor){if(destroyed||!Number.isFinite(factor)||factor<=0)return;zoom=THREE.MathUtils.clamp(zoom*factor,.5,2.5);updateCamera();render();}
  function resize(){
    if(destroyed)return;const r=container.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);safeBottom=width<600?155:142;usableHeight=Math.max(180,height-safeBottom);
    if(renderer){renderer.setSize(width,height,false);layer.style.height=usableHeight+'px';}if(positions.size)frameMap();updateCamera();render();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  let drag=null;
  function pointerDown(event){if(event.button!==0||!renderer)return;stop();drag={x:event.clientX,y:event.clientY,target:target.clone()};canvas.setPointerCapture(event.pointerId);canvas.style.cursor='grabbing';}
  function pointerMove(event){if(!drag)return;const scale=viewHeight/(usableHeight*zoom);target.copy(drag.target).addScaledVector(right,-(event.clientX-drag.x)*scale).addScaledVector(up,(event.clientY-drag.y)*scale);updateCamera();render();}
  function pointerUp(){drag=null;canvas.style.cursor='grab';}
  function canvasKeys(event){if(mode!=='overview')return;const moves={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[event.key])return;event.preventDefault();stop();const [x,y]=moves[event.key];target.addScaledVector(right,x*.8).addScaledVector(up,y*.8);updateCamera();render();}
  function reducedChanged(){if(media.matches&&animation){robot.position.copy(animation.to);target.copy(animation.cameraTo);stop();robot.rotation.z=0;pose(0);updateCamera();render();}}
  canvas.style.cursor='grab';canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('keydown',canvasKeys);media.addEventListener('change',reducedChanged);
  function contextLost(event){event.preventDefault();stop();container.dataset.renderer='fallback';canvas.hidden=true;layer.classList.add('fallback');actorLabel.hidden=true;panHelp.hidden=true;for(const button of overlays.values()){button.style.visibility='visible';button.classList.remove('compact','label-offset');}for(const leader of labelLeaders.values())leader.hidden=true;for(const edge of edgeObjects)edge.leader.hidden=true;}
  canvas.addEventListener('webglcontextlost',contextLost);
  function destroy(){
    if(destroyed)return;stop();destroyed=true;observer.disconnect();media.removeEventListener('change',reducedChanged);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('keydown',canvasKeys);canvas.removeEventListener('webglcontextlost',contextLost);
    for(const g of disposableGeometries)g.dispose();for(const m of disposableMaterials)m.dispose();for(const t of disposableTextures)t.dispose();renderer?.dispose();style.remove();canvas.remove();layer.remove();panHelp.remove();
  }
  resize();return {setFlow,select,previewEdge,getRoutes,setMode,zoomBy,fit,resize,destroy};
}
