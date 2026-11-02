/**
 * OmniGrade Math AI - Google Apps Script (GAS) 雲端後端服務 v4.8
 * 支援多組 Gemini 金鑰輪替代理辨識、Google Drive 自動歸檔、全卷兩層式動態評語與 PDF 附件寄發
 */

// ==========================================
// 【重要設定】請填寫您 Google 雲端硬碟中的專屬資料夾 ID
// 例如：https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
// 資料夾 ID 為 '1aBcDeFgHiJkLmNoPqRsTuVwXyZ'
// ==========================================
var DRIVE_FOLDER_ID = "請在此填入您的資料夾ID"; 

/**
 * Web App 主入口：處理外部 POST 請求分流
 */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    var action = data.action || "";

    if (action === "saveConfig") {
      return handleSaveConfig(data);
    } else if (action === "recognizeHandwriting") {
      return handleRecognizeHandwriting(data);
    } else if (action === "publishExam") {
      return handlePublishExam(data);
    } else if (action === "getExam") {
      return handleGetExam(data);
    } else if (action === "submitStudentAnswers") {
      return handleSubmitStudentAnswers(data);
    } else if (action === "getSubmissions") {
      return handleGetSubmissions(data);
    } else if (action === "sendEmail") {
      return handleSendEmail(data);
    } else {
      return buildJsonResponse({ success: false, error: "未知的請求動作 (action): " + action });
    }
  } catch (err) {
    return buildJsonResponse({ success: false, error: "GAS 伺服器處理異常: " + err.toString() });
  }
}

/**
 * Web App 探測入口：處理 GET 請求
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "ping") {
    return buildJsonResponse({ success: true, message: "OmniGrade GAS Backend is active!" });
  }
  return buildJsonResponse({
    success: true,
    message: "OmniGrade Math 評量後端服務正常運作中。"
  });
}

/**
 * 輔助函式：取得指定的 Google Drive 資料夾
 */
function getStorageFolder() {
  if (!DRIVE_FOLDER_ID || DRIVE_FOLDER_ID === "請在此填入您的資料夾ID") {
    throw new Error("尚未設定 Google Drive 資料夾 ID！請先至 GAS 程式碼中設定 DRIVE_FOLDER_ID。");
  }
  try {
    return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  } catch (e) {
    throw new Error("無法存取指定的 Google Drive 資料夾，請確認 ID 是否正確且您具有編輯權限。");
  }
}

/**
 * 輔助函式：在 Google Drive 中讀取 JSON 檔案內容
 */
function readJsonFromDrive(fileName) {
  var folder = getStorageFolder();
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var content = file.getBlob().getDataAsString();
    try {
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 輔助函式：在 Google Drive 中寫入 JSON 檔案
 */
function writeJsonToDrive(fileName, dataObj) {
  var folder = getStorageFolder();
  var files = folder.getFilesByName(fileName);
  var jsonString = JSON.stringify(dataObj);
  
  if (files.hasNext()) {
    var file = files.next();
    file.setContent(jsonString); // 覆寫現有檔案
  } else {
    folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT); // 建立新檔案
  }
}

/**
 * 核心處理：安全儲存教師 Gemini 多組金鑰池於 GAS 雲端屬性中
 */
function handleSaveConfig(data) {
  var props = PropertiesService.getScriptProperties();
  if (data.geminiApiKeys && Array.isArray(data.geminiApiKeys) && data.geminiApiKeys.length > 0) {
    props.setProperty("GEMINI_API_KEYS", JSON.stringify(data.geminiApiKeys));
    props.setProperty("GEMINI_API_KEY", data.geminiApiKeys[0]);
  } else if (data.geminiApiKey) {
    props.setProperty("GEMINI_API_KEYS", JSON.stringify([data.geminiApiKey.trim()]));
    props.setProperty("GEMINI_API_KEY", data.geminiApiKey.trim());
  }
  return buildJsonResponse({
    success: true,
    message: "✓ GAS 雲端後端多組金鑰池與設定已儲存成功！"
  });
}

/**
 * 核心處理：跨裝置安全代理手寫數學式辨識 (Gemini 2.5 Flash + 多金鑰輪替)
 */
function handleRecognizeHandwriting(data) {
  var props = PropertiesService.getScriptProperties();
  var keysStr = props.getProperty("GEMINI_API_KEYS");
  var keyList = [];
  
  if (keysStr) {
    try { keyList = JSON.parse(keysStr); } catch (e) {}
  }
  if (!keyList || keyList.length === 0) {
    var singleKey = props.getProperty("GEMINI_API_KEY") || data.geminiApiKey;
    if (singleKey) keyList = [singleKey];
  }

  if (keyList.length === 0) {
    return buildJsonResponse({
      success: false,
      error: "GAS 雲端後端尚未設定 Gemini API Key。請教師先至主控台金鑰設定中貼入金鑰池。"
    });
  }

  var imageBase64 = data.imageBase64;
  if (!imageBase64) {
    return buildJsonResponse({
      success: false,
      error: "未接收到有效的手寫圖檔資料。"
    });
  }

  var cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  var promptText = "你是一位專業的台灣中學數學科閱卷教師。請仔細辨識這張學生在手寫板上書寫的手寫數學算式或答案圖片。" +
    "請只輸出辨識出的標準自然數學式，不要輸出任何多餘解說、Markdown 引號或客套話。\n" +
    "符號轉換規範：\n" +
    "- 根號：若寫 3根號2 請輸出 3√2\n" +
    "- 平面坐標：若寫坐標請輸出 (2, -5)\n" +
    "- 分數：若寫分數請輸出 2/3 或 -1/4\n" +
    "- 線段：若寫線段AB 請輸出 \\overline{AB}\n" +
    "- 圓弧：若寫弧AB 請輸出 \\overparen{AB}\n" +
    "- 指數次方：若寫科學記號或次方請輸出 4.5*10^9 或 x^2\n" +
    "- 多解集合：若有多個答案請用頓號或逗號隔開，如 0、4、6、10\n" +
    "- 幾何記號：三角形 △ABC、角 ∠A、平行 ∥、垂直 ⊥、相似 ∼、全等 ≅";

  var payload = {
    contents: [{
      parts: [
        { text: promptText },
        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
      ]
    }]
  };

  var lastErrorMessage = "";

  for (var k = 0; k < keyList.length; k++) {
    var apiKey = keyList[k];
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

    try {
      var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      var response = UrlFetchApp.fetch(url, options);
      var respJson = JSON.parse(response.getContentText());

      if (respJson.error) {
        var errCode = respJson.error.code;
        var errMsg = respJson.error.message || "";
        if (errCode === 429 || errMsg.indexOf("RESOURCE_EXHAUSTED") !== -1 || errMsg.indexOf("quota") !== -1) {
          lastErrorMessage = "金鑰 #" + (k + 1) + " 額度已耗盡: " + errMsg;
          continue;
        }
        return buildJsonResponse({
          success: false,
          error: "Gemini API 呼叫失敗: " + errMsg
        });
      }

      var recognizedText = "";
      if (respJson.candidates && respJson.candidates.length > 0 &&
          respJson.candidates[0].content && respJson.candidates[0].content.parts &&
          respJson.candidates[0].content.parts.length > 0) {
        recognizedText = respJson.candidates[0].content.parts[0].text || "";
      }

      recognizedText = recognizedText.replace(/```[a-z]*\n?/gi, "").replace(/`/g, "").trim();

      return buildJsonResponse({
        success: true,
        text: recognizedText
      });

    } catch (err) {
      lastErrorMessage = err.toString();
    }
  }

  return buildJsonResponse({
    success: false,
    error: "GAS 金鑰池所有金鑰皆已達到使用上限: " + lastErrorMessage
  });
}

/**
 * 核心處理：發布試卷題目至 Google Drive 雲端庫
 */
function handlePublishExam(data) {
  var exam = data.exam;
  if (!exam || !exam.code) {
    return buildJsonResponse({ success: false, error: "無效的試卷資料" });
  }
  try {
    var fileName = "EXAM_" + exam.code.toUpperCase() + ".json";
    writeJsonToDrive(fileName, exam);
    return buildJsonResponse({ success: true, message: "✓ 試卷已同步發布至 Google Drive 雲端庫！" });
  } catch (e) {
    return buildJsonResponse({ success: false, error: "寫入 Google Drive 失敗: " + e.toString() });
  }
}

/**
 * 核心處理：學生端跨裝置依測驗碼自 Google Drive 獲取試卷
 */
function handleGetExam(data) {
  var code = (data.code || "").toUpperCase();
  try {
    var fileName = "EXAM_" + code + ".json";
    var examObj = readJsonFromDrive(fileName);
    if (!examObj) {
      return buildJsonResponse({ success: false, error: "找不到測驗碼 " + code + " 的試卷檔案" });
    }
    return buildJsonResponse({ success: true, exam: examObj });
  } catch (e) {
    return buildJsonResponse({ success: false, error: "讀取 Google Drive 失敗: " + e.toString() });
  }
}

/**
 * 核心處理：學生端跨裝置提交答案卷存檔 (寫入 Google Drive)
 */
function handleSubmitStudentAnswers(data) {
  var examCode = (data.examCode || "").toUpperCase();
  var sub = data.submission;
  if (!examCode || !sub || !sub.studentId) {
    return buildJsonResponse({ success: false, error: "無效的學生作答資料" });
  }

  try {
    var fileName = "SUBS_" + examCode + ".json";
    var subsMap = readJsonFromDrive(fileName) || {};
    
    subsMap[sub.studentId] = sub;
    writeJsonToDrive(fileName, subsMap);

    return buildJsonResponse({
      success: true,
      message: "✓ 學生作答已成功寫入 Google Drive 雲端資料庫！"
    });
  } catch (e) {
    return buildJsonResponse({ success: false, error: "寫入 Google Drive 失敗: " + e.toString() });
  }
}

/**
 * 核心處理：教師端自 Google Drive 拉取所有學生的最新繳交紀錄
 */
function handleGetSubmissions(data) {
  var examCode = (data.examCode || "").toUpperCase();
  try {
    var fileName = "SUBS_" + examCode + ".json";
    var subsMap = readJsonFromDrive(fileName) || {};

    return buildJsonResponse({
      success: true,
      submissions: subsMap
    });
  } catch (e) {
    return buildJsonResponse({ success: false, error: "讀取 Google Drive 失敗: " + e.toString() });
  }
}

/**
 * 核心處理：發送成績通知信（含批閱 PDF 實體附件自動夾帶，並可選擇存檔 PDF 至 Drive）
 */
function handleSendEmail(data) {
  var recipient = (data.recipient || "").trim();
  if (!recipient) {
    return buildJsonResponse({ success: false, error: "未提供收件人 Email 信箱" });
  }

  var examTitle = data.examTitle || "數學科評量";
  var examCode = data.examCode || "";
  var studentId = data.studentId || "";
  var seat = data.seat || "";
  var studentName = data.studentName || "同學";
  var totalScore = data.totalScore !== undefined ? data.totalScore : 0;
  var choiceScore = data.choiceScore !== undefined ? data.choiceScore : 0;
  var fillScore = data.fillScore !== undefined ? data.fillScore : 0;
  var maxTotal = data.maxTotal || 100;
  var generalComment = data.generalComment || calculateGasDynamicComment({ total: totalScore, maxTotal: maxTotal, choice: choiceScore, fill: fillScore }, data.questionBreakdown);
  var pdfBase64 = data.pdfBase64 || "";
  var hasPdf = !!pdfBase64;

  var htmlBody = generateScoreNotificationHtml({
    examTitle: examTitle,
    examCode: examCode,
    studentId: studentId,
    seat: seat,
    studentName: studentName,
    totalScore: totalScore,
    choiceScore: choiceScore,
    fillScore: fillScore,
    maxTotal: maxTotal,
    generalComment: generalComment,
    questionBreakdown: data.questionBreakdown || [],
    hasPdfAttachment: hasPdf
  });

  var mailOptions = {
    to: recipient,
    subject: data.subject || ("【評量成績通知】" + examTitle + " - " + seat + "號 " + studentName),
    htmlBody: htmlBody
  };

  var pdfBlob = null;
  if (hasPdf) {
    try {
      var cleanPdf = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      var pdfFileName = examCode + "_" + studentId + "_" + studentName + "_正式批閱答案卷.pdf";
      pdfBlob = Utilities.newBlob(Utilities.base64Decode(cleanPdf), "application/pdf", pdfFileName);
      mailOptions.attachments = [pdfBlob];
      
      if(DRIVE_FOLDER_ID && DRIVE_FOLDER_ID !== "請在此填入您的資料夾ID") {
         var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
         folder.createFile(pdfBlob);
      }
    } catch (e) {
      Logger.log("PDF 解碼或備份失敗: " + e.toString());
    }
  }

  try {
    MailApp.sendEmail(mailOptions);
    recordToSpreadsheetArchive({
      timestamp: Utilities.formatDate(new Date(), "GMT+8", "yyyy/MM/dd HH:mm:ss"),
      examTitle: examTitle,
      studentId: studentId,
      seat: seat,
      studentName: studentName,
      totalScore: totalScore,
      choiceScore: choiceScore,
      fillScore: fillScore,
      generalComment: generalComment,
      recipient: recipient
    });
    return buildJsonResponse({ success: true, message: "✓ 成績通知信已成功寄出！(批閱卷已同步備份至雲端資料夾)" });
  } catch (err) {
    return buildJsonResponse({ success: false, error: "Email 寄送失敗: " + err.toString() });
  }
}

/**
 * GAS 端「動態評語運算邏輯」實作
 */
function calculateGasDynamicComment(scores, questionBreakdown) {
  var totalScore = scores.total || 0;
  var maxTotal = scores.maxTotal || 100;
  var choiceCorrect = 0, choiceTotal = 0;
  var fillCorrect = 0, fillTotal = 0;
  var hasOrderFail = false;
  var hasFormFail = false;

  if (Array.isArray(questionBreakdown)) {
    questionBreakdown.forEach(function(q) {
      var isCorrect = (q.score >= q.points && q.points > 0);
      if (q.type === "choice") {
        choiceTotal++;
        if (isCorrect) choiceCorrect++;
      } else if (q.type === "fill") {
        fillTotal++;
        if (isCorrect) fillCorrect++;
        if (q.feedback && (q.feedback.indexOf("順序錯誤") !== -1 || q.feedback.indexOf("ORDER_FAIL") !== -1 || q.feedback.indexOf("順序不符") !== -1)) {
          hasOrderFail = true;
        }
        if (q.feedback && (q.feedback.indexOf("未化為最簡") !== -1 || q.feedback.indexOf("FORM_FAIL") !== -1)) {
          hasFormFail = true;
        }
      }
    });
  }

  var comment = "實得總分：" + totalScore + " / " + maxTotal + " 分。";
  if (choiceTotal > 0) comment += "選擇題答對 " + choiceCorrect + "/" + choiceTotal + " 題；";
  if (fillTotal > 0) comment += "填充題答對 " + fillCorrect + "/" + fillTotal + " 題。";

  var ratio = maxTotal > 0 ? (totalScore / maxTotal) : 0;
  if (ratio >= 0.85) {
    comment += " 各題觀念清晰、運算熟練，表現特優！";
  } else if (ratio >= 0.60) {
    comment += " 基礎概念大致掌握，部分題目形式需更加注意。";
  } else {
    comment += " 建議加強基礎觀念與四則運算規則，多加演練！";
  }

  if (hasOrderFail) {
    comment += " 【特別叮嚀】：部分題目要求嚴格順序，數值雖對但順序顛倒仍不予給分，解題時請特別留意題意要求。";
  }
  if (hasFormFail) {
    comment += " 【最簡規範】：作答時請務必化為最簡根式、最簡分數或標準科學記號，避免因格式要求失分。";
  }

  return comment;
}

/**
 * 產生專業 RWD HTML 成績通知信樣板
 */
function generateScoreNotificationHtml(params) {
  var isPass = params.totalScore >= (params.maxTotal * 0.6);
  var passBadgeColor = isPass ? "#059669" : "#dc2626";

  var questionsRowsHtml = "";
  if (params.questionBreakdown && params.questionBreakdown.length > 0) {
    questionsRowsHtml = params.questionBreakdown.map(function(q) {
      var isCorrect = (q.score >= q.points && q.points > 0);
      var markIcon = isCorrect ? "<span style='color:#059669; font-weight:bold;'>✓ 正確</span>" : "<span style='color:#dc2626; font-weight:bold;'>✗ 錯誤</span>";
      var typeText = q.type === 'choice' ? '單選' : '填充';
      return "<tr style='border-bottom:1px solid #e2e8f0; font-size:12px;'>" +
               "<td style='padding:8px; font-weight:bold; color:#1e293b;'>" + typeText + " 第 " + q.num + " 題</td>" +
               "<td style='padding:8px; font-family:monospace; color:#334155;'>" + (q.studentAnswer || "--") + "</td>" +
               "<td style='padding:8px; font-family:monospace; color:#0e535a; font-weight:bold;'>" + (q.standardAnswer || "--") + "</td>" +
               "<td style='padding:8px; text-align:center;'>" + markIcon + "</td>" +
               "<td style='padding:8px; text-align:right; font-weight:bold; color:" + (isCorrect ? "#059669" : "#dc2626") + ";'>" + q.score + " / " + q.points + " 分</td>" +
             "</tr>";
    }).join("");
  }

  return "<!DOCTYPE html>" +
    "<html>" +
    "<head><meta charset='UTF-8'></head>" +
    "<body style='margin:0; padding:20px; background-color:#f1f5f9; font-family:\"Noto Sans TC\", Helvetica, Arial, sans-serif;'>" +
      "<div style='max-width:640px; margin:0 auto; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); border:1px solid #e2e8f0;'>" +
        "<div style='background-color:#0e535a; padding:24px; color:#ffffff;'>" +
          "<div style='font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#99f6e4; font-weight:bold;'>OmniGrade 數學科線上評量成績通知</div>" +
          "<h1 style='margin:6px 0 0 0; font-size:20px; font-weight:bold;'>" + params.examTitle + "</h1>" +
          "<div style='font-size:12px; margin-top:8px; color:#ccfbf1;'>測驗代碼：" + params.examCode + " · 學生：" + params.seat + "號 " + params.studentName + " (" + params.studentId + ")</div>" +
        "</div>" +
        "<div style='padding:24px; border-bottom:1px solid #e2e8f0;'>" +
          "<table style='width:100%; text-align:center; border-collapse:collapse;'>" +
            "<tr>" +
              "<td style='padding:12px; background-color:#f8fafc; border-radius:12px; width:33%; border:1px solid #e2e8f0;'>" +
                "<div style='font-size:11px; color:#64748b; font-weight:bold;'>單選題得分</div>" +
                "<div style='font-size:20px; font-weight:900; color:#0e535a; margin-top:4px;'>" + params.choiceScore + "</div>" +
              "</td>" +
              "<td style='width:4%;'></td>" +
              "<td style='padding:12px; background-color:#f8fafc; border-radius:12px; width:33%; border:1px solid #e2e8f0;'>" +
                "<div style='font-size:11px; color:#64748b; font-weight:bold;'>填充題得分</div>" +
                "<div style='font-size:20px; font-weight:900; color:#0e535a; margin-top:4px;'>" + params.fillScore + "</div>" +
              "</td>" +
              "<td style='width:4%;'></td>" +
              "<td style='padding:12px; background-color:#fef2f2; border-radius:12px; width:33%; border:1px solid #fecaca;'>" +
                "<div style='font-size:11px; color:#991b1b; font-weight:bold;'>實得總分</div>" +
                "<div style='font-size:22px; font-weight:900; color:" + passBadgeColor + "; margin-top:2px;'>" + params.totalScore + " <span style='font-size:12px; color:#64748b;'>/ " + params.maxTotal + "</span></div>" +
              "</td>" +
            "</tr>" +
          "</table>" +
        "</div>" +
        "<div style='padding:20px 24px; background-color:#f0fdfa; border-bottom:1px solid #ccfbf1;'>" +
          "<div style='font-size:13px; font-weight:bold; color:#0f766e; margin-bottom:6px;'>💡 教師總評與個人學習診斷：</div>" +
          "<div style='font-size:13px; line-height:1.6; color:#134e4a; font-weight:500;'>" + params.generalComment + "</div>" +
        "</div>" +
        (questionsRowsHtml !== "" ? (
          "<div style='padding:20px 24px; border-bottom:1px solid #e2e8f0;'>" +
            "<div style='font-size:13px; font-weight:bold; color:#334155; margin-bottom:10px;'>📋 各題作答明細清單：</div>" +
            "<table style='width:100%; border-collapse:collapse; text-align:left;'>" +
              "<thead>" +
                "<tr style='background-color:#f8fafc; color:#64748b; font-size:11px; border-bottom:2px solid #cbd5e1;'>" +
                  "<th style='padding:6px 8px;'>題號</th>" +
                  "<th style='padding:6px 8px;'>學生作答</th>" +
                  "<th style='padding:6px 8px;'>標準答案</th>" +
                  "<th style='padding:6px 8px; text-align:center;'>判定</th>" +
                  "<th style='padding:6px 8px; text-align:right;'>實得</th>" +
                "</tr>" +
              "</thead>" +
              "<tbody>" + questionsRowsHtml + "</tbody>" +
            "</table>" +
          "</div>"
        ) : "") +
        (params.hasPdfAttachment ? (
          "<div style='padding:14px 24px; background-color:#f8fafc; font-size:12px; color:#475569; border-bottom:1px solid #e2e8f0;'>" +
            "📎 <strong>附件提醒：</strong> 本郵件已自動附加任課教師正式核定之答案卷 PDF 檔，歡迎下載存查或列印進行錯題訂正。" +
          "</div>"
        ) : "") +
        "<div style='padding:16px 24px; background-color:#ffffff; font-size:11px; color:#94a3b8; text-align:center;'>" +
          "此信件由 OmniGrade Math AI 線上評量系統自動發出，請勿直接回覆此郵件。" +
        "</div>" +
      "</div>" +
    "</body>" +
    "</html>";
}

function recordToSpreadsheetArchive(rowObj) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  var sheet = ss.getSheetByName("評量成績總表");
  if (!sheet) {
    sheet = ss.insertSheet("評量成績總表");
    sheet.appendRow(["時間戳記", "試卷名稱", "學號", "座號", "姓名", "實得總分", "選擇得分", "填充得分", "教師評語", "寄送信箱"]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 10).setBackground("#0e535a").setFontColor("#ffffff").setFontWeight("bold");
  }
  sheet.appendRow([
    rowObj.timestamp,
    rowObj.examTitle,
    rowObj.studentId,
    rowObj.seat,
    rowObj.studentName,
    rowObj.totalScore,
    rowObj.choiceScore,
    rowObj.fillScore,
    rowObj.generalComment,
    rowObj.recipient
  ]);
}

function buildJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
