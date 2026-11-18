(() => {
  if (window.__camFovInitialized) return;
  window.__camFovInitialized = true;

  const SENSORS = {
    "ff": { name: "Vollformat (36mm)", width: 36.0 },
    "apsc": { name: "APS-C (23.6mm)", width: 23.6 },
    "mft": { name: "Micro 4/3 (17.3mm)", width: 17.3 },
    "1inch": { name: "1 Zoll (13.2mm)", width: 13.2 },
    "s35": { name: "Super 35 Cinema (24.89mm)", width: 24.89 },
    "custom": { name: "Benutzerdefiniert", width: 36.0 }
  };

  const state = {
    visible: true,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    angle: -90,        // Hauptblickrichtung in Grad
    fovHalf: 20,       // Halber Bildwinkel in Grad
    distance: 300,     // Standard-Reichweite

    mapCenterLat: 52.5200,
    mapCenterLng: 13.4050,
    hasGeo: false,

    sensorKey: "ff",
    sensorWidth: 36.0,
    focalLength: 50.0,
    locks: {
      pos: false,
      angle: false,
      sensor: false,
      focal: false,
      fov: false
    }
  };

  function updateFocalFromFov() {
    const totalFov = state.fovHalf * 2;
    if (totalFov < 1 || totalFov > 175) return;
    const rad = (totalFov * Math.PI) / 180;
    state.focalLength = state.sensorWidth / (2 * Math.tan(rad / 2));
  }

  function updateFovFromFocal() {
    if (state.focalLength <= 0) return;
    const rad = state.sensorWidth / (2 * state.focalLength);
    const totalFov = 2 * Math.atan(rad) * (180 / Math.PI);
    state.fovHalf = Math.max(0.5, Math.min(87.5, totalFov / 2));
  }

  function getCardinalDirection(angleDeg) {
    let norm = (angleDeg + 360) % 360;
    const directions = ["Norden (N)", "Nordost (NO)", "Osten (O)", "Südost (SO)", "Süden (S)", "Südwest (SW)", "Westen (W)", "Nordwest (NW)"];
    const index = Math.round(norm / 45) % 8;
    return `${Math.round(norm)}° (${directions[index]})`;
  }

  function parseMapUrl(urlText) {
    try {
      const gmapsMatch = urlText.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (gmapsMatch) return { lat: parseFloat(gmapsMatch[1]), lng: parseFloat(gmapsMatch[2]) };
      const osmMatch = urlText.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/);
      if (osmMatch) return { lat: parseFloat(osmMatch[1]), lng: parseFloat(osmMatch[2]) };
    } catch (e) {
      console.error("Fehler beim Parsen der URL:", e);
    }
    return null;
  }

  function getCurrentCameraGeo() {
    if (!state.hasGeo) return { lat: null, lng: null };
    const deltaX = state.x - window.innerWidth / 2;
    const deltaY = state.y - window.innerHeight / 2;
    const lat = state.mapCenterLat - (deltaY * 0.00001); 
    const lng = state.mapCenterLng + (deltaX * 0.00001);
    return { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
  }

  function pixelToGeo(px, py) {
    if (!state.hasGeo) return [0, 0];
    const deltaX = px - window.innerWidth / 2;
    const deltaY = py - window.innerHeight / 2;
    const lat = state.mapCenterLat - (deltaY * 0.00001);
    const lng = state.mapCenterLng + (deltaX * 0.00001);
    return [parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))];
  }

  // --- DOM & SVG Aufbau ---
  const root = document.createElement("div");
  root.id = "cam-fov-root";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.id = "cam-fov-svg";

  const conePoly = document.createElementNS(svgNS, "polygon");
  conePoly.setAttribute("fill", "rgba(0, 168, 255, 0.22)");
  conePoly.setAttribute("stroke", "rgba(0, 168, 255, 0.85)");
  conePoly.setAttribute("stroke-width", "2");

  const centerLine = document.createElementNS(svgNS, "line");
  centerLine.setAttribute("stroke", "rgba(255, 255, 255, 0.6)");
  centerLine.setAttribute("stroke-width", "1.5");
  centerLine.setAttribute("stroke-dasharray", "5,5");

  function createHandle(color, radius = 7) {
    const c = document.createElementNS(svgNS, "circle");
    c.setAttribute("r", radius);
    c.setAttribute("fill", color);
    c.setAttribute("stroke", "#ffffff");
    c.setAttribute("stroke-width", "2");
    c.classList.add("cam-handle");
    return c;
  }

  const handleOrigin = createHandle("#ff4757", 8);       // Kameraposition (Rot)
  const handleDir = createHandle("#2ed573", 7);          // Blickrichtung (Grün)
  const handleLeftTarget = createHandle("#ffa502", 7);   // Linker Landmarken-Punkt (Orange)
  const handleRightTarget = createHandle("#ffa502", 7);  // Rechter Landmarken-Punkt (Orange)

  svg.append(conePoly, centerLine, handleLeftTarget, handleRightTarget, handleDir, handleOrigin);
  root.appendChild(svg);

  // Steuerungs-Panel HTML
  const panel = document.createElement("div");
  panel.id = "cam-fov-panel";
  panel.innerHTML = `
    <h3>
      <span>Kamera-FOV & Resection</span>
      <button class="cam-close-btn" id="cam-close" title="Ausblenden">✕</button>
    </h3>

    <div class="cam-row" style="margin-bottom: 8px;">
      <input type="text" id="cam-map-url" placeholder="Google Maps / OSM Link einfügen..." style="width: 100%; font-size: 11px; padding: 5px; background: #2b2f38; border: 1px solid #444a57; color: #fff; border-radius: 4px;">
    </div>

    <div style="background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px; margin-bottom: 8px; font-size: 11px; border: 1px dashed rgba(255,255,255,0.15);">
      <div style="color: #ff4757; font-weight: 500;">📍 GPS: <span id="live-latlng" style="color:#fff; font-weight:400;">Link einfügen</span></div>
      <div style="color: #2ed573; font-weight: 500; margin-top: 2px;">🧭 Azimut: <span id="live-azimuth" style="color:#fff; font-weight:400;">-</span></div>
      <div style="color: #ffa502; font-size: 10px; margin-top: 4px; font-style: italic;">💡 Orangen Punkte bewegen FOV (frei) oder rotieren den Kegel (bei fixiertem FOV).</div>
    </div>

    <div class="cam-row">
      <label>Format:</label>
      <select id="cam-sensor-select">
        ${Object.entries(SENSORS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}
      </select>
    </div>

    <div class="cam-row">
      <label>Sensorbreite (mm):</label>
      <input type="number" id="cam-sensor-w" step="0.1" min="1" max="200">
      <button class="cam-lock-btn" data-lock="sensor" title="Sensor fixieren">🔓</button>
    </div>

    <div class="cam-row">
      <label>Brennweite (mm):</label>
      <input type="number" id="cam-focal" step="0.5" min="1" max="2000">
      <button class="cam-lock-btn" data-lock="focal" title="Brennweite fixieren">🔓</button>
    </div>

    <div class="cam-row">
      <label>Gesamt-FOV (°):</label>
      <input type="number" id="cam-fov" step="0.5" min="1" max="175">
      <button class="cam-lock-btn" data-lock="fov" title="FOV fixieren">🔓</button>
    </div>

    <div class="cam-row">
      <label>Ausrichtung (°):</label>
      <input type="number" id="cam-angle" step="1" min="-360" max="360">
      <button class="cam-lock-btn" data-lock="angle" title="Richtung fixieren">🔓</button>
    </div>

    <div class="cam-row">
      <label>Position:</label>
      <span style="font-size:11px; color:#ff4757;">Rot</span>
      <button class="cam-lock-btn" data-lock="pos" title="Position fixieren">🔓</button>
    </div>

    <div style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 8px; padding-top: 6px; display: flex; flex-direction: column; gap: 4px;">
      <button id="cam-export-meta" style="width: 100%; background: #2ed573; color: #111; border: none; border-radius: 4px; padding: 5px; font-weight: 600; cursor: pointer; font-size: 11px;">📋 EXIF-Metadaten kopieren</button>
      <button id="cam-export-geojson" style="width: 100%; background: #1e90ff; color: #fff; border: none; border-radius: 4px; padding: 5px; font-weight: 600; cursor: pointer; font-size: 11px;">🌍 GeoJSON (QGIS) kopieren</button>
    </div>
  `;
  root.appendChild(panel);
  document.body.appendChild(root);

  const elSensorSelect = panel.querySelector("#cam-sensor-select");
  const elSensorW = panel.querySelector("#cam-sensor-w");
  const elFocal = panel.querySelector("#cam-focal");
  const elFov = panel.querySelector("#cam-fov");
  const elAngle = panel.querySelector("#cam-angle");
  const elMapUrl = panel.querySelector("#cam-map-url");
  const elLiveLatLng = panel.querySelector("#live-latlng");
  const elLiveAzimuth = panel.querySelector("#live-azimuth");
  const elExportMeta = panel.querySelector("#cam-export-meta");
  const elExportGeoJSON = panel.querySelector("#cam-export-geojson");

  let leftTargetX = window.innerWidth / 2 - 150;
  let leftTargetY = window.innerHeight / 2 - 250;
  let rightTargetX = window.innerWidth / 2 + 150;
  let rightTargetY = window.innerHeight / 2 - 250;

  function updateFromTargets() {
    if (state.locks.focal || state.locks.fov) return;

    const dxL = leftTargetX - state.x;
    const dyL = leftTargetY - state.y;
    const dxR = rightTargetX - state.x;
    const dyR = rightTargetY - state.y;

    const angleL = (Math.atan2(dyL, dxL) * 180) / Math.PI;
    const angleR = (Math.atan2(dyR, dxR) * 180) / Math.PI;

    if (!state.locks.angle) {
      state.angle = (angleL + angleR) / 2;
    }

    let diff = angleR - state.angle;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    state.fovHalf = Math.max(0.5, Math.min(87.5, Math.abs(diff)));
    updateFocalFromFov();
  }

  function render() {
    const radCenter = (state.angle * Math.PI) / 180;
    const radHalf = (state.fovHalf * Math.PI) / 180;
    const dirX = state.x + Math.cos(radCenter) * state.distance;
    const dirY = state.y + Math.sin(radCenter) * state.distance;

    // Wenn FOV oder Brennweite FIXIERT sind, erzwingen die Parameter die Position der orangen Punkte (starrer Kegel)
    if (state.locks.focal || state.locks.fov) {
      const distL = Math.hypot(leftTargetX - state.x, leftTargetY - state.y) || 250;
      const distR = Math.hypot(rightTargetX - state.x, rightTargetY - state.y) || 250;

      leftTargetX = state.x + Math.cos(radCenter - radHalf) * distL;
      leftTargetY = state.y + Math.sin(radCenter - radHalf) * distL;
      rightTargetX = state.x + Math.cos(radCenter + radHalf) * distR;
      rightTargetY = state.y + Math.sin(radCenter + radHalf) * distR;
    }

    conePoly.setAttribute("points", `${state.x},${state.y} ${leftTargetX},${leftTargetY} ${rightTargetX},${rightTargetY}`);
    centerLine.setAttribute("x1", state.x);
    centerLine.setAttribute("y1", state.y);
    centerLine.setAttribute("x2", dirX);
    centerLine.setAttribute("y2", dirY);

    handleOrigin.setAttribute("cx", state.x);
    handleOrigin.setAttribute("cy", state.y);
    handleDir.setAttribute("cx", dirX);
    handleDir.setAttribute("cy", dirY);

    handleLeftTarget.setAttribute("cx", leftTargetX);
    handleLeftTarget.setAttribute("cy", leftTargetY);
    handleRightTarget.setAttribute("cx", rightTargetX);
    handleRightTarget.setAttribute("cy", rightTargetY);

    if (document.activeElement !== elSensorW) elSensorW.value = state.sensorWidth.toFixed(2);
    if (document.activeElement !== elFocal) elFocal.value = state.focalLength.toFixed(1);
    if (document.activeElement !== elFov) elFov.value = (state.fovHalf * 2).toFixed(1);
    
    if (document.activeElement !== elAngle) {
      let compass = (state.angle + 90) % 360;
      if (compass < 0) compass += 360;
      elAngle.value = Math.round(compass);
    }

    const compassDeg = (state.angle + 90) % 360;
    elLiveAzimuth.textContent = getCardinalDirection(compassDeg);

    const geo = getCurrentCameraGeo();
    elLiveLatLng.textContent = geo.lat !== null ? `${geo.lat}, ${geo.lng}` : "Nicht kalibriert";

    elSensorW.disabled = state.locks.sensor;
    elSensorSelect.disabled = state.locks.sensor;
    elFocal.disabled = state.locks.focal;
    elFov.disabled = state.locks.fov;
    elAngle.disabled = state.locks.angle;
  }

  function updateFromSensor(newSensorW) {
    if (newSensorW <= 0.1) return;
    state.sensorWidth = newSensorW;
    updateFocalFromFov();
    render();
  }

  elSensorSelect.addEventListener("change", (e) => {
    state.sensorKey = e.target.value;
    if (e.target.value !== "custom") updateFromSensor(SENSORS[e.target.value].width);
  });

  elSensorW.addEventListener("input", (e) => {
    state.sensorWidth = parseFloat(e.target.value);
    updateFocalFromFov();
    render();
  });

  elFocal.addEventListener("input", (e) => {
    const newFocal = parseFloat(e.target.value);
    if (newFocal > 0) {
      state.focalLength = newFocal;
      updateFovFromFocal();
      render();
    }
  });

  elFov.addEventListener("input", (e) => {
    const newFov = parseFloat(e.target.value);
    if (newFov >= 1 && newFov <= 175) {
      state.fovHalf = newFov / 2;
      updateFocalFromFov();
      render();
    }
  });

  elAngle.addEventListener("input", (e) => {
    const compass = parseFloat(e.target.value);
    if (!isNaN(compass)) {
      state.angle = compass - 90;
      render();
    }
  });

  elMapUrl.addEventListener("paste", (e) => {
    setTimeout(() => {
      const coords = parseMapUrl(elMapUrl.value);
      if (coords) {
        state.mapCenterLat = coords.lat;
        state.mapCenterLng = coords.lng;
        state.hasGeo = true;
        state.x = window.innerWidth / 2;
        state.y = window.innerHeight / 2;
        updateFromTargets();
        render();
      }
    }, 50);
  });

  // --- DRAG & DROP ---
  let activeHandle = null;

  function onPointerDown(type, e) {
    e.stopPropagation();
    e.preventDefault();
    activeHandle = type;
    e.target.setPointerCapture(e.pointerId);
    e.target.setAttribute("stroke", "#ffff00");
    e.target.setAttribute("stroke-width", "4");
  }

  handleOrigin.addEventListener("pointerdown", (e) => onPointerDown("origin", e));
  handleDir.addEventListener("pointerdown", (e) => onPointerDown("dir", e));
  handleLeftTarget.addEventListener("pointerdown", (e) => onPointerDown("leftTarget", e));
  handleRightTarget.addEventListener("pointerdown", (e) => onPointerDown("rightTarget", e));

  window.addEventListener("pointermove", (e) => {
    if (!activeHandle) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    if (activeHandle === "origin") {
      if (state.locks.pos) return;
      state.x = mouseX;
      state.y = mouseY;
      if (!state.locks.focal && !state.locks.fov) {
        updateFromTargets();
      }
      render();
    } 
    else if (activeHandle === "dir") {
      const dx = mouseX - state.x;
      const dy = mouseY - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) state.distance = dist;
      if (!state.locks.angle) {
        state.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
      render();
    } 
    else if (activeHandle === "leftTarget") {
      leftTargetX = mouseX;
      leftTargetY = mouseY;
      
      if (state.locks.focal || state.locks.fov) {
        // Wenn FOV fixiert ist: Verschieben des linken Punkts rotiert den Kegel um den Kamerapunkt!
        const pointerAngle = (Math.atan2(mouseY - state.y, mouseX - state.x) * 180) / Math.PI;
        if (!state.locks.angle) {
          state.angle = pointerAngle + state.fovHalf;
        }
      } else {
        updateFromTargets();
      }
      render();
    } 
    else if (activeHandle === "rightTarget") {
      rightTargetX = mouseX;
      rightTargetY = mouseY;
      
      if (state.locks.focal || state.locks.fov) {
        // Wenn FOV fixiert ist: Verschieben des rechten Punkts rotiert den Kegel
        const pointerAngle = (Math.atan2(mouseY - state.y, mouseX - state.x) * 180) / Math.PI;
        if (!state.locks.angle) {
          state.angle = pointerAngle - state.fovHalf;
        }
      } else {
        updateFromTargets();
      }
      render();
    }
  });

  window.addEventListener("pointerup", () => {
    if (activeHandle) {
      [handleOrigin, handleDir, handleLeftTarget, handleRightTarget].forEach(h => {
        h.setAttribute("stroke", "#ffffff");
        h.setAttribute("stroke-width", "2");
      });
      activeHandle = null;
    }
  });

  elExportMeta.addEventListener("click", () => {
    const geo = getCurrentCameraGeo();
    const compassDeg = (state.angle + 90) % 360;
    const normalizedCompass = compassDeg < 0 ? compassDeg + 360 : compassDeg;
    const metadata = {
      tool: "Camera FOV & Resection Planner",
      timestamp: new Date().toISOString(),
      cameraPosition: { latitude: geo.lat || "Unbekannt", longitude: geo.lng || "Unbekannt" },
      orientation: { azimuthDegrees: parseFloat(normalizedCompass.toFixed(1)), cardinalDirection: getCardinalDirection(compassDeg) },
      optics: { focalLengthMm: parseFloat(state.focalLength.toFixed(1)), horizontalFOV: parseFloat((state.fovHalf * 2).toFixed(1)) },
      exifToolCommand: geo.lat ? `exiftool -GPSLatitude="${geo.lat}" -GPSLongitude="${geo.lng}" -GPSImgDirection="${normalizedCompass.toFixed(1)}" -FocalLength="${state.focalLength.toFixed(1)}" bild.jpg` : "Karten-Link fehlt"
    };
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2)).then(() => {
      elExportMeta.textContent = "✓ EXIF-Daten kopiert!";
      setTimeout(() => elExportMeta.textContent = "📋 EXIF-Metadaten kopieren", 2000);
    });
  });

  elExportGeoJSON.addEventListener("click", () => {
    const geo = getCurrentCameraGeo();
    const compassDeg = (state.angle + 90) % 360;
    const normalizedCompass = compassDeg < 0 ? compassDeg + 360 : compassDeg;
    if (!geo.lat) { alert("Bitte zuerst einen Karten-Link einfügen!"); return; }

    const camPointCoord = [geo.lng, geo.lat];
    const leftCoord = pixelToGeo(leftTargetX, leftTargetY);
    const rightCoord = pixelToGeo(rightTargetX, rightTargetY);

    const geojson = {
      "type": "FeatureCollection",
      "features": [
        { "type": "Feature", "geometry": { "type": "Point", "coordinates": camPointCoord }, "properties": { "name": "Kameraposition", "azimuth": parseFloat(normalizedCompass.toFixed(1)), "focalLength": parseFloat(state.focalLength.toFixed(1)) } },
        { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[camPointCoord, leftCoord, rightCoord, camPointCoord]] }, "properties": { "name": "Sichtfeld (FOV-Kegel)" } }
      ]
    };
    navigator.clipboard.writeText(JSON.stringify(geojson, null, 2)).then(() => {
      elExportGeoJSON.textContent = "✓ GeoJSON kopiert!";
      setTimeout(() => elExportGeoJSON.textContent = "🌍 GeoJSON (QGIS) kopieren", 2000);
    });
  });

  panel.querySelectorAll(".cam-lock-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.lock;
      state.locks[key] = !state.locks[key];
      btn.classList.toggle("locked", state.locks[key]);
      btn.textContent = state.locks[key] ? "🔒" : "🔓";
      render();
    });
  });

  window.__camFovToggle = () => {
    state.visible = !state.visible;
    root.style.display = state.visible ? "block" : "none";
    return state.visible;
  };
  panel.querySelector("#cam-close").addEventListener("click", window.__camFovToggle);

  render();
})();