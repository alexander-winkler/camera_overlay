# Camera FOV & Resection Planner (Firefox Add-on)

A lightweight, universal Firefox extension designed for photographers, OSINT analysts, and researchers to geolocate camera viewpoints on any map service (such as Google Maps, OpenStreetMap, Apple Maps, etc.). 

It projects an interactive, transparent SVG camera frustum (Field of View / FOV cone) directly over the web page, allowing you to perform photogrammetric resection, calculate focal lengths, and export metadata for GIS or EXIF workflows.

---

## Features

* **Universal Map Support:** Works seamlessly over any map rendering engine using a transparent, click-through SVG overlay.
* **Interactive Frustum Control:** 
  * **Red Handle:** Move the camera origin point across the map.
  * **Green Handle:** Rotate the camera's azimuth direction.
  * **Orange Handles:** Pinpoint photo landmarks (left and right image edges) to automatically calculate the Field of View (FOV) and focal length.
* **Parameter Locks:** Lock individual properties like focal length, sensor width, FOV, or camera position to prevent accidental changes while adjusting your layout.
* **Auto-GPS Geolocation:** Automatically reads and syncs GPS coordinates from map URLs (Google Maps / OpenStreetMap) as you browse.
* **Professional Metadata & GIS Exports:**
  * Copy **EXIF metadata** (including `exifTool` command lines) to the clipboard.
  * Export complete **GeoJSON** FeatureCollections (Point + Polygon frustum) for direct import into QGIS or other GIS software.

---

## Temporary Installation Instructions (Firefox)

To test or use this add-on locally in Firefox:

1. **Clone or Download** this repository to a local folder on your computer.
2. Open Firefox and navigate to `about:debugging`.
3. Click on the **"This Firefox"** menu item on the left sidebar.
4. Click the **"Load Temporary Add-on..."** button.
5. Navigate to your project folder and select the `manifest.json` file.

> *Note: Temporary add-ons in Firefox remain active until you restart the browser.*

---

## Project Structure

```text
camera-fov-overlay/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Background service worker / tab handler
├── content.js          # Core math, SVG rendering, and UI logic
└── README.md           # Documentation