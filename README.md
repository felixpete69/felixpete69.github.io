# felixpete69.github.io

Personal portfolio for Feng Qi, featuring spatial design, GIS and data-science work.

**Website:** https://felixpete69.github.io/

## Featured work

- **Nanjing Reimagined:** a graduation project on 3D relief mapping, digital visualisation and physical 3D printing. The gallery contains 17 original figures and model photographs, grouped into citywide maps, district studies and printed outputs.
- **Spatial sandbox:** a synthetic, interactive city map with three layers, pan/zoom, point inspection, sample controls and PNG export.
- **Course notebooks:** Quantitative Methods and Efficient Code project summaries. Repository links retain their existing access requirements.

## Interaction and accessibility

- GSAP 3.15.0 title entrances, terrain-card parallax and desktop scroll-driven exhibition.
- Desktop pointer tilt and magnetic links; touch devices use native horizontal swipe.
- Bold editorial typography with deep navy, purple, red and white.
- Selected CV experience in expandable rows, with an original PDF link.

- Three animated hero modes: Orbit, Connect and Flow.
- Project details and full-image dialogs with keyboard controls.
- Gallery thumbnails, previous/next navigation and mobile swipe support.
- Light/dark themes, global animation pause, map animation pause and system reduced-motion support.
- Responsive layouts, visible keyboard focus and descriptive image text.

## Local preview

No build step or installation is required. From this folder:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/.

- `index.html` — page content and structure
- `styles.css` — deep navy, purple, red and white design
- `app.js` — canvas rendering and browser interactions
- `editorial.css` — exhibition layout and responsive compositions
- `motion.js` — GSAP choreography and reduced-motion cleanup
- `assets/vendor/` — local animation dependencies and [notices](assets/vendor/NOTICE.md)
- `assets/Feng_Qi_Geospatial_CV.pdf` — original CV supplied by Feng Qi
- `assets/nanjing/` — original project figures and [image credits](assets/nanjing/credits.md)

The map sandbox uses generated coordinates and is an illustrative experiment. It is separate from the thesis maps, which are original project outputs.
