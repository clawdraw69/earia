import {t as tr} from "./i18n.js";
// Crop the accepted image; never generate a second, different face for the avatar.
export async function cropAvatar(url){
 const response=await fetch(url);if(!response.ok)throw Error(tr('A karakterkép nem tölthető be.'));
 const bitmap=await createImageBitmap(await response.blob());
 const box=document.createElement('dialog');box.className='avatar-crop';
 box.innerHTML=tr('<h2>Fejportré kivágása</h2><p>Állítsd a kivágást úgy, hogy a karakter feje látszódjon.</p><canvas width="512" height="512" aria-label="Avatár előnézete"></canvas><label>Vízszintes helyzet<input data-x type="range" min="0" max="100" value="50"></label><label>Függőleges helyzet<input data-y type="range" min="0" max="100" value="5"></label><label>Kivágás mérete<input data-size type="range" min="10" max="100" value="45"></label><div class="actions"><button data-cancel>Mégse</button><button data-ok class="primary">Karakterkép és avatár elfogadása</button></div>');
 document.body.append(box);
 const canvas=box.querySelector('canvas'),ctx=canvas.getContext('2d');
 const draw=()=>{const size=Math.min(bitmap.width,bitmap.height)*Number(box.querySelector('[data-size]').value)/100;
  const x=(bitmap.width-size)*Number(box.querySelector('[data-x]').value)/100,y=(bitmap.height-size)*Number(box.querySelector('[data-y]').value)/100;
  ctx.drawImage(bitmap,x,y,size,size,0,0,512,512);};
 box.querySelectorAll('input').forEach(i=>i.oninput=draw);draw();box.showModal();
 return new Promise(resolve=>{const finish=value=>{bitmap.close();box.close();box.remove();resolve(value);};
  box.querySelector('[data-ok]').onclick=()=>finish(canvas.toDataURL('image/jpeg',.9).split(',')[1]);
  box.querySelector('[data-cancel]').onclick=()=>finish(null);box.oncancel=e=>{e.preventDefault();finish(null);};});
}
