# OmniGrade 雲端評量入口

[網站](https://math91-sfyu.github.io/omnigrade-website/)

## 本次修正

原 ZIP 的瀏覽器示範教師／學生程式，改由已建置的 GAS 工作台提供正式資料流程；保留新首頁視覺與舊頁網址相容性。

- GitHub Pages main /docs 只發布入口，不接收密碼、試卷、答案或學生資料。
- 教師／學生入口以完整視窗轉到學校網域 GAS；Google 協作平台嵌入時提供明確開啟按鈕。
- 教師帳號使用 sfyu@cdjh.ylc.edu.tw 與先前設定的系統密碼；沒有通用 PIN 或免登入教師入口。
- 學生使用教師建立的系統帳號，或限定派卷的辨識碼；不使用舊原型的 MATH-115、666 或示範正解。
- 原教用卷、核對版本、學用卷、派卷、草稿、交卷、教師核定、成績發布、PDF 工作均由既有後端處理。
- 每次 AI 結果仍需核對；未知數學形式保留待評。Email 僅教師明確發布後排程，接受不等於證明送達。

## 結構與驗證

config.js 定義唯一的 GAS 部署網址；portal.js 僅依 teacher/student 角色導覽，不接受查詢字串指定任意服務或傳送密碼。

執行 node check.mjs、node preview.mjs。GAS 測試及來源在同工作區 OmniGrade 專案，原密碼、API key 與資料庫不放在儲存庫。

首次使用請先選學校 Google 帳號，再登入 OmniGrade 系統。先以兩班各五名虛構學生驗證流程，實體手寫、裝置相容性與真實通知收信依驗收紀錄補齊。
