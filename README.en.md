# dsh-price-tip — DeepSeek pricing-period tip

*English · [中文](README.md) — this is the English edition of [README.md](README.md), which stays canonical.*

A DSH (DeepSeek Harness) plugin that keeps a pricing-period badge in the **sidebar footer** of the Web UI.
It shows whether the DeepSeek API is currently in an **off-peak** or **peak** period, plus how long until the
next switch. Click it to open the rules, the price table currently in force, and the balance of the signed-in
DeepSeek account.

![The badge in the sidebar footer](docs/screenshot-sidebar.png)

*The sidebar footer in the running app: a green crescent = off-peak, a green slogan next to the status text,
and a countdown to the next switch on the right.*

![The panel opened by clicking the badge](docs/screenshot-panel.png)

*Click to expand: the current period and its discount, time remaining and the switch instant (local time zone,
following the UI language), the slogan, the account balance (topped-up and granted balance, last-updated time,
refresh and top-up actions), the price table (bold = price in force, struck through = peak price), and the
rules and sources at the bottom. For the sidebar and panel in the dark theme, see
[docs/verification.md](docs/verification.md).*

## What it reminds you of

| Period | Beijing time | Price |
| --- | --- | --- |
| Peak | Mon–Fri 09:00–12:00 and 14:00–18:00 (Chinese public holidays excluded) | Standard price |
| Off-peak | All other times, including all day on weekends and public holidays | 50% of the peak price |

> ⚠️ The 2025 "00:30–08:30 off-peak discount" scheme was withdrawn on 2025-09-05, and `deepseek-chat` /
> `deepseek-reasoner` were retired on 2026-07-24 — **neither is the rule in force**. The rules and the price
> table follow the
> [official DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing) (checked 2026-10-10).

## Features

- **Follows the calendar**: weekends and public holidays are off-peak the whole day; the 19 holidays that fall
  on weekdays in 2026 are built in, and years the calendar does not cover are labelled "estimated from weekdays".
- **Balance**: opening the panel reads the signed-in DeepSeek account once (topped-up balance, granted balance,
  two decimals with thousands separators — the same figures as "Settings → Account"), with a last-updated time,
  a manual refresh, and a top-up entry point. It goes through DSH's own Remote namespace and the plugin
  **never touches any credential**; when signed out it shows a single line of text, and a profile without an
  account controller hides the whole section. It reads only when the panel opens — no polling.
- **Mood value**: off-peak tells you to "Stand up and pedal", peak reminds you to "Wince as you pedal" — the
  sidebar line already carries it, and opening the panel gives the full sentence, "cheap hours — go all out" /
  "peak rates — every push stings".
- **Bilingual**: the copy lives in the Harness locale namespace, so switching the UI language takes effect
  immediately.
- **Zero dependencies, no build step**: `client.js` is committed, so it works as soon as it is installed; the
  host half registers no tools and no session state.
- **Hackable**: the rules, holidays and price table live in `src/policy.js`; balance formatting and its state
  machine live in `src/balance.js`. Rebuild after editing — see [docs/development.md](docs/development.md).

## How to install

The plugin has zero dependencies and no lifecycle scripts, and it **ships its build output**, so installing it
needs no build step. All three paths below were exercised on DSH `0.2.0-rc.2` (the verification record is in
[docs/verification.md](docs/verification.md)).

| Path | What to do | When to use it |
| --- | --- | --- |
| **GitHub** (recommended) | **Settings → Plugins** → paste `https://github.com/hojas/dsh-price-tip` | General use |
| **Tarball** | Run `pnpm pack`, then paste the absolute path of the `.tgz` into the install box | Offline / intranet / pinned version |
| **Local directory** | `git clone`, then paste the absolute path of that directory into the install box | You want to change the code |

The first two give you only the runtime files and the documents (no `src/`, `scripts/` or `test/`); use the
local directory if you want to change the rules. The command-line equivalent (non-`desktop` profiles only):

```sh
dsh plugin --profile <profile> add https://github.com/hojas/dsh-price-tip
```

### Installation notes

- **The desktop app only takes the UI path**: the `desktop` profile is owned exclusively by Electron and the
  command line refuses it (`profile "desktop" is managed exclusively by the Electron application`).
- **Refresh the page after installing**: the client bundle is appended to the boot graph by HMR, and a refresh
  makes sure it takes effect.
- **A local directory installs a symlink** (`link:`): after editing, run `node scripts/build-client.mjs` and
  refresh — no reinstall needed.
- **Version coupling**: the styles use only `--dsw-alias-*` theme tokens, the slot is
  `sidebar.footer.action`, and `dsh.client.inject` depends on the sidebar and locale client packages shipped
  with DSH; the balance is read through the **optional** `remote.account` namespace (profiles without an
  account controller hide that section automatically). If DSH renames the slot, the locale API or the account
  Remote, this plugin has to follow.

## Documents

| Document | Contents |
| --- | --- |
| [docs/development.md](docs/development.md) | File layout, customising the rules, rule sources and edge assumptions, design trade-offs, build and tests |
| [docs/verification.md](docs/verification.md) | Verification status: what was actually exercised, screenshots, what was not verified, method |

Both documents are written in Chinese.
