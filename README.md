# PhoneOnCloud MCP Server

讓 Claude Code、Claude Desktop、Codex、Cursor 或任何 MCP 工具直接操控你的雲端
Android 機器。

截圖與操控指令都是你的電腦與機器之間的 P2P WebRTC 直連，只有一開始建立連線的
握手會碰到 PhoneOnCloud 的伺服器。

---

## 1. 產生 token

1. 開 <https://poc200.web.app> 登入。
2. 在要操控的那台機器上，點 **⋯** 選單 → **AI / MCP**。
3. 填名稱（例如 `MacBook — Claude Code`）、選有效期限（預設 30 天）與要授予的權限。
4. 按 **產生 token**。

**這串只會顯示一次**，請立刻複製保存。遺失只能重新產生，救不回來。

Token 開頭是 `poc_mcp_`。把它當密碼看：在到期之前，它對你選的機器擁有你勾選的
全部權限。

---

## 2. 安裝

需要 **Node.js 18 或更新的版本**。

### Claude Code

```bash
claude mcp add phoneoncloud -- npx -y @zerohuman-ai/poc-mcp --token poc_mcp_… --device <DEVICE_ID>
```

### Claude Desktop

在 **AI / MCP** 面板下載 `poc-mcp.mcpb`，雙擊安裝。Claude Desktop 會跳出來問你的
token，並存進作業系統的 keychain。

### Codex、Cursor 與其他吃 JSON 設定的工具

```json
{
  "mcpServers": {
    "phoneoncloud": {
      "command": "npx",
      "args": ["-y", "@zerohuman-ai/poc-mcp", "--token", "poc_mcp_…", "--device", "<DEVICE_ID>"]
    }
  }
}
```

也可以用環境變數 `POC_MCP_TOKEN` 代替命令列參數——這樣 token 不會留在 shell
歷史，也不會被寫進可能被 commit 的設定檔。

---

## 3. 參數

每個參數都有 flag 與環境變數兩種寫法，flag 優先。

| Flag | 環境變數 | 預設 | 說明 |
| :--- | :--- | :--- | :--- |
| `--token <TOKEN>` | `POC_MCP_TOKEN` | — | 必填。 |
| `--device <ID>` | `POC_MCP_DEVICE_ID` | — | 預設機器。token 只綁一台時可省略。 |
| `--profile <full\|core>` | `POC_MCP_PROFILE` | `full` | `core` 只留截圖與操控相關的 11 個 tool。 |
| `--readonly` | `POC_MCP_READONLY` | 關 | 隱藏所有會改動機器的 tool。 |
| `--unsafe-raw` | `POC_MCP_UNSAFE_RAW` | 關 | 開放 `send_raw_message`。 |
| `--idle-timeout <秒>` | `POC_MCP_IDLE_TIMEOUT` | `1800` | 這麼久沒有 tool 呼叫就斷線。`0` = 永不主動斷。 |
| `--screenshot-max-edge <px>` | `POC_MCP_SCREENSHOT_MAX_EDGE` | `1024` | 截圖長邊縮到這個大小。`0` = 原生解析度。 |
| `--api-base <URL>` | `POC_MCP_API_BASE` | 正式站 | 覆寫後端位址。 |

如果覺得 AI 容易分心，可以試 `--profile core`：tool 清單短一點，模型挑對動作的
機率明顯較高。

---

## 4. Tool 清單

座標一律是 **0–1000 的比例值**，不是實際像素：`(0,0)` 是左上角、`(1000,1000)` 是右下角、
`(500,500)` 正中央。不論裝置解析度是多少、也不論截圖有沒有被縮小，這個對應都成立——
所以沒有任何東西需要換算。`x` 與 `y` 各自獨立正規化，長螢幕上 100 單位的垂直距離
比 100 單位的水平距離長。

> **0.2.0 變更。** 座標以前是實際像素。如果你的 prompt 或 `CLAUDE.md` 裡寫死了像素
> 座標，現在會被當成比例而點到錯的位置，請一併更新。

### 螢幕

| Tool | 功能 |
| :--- | :--- |
| `screenshot` | 目前畫面的 PNG，附帶像素尺寸。可選 `crop`、`max_edge`、`quality`。 |
| `get_screen_size` | 機器螢幕的像素尺寸。僅供參考，算座標不需要它。 |
| `get_pixel_color` | 單一像素的 RGB 與 hex。只想確認某一點有沒有變色時比截圖便宜。 |

### 操控

| Tool | 功能 |
| :--- | :--- |
| `tap` | 點 `x, y`。給 `hold_ms` 就變長按。 |
| `swipe` | 從一點拖到另一點。插值由機器端做，慢拖手勢不會被網路抖動打斷。 |
| `scroll` | 滾輪事件。很多 Android App 不理它——清單捲動建議用 `swipe`。 |
| `input_text` | 對已聚焦的欄位輸入文字。 |
| `press_key` | 按鍵，可用名稱（`BACK`、`HOME`、`ENTER`、`VOLUME_UP`…）或原始 Android keycode。 |
| `navigate` | `back`、`home`、`recent`。 |
| `rotate_screen` | 切換橫豎向。螢幕尺寸會變，記得重新截圖。 |
| `wake_screen` | 亮螢幕。 |
| `batch_input` | 一次送最多 50 個操控動作，省 round trip。 |

### 檔案與 App

| Tool | 功能 |
| :--- | :--- |
| `list_dir` | 列目錄。路徑用絕對路徑，例如 `/sdcard`。 |
| `read_file` | 讀檔。文字檔直接回文字；二進位回 base64 加上大小與 SHA-256。 |
| `write_file` | 寫檔，會自動建上層目錄，大檔自動分塊。 |
| `rename_file` | 改名或搬移。 |
| `delete_file` | 刪除，無法復原。 |
| `install_apk` | 安裝機器上已有的 APK，或先從你的電腦上傳。機器上已有同樣的內容就跳過上傳。 |

### 自動化與定位

| Tool | 功能 |
| :--- | :--- |
| `run_script` | 用名稱或直接給原始碼執行自動化腳本，並收集幾秒的輸出。 |
| `stop_script` | 停掉正在跑的腳本。 |
| `script_control` | `start_auto`、`reload`、`update_config`。 |
| `set_location` | 設定絕對的模擬 GPS 座標。 |
| `move_location` | 以公尺或度數位移模擬座標。 |

### 診斷

| Tool | 功能 |
| :--- | :--- |
| `list_devices` | 這個 token 能用的機器，含狀態與螢幕尺寸。 |
| `get_connection_status` | 連線狀態、RTT、閒置時間、token 到期日。 |
| `get_logs` | 最近的腳本輸出、連線事件，以及每次 tool 呼叫一行的紀錄。 |

---

## 5. 要知道的幾件事

**第一次 tool 呼叫可能要 40 秒。** 建立連線會順便啟動機器的螢幕擷取管線，之後就
很快。如果那台機器已經有瀏覽器連著，連線會很快完成。

**連著就等於機器在忙。** 只要 MCP session 開著，機器就會一直跑螢幕擷取的編碼器
——即使 MCP 從不要求視訊，因為觸控指令走的是同一條管線。閒置 30 分鐘會自動斷，
下次呼叫再自動連回來。

**自動化腳本跑在 Otto，是 ES5 引擎**，不是 Node。箭頭函式、模板字串、`Promise`、
`async`/`await`、`Map`、`Set`、展開運算子、解構全部不能用，會直接 parse 失敗。
請用 `var`、`function () {}`、字串相加。

**撤銷 token 在下一次建立連線時才生效。** 已經建好的 P2P DataChannel 不會因為
撤銷而中斷。要立刻切斷就把 AI 工具關掉。

---

## 6. 疑難排解

先看 `get_connection_status`，再看 `get_logs`。

| 訊息 | 意思與處理 |
| :--- | :--- |
| `[token_expired] Your PhoneOnCloud MCP token expired on …` | 到 AI / MCP 面板重新產生一個，並更新設定檔。 |
| `[token_revoked] This token was revoked.` | 已被撤銷，請重新產生。 |
| `[token_invalid] Malformed token.` | 複製時被截斷了。必須以 `poc_mcp_` 開頭、中間有兩個點。 |
| `[device_not_running] Device … is stop.` | 先到 dashboard 把機器開起來。 |
| `[scope_denied] This token does not allow … operations.` | 產生 token 時沒勾這個權限，重新產生一個並勾上。 |
| `[device_not_found] Device … does not exist or is not yours.` | deviceId 錯了，或 token 綁的是別台。跑 `list_devices` 確認。 |
| `[network] Cannot reach the PhoneOnCloud backend` | 沒網路，或 proxy 擋了 `*.cloudfunctions.net`。 |
| `Handshake-ready timeout … scrcpy is still starting` | 機器接受連線了但擷取管線還在啟動。過幾秒重試。 |
| `could not establish a peer-to-peer connection` | 網路環境太嚴（公司 VPN、嚴格防火牆）擋掉了 WebRTC。 |
| `Multiple devices are available; pass device_id explicitly.` | 設 `--device`，或每次呼叫都帶 `device_id`。 |
| `Another client kept winning the connection handshake` | 有瀏覽器分頁在反覆連同一台機器。關掉它再試。 |

要看 server 自己在做什麼就看 stderr，MCP 工具通常會把它寫進自己的 log。
stdout 只走 JSON-RPC，不會有別的東西。

---

## 7. 安全性

- Token 在到期前，對你選的機器擁有你勾選的全部權限。AI 用不到的話，
  **執行自動化腳本**、**安裝 App**、**讀寫檔案**這三個請取消勾選——這三個加起來
  等於機器的完整控制權。
- 只想讓 AI 看、不要它動手，就加 `--readonly`。
- Token 會存在你的 MCP 工具放設定的地方。Claude Desktop 用 OS keychain；
  其他工具可能是專案裡的一個明文檔案。建議用環境變數 `POC_MCP_TOKEN`，
  不要把值寫進會被 commit 的檔案。
- 不用的 token 請到 AI / MCP 面板撤銷。

---

## 8. 專案位置

發佈與問題回報：<https://github.com/zerohuman-ai/poc-mcp>

英文版說明見 [English](./README.en.md)。
