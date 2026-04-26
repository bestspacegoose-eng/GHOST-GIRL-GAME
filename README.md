# GHOST GIRL

A narrative browser game about watch-dial painting, survival, labor, and the slow cost of the work.

## Play Online

Once the GitHub Pages workflow finishes on `main`, the game is playable at:

[https://bestspacegoose-eng.github.io/radium-codex-game/](https://bestspacegoose-eng.github.io/radium-codex-game/)

The game is deployed as a static site, so it no longer depends on opening `index.html` from your local filesystem.

## How Pages Deployment Works

This repository uses the workflow at `.github/workflows/deploy-pages.yml`.

On every push to `main`, GitHub Actions will:

1. copy `index.html`, `style.css`, `game.js`, and `assets/` into a clean `_site/` directory
2. add `.nojekyll` so GitHub Pages serves the files exactly as-is
3. upload that static bundle to GitHub Pages

## Local Development

You can still open the game locally, but using a local web server is closer to the deployed environment than `file://`.

Example:

```bash
cd /Users/jodiec/Documents/Codex/2026-04-20-create-a-game-that-intakes-user
python3 -m http.server 8000
```

Then open:

[http://localhost:8000/](http://localhost:8000/)

## Controls

- `Left click`: interact, paint, select dialogue, and use minigame timing actions
- `Escape`: leave zoomed numerals or back out of a minigame
- `M`: open or close the menu
- `Arrow Left` / `Arrow Right`: move through paged dialogue sections

## Notes

- Save data and settings are stored in the browser with `localStorage`, so they are per-browser and per-device.
- Background music and external sound embeds still rely on the player’s browser allowing those sources after interaction.
