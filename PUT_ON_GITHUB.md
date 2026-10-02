# Putting Aman Patrol on GitHub — for non-technical people

> **Status: already done!** Aman Patrol is live at
> **https://mia-za.github.io/aman-patrol/** (GitHub Pages, `main` branch, root
> folder). This guide is kept for reference — and Step 5 below is still the
> way to update the site by hand if you ever need to.

**Why do this?**
1. **Free hosting** — GitHub can serve the app on a link like
   `https://yourname.github.io/aman-patrol/` that any volunteer can open on
   their phone. Free, no server, no monthly bill.
2. **Free backup** — your app code lives safely online. If your laptop dies,
   nothing is lost.
3. **Version history** — every future change I make can be updated there.

> **Good to know:** the GitHub version is still the *demo* — each phone keeps
> its own sample data. When we connect Supabase (see `SUPABASE_SETUP.md`),
> the same GitHub link becomes the real, synced app. So this link is not
> throwaway work — it's your app's permanent home address.

Takes about **10 minutes**. You need an email address. That's all.

---

## Step 1 — Create a free GitHub account

1. Go to **https://github.com** → click **Sign up**.
2. Enter your email, make up a password, pick a username (e.g.
   `yusuf-greenside`), solve the little puzzle.
3. Verify your email when GitHub sends you the link.

## Step 2 — Create the repository (your project's folder)

1. Once logged in, click the **+** icon (top-right) → **New repository**.
2. Repository name: `aman-patrol`
3. Choose **Public** (needed for the free hosting — your app contains no
   secrets, it's safe).
4. Click the green **Create repository** button.

## Step 3 — Upload the app

1. On the next screen, click the link that says **"uploading an existing
   file"**.
2. Open the `aman-patrol` folder on your computer, select **everything inside
   it** (the `css` folder, `js` folder, `images` folder, `supabase` folder,
   `index.html`, `README.md`, and the other files) and **drag them all** into
   the GitHub upload area.
3. Wait for it to finish uploading, then click **Commit changes** (green
   button, top-right).

## Step 4 — Turn on the free website (GitHub Pages)

1. In your repository, click **Settings** (top bar of the repo page).
2. In the left menu, click **Pages**.
3. Under "Build and deployment":
   - **Source**: choose `Deploy from a branch`
   - **Branch**: choose `main` and `/ (root)` → click **Save**
4. Wait 2–5 minutes, then refresh the page. At the top it will show your
   site's address, something like:
   **`https://yourname.github.io/aman-patrol/`**

Open that link on your phone — that's Aman Patrol, live on the internet.
Bookmark it, or add it to your home screen (iPhone: Share → Add to Home
Screen. Android: menu → Add to Home screen) so it behaves like an app.

## Step 5 (later) — Updating the app

Whenever we change the app, I'll give you new/changed files. In your
repository click **Add file → Upload files**, drag the changed files in
(GitHub will replace the old versions), then **Commit changes**. The website
updates itself a minute or two later.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "404 — there isn't a GitHub Pages site here" | Wait a few more minutes, and check the URL spelling — it's `yourname.github.io/aman-patrol/` with a trailing slash. |
| The map shows markers but grey/blank streets | You're offline or the OpenStreetMap tile servers are busy — the street tiles need internet, everything else works. |
| I uploaded the wrong files | In the repo, open the file → trash icon → delete, then re-upload. Or just tell me and I'll give you a clean set. |
| Drag-and-drop didn't work in my browser | Try Chrome, or upload folder-by-folder (css first, then js, then the rest). |

## A note on open-source

This whole project stands on free, open-source tools — the same spirit as
Aman Patrol itself:

- **Leaflet** (github.com/Leaflet/Leaflet) — the map
- **OpenStreetMap / Overpass API** — all the real area data
- **Open-Meteo** — the live weather
- **Supabase** (when we connect it) — accounts, data, photo storage
- Later, if you ever want **live GPS tracking** of patrols:
  **Traccar** (github.com/traccar/traccar) is the established open-source
  option — we'd add it only when there's a real need, keeping the app simple
  first.
