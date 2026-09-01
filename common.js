
function updateClock(){
 const d=new Date();
 const el=document.getElementById('clock');
 if(el) el.textContent=d.toLocaleString('id-ID');
}
setInterval(updateClock,1000);updateClock();
