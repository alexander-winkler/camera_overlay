browser.action.onClicked.addListener(async (tab) => {
  try {
    // Prüfen, ob das Skript bereits injiziert wurde
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__camFovToggle && window.__camFovToggle()
    });

    // Wenn noch nicht vorhanden, CSS und JS injizieren
    if (!results || results[0].result === undefined) {
      await browser.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["styles.css"]
      });
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    }
  } catch (err) {
    console.error("Fehler beim Laden des Kamera-Overlays:", err);
  }
});

// background.js (Ergänzung)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    browser.tabs.sendMessage(tabId, { type: "URL_CHANGED", url: changeInfo.url }).catch(() => {});
  }
});