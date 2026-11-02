'use strict';
(function(){
 if(location.search){history.replaceState(null,'',location.pathname+location.hash);}
 const role=document.body.dataset.workspace;if(!role)return;
 const status=document.getElementById('handoff-status'),link=document.getElementById('open-workspace');
 try{const raw=window.OmniGradeConfig?.gasBaseUrl,u=new URL(raw);if(!['teacher','student'].includes(role)||u.protocol!=='https:'||u.hostname!=='script.google.com'||!u.pathname.endsWith('/exec'))throw Error('工作台網址設定錯誤');u.search='';u.searchParams.set('page',role);link.href=u.href;
 if(window.top!==window){status.textContent='請點擊下方按鈕，以完整視窗或新分頁開啟工作台。';return;}
 status.textContent='正在前往'+(role==='teacher'?'教師工作台':'學生作答室')+'…';window.location.replace(u.href);
 }catch(e){status.textContent='無法自動開啟，請使用下方工作台連結或聯絡教師。';}
})();
