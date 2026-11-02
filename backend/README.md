# 已連接的後端

正式入口使用已部署的 OmniGrade GAS v1.5.2，沿用既有 Sheets、Drive 與教師授權。

- 在 GAS 內執行教師／學生前端與 google.script.run，不以公開 GitHub JavaScript 儲存教師憑證。
- 教用答案、標準答案、正式分數與收件驗證由後端控制。
- 原 ZIP 的 backend/Code.gs 未實作角色授權，沒有部署為正式後端；原件可由 Git 歷史及使用者原 ZIP 復原。
- 現行後端本機來源：同工作區的 OmniGrade/gas、OmniGrade/web。機密只存 Script Properties，不上傳 GitHub。
