# Terrain to Tangible

Feng Qi’s portfolio of GIS, three-dimensional cartography and digital fabrication.

## Explore the site

The cover uses elevation data from Zijin Mountain in Nanjing. Switch between **Orbit**, **Connect** and **Flow**, or move the pointer across the mountain. The motion control in the header pauses the experience. The site also respects the system’s reduced-motion preference.

Choose **Explore the terrain** to enter the full-screen flight. Scroll to approach the ridge and see its mesh, choose a chapter, or use **Play fly-through** for an 18-second camera journey. The terrain is rendered locally from the same elevation grid as the cover.

Mouse-wheel movement eases to a stop and responds immediately to a change in direction. The two cover lines lean with scroll speed, and the flight and project headings reveal line by line as you move through them. Touch scrolling follows the device’s own momentum. **Motion off** restores native wheel scrolling and displays the headings at rest.

The Nanjing graduation project includes a scroll-through process study, 17 original project images and an accessible full-size viewer. The spatial sandbox supports three map layers, keyboard navigation, point inspection and PNG export. Its coordinates are synthetic. The profile includes a downloadable CV and selected experience.

## Preview

Open `index.html` in a browser, or serve this directory locally.

```sh
python -m http.server 8765 --bind 127.0.0.1
```

The repository root is ready to serve on GitHub Pages. Fonts, scripts, project images and cover elevation data are included.

## Credits

- [Nanjing project image provenance](assets/nanjing/credits.md)
- [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) for the cover relief. Elevations are exaggerated for display.
- [GSAP notices](assets/vendor/NOTICE.md)
- [Archivo license](assets/fonts/archivo-OFL.txt) and [IBM Plex Mono license](assets/fonts/ibm-plex-mono-OFL.txt)
