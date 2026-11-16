// Отрисовка персонажей и оружия — дословно из public/games/joe.html (строки 196–275),
// чтобы в меню Джо выглядел ровно как в игре. При правках игры обновлять вместе.
/* eslint-disable */

/* ================= РИСОВАНИЕ: ПРИМИТИВЫ ================= */
let SIL=null; // цвет силуэта (для закрытых предметов и вспышки попадания)
function box(c,col,x,y,w,h,r){
  c.fillStyle=SIL||col;
  if(!r){c.fillRect(x,y,w,h);return;}
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fill();
}
function poly(c,col,p){c.fillStyle=SIL||col;c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.closePath();c.fill();}
function disc(c,col,x,y,r){c.fillStyle=SIL||col;c.beginPath();c.arc(x,y,r,0,7);c.fill();}

/* ================= РИСОВАНИЕ: ОРУЖИЕ (ствол смотрит вправо, 0,0 — рука) ================= */
function drawGun(c,id){
  const st='#2f3850',dk='#141926',lt='#93a0bd',wd='#a8642e',ol='#5b6b47';
  switch(id){
  case 0: box(c,st,-2,-8,20,7,1);box(c,lt,1,-8,11,2);box(c,dk,18,-7,15,5,2);box(c,dk,-2,-1,7,10,1);box(c,dk,6,-1,5,3);break;
  case 1: box(c,lt,-3,-10,29,7,1);box(c,st,-3,-4,29,3);box(c,dk,24,-8,2,3);box(c,dk,-3,-1,9,12,2);box(c,dk,8,-1,6,3);box(c,dk,4,-10,8,2);break;
  case 2: box(c,lt,7,-9,24,5,1);box(c,st,9,-4,13,2);box(c,st,-3,-11,12,10,3);box(c,dk,0,-8,6,4,1);box(c,wd,-7,-3,8,13,3);box(c,dk,-6,-12,3,3);box(c,dk,5,-1,5,3);break;
  case 3: box(c,wd,-23,-7,17,8,2);box(c,st,-7,-9,25,8,1);box(c,wd,18,-8,14,6,1);box(c,dk,18,-10,12,2);box(c,dk,32,-7,17,3);box(c,dk,45,-11,2,4);
          box(c,dk,8,-1,7,8);box(c,dk,10,6,7,6,2);box(c,wd,-3,-1,6,10,2);break;
  case 4: box(c,ol,-24,-9,36,10,3);box(c,ol,-24,-3,9,10,2);box(c,dk,12,-7,27,3);box(c,dk,36,-8,3,5);box(c,dk,-6,-15,18,4,2);box(c,dk,-3,-11,3,2);box(c,dk,7,-11,3,2);
          box(c,ol,15,-4,5,11,2);box(c,dk,-14,1,7,11,1);box(c,ol,-3,-1,6,10,2);break;
  case 5: box(c,st,-8,-10,30,9,2);box(c,lt,-5,-12,21,2);box(c,dk,22,-8,11,4,1);box(c,dk,-21,-9,13,3);box(c,dk,-21,-9,3,10);box(c,dk,6,-1,6,15,1);box(c,dk,-3,-1,6,10,2);box(c,dk,15,-1,4,5);break;
  case 6: box(c,wd,-23,-6,19,9,3);box(c,st,-5,-9,17,8,1);box(c,lt,12,-9,41,3);box(c,dk,12,-5,35,3);box(c,wd,22,-6,15,6,2);box(c,dk,2,-1,5,3);box(c,dk,51,-11,2,3);break;
  case 7: box(c,'#3f4d3c',-25,-7,21,9,3);box(c,'#3f4d3c',-5,-8,25,7,1);box(c,dk,20,-7,44,3);box(c,dk,62,-8,5,5,1);box(c,dk,-1,-15,25,5,2);box(c,'#6fd3ff',22,-15,2,5);
          box(c,dk,4,-10,3,2);box(c,dk,17,-10,3,2);box(c,dk,8,-1,6,6);box(c,'#3f4d3c',-3,-1,6,9,2);break;
  case 8: box(c,dk,-25,-8,15,9,2);box(c,st,-11,-11,31,11,2);box(c,dk,20,-8,38,4);box(c,lt,20,-9,17,2);box(c,dk,56,-9,3,6);box(c,dk,6,-15,13,2);box(c,dk,8,-13,2,3);box(c,dk,15,-13,2,3);
          box(c,ol,0,0,15,12,2);box(c,'#e0ac33',3,-2,10,2);box(c,dk,-7,0,6,9,2);box(c,dk,44,-4,2,11);break;
  }
}

/* ================= РИСОВАНИЕ: ПЕРСОНАЖИ (0,0 — ступни, смотрит вправо) ================= */
function base(c,body,head){box(c,body,-13,-32,26,32,4);box(c,head,-15,-62,32,31,7);}
function eyes(c,col){box(c,col||'#1b1b28',6,-51,4,7,1);box(c,col||'#1b1b28',12,-51,4,7,1);}
function drawSkin(c,id){
  switch(id){
  case 0: base(c,'#ffc233','#ffffff');eyes(c);break;
  case 1: base(c,'#1c2236','#ffffff');box(c,'#fff',2,-32,9,15);box(c,'#e5334b',5,-31,3,13);box(c,'#22262f',-15,-62,30,7,4);box(c,'#111',2,-53,16,6,2);break;
  case 2: base(c,'#5f7d3b','#ecdcc0');box(c,'#3f5a28',-10,-26,9,7,3);box(c,'#3f5a28',2,-14,9,8,3);box(c,'#7d9a4b',-4,-9,7,5,2);
          box(c,'#4c6a30',-17,-65,35,13,6);box(c,'#3a5424',-10,-63,9,5,2);box(c,'#7d9a4b',5,-62,8,4,2);eyes(c);break;
  case 3: base(c,'#c98a4b','#ffe6cb');box(c,'#7a4a22',-13,-32,9,32,3);box(c,'#d6334a',-11,-37,24,7,3);eyes(c);
          box(c,'#6b3f1d',-25,-65,50,5,2);box(c,'#6b3f1d',-12,-78,25,15,5);box(c,'#e9b23a',-12,-69,25,3);break;
  case 4: base(c,'#232a3d','#232a3d');box(c,'#d6334a',-13,-15,26,4);box(c,'#ffe1c4',1,-54,16,9,2);eyes(c);
          box(c,'#d6334a',-15,-60,32,4);box(c,'#d6334a',-25,-60,10,3);box(c,'#d6334a',-27,-55,10,3);break;
  case 5: base(c,'#4c5f3b','#f0d2b0');poly(c,'#2b3323',[-13,-32,-7,-32,13,-8,13,-2]);box(c,'#e0ac33',-4,-24,3,4);box(c,'#e0ac33',3,-16,3,4);
          box(c,'#c2283a',-17,-67,31,10,5);box(c,'#c2283a',-21,-63,9,6,3);eyes(c);box(c,'#333',4,-42,11,2);break;
  case 6: base(c,'#2f7de1','#ffffff');box(c,'#fff',-13,-23,26,4);box(c,'#fff',-13,-17,26,2);box(c,'#ff4d6d',-15,-59,32,5);eyes(c);box(c,'#1b1b28',-17,-10,4,6,1);break;
  case 7: base(c,'#3b4458','#e9e9ee');box(c,'#3b4458',-18,-66,28,24,8);box(c,'#3b4458',-18,-66,34,9,5);box(c,'#596580',-12,-37,26,7,3);
          disc(c,'#161a26',11,-48,6);disc(c,'#35e08a',11,-48,3.5);break;
  case 8: base(c,'#17181f','#ffffff');poly(c,'#ffc233',[2,-28,-5,-15,0,-15,-3,-4,7,-19,2,-19,6,-28]);
          poly(c,'#ff3dbb',[-12,-61,-9,-76,-5,-62,-1,-78,3,-62,7,-76,10,-61]);eyes(c);box(c,'#aab',-13,-32,26,2);break;
  }
}
function drawEnemy(c,e){
  if(e.boss){
    const t=e.btype;
    if(t===0){base(c,'#7a1f2b','#f1dccb');box(c,'#fff',3,-32,8,12);box(c,'#111',-23,-65,47,5,2);box(c,'#111',-14,-86,29,22,3);box(c,'#e5334b',-14,-70,29,4);box(c,'#111',3,-42,14,4,2);}
    else if(t===1){base(c,'#4b2a7a','#f1dccb');box(c,'#e9b23a',-13,-18,26,4);box(c,'#e9b23a',-15,-69,32,8,2);poly(c,'#e9b23a',[-15,-68,-12,-80,-7,-68,-2,-68,1,-82,4,-68,9,-68,14,-80,17,-68]);disc(c,'#e5334b',1,-65,2);}
    else if(t===2){base(c,'#0f5a4a','#f1dccb');box(c,'#16332c',-18,-66,22,26,8);disc(c,'#16332c',-12,-70,8);box(c,'#e5334b',3,-54,15,3);poly(c,'#7df0c8',[-13,-32,13,-32,0,-18]);}
    else if(t===3){base(c,'#454d5e','#b9c2d4');box(c,'#8792a8',-17,-67,36,13,5);poly(c,'#f4f4f4',[-17,-62,-27,-78,-11,-67]);poly(c,'#f4f4f4',[19,-62,29,-78,13,-67]);box(c,'#22262f',2,-40,15,5);box(c,'#f4f4f4',4,-40,3,3);box(c,'#f4f4f4',10,-40,3,3);}
    else{base(c,'#1f3d7a','#f1dccb');box(c,'#11203f',-17,-66,35,9,3);box(c,'#11203f',-21,-59,42,4,2);box(c,'#e9b23a',-2,-65,6,5,1);poly(c,'#b3443a',[2,-58,5,-58,13,-36,10,-36]);box(c,'#e9b23a',-13,-30,5,5);}
    eyes(c,'#1b1b28');poly(c,SIL||'#1b1b28',[3,-57,18,-53,18,-51,3,-55]);
    return;
  }
  base(c,e.col,'#f4e7dc');
  if(e.armor){box(c,'#8792a8',-14,-31,28,17,3);box(c,'#8792a8',-17,-66,36,15,6);box(c,'#5d6880',-17,-55,36,3);}
  else if(e.hat===1){box(c,e.col2,-16,-66,33,9,4);box(c,e.col2,10,-60,13,4,2);}
  else if(e.hat===2){box(c,e.col2,-16,-67,34,11,5);disc(c,e.col2,1,-69,4);}
  else if(e.hat===3){box(c,'#22262f',-15,-55,32,13);eyes(c,'#f4e7dc');return;}
  eyes(c);poly(c,'#1b1b28',[4,-56,17,-53,17,-51,4,-54]);
}
// универсальная отрисовка фигурки
function drawDude(c,x,y,dir,s,look,gun,aim,kick,rot){
  c.save();c.translate(x,y);c.scale(dir*s,s);
  if(rot){c.translate(0,-31);c.rotate(rot);c.translate(0,31);}
  look(c);
  if(gun>=0){c.save();c.translate(6-(kick||0)*5,-22);c.rotate(-aim);drawGun(c,gun);box(c,'#fff',-3,-3,7,7,2);c.restore();}
  c.restore();
}


export { box, drawDude, drawEnemy, drawGun, drawSkin }
