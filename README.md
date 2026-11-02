# OmniGrade Website

GitHub Pages 網站介面發布版，來源：使用者提供的 OmniGrade_GoogleSites_Full.zip。

- 網站目錄：docs；Pages 設定 main /docs。
- 首頁、教師與學生頁使用相同來源及相對路徑，支援專案子路徑。
- 修正派卷連結與返回首頁；登入表單示範值透過 sessionStorage 傳遞，不寫進新網址。
- 原件的 PIN、localStorage、內嵌正解僅適合示範，不能當正式認證或正式學生資料庫。
- 此包的教師主控台含多個未實作函式。未完成的按鈕明確停用，雲端連線保持未啟用，沒有假裝同步／寄信成功。
- backend/Code.gs 保留原附 GAS 範本；它需要獨立設定、角色授權與測試，本次未部署，亦未覆蓋先前 GAS 系統。
- 不含 API key、學生名冊、真實密碼或舊專案資料。

## 驗證
node check.mjs
node preview.mjs
