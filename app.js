
import { PonaAI } from "./ponaai.js";
import { Store } from "./store.js";

const $ = id => document.getElementById(id);

const store = new Store();
const ai = new PonaAI(store);

let files = [];
let cameraStream = null;
let currentMood = "neutral";
let selectedVoice = "Kore";
let recognition = null;
let isListening = false;

let voiceCallActive = false;
let voiceCallBusy = false;
let voiceCallButton = null;

// ============================================================
// TTS
// ============================================================

let currentAudio = null;
let audioUrl = null;
let isSpeaking = false;
let ttsController = null;
let ttsRequestId = 0;

const TTS_PLAYBACK_RATE = 1.18;

// ============================================================
// TALLENNETUT – IndexedDB
// ============================================================

const ASSET_DB_NAME = "PonaAI_Assets";
const ASSET_DB_VERSION = 1;
const ASSET_STORE_NAME = "assets";

function openAssetDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      ASSET_DB_NAME,
      ASSET_DB_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(ASSET_STORE_NAME)) {
        db.createObjectStore(
          ASSET_STORE_NAME,
          { keyPath: "id" }
        );
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveAssetData(assetId, data) {
  const db = await openAssetDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ASSET_STORE_NAME,
      "readwrite"
    );

    transaction
      .objectStore(ASSET_STORE_NAME)
      .put({
        id: assetId,
        data
      });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getAssetData(assetId) {
  const db = await openAssetDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ASSET_STORE_NAME,
      "readonly"
    );

    const request =
      transaction
        .objectStore(ASSET_STORE_NAME)
        .get(assetId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result?.data || null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function deleteAssetData(assetId) {
  const db = await openAssetDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ASSET_STORE_NAME,
      "readwrite"
    );

    transaction
      .objectStore(ASSET_STORE_NAME)
      .delete(assetId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// ============================================================
// TALLENNETUT – UI
// ============================================================

function assetTypeName(type) {
  const names = {
    image: "Kuva",
    file: "Tiedosto",
    code: "Koodi",
    music: "Musiikki",
    game: "Peli"
  };

  return names[type] || "Tiedosto";
}

function assetIcon(type) {
  const icons = {
    image: "fa-image",
    file: "fa-file",
    code: "fa-code",
    music: "fa-music",
    game: "fa-gamepad"
  };

  return icons[type] || "fa-file";
}

function formatAssetDate(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleString(
    "fi-FI",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

async function saveProjectAsset({
  type,
  name,
  mimeType,
  data,
  prompt = ""
}) {
  if (!data) {
    throw new Error(
      "Tallennettava sisältö puuttuu."
    );
  }

  const id =
    "asset_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 9);

  await saveAssetData(id, data);

  store.addAsset({
    id,
    type,
    name:
      name ||
      `PonaAI-${Date.now()}`,
    mimeType:
      mimeType ||
      "application/octet-stream",
    prompt,
    createdAt: Date.now()
  });

  return id;
}

function dataUrlToBlob(dataUrl) {
  if (
    typeof dataUrl !== "string" ||
    !dataUrl.startsWith("data:")
  ) {
    return new Blob([dataUrl]);
  }

  const parts =
    dataUrl.split(",");

  const mime =
    parts[0]
      .match(/data:(.*?);/)?.[1] ||
    "application/octet-stream";

  const binary =
    atob(parts[1]);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return new Blob(
    [bytes],
    { type: mime }
  );
}

async function openSavedAsset(asset) {
  try {
    const data =
      await getAssetData(asset.id);

    if (!data) {
      alert(
        "Tallennettua tiedostoa ei löytynyt."
      );
      return;
    }

    if (asset.type === "image") {
      const win =
        window.open("");

      if (!win) {
        alert(
          "Selain esti uuden ikkunan."
        );
        return;
      }

      win.document.documentElement.innerHTML = `
        <!doctype html>
        <html lang="fi">
        <head>
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          >
          <title>${esc(asset.name)}</title>

          <style>
            body {
              margin: 0;
              background: #050b14;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 12px;
              box-sizing: border-box;
            }

            img {
              max-width: 100%;
              max-height: 95vh;
              width: auto;
              height: auto;
              object-fit: contain;
              border-radius: 12px;
            }
          </style>
        </head>

        <body>
          <img src="${esc(data)}">
        </body>
        </html>
      `;

      return;
    }

    const blob =
      dataUrlToBlob(data);

    const url =
      URL.createObjectURL(blob);

    window.open(
      url,
      "_blank"
    );

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000);

  } catch (e) {
    console.error(e);

    alert(
      "Tiedoston avaaminen epäonnistui: " +
      (e.message || e)
    );
  }
}

async function downloadSavedAsset(asset) {
  try {
    const data =
      await getAssetData(asset.id);

    if (!data) {
      alert(
        "Tiedostoa ei löytynyt."
      );
      return;
    }

    const blob =
      dataUrlToBlob(data);

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      asset.name ||
      "ponaai-tiedosto";

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5000);

  } catch (e) {
    console.error(e);

    alert(
      "Lataus epäonnistui: " +
      (e.message || e)
    );
  }
}

async function deleteSavedAsset(asset) {
  const ok =
    confirm(
      `Poistetaanko "${asset.name}"?`
    );

  if (!ok) return;

  try {
    await deleteAssetData(
      asset.id
    );

    store.removeAsset(
      asset.id
    );

    renderSavedAssets();

  } catch (e) {
    console.error(e);

    alert(
      "Poistaminen epäonnistui: " +
      (e.message || e)
    );
  }
}

async function renderSavedAssets() {
  const list =
    $("savedList");

  const projectName =
    $("savedProjectName");

  if (!list) return;

  const project =
    store.active();

  if (!project) return;

  if (projectName) {
    projectName.textContent =
      `Projekti: ${project.name}`;
  }

  const assets =
    store.getAssets();

  if (!assets.length) {
    list.innerHTML = `
      <div class="saved-empty">
        <div
          style="
            font-size:2rem;
            margin-bottom:8px;
          "
        >
          📁
        </div>

        Ei vielä tallennettua sisältöä.
        <br>

        Kun tallennat jotain,
        se näkyy täällä.
      </div>
    `;

    return;
  }

  const categories = [
    ["image", "🖼️ Kuvat"],
    ["file", "📄 Tiedostot"],
    ["code", "💻 Koodit"],
    ["music", "🎵 Musiikki"],
    ["game", "🎮 Pelit"]
  ];

  list.innerHTML = "";

  for (
    const [type, title]
    of categories
  ) {
    const items =
      assets.filter(
        asset =>
          asset.type === type
      );

    if (!items.length) {
      continue;
    }

    const category =
      document.createElement(
        "div"
      );

    category.className =
      "saved-category";

    category.innerHTML =
      `<h3>${title}</h3>`;

    for (
      const asset
      of items
    ) {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "saved-item";

      const preview =
        document.createElement(
          "div"
        );

      preview.className =
        "saved-preview";

      if (
        asset.type === "image"
      ) {
        try {
          const data =
            await getAssetData(
              asset.id
            );

          if (data) {
            preview.innerHTML =
              `<img src="${esc(data)}" alt="">`;
          }
        } catch {}
      }

      if (!preview.innerHTML) {
        preview.innerHTML =
          `<i class="fa-solid ${assetIcon(
            asset.type
          )}"></i>`;
      }

      const info =
        document.createElement(
          "div"
        );

      info.className =
        "saved-info";

      info.innerHTML = `
        <div class="saved-name">
          ${esc(asset.name)}
        </div>

        <div class="saved-type">
          ${assetTypeName(asset.type)}
          •
          ${formatAssetDate(
            asset.createdAt
          )}
        </div>
      `;

      const actions =
        document.createElement(
          "div"
        );

      actions.className =
        "saved-actions";

      const open =
        document.createElement(
          "button"
        );

      open.title = "Avaa";

      open.innerHTML =
        '<i class="fa-solid fa-eye"></i>';

      open.onclick =
        () =>
          openSavedAsset(asset);

      const download =
        document.createElement(
          "button"
        );

      download.title =
        "Lataa puhelimeen";

      download.innerHTML =
        '<i class="fa-solid fa-download"></i>';

      download.onclick =
        () =>
          downloadSavedAsset(
            asset
          );

      const del =
        document.createElement(
          "button"
        );

      del.title =
        "Poista";

      del.className =
        "delete";

      del.innerHTML =
        '<i class="fa-solid fa-trash"></i>';

      del.onclick =
        () =>
          deleteSavedAsset(
            asset
          );

      actions.append(
        open,
        download,
        del
      );

      row.append(
        preview,
        info,
        actions
      );

      category.appendChild(
        row
      );
    }

    list.appendChild(
      category
    );
  }
}

function openSavedModal() {
  const modal =
    $("savedModal");

  if (!modal) return;

  modal.classList.add(
    "active"
  );

  renderSavedAssets();
}

// ============================================================
// GAME
// ============================================================

let gameCode =
  localStorage.getItem(
    "pona_game_code"
  ) ||
  `<!doctype html>
<html lang="fi">
<head>
<meta charset="UTF-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>PonaAI Game</title>
</head>

<body>
<h1>PonaAI Game</h1>
<p>
  Pyydä PonaAI:ta tekemään peli.
</p>
</body>
</html>`;

function normalizeCodeLanguage(
  language
) {
  const lang =
    String(language || "")
      .toLowerCase()
      .trim();

  if (
    ["html", "htm", "xml"]
      .includes(lang)
  ) {
    return "html";
  }

  if (
    ["css", "scss"]
      .includes(lang)
  ) {
    return "css";
  }

  if (
    [
      "js",
      "javascript",
      "mjs",
      "jsx",
      "typescript",
      "ts"
    ].includes(lang)
  ) {
    return "js";
  }

  if (
    ["json"].includes(lang)
  ) {
    return "json";
  }

  return lang || "code";
}

function extractCodeBlocks(text) {
  const source =
    String(text || "");

  const blocks = [];

  const regex =
    /```([a-zA-Z0-9_+.-]*)[ \t]*\r?\n?([\s\S]*?)```/g;

  let match;

  while (
    (match = regex.exec(source))
  ) {
    let code =
      match[2] || "";

    code =
      code
        .replace(
          /^\r?\n/,
          ""
        )
        .replace(
          /\r?\n$/,
          ""
        );

    const before =
      source.slice(
        Math.max(
          0,
          match.index - 180
        ),
        match.index
      );

    const fileMatch =
      before.match(
        /(?:^|\n)\s*(?:filename|file|tiedosto)?\s*[:\-]?\s*`?([A-Za-z0-9_.-]+\.(?:html?|css|js|mjs|json|ts))`?\s*$/i
      );

    blocks.push({
      language:
        normalizeCodeLanguage(
          match[1]
        ),

      code,

      filename:
        fileMatch?.[1] || ""
    });
  }

  return blocks;
}

function inferBlockType(block) {
  const filename =
    String(
      block.filename || ""
    ).toLowerCase();

  if (
    filename.endsWith(".html") ||
    filename.endsWith(".htm")
  ) {
    return "html";
  }

  if (
    filename.endsWith(".css")
  ) {
    return "css";
  }

  if (
    filename.endsWith(".js") ||
    filename.endsWith(".mjs")
  ) {
    return "js";
  }

  if (
    block.language === "html"
  ) {
    return "html";
  }

  if (
    block.language === "css"
  ) {
    return "css";
  }

  if (
    block.language === "js"
  ) {
    return "js";
  }

  const code =
    block.code || "";

  if (
    /<!doctype\s+html|<html[\s>]|<body[\s>]|<head[\s>]|<canvas[\s>]/i
      .test(code)
  ) {
    return "html";
  }

  if (
    /(^|\n)\s*[.#a-zA-Z][^{]{0,80}{[\s\S]*?}/
      .test(code) &&
    !/\b(function|const|let|var)\b/
      .test(code)
  ) {
    return "css";
  }

  if (
    /\b(const|let|var|function|document\.|window\.|addEventListener)\b/
      .test(code)
  ) {
    return "js";
  }

  return "code";
}

function escapeForInlineScript(
  code
) {
  return String(code || "")
    .replace(
      /<\/script/gi,
      "<\\/script"
    );
}

function escapeForInlineStyle(
  code
) {
  return String(code || "")
    .replace(
      /<\/style/gi,
      "<\\/style"
    );
}

function ensureHtmlDocument(html) {
  let source =
    String(html || "")
      .trim();

  if (!source) {
    source =
      "<main id=\"game\"></main>";
  }

  if (
    !/<html[\s>]/i.test(
      source
    )
  ) {
    source = `
<!doctype html>
<html lang="fi">
<head>
<meta charset="UTF-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>PonaAI Game</title>
</head>
<body>
${source}
</body>
</html>`;
  }

  return source;
}

function injectIntoHtml(
  html,
  css,
  js
) {
  let source =
    ensureHtmlDocument(
      html
    );

  if (css.trim()) {
    const styleTag =
      `<style>\n${escapeForInlineStyle(
        css
      )}\n</style>`;

    if (
      /<\/head>/i.test(
        source
      )
    ) {
      source =
        source.replace(
          /<\/head>/i,
          `${styleTag}\n</head>`
        );
    } else {
      source =
        `${styleTag}\n${source}`;
    }
  }

  if (js.trim()) {
    const scriptTag =
      `<script>\n${escapeForInlineScript(
        js
      )}\n<\/script>`;

    if (
      /<\/body>/i.test(
        source
      )
    ) {
      source =
        source.replace(
          /<\/body>/i,
          `${scriptTag}\n</body>`
        );
    } else {
      source +=
        scriptTag;
    }
  }

  return source;
}

function buildRunnableGame(
  answer
) {
  const blocks =
    extractCodeBlocks(
      answer
    );

  if (!blocks.length) {
    return null;
  }

  let html = "";

  const css = [];
  const js = [];
  const unknown = [];

  for (
    const block of blocks
  ) {
    const type =
      inferBlockType(
        block
      );

    if (
      type === "html"
    ) {
      html +=
        (html ? "\n\n" : "") +
        block.code;

    } else if (
      type === "css"
    ) {
      css.push(
        block.code
      );

    } else if (
      type === "js"
    ) {
      js.push(
        block.code
      );

    } else {
      unknown.push(
        block.code
      );
    }
  }

  if (
    !html &&
    unknown.length
  ) {
    const combined =
      unknown.join(
        "\n\n"
      );

    if (
      /<!doctype\s+html|<html[\s>]|<body[\s>]|<head[\s>]/i
        .test(combined)
    ) {
      html =
        combined;
    }
  }

  if (!html) {
    html =
      `<main id="game"></main>`;
  }

  return injectIntoHtml(
    html,
    css.join("\n\n"),
    js.join("\n\n")
  );
}

function updateGameFromAnswer(
  answer
) {
  const blocks =
    extractCodeBlocks(
      answer
    );

  if (!blocks.length) {
    return false;
  }

  const runnable =
    buildRunnableGame(
      answer
    );

  if (!runnable) {
    return false;
  }

  gameCode =
    runnable;

  localStorage.setItem(
    "pona_game_code",
    gameCode
  );

  const frame =
    $("gameFrame");

  if (frame) {
    frame.srcdoc =
      gameCode;
  }

  return true;
}

// ============================================================
// TTS
// ============================================================

function initTTS() {
  updateStopSpeechButton();
}

function cleanSpeechText(
  text
) {
  return String(text || "")
    .replace(
      /\[PONA_EMOTION:[\s\S]*?\]/gi,
      ""
    )
    .replace(
      /```[\s\S]*?```/g,
      ""
    )
    .replace(
      /`([^`]+)`/g,
      "$1"
    )
    .replace(
      /^#{1,6}\s*/gm,
      ""
    )
    .replace(
      /[*_~]/g,
      ""
    )
    .replace(
      /\[([^\]]+)\]\([^)]+\)/g,
      "$1"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

function base64ToBlob(
  base64,
  mimeType = "audio/wav"
) {
  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return new Blob(
    [bytes],
    {
      type: mimeType
    }
  );
}

function updateStopSpeechButton() {
  const button =
    $("stopSpeechBtn");

  if (!button) return;

  button.disabled =
    !isSpeaking &&
    !ttsController;

  button.classList.toggle(
    "active",
    Boolean(
      isSpeaking ||
      ttsController
    )
  );
}

function stopSpeaking() {
  ttsRequestId++;

  if (ttsController) {
    try {
      ttsController.abort();
    } catch {}
  }

  ttsController =
    null;

  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {}

    try {
      currentAudio.currentTime =
        0;
    } catch {}

    try {
      currentAudio.removeAttribute(
        "src"
      );

      currentAudio.load();
    } catch {}

    currentAudio =
      null;
  }

  if (audioUrl) {
    try {
      URL.revokeObjectURL(
        audioUrl
      );
    } catch {}

    audioUrl =
      null;
  }

  isSpeaking =
    false;

  updateStopSpeechButton();
}

async function speak(
  text
) {
  const cleanText =
    cleanSpeechText(
      text
    );

  if (!cleanText) {
    return;
  }

  stopSpeaking();

  const requestId =
    ttsRequestId;

  const controller =
    new AbortController();

  ttsController =
    controller;

  isSpeaking =
    true;

  updateStopSpeechButton();

  setEmotion(
    "Puhuu",
    "🗣️"
  );

  try {
    const result =
      await ai.speak(
        cleanText,
        selectedVoice,
        controller.signal
      );

    if (
      controller.signal.aborted ||
      requestId !== ttsRequestId
    ) {
      return;
    }

    if (
      !result ||
      !result.data
    ) {
      throw new Error(
        "TTS ei palauttanut audiota."
      );
    }

    const blob =
      base64ToBlob(
        result.data,
        result.mimeType ||
          "audio/wav"
      );

    if (
      controller.signal.aborted ||
      requestId !== ttsRequestId
    ) {
      return;
    }

    audioUrl =
      URL.createObjectURL(
        blob
      );

    const audio =
      new Audio(
        audioUrl
      );

    currentAudio =
      audio;

        let dynamicRate= TTS_PLAYBACK_RATE;
    if (currentMood === "angry") dynamicRate = 1.30;
    else if (currentMood === "love" || currentMood === "shy") dynamicRate =1.05;
    else if (currentMood === "excited") dynamicRate = 1.25;
    else if (currentMood === "sad") dynamicRate = 0.95;

    audio.playbackRate = dynamicRate;

    audio.preload =
      "auto";

    audio.onended =
      () => {
        if (
          requestId !==
          ttsRequestId
        ) {
          return;
        }

        isSpeaking =
          false;

        if (audioUrl) {
          try {
            URL.revokeObjectURL(
              audioUrl
            );
          } catch {}

          audioUrl =
            null;
        }

        currentAudio =
          null;

        ttsController =
          null;

        updateStopSpeechButton();

        setEmotion(
          "Rauhallinen",
          "😌"
        );
      };

    audio.onerror =
      () => {
        if (
          requestId !==
          ttsRequestId
        ) {
          return;
        }

        isSpeaking =
          false;

        currentAudio =
          null;

        if (audioUrl) {
          try {
            URL.revokeObjectURL(
              audioUrl
            );
          } catch {}

          audioUrl =
            null;
        }

        ttsController =
          null;

        updateStopSpeechButton();

        console.warn(
          "PonaAI:n äänentoisto epäonnistui."
        );
      };

    await audio.play();

    if (
      controller.signal.aborted ||
      requestId !== ttsRequestId
    ) {
      try {
        audio.pause();
      } catch {}

      return;
    }

  } catch (e) {
    if (
      e?.name ===
        "AbortError" ||
      controller.signal.aborted ||
      requestId !==
        ttsRequestId
    ) {
      return;
    }

    console.warn(
      "PonaAI TTS epäonnistui:",
      e
    );

  } finally {
    if (
      requestId ===
      ttsRequestId
    ) {
      ttsController =
        null;

      if (
        !currentAudio ||
        !isSpeaking
      ) {
        isSpeaking =
          false;
      }

      updateStopSpeechButton();
    }
  }
}

// ============================================================
// MICROFONI
// ============================================================

let speechRecognitionPlugin =
  null;

function getSpeechRecognitionPlugin() {
  if (
    speechRecognitionPlugin
  ) {
    return speechRecognitionPlugin;
  }

  const capacitor =
    window.Capacitor;

  if (!capacitor) {
    return null;
  }

  if (
    capacitor.Plugins?.SpeechRecognition
  ) {
    speechRecognitionPlugin =
      capacitor.Plugins.SpeechRecognition;

    return speechRecognitionPlugin;
  }

  if (
    typeof capacitor.registerPlugin ===
    "function"
  ) {
    try {
      speechRecognitionPlugin =
        capacitor.registerPlugin(
          "SpeechRecognition"
        );

      return speechRecognitionPlugin;

    } catch (e) {
      console.warn(
        "SpeechRecognition-pluginin rekisteröinti epäonnistui:",
        e
      );
    }
  }

  return null;
}

async function initSpeechRecognition() {
  const micBtn =
    $("micBtn");

  if (!micBtn) return;

  recognition =
    getSpeechRecognitionPlugin();

  if (!recognition) {
    console.warn(
      "SpeechRecognition-plugin ei löytynyt Capacitorista."
    );

    micBtn.title =
      "Puheentunnistus ei ole käytettävissä";

    return;
  }

  try {
    const availability =
      await recognition.available();

    if (
      !availability?.available
    ) {
      console.warn(
        "Androidin puheentunnistus ei ole käytettävissä."
      );

      micBtn.title =
        "Puheentunnistus ei ole käytettävissä";

      return;
    }

  } catch (e) {
    console.warn(
      "Puheentunnistuksen saatavuuden tarkistus epäonnistui:",
      e
    );
  }

  try {
    await recognition.addListener(
      "partialResults",
      event => {
        const matches =
          event?.matches ||
          [];

        const accumulated =
          event?.accumulatedText ||
          event?.accumulated ||
          "";

        const text =
          accumulated ||
          matches[0] ||
          "";

        if (!text) {
          return;
        }

        $("input").value =
          text;

        $("input").dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true
            }
          )
        );
      }
    );

  } catch (e) {
    console.warn(
      "partialResults-listener epäonnistui:",
      e
    );
  }

  try {
    await recognition.addListener(
      "listeningState",
      event => {
        const state =
          event?.state ||
          event?.status ||
          "";

        const listening =
          String(state)
            .toLowerCase()
            .includes(
              "listening"
            );

        if (listening) {
          isListening =
            true;

          micBtn.classList.add(
            "active"
          );

          micBtn.innerHTML =
            '<i class="fa-solid fa-stop"></i>';

          micBtn.title =
            "Lopeta kuuntelu";

          $("input").placeholder =
            "Kuuntelen…";

          setEmotion(
            "Kuuntelee",
            "🎙️"
          );

        } else {
          isListening =
            false;

          micBtn.classList.remove(
            "active"
          );

          micBtn.innerHTML =
            '<i class="fa-solid fa-microphone"></i>';

          micBtn.title =
            "Puhu PonaAI:lle";

          $("input").placeholder =
            "Kirjoita PonaAI:lle...";

          if (
            !voiceCallActive
          ) {
            setEmotion(
              "Valmis",
              "😊"
            );
          }
        }
      }
    );

  } catch (e) {
    console.warn(
      "listeningState-listener epäonnistui:",
      e
    );
  }

  micBtn.onclick =
    async () => {
      if (isListening) {
        try {
          await recognition.stop();
        } catch (e) {
          console.warn(
            "Puheen pysäytys epäonnistui:",
            e
          );
        }

        return;
      }

      try {
        const permission =
          await recognition.requestPermissions();

        if (
          permission?.speechRecognition !==
          "granted"
        ) {
          alert(
            "PonaAI tarvitsee mikrofonin käyttöluvan."
          );

          return;
        }

        $("input").value =
          "";

        $("input").placeholder =
          "Kuuntelen…";

        isListening =
          true;

        micBtn.classList.add(
          "active"
        );

        micBtn.innerHTML =
          '<i class="fa-solid fa-stop"></i>';

        micBtn.title =
          "Lopeta kuuntelu";

        setEmotion(
          "Kuuntelee",
          "🎙️"
        );

        const result =
          await recognition.start({
            language: "fi-FI",
            maxResults: 1,
            partialResults: true,
            popup: false
          });

        const finalText =
          result?.matches?.[0]?.trim() ||
          $("input")
            .value
            .trim();

        if (finalText) {
          $("input").value =
            finalText;

          $("input").dispatchEvent(
            new Event(
              "input",
              {
                bubbles: true
              }
            )
          );

          setTimeout(() => {
            if (
              $("input")
                .value
                .trim()
            ) {
              send();
            }
          }, 150);
        }

      } catch (e) {
        console.error(
          "Puheentunnistus epäonnistui:",
          e
        );

        const message =
          e?.message ||
          String(e);

        if (
          message
            .toLowerCase()
            .includes(
              "permission"
            )
        ) {
          alert(
            "PonaAI ei saanut mikrofonin käyttöoikeutta."
          );
        }

        setEmotion(
          "Mikrofonivirhe",
          "⚠️"
        );

      } finally {
        isListening =
          false;

        micBtn.classList.remove(
          "active"
        );

        micBtn.innerHTML =
          '<i class="fa-solid fa-microphone"></i>';

        micBtn.title =
          "Puhu PonaAI:lle";

        $("input").placeholder =
          "Kirjoita PonaAI:lle...";
      }
    };
}

// ============================================================
// ÄÄNIPUHELU
// ============================================================

function createVoiceCallButton() {
  if ($("voiceCallBtn")) {
    return;
  }

  const composer =
    document.querySelector(
      ".composer"
    );

  if (!composer) {
    return;
  }

  const row =
    document.createElement(
      "div"
    );

  row.style.cssText =
    `
      display:flex;
      gap:8px;
      margin-bottom:8px;
    `;

  voiceCallButton =
    document.createElement(
      "button"
    );

  voiceCallButton.id =
    "voiceCallBtn";

  voiceCallButton.className =
    "action";

  voiceCallButton.style.flex =
    "1";

  voiceCallButton.innerHTML =
    '<i class="fa-solid fa-phone"></i> Aloita äänipuhelu';

  voiceCallButton.onclick =
    toggleVoiceCall;

  row.appendChild(
    voiceCallButton
  );

  composer.parentNode.insertBefore(
    row,
    composer
  );
}

function updateVoiceCallButton() {
  if (!voiceCallButton) {
    return;
  }

  if (voiceCallActive) {
    voiceCallButton.innerHTML =
      '<i class="fa-solid fa-phone-slash"></i> Lopeta äänipuhelu';

    voiceCallButton.classList.add(
      "danger"
    );

  } else {
    voiceCallButton.innerHTML =
      '<i class="fa-solid fa-phone"></i> Aloita äänipuhelu';

    voiceCallButton.classList.remove(
      "danger"
    );
  }
}

async function toggleVoiceCall() {
  if (!voiceCallActive) {
    await startVoiceCall();
    return;
  }

  if (
    voiceCallBusy ||
    isSpeaking
  ) {
    stopSpeaking();
    return;
  }

  await voiceCallListen();
}

async function startVoiceCall() {
  if (!recognition) {
    setEmotion(
      "Mikrofoni ei valmis",
      "⚠️"
    );

    return;
  }

  try {
    const permission =
      await recognition.requestPermissions();

    if (
      permission?.speechRecognition !==
      "granted"
    ) {
      alert(
        "PonaAI tarvitsee mikrofonin käyttöluvan."
      );

      return;
    }

  } catch (e) {
    console.error(
      "Äänipuhelun mikrofonilupa:",
      e
    );

    return;
  }

  voiceCallActive =
    true;

  voiceCallBusy =
    false;

  updateVoiceCallButton();

  setEmotion(
    "Puhelu päällä",
    "📞"
  );
}

async function voiceCallListen() {
  if (
    !voiceCallActive ||
    voiceCallBusy ||
    isSpeaking
  ) {
    return;
  }

  const plugin =
    getSpeechRecognitionPlugin();

  if (!plugin) {
    console.warn(
      "SpeechRecognition-plugin puuttuu."
    );

    return;
  }

  try {
    if (voiceCallButton) {
      voiceCallButton.classList.add(
        "listening"
      );

      voiceCallButton.innerHTML =
        '<i class="fa-solid fa-microphone"></i> Kuuntelen...';
    }

    $("input").value =
      "";

    const result =
      await plugin.start({
        language: "fi-FI",
        maxResults: 1,
        partialResults: false,
        popup: false
      });

    if (!voiceCallActive) {
      return;
    }

    let text = "";

    if (
      Array.isArray(
        result?.matches
      )
    ) {
      text =
        result.matches[0] ||
        "";
    }

    text =
      String(text).trim();

    console.log(
      "VOICE USER:",
      text
    );

    if (!text) {
      setEmotion(
        "En kuullut",
        "👂"
      );

      return;
    }

    await voiceCallProcess(
      text
    );

  } catch (e) {
    console.warn(
      "Äänipuhelun kuunteluvirhe:",
      e
    );

  } finally {
    if (voiceCallButton) {
      voiceCallButton.classList.remove(
        "listening"
      );

      if (
        voiceCallActive
      ) {
        voiceCallButton.innerHTML =
          '<i class="fa-solid fa-microphone"></i> Paina ja puhu';
      }
    }
  }
}

async function voiceCallProcess(
  text
) {
  if (
    !voiceCallActive ||
    voiceCallBusy
  ) {
    return;
  }

  voiceCallBusy =
    true;

  try {
    addMessage(
      "user",
      text
    );

    store.push({
      role: "user",
      text
    });

    setThinking(
      true,
      "PonaAI miettii..."
    );

    let answer = "";

    answer =
      await ai.stream(
        text,
        {
          onThought:
            thought => {
              setThinking(
                true,
                thought
              );
            },

          onStatus:
            status => {
              setThinking(
                true,
                status
              );
            },

          onText:
            () => {},

          onEmotion:
            emotion => {
              if (emotion) {
                setEmotion(
                  emotion.name ||
                    "Rauhallinen",
                  emotion.emoji ||
                    "😌"
                );
              }
            },

          onComplete:
            () => {}
        }
      );

    setThinking(
      false
    );

    if (!answer) {
      answer =
        "En saanut vastausta.";
    }

    addMessage(
      "ai",
      answer
    );

    store.push({
      role: "model",
      text: answer
    });

    await speak(
      answer
    );

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          700
        )
    );

  } catch (e) {
    setThinking(
      false
    );

    console.error(
      "Äänipuhelun vastausvirhe:",
      e
    );

    addMessage(
      "ai",
      "Äänipuhelussa tuli virhe: " +
        (e.message || e)
    );

  } finally {
    voiceCallBusy =
      false;

    if (
      voiceCallActive
    ) {
      if (voiceCallButton) {
        voiceCallButton.classList.remove(
          "listening"
        );

        voiceCallButton.innerHTML =
          '<i class="fa-solid fa-microphone"></i> Paina ja puhu';
      }

      setEmotion(
        "Puhelu päällä",
        "📞"
      );
    }
  }
}

// ============================================================
// HELPERS
// ============================================================

function rememberFromText(
  text
) {
  const value =
    String(text || "")
      .trim();

  if (!value) {
    return null;
  }

  const patterns = [
    /^muista että\s+(.+)$/i,
    /^muista et\s+(.+)$/i,
    /^muista\s+että\s+(.+)$/i,
    /^muista:\s*(.+)$/i,
    /^muista\s+(.+)$/i
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      value.match(
        pattern
      );

    if (!match) {
      continue;
    }

    const memory =
      match[1].trim();

    if (!memory) {
      return null;
    }

    store.addMemory(
      memory,
      "user"
    );

    return memory;
  }

  return null;
}

function esc(value) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

// ============================================================
// MARKDOWN / CODE
// ============================================================

function formatProse(
  text
) {
  return esc(text)
    .replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    )
    .replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    )
    .replace(
      /\n/g,
      "<br>"
    );
}

window.scrollToCodeBlock = function(id) {
  const el =document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("code-highlight-pulse");setTimeout(() => el.classList.remove("code-highlight-pulse"), 2000);
  }};

function formatText(
  text,
  msgId = ("msg_" + Math.random().toString(36).slice(2, 8))
) {const source = String(text ?? "");
  const regex = /([a-zA-Z0-9_+.-]*)[ \t]*\r?\n?([\s\S]*?)/g;

  let output ="";
  let lastIndex = 0;
  let match;
  let codeBlocks = [];let blockIndex = 0;

  while ((match = regex.exec(source))) {
    const prose= source.slice(lastIndex, match.index);
    output += formatProse(prose);const language = normalizeCodeLanguage(match[1]);
    const code = String(match[2] ||"")
      .replace(/^\r?\n/, "")
      .replace(/\r?\n$/, "");

    let blockFileName = "";const firstLine = code.trim().split("\n")[0] || "";
    if (firstLine.startsWith("//") || firstLine.startsWith("/*") || firstLine.startsWith("#") || firstLine.startsWith("<!--")) {
      const matchName = firstLine.replace(/^[\/\*#<!\s-]+/, "").replace(/[-*>\/]+$/, "").trim();
      if (matchName.includes(".")) {
        blockFileName = matchName;}
    }
    if (!blockFileName) {
      blockFileName = language ? `${language.toUpperCase()}-tiedosto ${blockIndex + 1}` : `Koodi ${blockIndex + 1}`;
    }const blockDomId = `code_${msgId}_${blockIndex++}`;
    codeBlocks.push({id: blockDomId, name: blockFileName });

    output += `
      <div class="code-block" id="${blockDomId}">
        <div class="code-head">
          <span>📄 ${esc(blockFileName)}</span>
          <button type="button" class="code-copy" data-copy-code>Kopioi</button>
        </div>
        <pre><code>${esc(code)}</code></pre>
      </div>
    `;

    lastIndex = regex.lastIndex;
  }

  output +=formatProse(source.slice(lastIndex));

  if (codeBlocks.length > 0) {const chipsHtml = codeBlocks.map(b => 
      `<button type="button" class="code-jump-chip" onclick="scrollToCodeBlock('${b.id}')"><i class="fa-solid fa-code"></i> ${esc(b.name)}</button>`
    ).join("");

    output +=`
      <div class="message-code-chips">
        <span class="chips-label">Tiedostot:</span>
        ${chipsHtml}
      </div>
    `;
  }

  return output;}

async function copyTextFallback(
  text
) {
  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.value =
    text;

  textarea.style.position =
    "fixed";

  textarea.style.opacity =
    "0";

  document.body.appendChild(
    textarea
  );

  textarea.focus();
  textarea.select();

  try {
    document.execCommand(
      "copy"
    );
  } finally {
    textarea.remove();
  }
}

function bindCodeCopyButtons(
  root
) {
  if (!root) return;

  root
    .querySelectorAll(
      "[data-copy-code]"
    )
    .forEach(
      button => {
        if (
          button.dataset.bound ===
          "1"
        ) {
          return;
        }

        button.dataset.bound =
          "1";

        button.onclick =
          async () => {
            const block =
              button.closest(
                ".code-block"
              );

            const code =
              block
                ?.querySelector(
                  "code"
                )
                ?.textContent ||
              "";

            if (!code) {
              return;
            }

            const original =
              button.textContent;

            try {
              if (
                navigator.clipboard
                  ?.writeText
              ) {
                await navigator.clipboard.writeText(
                  code
                );
              } else {
                await copyTextFallback(
                  code
                );
              }

              button.textContent =
                "Kopioitu";

              setTimeout(
                () => {
                  button.textContent =
                    original;
                },
                1000
              );

            } catch (e) {
              console.warn(
                "Kopiointi epäonnistui:",
                e
              );

              try {
                await copyTextFallback(
                  code
                );

                button.textContent =
                  "Kopioitu";

                setTimeout(
                  () => {
                    button.textContent =
                      original;
                  },
                  1000
                );

              } catch {
                alert(
                  "Koodin kopiointi epäonnistui."
                );
              }
            }
          };
      }
    );
}

function addMessage(
  role,
  text,
  meta = ""
) {
  const d =
    document.createElement(
      "div"
    );

  const uiRole =
    role === "model" ||
    role === "assistant"
      ? "ai"
      : role;

  d.className =
    `msg ${uiRole}`;

  d.innerHTML = `
    <div class="msg-content">
      ${formatText(text)}
    </div>

    ${
      meta
        ? `<div class="meta">${esc(
            meta
          )}</div>`
        : ""
    }
  `;

  $("chat").appendChild(
    d
  );

  bindCodeCopyButtons(
    d
  );

  $("chat").scrollTop =
    $("chat").scrollHeight;

  return d;
}

// ============================================================
// THINKING
// ============================================================

function setThinking(
  on,
  label = "Ajattelee…"
) {
  const stateEl =
    $("thinkingState");

  const boxEl =
    $("thinkingBox");

  const textEl =
    $("thinkingText");

  if (stateEl) {
    stateEl.textContent =
      on
        ? label
        : "Valmis";
  }

  if (boxEl) {
    boxEl.classList.toggle(
      "hidden",
      !on &&
      !textEl?.textContent?.trim()
    );
  }
}

// ============================================================
// FACE
// ============================================================

function drawFace() {
  const c =
    $("face");

  if (!c) return;

  const x =
    c.getContext(
      "2d"
    );

  const w =
    c.width;

  const h =
    c.height;

  const t =
    performance.now() /
    1000;

  x.clearRect(
    0,
    0,
    w,
    h
  );

    const moodStyles = {
    happy: { glow: "#00f0a8", eyeStyle: "dot", mouth: "smile", blush: false },
    angry: { glow: "#ff4757", eyeStyle: "angry", mouth: "frown", blush: false },sad: { glow: "#6ea8ff", eyeStyle: "sad", mouth: "sad", blush:false },
    excited: { glow: "#ffb300", eyeStyle: "star", mouth:"bigSmile", blush: false },
    love: { glow: "#ff4fa3", eyeStyle:"dot", mouth: "smile", blush: true },
    shy: { glow: "#ff9ff3", eyeStyle: "shy", mouth: "smallSmile", blush: true },
    thinking: { glow:"#9b6cff", eyeStyle: "thinking", mouth: "line", blush: false },neutral: { glow: "#00d2ff", eyeStyle: "dot", mouth: "neutral", blush: false }
  };

  const speakingPulse =
    isSpeaking
      ? 1 +
        Math.abs(
          Math.sin(
            t * 14
          )
        ) *
          0.08
      : 1;

  const style =
    moodStyles[
      currentMood
    ] ||
    moodStyles.neutral;

  const pulse =
    (
      1 +
      Math.sin(
        t * 3
      ) *
        0.025
    ) *
    speakingPulse;

  x.save();

  x.translate(
    w / 2,
    h / 2
  );

  x.scale(
    pulse,
    pulse
  );

  x.shadowBlur =
    isSpeaking
      ? 26
      : 18;

  x.shadowColor =
    style.glow;

  x.fillStyle =
    "#071321";

  x.strokeStyle =
    style.glow;

  x.lineWidth =
    3;

  x.beginPath();

  x.arc(
    0,
    0,
    35,
    0,
    Math.PI * 2
  );

  x.fill();
  x.stroke();

  x.shadowBlur =
    0;

  x.fillStyle =
    style.glow;

  x.strokeStyle =
    style.glow;

  x.lineWidth =
    2;

  if (
    style.eyeStyle ===
    "angry"
  ) {
    x.beginPath();

    x.arc(
      -13,
      -6,
      4,
      0,
      Math.PI * 2
    );

    x.arc(
      13,
      -6,
      4,
      0,
      Math.PI * 2
    );

    x.fill();

    x.beginPath();

    x.moveTo(
      -20,
      -16
    );

    x.lineTo(
      -7,
      -11
    );

    x.moveTo(
      20,
      -16
    );

    x.lineTo(
      7,
      -11
    );

    x.stroke();

  } else {
    x.beginPath();

    x.arc(
      -13,
      -8,
      4,
      0,
      Math.PI * 2
    );

    x.arc(
      13,
      -8,
      4,
      0,
      Math.PI * 2
    );

    x.fill();

    x.beginPath();

    x.moveTo(
      -19,
      -18
    );

    x.lineTo(
      -7,
      -19
    );

    x.moveTo(
      19,
      -18
    );

    x.lineTo(
      7,
      -19
    );

    x.stroke();
  }

  x.beginPath();

  if (isSpeaking) {
    const mouthOpen =
      3 +
      Math.abs(
        Math.sin(
          t * 13
        )
      ) *
        7;

    x.ellipse(
      0,
      13,
      9,
      mouthOpen,
      0,
      0,
      Math.PI * 2
    );

    x.stroke();

  } else if (
    style.mouth ===
      "smile" ||
    style.mouth ===
      "bigSmile"
  ) {
    x.arc(
      0,
      8,
      style.mouth ===
        "bigSmile"
        ? 14
        : 11,
      0.15 * Math.PI,
      0.85 * Math.PI
    );

    x.stroke();

  } else if (
    style.mouth ===
      "frown" ||
    style.mouth ===
      "sad"
  ) {
    x.arc(
      0,
      18,
      10,
      Math.PI * 1.1,
      Math.PI * 1.9
    );

    x.stroke();

  } else if (
    style.mouth ===
    "smallSmile"
  ) {
    x.arc(
      0,
      12,
      6,
      0.2 * Math.PI,
      0.8 * Math.PI
    );

    x.stroke();

  } else {
    x.moveTo(
      -10,
      14
    );

    x.quadraticCurveTo(
      0,
      18,
      10,
      14
    );

    x.stroke();
  }

  x.restore();

  requestAnimationFrame(
    drawFace
  );
}

function setEmotion(name, emoji = "😌") {
  const n = String(name).toLowerCase();if (n.includes("vih") || n.includes("raivo")) {
    currentMood = "angry";
  } else if (n.includes("rakas") || n.includes("ihas") ||n.includes("helt")) {
    currentMood = "love";
  } else if (n.includes("ujost") || n.includes("häpe") || n.includes("nolo")) {currentMood = "shy";
  } else if (n.includes("ilo") || n.includes("innost")) {
    currentMood = "happy";
  } else if (n.includes("sur") ||n.includes("tyls")) {
    currentMood = "sad";
  } else if (n.includes("piru") || n.includes("huvit") || n.includes("itsev")) {
    currentMood= "excited";
  } else if (n.includes("miet") || n.includes("ajat") || n.includes("keskit") || n.includes("utel")) {
    currentMood = "thinking";
  }else {
    currentMood = "neutral";
  }

  const emotionEl = $("emotion");const moodTextEl = $("moodText");

  if (emotionEl) {
    emotionEl.textContent =`${emoji} ${name}`;
  }
  if (moodTextEl) {
    moodTextEl.textContent = `Moodi: ${String(name).toLowerCase()}`;
  }
}

// ============================================================
// PROJECTS
// ============================================================

function renderProjects() {
  const box =
    $("projects");

  if (!box) return;

  box.innerHTML =
    "";

  for (
    const p of store.projects()
  ) {
    const assets =
      p.assets || [];

    const imageAssets =
      assets.filter(
        asset =>
          asset.type ===
            "image" &&
          asset.data
      );

    const d =
      document.createElement(
        "div"
      );

    d.className =
      "project";

    d.innerHTML = `
      <div
        style="
          flex:1;
          min-width:0;
        "
      >
        <div
          style="
            font-weight:700;
            margin-bottom:6px;
          "
        >
          ${esc(p.name)}
        </div>

        ${
          imageAssets.length
            ? `
              <div
                style="
                  display:flex;
                  gap:6px;
                  overflow-x:auto;
                  margin-top:8px;
                  padding-bottom:4px;
                "
              >
                ${imageAssets
                  .map(
                    asset =>
                      `
                        <img
                          src="${esc(
                            asset.data
                          )}"
                          title="${esc(
                            asset.prompt ||
                              asset.name ||
                              "Kuva"
                          )}"
                          style="
                            width:64px;
                            height:64px;
                            object-fit:cover;
                            border-radius:10px;
                            border:1px solid rgba(255,255,255,.15);
                            flex:none;
                          "
                        >
                      `
                  )
                  .join("")}
              </div>
            `
            : `
              <div
                class="muted"
                style="
                  font-size:12px;
                  margin-top:4px;
                "
              >
                Ei tallennettuja kuvia
              </div>
            `
        }
      </div>

      <div
        style="
          display:flex;
          gap:6px;
          align-items:flex-start;
        "
      >
        <button
          data-open="${esc(p.id)}"
        >
          Avaa
        </button>

        <button
          data-del="${esc(p.id)}"
        >
          ×
        </button>
      </div>
    `;

    box.appendChild(d);
  }

  box
    .querySelectorAll(
      "[data-open]"
    )
    .forEach(
      b => {
        b.onclick =
          () => {
            store.activeProject(
              b.dataset.open
            );

            loadProject();

            $("projectsModal")
              ?.classList
              .remove(
                "active"
              );
          };
      }
    );

  box
    .querySelectorAll(
      "[data-del]"
    )
    .forEach(
      b => {
        b.onclick =
          () => {
            store.deleteProject(
              b.dataset.del
            );

            renderProjects();
          };
      }
    );
}

function loadProject() {
  const chat =
    $("chat");

  if (!chat) {
    return;
  }

  chat.innerHTML =
    "";

  const p =
    store.active();

  if (!p) {
    return;
  }

  for (
    const m of
      p.messages || []
  ) {
    addMessage(
      m.role,
      m.text,
      m.meta || ""
    );
  }
}

// ============================================================
// SETTINGS
// ============================================================

function saveSettings() {
  const profileName =
    $("profileName")
      .value
      .trim() ||
    "Käyttäjä";

  const profileAiName =
    $("profileAiName")
      .value
      .trim() ||
    "PonaAI";

  const profileAbout =
    $("profileAbout")
      .value
      .trim();

  const profileInstructions =
    $("profileInstructions")
      .value
      .trim();

  store.settings = {
    model:
      $("mainModel").value,

    thinkingLevel:
      $("thinkingLevel").value,

    personality:
      $("personality").value,

    blockLevel:
      $("blockLevel").value,

    userName:
      profileName,

    userProfile: {
      name:
        profileName,

      aiName:
        profileAiName,

      about:
        profileAbout,

      instructions:
        profileInstructions
    }
  };

  ai.refresh();

  if ($("modelTag")) {
    $("modelTag").textContent =
      store.settings.model;
  }

  if ($("aiName")) {
    $("aiName").textContent =
      profileAiName;
  }

  $("settingsModal")
    ?.classList
    .remove(
      "active"
    );
}

// ============================================================
// CHAT
// ============================================================

async function send() {
  const input =
    $("input");

  const text =
    input.value.trim();

  const remembered =
    !files.length
      ? rememberFromText(text)
      : null;

  if (remembered) {
    input.value =
      "";

    addMessage(
      "user",
      text
    );

    store.push({
      role: "user",
      text
    });

    const memoryReply =
      `Selvä. Muistan tämän: "${remembered}"`;

    addMessage(
      "ai",
      memoryReply
    );

    store.push({
      role: "model",
      text:
        memoryReply
    });

    setEmotion(
      "Iloinen",
      "🧠"
    );

    return;
  }

  if (
    !text &&
    !files.length
  ) {
    return;
  }

  const fileParts =
    [];

  for (
    const file of files
  ) {
    try {
      if (
        file.type ===
          "application/json" ||
        file.type.startsWith(
          "text/"
        ) ||
        /\.(json|js|mjs|ts|css|html?|txt|md)$/i
          .test(
            file.name
          )
      ) {
        const textContent =
          await file.text();

        fileParts.push({
          text:
            `\n--- Tiedosto: ${file.name} ---\n` +
            `${textContent}\n---`
        });

      } else {
        const base64Data =
          await new Promise(
            (
              resolve,
              reject
            ) => {
              const reader =
                new FileReader();

              reader.onload =
                () =>
                  resolve(
                    reader.result
                      .split(",")[1]
                  );

              reader.onerror =
                err =>
                  reject(err);

              reader.readAsDataURL(
                file
              );
            }
          );

        fileParts.push({
          inlineData: {
            mimeType:
              file.type ||
              "application/octet-stream",

            data:
              base64Data
          }
        });
      }

    } catch (e) {
      console.error(
        "Tiedoston luku epäonnistui:",
        e
      );
    }
  }

  const userDisplayText =
    text ||
    (
      files.length
        ? `[${files.length} liitetiedostoa]`
        : ""
    );

  input.value =
    "";

  addMessage(
    "user",
    userDisplayText
  );

  store.push({
    role: "user",
    text:
      userDisplayText
  });

  const payload =
    fileParts.length > 0
      ? {
          text,
          files:
            fileParts
        }
      : text;

  files = [];

  $("attachments").innerHTML =
    "";

  setThinking(
    true,
    "Ajattelee…"
  );

  $("thinkingBox")
    ?.classList
    .remove(
      "hidden"
    );

  $("thinkingText").textContent =
    "";

  setEmotion(
    "Utelias",
    "🧠"
  );

  const aiMsg =
    addMessage(
      "ai",
      "",
      "Gemini • käynnistyy"
    );

  try {
    let answer =
      "";

    await ai.stream(
      payload,
      {
        onThought:
          t => {
            $("thinkingBox")
              ?.classList
              .remove(
                "hidden"
              );

            $("thinkingText")
              .textContent +=
              t;

            $("thinkingText")
              .scrollTop =
              $("thinkingText")
                .scrollHeight;

            setThinking(
              true,
              "Ajattelee…"
            );
          },

        onText:
          t => {
            answer +=
              t;

            const contentEl =
              aiMsg.querySelector(
                ".msg-content"
              );

            if (contentEl) {
              contentEl.innerHTML =
                formatText(
                  answer
                );

              bindCodeCopyButtons(
                contentEl
              );
            }

            $("chat")
              .scrollTop =
              $("chat")
                .scrollHeight;
          },

        onStatus:
          s => {
            setThinking(
              true,
              s
            );
          },

        onComplete:
          () => {
            const metaEl =
              aiMsg.querySelector(
                ".meta"
              );

            if (metaEl){
              metaEl.textContent = store.settings.model;
            }
          },

        onEmotion:
          e => {
            if (!e) {
              return;
            }

            setEmotion(
              e.name ||
                "Rauhallinen",
              e.emoji ||
                "😌"
            );
          }
      }
    );

    if (!answer) {
      answer =
        "PonaAI ei palauttanut tekstivastausta.";
    }

    const metaText =
      aiMsg
        .querySelector(
          ".meta"
        )
        ?.textContent ||
      store.settings.model;

    store.push({
      role: "model",
      text:
        answer,
      meta:
        metaText
    });

    updateGameFromAnswer(
      answer
    );

    await speak(
      answer
    );

  } catch (err) {
    const errorText =
      err?.message ||
      String(err);

    aiMsg.innerHTML = `
      <div class="msg-content">
        <b>Virhe:</b>
        ${esc(errorText)}
      </div>
    `;

    store.push({
      role: "model",
      text:
        `Virhe: ${errorText}`
    });

  } finally {
    setThinking(
      false,
      "Valmis"
    );

    if (
      !$("thinkingText")
        ?.textContent
        .trim()
    ) {
      $("thinkingBox")
        ?.classList
        .add(
          "hidden"
        );
    }
  }
}

// ============================================================
// IMAGE
// ============================================================

async function generateImage() {
  const prompt =
    $("imagePrompt")
      .value
      .trim();

  if (!prompt) {
    return;
  }

  const box =
    $("mediaResult");

  box.innerHTML =
    "<p class='muted'>Generoidaan…</p>";

  try {
    const r =
      await ai.generateImage(
        $("imageModel").value,
        prompt
      );

    box.innerHTML =
      "";

    const imageList =
      r?.images ||
      (
        typeof r ===
        "string"
          ? [r]
          : []
      );

    for (
      const item of
        imageList
    ) {
      const img =
        document.createElement(
          "img"
        );

      let imageData =
        "";

      if (
        typeof item ===
        "string"
      ) {
        imageData =
          item;

      } else if (
        item?.data
      ) {
        imageData =
          `data:${
            item.mimeType ||
            "image/png"
          };base64,${
            item.data
          }`;
      }

      if (imageData) {
        img.src =
          imageData;
      }

      box.appendChild(
        img
      );

      const saveButton =
        document.createElement(
          "button"
        );

      saveButton.className =
        "action";

      saveButton.innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Tallenna kuva';

      saveButton.onclick =
        async () => {
          try {
            if (!imageData) {
              throw new Error(
                "Kuvan data puuttuu."
              );
            }

            saveButton.disabled =
              true;

            saveButton.textContent =
              "Tallennetaan…";

            await saveProjectAsset({
              type:
                "image",

              name:
                "PonaAI-kuva-" +
                Date.now() +
                ".png",

              mimeType:
                item?.mimeType ||
                "image/png",

              data:
                imageData,

              prompt
            });

            saveButton.innerHTML =
              '<i class="fa-solid fa-check"></i> Tallennettu';

          } catch (e) {
            console.error(e);

            saveButton.disabled =
              false;

            saveButton.innerHTML =
              '<i class="fa-solid fa-floppy-disk"></i> Tallenna kuva';

            alert(
              "Tallennus epäonnistui: " +
                (e.message || e)
            );
          }
        };

      box.appendChild(
        saveButton
      );
    }

    if (
      !imageList.length
    ) {
      box.innerHTML =
        "<pre>" +
        esc(
          JSON.stringify(
            r,
            null,
            2
          )
        ) +
        "</pre>";
    }

  } catch (e) {
    box.innerHTML =
      `<p class="muted">
        Virhe: ${esc(
          e.message || e
        )}
      </p>`;
  }
}

// ============================================================
// MUSIC
// ============================================================

async function generateMusic() {
  const prompt =
    $("musicPrompt")
      .value
      .trim();

  if (!prompt) {
    return;
  }

  $("musicResult")
    .innerHTML =
    "<p class='muted'>Musiikkipyyntö lähetetty.</p>";

  try {
    const r =
      await ai.generateMusic(
        $("musicModel").value,
        prompt
      );

    $("musicResult")
      .innerHTML =
      `<pre>${esc(
        JSON.stringify(
          r,
          null,
          2
        )
      )}</pre>`;

  } catch (e) {
    $("musicResult")
      .innerHTML =
      `<p class="muted">
        Virhe: ${esc(
          e.message || e
        )}
      </p>`;
  }
}

// ============================================================
// TABS
// ============================================================

document
  .querySelectorAll(
    ".tab"
  )
  .forEach(
    b => {
      b.onclick =
        () => {
          document
            .querySelectorAll(
              ".tab"
            )
            .forEach(
              x =>
                x.classList
                  .remove(
                    "active"
                  )
            );

          document
            .querySelectorAll(
              ".page"
            )
            .forEach(
              x =>
                x.classList
                  .remove(
                    "active"
                  )
            );

          b.classList.add(
            "active"
          );

          $(
            "page-" +
            b.dataset.tab
          )
            ?.classList
            .add(
              "active"
            );
        };
    }
  );

// ============================================================
// BUTTONS
// ============================================================

$("sendBtn").onclick =
  send;

$("input").addEventListener(
  "keydown",
  e => {
    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {
      e.preventDefault();
      send();
    }
  }
);

$("attachBtn").onclick =
  () =>
    $("fileInput").click();

$("fileInput").onchange =
  e => {
    files =
      [
        ...e.target.files
      ].slice(
        0,
        30
      );

    $("attachments")
      .innerHTML =
      files
        .map(
          f =>
            `<span class="chip">
              ${esc(f.name)}
            </span>`
        )
        .join("");
  };

// ============================================================
// TTS STOP BUTTON
// ============================================================

function createTTSStopButton() {
  if (
    $("stopSpeechBtn")
  ) {
    $("stopSpeechBtn")
      .onclick =
      stopSpeaking;

    updateStopSpeechButton();

    return;
  }

  const composer =
    document.querySelector(
      ".composer"
    );

  if (!composer) {
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.id =
    "stopSpeechBtn";

  button.className =
    "icon tts-stop";

  button.title =
    "Lopeta PonaAI:n puhe";

  button.disabled =
    true;

  button.innerHTML =
    '<i class="fa-solid fa-stop"></i>';

  button.onclick =
    stopSpeaking;

  composer.insertBefore(
    button,
    composer.firstChild
  );

  updateStopSpeechButton();
}

// ============================================================
// SETTINGS EVENTS
// ============================================================

$("settingsBtn").onclick =
  () => {
    $("settingsModal")
      .classList
      .add(
        "active"
      );

    const settings =
      store.settings;

    const profile =
      settings.userProfile ||
      {};

    $("mainModel").value =
      settings.model ||
      "gemini-3.8-flash";

    $("thinkingLevel").value =
      settings.thinkingLevel ||
      "medium";

    $("personality").value =
      settings.personality ||
      "sarcastic";

    $("blockLevel").value =
      settings.blockLevel ||
      "none";

    $("profileName").value =
      profile.name ||
      settings.userName ||
      "Käyttäjä";

    $("profileAiName").value =
      profile.aiName ||
      "PonaAI";

    $("profileAbout").value =
      profile.about ||
      "";

    $("profileInstructions").value =
      profile.instructions ||
      "";
  };

$("projectBtn").onclick =
  () => {
    $("projectsModal")
      .classList
      .add(
        "active"
      );

    renderProjects();
  };

$("savedBtn").onclick =
  openSavedModal;

document
  .querySelectorAll(
    ".close"
  )
  .forEach(
    b =>
      b.onclick =
        () =>
          b
            .closest(
              ".modal"
            )
            .classList
            .remove(
              "active"
            )
  );

$("saveSettings").onclick =
  saveSettings;

$("clearThinking").onclick =
  () => {
    $("thinkingText")
      .textContent =
      "";

    $("thinkingBox")
      .classList
      .add(
        "hidden"
      );
  };

$("newProject").onclick =
  () => {
    store.newProject();

    renderProjects();

    loadProject();
  };

$("runGame").onclick =
  () => {
    $("gameFrame")
      .srcdoc =
      gameCode;
  };

// ============================================================
// MEDIA BUTTONS
// ============================================================

$("imageBtn").onclick =
  generateImage;

$("musicBtn").onclick =
  generateMusic;

// ============================================================
// CAMERA
// ============================================================

let capturedCameraImage =
  null;

function createCameraControls() {
  if (
    $("cameraCapture")
  ) {
    return;
  }

  const camera =
    $("camera");

  if (!camera) {
    return;
  }

  const controls =
    document.createElement(
      "div"
    );

  controls.className =
    "button-row";

  controls.innerHTML = `
    <button
      class="action"
      id="cameraCapture"
    >
      <i class="fa-solid fa-camera"></i>
      Ota kuva
    </button>

    <button
      class="action"
      id="cameraEdit"
    >
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      Muokkaa kuvaa
    </button>
  `;

  camera.parentNode.insertBefore(
    controls,
    camera.nextSibling
  );

  $("cameraCapture").onclick =
    () => {
      try {
        const data =
          captureCameraImage();

        $("visionResult")
          .innerHTML = `
            <div class="card">

              <p class="muted">
                Kuva otettu.
              </p>

              <img
                src="${esc(data)}"
                style="
                  width:100%;
                  border-radius:14px;
                  margin-top:10px;
                  display:block;
                "
              >

              <button
                class="action"
                id="saveCapturedCameraImage"
                style="margin-top:10px;"
              >
                <i class="fa-solid fa-floppy-disk"></i>
                Tallenna kuva
              </button>

            </div>
          `;

        $("saveCapturedCameraImage")
          .onclick =
          async () => {
            const button =
              $("saveCapturedCameraImage");

            try {
              button.disabled =
                true;

              button.textContent =
                "Tallennetaan…";

              await saveProjectAsset({
                type:
                  "image",

                name:
                  "PonaAI-kamerakuva-" +
                  Date.now() +
                  ".jpg",

                mimeType:
                  "image/jpeg",

                data
              });

              button.innerHTML =
                '<i class="fa-solid fa-check"></i> Tallennettu';

            } catch (e) {
              console.error(e);

              button.disabled =
                false;

              button.innerHTML =
                '<i class="fa-solid fa-floppy-disk"></i> Tallenna kuva';

              alert(
                "Tallennus epäonnistui: " +
                  (e.message || e)
              );
            }
          };

      } catch (e) {
        $("visionResult")
          .innerHTML =
          `<p class="muted">
            ${esc(
              e.message || e
            )}
          </p>`;
      }
    };

  $("cameraEdit").onclick =
    editCapturedCameraImage;
}

// ============================================================
// EDIT CAMERA IMAGE
// ============================================================

async function editCapturedCameraImage() {
  if (
    !capturedCameraImage
  ) {
    $("visionResult")
      .innerHTML =
      `<p class="muted">
        Ota ensin kuva.
      </p>`;

    return;
  }

  const prompt =
    window.prompt(
      "Mitä haluat muuttaa kuvassa?"
    );

  if (
    !prompt?.trim()
  ) {
    return;
  }

  $("visionResult")
    .innerHTML =
    `<p class="muted">
      PonaAI muokkaa kuvaa…
    </p>`;

  try {
    const result =
      await ai.editImage(
        capturedCameraImage,
        prompt.trim()
      );

    if (
      !result?.data
    ) {
      throw new Error(
        "Muokattua kuvaa ei palautunut."
      );
    }

    capturedCameraImage =
      result.data;

    $("visionResult")
      .innerHTML = `
        <p>
          <b>Kuva muokattu.</b>
        </p>

        <img
          src="${esc(
            result.data
          )}"
          style="
            width:100%;
            border-radius:14px;
            margin-top:10px;
            display:block;
          "
        >

        <p class="muted">
          ${esc(
            prompt.trim()
          )}
        </p>

        <button
          class="action"
          id="saveEditedCameraImage"
          style="margin-top:10px;"
        >
          <i class="fa-solid fa-floppy-disk"></i>
          Tallenna kuva
        </button>
      `;

    $("saveEditedCameraImage")
      .onclick =
      async () => {
        const button =
          $("saveEditedCameraImage");

        try {
          button.disabled =
            true;

          button.textContent =
            "Tallennetaan…";

          await saveProjectAsset({
            type:
              "image",

            name:
              "PonaAI-muokattu-" +
              Date.now() +
              ".jpg",

            mimeType:
              result.mimeType ||
              "image/jpeg",

            data:
              result.data,

            prompt:
              prompt.trim()
          });

          button.innerHTML =
            '<i class="fa-solid fa-check"></i> Tallennettu';

        } catch (e) {
          console.error(e);

          button.disabled =
            false;

          button.innerHTML =
            '<i class="fa-solid fa-floppy-disk"></i> Tallenna kuva';

          alert(
            "Tallennus epäonnistui: " +
              (e.message || e)
          );
        }
      };

  } catch (e) {
    console.error(e);

    $("visionResult")
      .innerHTML =
      `<p class="muted">
        Kuvan muokkaus epäonnistui:
        ${esc(
          e.message || e
        )}
      </p>`;
  }
}

// ============================================================
// CAMERA START / STOP / SWITCH
// ============================================================

let cameraFacingMode =
  "environment";

$("cameraStart").onclick =
  async () => {
    try {
      cameraStream
        ?.getTracks()
        .forEach(
          t => t.stop()
        );

      cameraStream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                cameraFacingMode
            },
            audio: false
          });

      $("camera")
        .srcObject =
        cameraStream;

    } catch (e) {
      $("visionResult")
        .innerHTML =
        `<p class="muted">
          ${esc(
            e.message || e
          )}
        </p>`;
    }
  };

$("cameraStop").onclick =
  () => {
    cameraStream
      ?.getTracks()
      .forEach(
        t => t.stop()
      );

    cameraStream =
      null;

    $("camera")
      .srcObject =
      null;
  };

if (
  $("cameraStop") &&
  $("cameraStop").parentNode
) {
  const cameraSwitch =
    document.createElement(
      "button"
    );

  cameraSwitch.className =
    "action";

  cameraSwitch.id =
    "cameraSwitch";

  cameraSwitch.innerHTML =
    `
      <i class="fa-solid fa-camera-rotate"></i>
      Vaihda kamera
    `;

  $("cameraStop")
    .parentNode
    .appendChild(
      cameraSwitch
    );

  cameraSwitch.onclick =
    async () => {
      cameraFacingMode =
        cameraFacingMode ===
        "environment"
          ? "user"
          : "environment";

      try {
        cameraStream
          ?.getTracks()
          .forEach(
            t => t.stop()
          );

        cameraStream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode:
                  cameraFacingMode
              },
              audio: false
            });

        $("camera")
          .srcObject =
          cameraStream;

      } catch (e) {
        $("visionResult")
          .innerHTML =
          `<p class="muted">
            ${esc(
              e.message || e
            )}
          </p>`;
      }
    };
}

// ============================================================
// CAPTURE CAMERA IMAGE
// ============================================================

function captureCameraImage() {
  const video =
    $("camera");

  if (
    !video ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    throw new Error(
      "Kamera ei ole valmis."
    );
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  const maxWidth =
    1280;

  const scale =
    Math.min(
      1,
      maxWidth /
        video.videoWidth
    );

  canvas.width =
    Math.round(
      video.videoWidth *
        scale
    );

  canvas.height =
    Math.round(
      video.videoHeight *
        scale
    );

  const ctx =
    canvas.getContext(
      "2d"
    );

  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  capturedCameraImage =
    canvas.toDataURL(
      "image/jpeg",
      0.82
    );

  return capturedCameraImage;
}

// ============================================================
// CAMERA ANALYZE
// ============================================================

$("cameraAnalyze").onclick = async () => {
  if (!capturedCameraImage) {
    try {
      capturedCameraImage = captureCameraImage();
    } catch (e) {
      try {
        if (!cameraStream) {
          cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: cameraFacingMode },
            audio: false
          });
          $("camera").srcObject = cameraStream;await new Promise(r => setTimeout(r, 600));
        }
        capturedCameraImage =captureCameraImage();
      } catch(err) {
        $("visionResult").innerHTML = `<p class="muted">Käynnistä kamera ensin.</p>`;
        return;
      }
    }}

  $("visionResult").innerHTML = "<p class='muted'>Analysoidaan kuvaa PonaAI:lla…</p>";

  try {
    const r = await ai.analyzeImage(
      capturedCameraImage,"Kerro tarkasti mitä kuvassa näkyy. Merkitse tärkeimmät kohteet, tekstitja esineet selkeästi ranskalaisilla viivoilla suomeksi."
    );

    const analysisText =typeof r === "string" ? r : (r?.text || r?.answer || JSON.stringify(r,null, 2));

    $("visionResult").innerHTML = `
      <div class="card" style="margin-top:10px;">
        <p>${formatText(analysisText)}</p>
        <imgsrc="${esc(capturedCameraImage)}" style="width:100%; border-radius:12px; margin-top:8px;">
      </div>
    `;

    bindCodeCopyButtons($("visionResult"));
    await speak(analysisText);
  } catch (e) {
    $("visionResult").innerHTML = `<p class="muted">Virhe: ${esc(e.message || e)}</p>`;
  }
};

// ============================================================
// STARTUP
// ============================================================

function startup() {
  store.ensure();

  loadProject();

  if ($("gameFrame")) {
    $("gameFrame")
      .srcdoc =
      gameCode;
  }

  if ($("modelTag")) {
    $("modelTag")
      .textContent =
      store.settings.model ||
      "gemini-3.8-flash";
  }

  if ($("aiName")) {
    $("aiName")
      .textContent =
      store.settings
        .userProfile
        ?.aiName ||
      "PonaAI";
  }

          // Pidetään edellinen tunnetila, ei nollata aina rauhalliseksi!

  createTTSStopButton();

  drawFace();

  initTTS();

  initSpeechRecognition();

  createCameraControls();

  createVoiceCallButton();
}

if (
  document.readyState ===
  "loading"
) {
  window.addEventListener(
    "DOMContentLoaded",
    startup,
    {
      once: true
    }
  );
} else {
  startup();
}

