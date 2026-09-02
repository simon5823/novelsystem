---
name: dev-day
description: >
  NovelSystem 每日開發流程。開始時讀取上次日誌與進度並接上；結束時寫今天日誌、更新進度、提交並推到 GitHub。
  Use when the user says 開始今天作業, 結束今天作業, 開工, 收工, start day, end day, or /dev-day.
---

# 每日開發流程

兩個口令，不要搞混。

## 開始今天作業

1. 在專案根目錄執行：`node scripts/dev-day.mjs start`
2. 讀取腳本指出的最新 `docs/開發日誌-*.md` 與 `docs/進度.md`
3. 用繁體中文向使用者報告：
   - 上次做到哪（含版本／最後一次提交）
   - `docs/進度.md` 裡建議的下一項
   - 工作區是否有未提交變更
4. 問今天要接哪一項，**等使用者點頭再改程式**。若使用者已說「接著做 X」，直接做 X。

不要開新功能、不要重寫規格，除非使用者要求。

## 結束今天作業

1. 看 git diff／對話，用**今天日期**寫或覆寫 `docs/開發日誌-YYYY-MM-DD.md`（繁體中文）。至少包含：做了什麼、還剩什麼、注意事項。
2. 更新 `docs/進度.md`：最後更新日期、上次做到哪、下一件建議。
3. 若有值得記的功能，在 `CHANGELOG.md` 最上方加一則（不要隨便升 major；日常提交不必打 tag。使用者明確要求發版再打 tag）。
4. 執行：

```
node scripts/dev-day.mjs push "YYYY-MM-DD: <一句話摘要>"
```

5. 告訴使用者：提交摘要、是否已推上 `origin`、倉庫網址 `https://github.com/simon5823/novelsystem`。

若沒有檔案變更，仍可只更新日誌再提交。推送失敗就報告錯誤，不要假裝成功。

## 檔案

| 檔案 | 用途 |
|---|---|
| `docs/進度.md` | 接續用的單一進度來源 |
| `docs/開發日誌-YYYY-MM-DD.md` | 當日紀錄 |
| `CHANGELOG.md` | 版本摘要 |
| `scripts/dev-day.mjs` | start 列資訊；push 提交並推送 |
