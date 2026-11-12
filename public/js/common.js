const socket=io();
function $(id){return document.getElementById(id)}
function setText(id,text){const el=$(id);if(el)el.textContent=text}
function ackEmit(event,payload={}){return new Promise(resolve=>socket.emit(event,payload,resolve))}
function drawStroke(ctx,canvas,stroke){if(!stroke||!stroke.points?.length)return;const w=canvas.width,h=canvas.height;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=stroke.size*(w/1000);ctx.strokeStyle=stroke.tool==='eraser'?'#ffffff':stroke.color;ctx.beginPath();stroke.points.forEach((p,i)=>{const x=p.x*w,y=p.y*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});if(stroke.points.length===1){const p=stroke.points[0];ctx.arc(p.x*w,p.y*h,ctx.lineWidth/2,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill()}else ctx.stroke();ctx.restore()}
function replay(canvas,strokes){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);(strokes||[]).forEach(s=>drawStroke(ctx,canvas,s))}
function formatTime(s){return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function showError(id,msg){const e=$(id);if(e)e.textContent=msg||''}
