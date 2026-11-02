'use strict';
const unfinished={"index.html":[],"teacher_console.html":["setupConsoleView","setConsoleSplitMode","undoTeacherMark","clearCurrentPageTeacherMarks","toggleContrastEnhance","syncSubmissionsFromCloud","publishAllExamResults","openEmailModalForCurrentStudent","closeEmailModal","loadDefaultDemoExam","openImportExamModal","switchConsoleStudent","batchConfirmCurrentSubmission","finalizeAndReleaseCurrentStudent","setConsoleCanvasZoom","filterQuestionPills","exportConfirmedGradedPaperPdf","closeImportExamModal","closeDeleteExamModal","saveApiConfig","sendViaWebmailDirect","sendViaGasCloudApi"],"student_portal.html":[]};
document.addEventListener('DOMContentLoaded',()=>{
 const banner=document.createElement('div');banner.setAttribute('role','status');banner.style.cssText='position:relative;z-index:40;background:#fff7df;color:#654900;padding:9px 16px;text-align:center;font:14px/1.6 system-ui;flex:none';banner.textContent='網站介面預覽版｜雲端服務尚未啟用；登入與資料僅供本機示範，請勿填入真實帳密或學生個資。';document.body.prepend(banner);
 const file=location.pathname.split('/').pop()||'index.html';const pending=unfinished[file]||[];
 for(const button of document.querySelectorAll('[onclick]')){const handler=button.getAttribute('onclick');if(pending.some(name=>handler.includes(name+'('))){button.disabled=true;button.title='原始檔尚未實作此功能；本次僅發布網站介面';button.style.opacity='.5';button.style.cursor='not-allowed';}}
 for(const input of document.querySelectorAll('#apiConfigModal input,#apiConfigModal textarea')){input.disabled=true;input.placeholder='雲端後端完成設定後再啟用';}
});
