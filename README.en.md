# PhoneOnCloud MCP Server

Control a cloud-hosted Android device from Claude Code, Claude Desktop, Codex,
Cursor, or any other MCP client.

Screenshots and control commands travel directly between your machine and the
device over a peer-to-peer WebRTC data channel. Only the initial connection
handshake touches PhoneOnCloud servers.

---

## 1. Get a token

1. Open <https://poc200.web.app> and sign in.
2. On the device you want to control, open the **⋯** menu → **AI / MCP**.
3. Fill in a name (e.g. `MacBook — Claude Code`), pick an expiry (30 days by
   default) and the permissions you want to grant.
4. Click **Create token**.

**The token is shown only once.** Copy it immediately. If you lose it, create a
new one — it cannot be recovered.

Tokens start with `poc_mcp_`. Treat one like a password: it grants whatever
permissions you checked, on the devices you selected, until it expires.

---

## 2. Install

Requires **Node.js 18 or newer**.

### Claude Code

```bash
claude mcp add phoneoncloud -- npx -y @zerohuman-ai/poc-mcp --token poc_mcp_… --device <DEVICE_ID>
```

### Claude Desktop

Download `poc-mcp.mcpb` from the **AI / MCP** panel and double-click it.
Claude Desktop asks for your token and stores it in your operating system's
keychain.

### Codex, Cursor, and other JSON-configured clients

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

You can also pass the token as an environment variable (`POC_MCP_TOKEN`) instead
of on the command line, which keeps it out of your shell history and out of any
config file you might commit.

---

## 3. Options

Every option is available as a flag or an environment variable. Flags win.

| Flag | Environment variable | Default | Meaning |
| :--- | :--- | :--- | :--- |
| `--token <TOKEN>` | `POC_MCP_TOKEN` | — | Required. |
| `--device <ID>` | `POC_MCP_DEVICE_ID` | — | Default device. Optional if the token covers exactly one device. |
| `--profile <full\|core>` | `POC_MCP_PROFILE` | `full` | `core` keeps only the 11 screenshot/input tools. |
| `--readonly` | `POC_MCP_READONLY` | off | Hides every tool that can change the device. |
| `--unsafe-raw` | `POC_MCP_UNSAFE_RAW` | off | Exposes `send_raw_message`. |
| `--idle-timeout <SECONDS>` | `POC_MCP_IDLE_TIMEOUT` | `1800` | Disconnect after this long with no tool call. `0` never disconnects. |
| `--screenshot-max-edge <PX>` | `POC_MCP_SCREENSHOT_MAX_EDGE` | `1024` | Downscale screenshots to this longest edge. `0` sends native resolution. |
| `--api-base <URL>` | `POC_MCP_API_BASE` | production | Override the backend endpoint. |

`--profile core` is worth trying if the agent seems to lose focus: a shorter tool
list measurably helps models pick the right action.

---

## 4. Tools

Coordinates are always **0–1000 proportional**, never device pixels: `(0,0)` is the
top-left corner, `(1000,1000)` the bottom-right, `(500,500)` dead centre. This holds
whatever the device's resolution is, and whether or not the screenshot was downscaled —
so there is nothing to scale. `x` and `y` are normalised independently, so on a tall
screen 100 units of vertical travel covers more of the screen than 100 horizontal.

> **Changed in 0.2.0.** Coordinates used to be device pixels. If you have prompts or
> `CLAUDE.md` notes with hardcoded pixel coordinates, they will now be read as
> proportions and land in the wrong place — update them.

### Screen

| Tool | What it does |
| :--- | :--- |
| `screenshot` | PNG of the current screen, plus its pixel dimensions. Optional `crop`, `max_edge`, `quality`. |
| `get_screen_size` | Device screen size in pixels. Informational only — not needed for coordinates. |
| `get_pixel_color` | RGB and hex of one pixel. Cheaper than a screenshot for checking a single change. |

### Input

| Tool | What it does |
| :--- | :--- |
| `tap` | Tap at `x, y`. `hold_ms` turns it into a long press. |
| `swipe` | Drag from one point to another. The device interpolates the gesture locally, so slow drags survive network jitter. |
| `scroll` | Scroll-wheel events. Many Android apps ignore these — prefer `swipe` for lists. |
| `input_text` | Type into the focused field. |
| `press_key` | Press a key by name (`BACK`, `HOME`, `ENTER`, `VOLUME_UP`, …) or raw Android keycode. |
| `navigate` | `back`, `home`, or `recent`. |
| `rotate_screen` | Toggle portrait/landscape. The screen size changes — take a new screenshot. |
| `wake_screen` | Turn the screen on. |
| `batch_input` | Run up to 50 input actions in one round trip. |

### Files and apps

| Tool | What it does |
| :--- | :--- |
| `list_dir` | List a directory. Paths are absolute, e.g. `/sdcard`. |
| `read_file` | Read a file. Text is returned as text; binary as base64 with size and SHA-256. |
| `write_file` | Write a file, creating parent directories. Chunks large files automatically. |
| `rename_file` | Rename or move. |
| `delete_file` | Delete. Not undoable. |
| `install_apk` | Install an APK already on the device, or upload one from your machine first. Skips the upload when the device already has those exact bytes. |

### Automation and location

| Tool | What it does |
| :--- | :--- |
| `run_script` | Run an automation script by name or by source. Collects output for a few seconds. |
| `stop_script` | Stop the running script. |
| `script_control` | `start_auto`, `reload`, or `update_config`. |
| `set_location` | Set an absolute simulated GPS position. |
| `move_location` | Move the simulated position by metres or degrees. |

### Diagnostics

| Tool | What it does |
| :--- | :--- |
| `list_devices` | Devices this token can reach, with status and screen size. |
| `get_connection_status` | Connection state, RTT, idle timeout, token expiry. |
| `get_logs` | Recent script output, connection lifecycle events, and one line per tool call. |

---

## 5. Things worth knowing

**The first tool call can take up to 40 seconds.** Connecting starts the
device's screen-capture pipeline; later calls are fast. If the device already
has a browser session open, connecting is quick.

**Staying connected keeps the device busy.** The device runs its screen-capture
encoder for as long as an MCP session is open, even though the MCP server never
requests video — touch input travels over that same pipeline. The connection
closes automatically after 30 minutes idle, and reconnects on the next call.

**Automation scripts run in Otto, an ES5 engine.** Not Node. No arrow
functions, template literals, `Promise`, `async`/`await`, `Map`, `Set`, spread,
or destructuring — they fail to parse. Use `var`, `function () {}`, and string
concatenation.

**Revoking a token takes effect on the next connection.** An established
peer-to-peer data channel is not torn down by revocation. Stop the agent if you
need the session to end immediately.

---

## 6. Troubleshooting

Start with `get_connection_status`, then `get_logs`.

| Message | Meaning and fix |
| :--- | :--- |
| `[token_expired] Your PhoneOnCloud MCP token expired on …` | Create a new token in the AI / MCP panel and update your MCP config. |
| `[token_revoked] This token was revoked.` | Someone revoked it. Create a new one. |
| `[token_invalid] Malformed token.` | The token was truncated when copied. It must start with `poc_mcp_` and contain two dots. |
| `[device_not_running] Device … is stop.` | Start the device from the dashboard first. |
| `[scope_denied] This token does not allow … operations.` | The token was created without that permission. Create a new one with it checked. |
| `[device_not_found] Device … does not exist or is not yours.` | Wrong device id, or the token is scoped to a different device. Run `list_devices`. |
| `[network] Cannot reach the PhoneOnCloud backend` | No internet, or a proxy is blocking `*.cloudfunctions.net`. |
| `Handshake-ready timeout … scrcpy is still starting` | The device accepted the connection but its capture pipeline was still starting. Retry in a few seconds. |
| `could not establish a peer-to-peer connection` | A restrictive network (corporate VPN, strict firewall) is blocking WebRTC. |
| `Multiple devices are available; pass device_id explicitly.` | Set `--device`, or pass `device_id` per call. |
| `Another client kept winning the connection handshake` | A browser tab is repeatedly connecting to the same device. Close it and retry. |

To see what the server itself is doing, look at stderr — MCP clients usually
surface it in their logs. Nothing but JSON-RPC goes to stdout.

---

## 7. Security

- A token grants exactly the permissions you checked, on the devices you
  selected, until it expires. Uncheck **Run automation scripts**, **Install
  apps** and **Read and write files** if the agent does not need them — those
  three amount to full control of the device.
- Use `--readonly` when you only want the agent to look.
- Tokens are stored wherever your MCP client keeps its config. Claude Desktop
  uses the OS keychain; other clients may write plain text to a file inside a
  project. Prefer `POC_MCP_TOKEN` in your environment over a value committed to
  a repository.
- Revoke tokens you are no longer using in the AI / MCP panel.

---

## 8. Repository

Distribution and issue tracker: <https://github.com/zerohuman-ai/poc-mcp>

Chinese version of this guide: [繁體中文](./README.md).
