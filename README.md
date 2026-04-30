# GHOST GIRL

A narrative browser game about watch-dial painting, survival, labor, and the slow cost of the work.

## Play Online

Once GitHub Pages is enabled for this repository, the game is playable at:

[https://bestspacegoose-eng.github.io/radium-codex-game/]([https://bestspacegoose-eng.github.io/GHOST-GIRL-GAME/](https://bestspacegoose-eng.github.io/GHOST-GIRL-GAME/))

The game is deployed as a static site, so it no longer depends on opening `index.html` from your local filesystem.

## GitHub Pages Setup

This repository is ready for the standard GitHub Pages branch-based setup.

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, set `Source` to `Deploy from a branch`.
4. Set `Branch` to `main`.
5. Set the folder to `/ (root)`.
6. Save.

This repo includes a root `.nojekyll` file so GitHub Pages serves the game as a plain static site instead of trying to run it through Jekyll.

## Important URL Note

Because the current repository is named `radium-codex-game`, the published URL is:

[https://bestspacegoose-eng.github.io/radium-codex-game/](https://bestspacegoose-eng.github.io/radium-codex-game/)

If you want the exact user-site format from the GitHub Docs example:

[https://bestspacegoose-eng.github.io/](https://bestspacegoose-eng.github.io/)

then the repository itself must be renamed to:

`bestspacegoose-eng.github.io`

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
