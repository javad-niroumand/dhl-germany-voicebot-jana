const TEST_SHIPMENTS = {
  "003404302811": {
    status: "In Zustellung (voraussichtlich heute)",
    detail: "Die Sendung wurde in das Zustellfahrzeug geladen. Eine Umleitung ist nicht mehr möglich.",
    nafo: false,
    plz: "54411",
  },
  "JJD000390016": {
    status: "In der Empfängerregion eingegangen",
    detail: "Ihr Paket ist regulär auf dem Weg in die Zustellung. Umleitung oder Ablageort sind noch möglich.",
    nafo: false,
    plz: "84030",
  },
  "825643754000": {
    status: "Scanabriss unterwegs (seit 6 Werktagen kein neuer Scan)",
    detail: "Ihr Paket ist vor 8 Tagen eingegangen. Sie können jetzt direkt mit Jana eine Nachforschung starten.",
    nafo: true,
    plz: "06188",
  },
  "003404325072": {
    status: "Als zugestellt markiert (Original-Empfänger)",
    detail: "Falls das Paket nicht auffindbar ist, unterstützt Jana Sie direkt bei der Nachforschung.",
    nafo: true,
    plz: "53119",
  },
  "003404348888": {
    status: "Am vereinbarten Ablageort zugestellt",
    detail: "Bitte prüfen Sie zuerst Ablageort, Umgebung und Nachbarn. Falls unauffindbar, starten Sie mit Jana eine Nachforschung.",
    nafo: true,
    plz: "59457",
  },
  "JJD014127000": {
    status: "Scanabriss unterwegs (seit 6 Werktagen kein neuer Scan)",
    detail: "Nachforschungsberechtigt – starten Sie direkt ein Gespräch mit Jana.",
    nafo: true,
    plz: "63110",
  },
  "506051112999": {
    status: "In der Empfängerregion eingegangen (Scan gestern)",
    detail: "Laufzeit überschritten, aber gestern noch gescannt (kein Scanabriss – aktuell keine Nachforschung nötig).",
    nafo: false,
    plz: "01458",
  },
  "476258741000": {
    status: "Elektronisch angekündigt (seit 6 Werktagen)",
    detail: "Bitte fragen Sie zunächst beim Absender nach oder starten Sie mit Jana eine Nachforschung.",
    nafo: true,
    plz: "67346",
  },
};

const CALC_PRODUCTS = {
  "2s": { name: "Päckchen S", price: "4,19 €", tracking: false, insurance: false },
  "2m": { name: "Päckchen M", price: "5,19 €", tracking: false, insurance: false },
  "2p": { name: "Paket 2 kg (online)", price: "6,19 €", tracking: true, insurance: true },
  "5": { name: "Paket 5 kg (Topseller)", price: "7,69 €", tracking: true, insurance: true },
  "10": { name: "Paket 10 kg", price: "10,49 €", tracking: true, insurance: true },
  "20": { name: "Paket 20 kg", price: "18,99 €", tracking: true, insurance: true },
};

const COGNIGY_SOCKET_HOST = "https://endpoint-trial.cognigy.ai";
const COGNIGY_WEBCHAT_TOKEN =
  "4347a89d2a38449e9b77ae96a3145b66f15050b66b771dfbb5e6665583f97979";
const COGNIGY_WEBCHAT_DEMO_URL =
  "https://webchat-trial.cognigy.ai/v3/4347a89d2a38449e9b77ae96a3145b66f15050b66b771dfbb5e6665583f97979";
const COGNIGY_WEBRTC_ENDPOINT =
  "https://endpoint-trial.cognigy.ai/9d56470dd93dd948a98bfdae06c67795e4590865551db81e821e5207b26b0bb9";
const COGNIGY_WEBRTC_FALLBACK_URL =
  "https://static-trial.cognigy.ai/webrtc/?token=9d56470dd93dd948a98bfdae06c67795e4590865551db81e821e5207b26b0bb9";

function createSessionId(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function cleanBotText(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSimpleMarkdown(str) {
  return escapeHtml(str)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="jana-xapp-btn">DHL Formular &amp; Foto-Upload öffnen ↗</a>'
    )
    .replace(/\n/g, "<br>");
}

document.addEventListener("DOMContentLoaded", () => {
  const launcher = document.getElementById("janaLauncher");
  const drawer = document.getElementById("janaDrawer");
  const closeBtn = document.getElementById("janaCloseBtn");
  const externalLink = document.getElementById("janaExternalLink");
  const statusTextEl = document.getElementById("janaStatusText");
  const statusDotEl = document.getElementById("janaStatusDot");

  // Mode tabs & panels
  const tabChat = document.getElementById("janaTabChat");
  const tabVoice = document.getElementById("janaTabVoice");
  const chatPanel = document.getElementById("janaChatPanel");
  const voicePanel = document.getElementById("janaVoicePanel");
  const switchToVoiceBtn = document.getElementById("janaSwitchToVoiceBtn");

  // Chat elements
  const chatMessagesEl = document.getElementById("janaChatMessages");
  const chatStartersEl = document.getElementById("janaChatStarters");
  const typingEl = document.getElementById("janaTypingIndicator");
  const chatForm = document.getElementById("janaChatForm");
  const chatInput = document.getElementById("janaChatInput");

  // Voice elements
  const mountEl = document.getElementById("janaWebrtcMount");
  const loaderEl = document.getElementById("janaStageLoader");
  const copyHintEl = document.getElementById("janaCopyHint");

  let activeMode = "chat";
  let webrtcInitialized = false;
  let webrtcInitializing = false;

  // Socket.IO Webchat state
  let socket = null;
  let socketConnected = false;
  let chatAutoStarted = false;
  const pendingMessages = [];
  const chatUserId = createSessionId("dhl-user");
  const chatSessionId = createSessionId("dhl-chat");

  function setStatus(text, isLive) {
    if (statusTextEl) {
      statusTextEl.innerHTML = `<span>${escapeHtml(text)}</span>`;
    }
    if (statusDotEl) {
      statusDotEl.classList.toggle("is-live", Boolean(isLive));
    }
  }

  function appendChatMessage(sender, text, quickReplies) {
    if (!chatMessagesEl || !text) return;
    const row = document.createElement("div");
    row.className = "jana-msg-row " + (sender === "user" ? "is-user" : "is-bot");

    if (sender === "bot") {
      row.innerHTML = `
        <img src="./images/jana-avatar.jpg" alt="Jana" class="jana-msg-avatar" />
        <div class="jana-bubble">${formatSimpleMarkdown(text)}</div>
      `;
    } else {
      row.innerHTML = `<div class="jana-bubble">${escapeHtml(text)}</div>`;
    }
    chatMessagesEl.appendChild(row);

    if (Array.isArray(quickReplies) && quickReplies.length > 0) {
      const qrWrap = document.createElement("div");
      qrWrap.className = "jana-msg-quick-replies";
      quickReplies.forEach((qr) => {
        const title = qr.title || qr.text || qr.payload;
        const payload = qr.payload || title;
        if (!title) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "jana-qr-btn";
        btn.textContent = title;
        btn.addEventListener("click", () => {
          qrWrap.remove();
          sendChatMessage(title, payload);
        });
        qrWrap.appendChild(btn);
      });
      chatMessagesEl.appendChild(qrWrap);
    }

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function appendMetadataCard(meta) {
    if (!chatMessagesEl || !meta || (!meta.url && !meta.title)) return;
    const row = document.createElement("div");
    row.className = "jana-msg-row is-bot";
    const imgHtml = meta.imageUrl
      ? `<img src="${escapeHtml(meta.imageUrl)}" alt="${escapeHtml(meta.title || "DHL")}" class="jana-meta-img" loading="lazy" />`
      : "";
    const linkHtml = meta.url
      ? `<a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener noreferrer" class="jana-xapp-btn">Mehr auf DHL.de erfahren ↗</a>`
      : "";
    row.innerHTML = `
      <img src="./images/jana-avatar.jpg" alt="Jana" class="jana-msg-avatar" />
      <div class="jana-meta-card">
        ${imgHtml}
        <div class="jana-meta-body">
          <span class="jana-meta-kicker">DHL SERVICE-INFO</span>
          <h4>${escapeHtml(meta.title || "DHL Information")}</h4>
          ${meta.description ? `<p>${escapeHtml(meta.description)}</p>` : ""}
          ${linkHtml}
        </div>
      </div>
    `;
    chatMessagesEl.appendChild(row);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function setTyping(visible) {
    if (typingEl) typingEl.hidden = !visible;
    if (visible && chatMessagesEl) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }

  function ensureWebchatSocket() {
    if (socket) return;
    if (typeof window.io !== "function") {
      appendChatMessage(
        "bot",
        "Die Chat-Verbindung wird geladen – alternativ können Sie den Vollbild-Webchat oben rechts öffnen."
      );
      return;
    }

    setStatus("Verbinde mit DHL Webchat…", false);
    socket = window.io(COGNIGY_SOCKET_HOST, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      query: {
        urlToken: COGNIGY_WEBCHAT_TOKEN,
        userId: chatUserId,
        sessionId: chatSessionId,
      },
    });

    socket.on("connect", () => {
      socketConnected = true;
      if (activeMode === "chat") {
        setStatus("Online · Verbunden mit DHL Webchat", false);
      }
      if (!chatAutoStarted && pendingMessages.length === 0) {
        chatAutoStarted = true;
        setTyping(true);
        emitCognigyInput("Hallo", { autoStart: true });
      }
      while (pendingMessages.length > 0) {
        chatAutoStarted = true;
        const item = pendingMessages.shift();
        emitCognigyInput(item.text, item.data);
      }
    });

    socket.on("typingStatus", (payload) => {
      if (payload && payload.status === "typingOn") {
        setTyping(true);
      } else if (payload && payload.status === "typingOff") {
        setTyping(false);
      }
    });

    socket.on("output", (payload) => {
      setTyping(false);
      const data = payload && payload.data ? payload.data : payload;
      const rawText = data && data.text ? data.text : "";
      const cleaned = cleanBotText(rawText);

      // Extract optional Cognigy Webchat quick replies
      let quickReplies = [];
      const cog = data && data.data && data.data._cognigy && data.data._cognigy._default;
      if (cog && cog._quickReplies && Array.isArray(cog._quickReplies.quickReplies)) {
        quickReplies = cog._quickReplies.quickReplies;
      }

      if (cleaned) {
        appendChatMessage("bot", cleaned, quickReplies);
      }

      const dhlMeta = data && data.data && data.data.dhlMetadata;
      if (dhlMeta) {
        appendMetadataCard(dhlMeta);
      }
    });

    socket.on("finalPing", () => {
      setTyping(false);
    });

    socket.on("exception", () => {
      setTyping(false);
      appendChatMessage(
        "bot",
        "Entschuldigung, die Verbindung wurde kurz unterbrochen. Bitte versuchen Sie es noch einmal."
      );
    });

    socket.on("disconnect", () => {
      socketConnected = false;
    });
  }

  function emitCognigyInput(text, data) {
    if (!socket) return;
    socket.emit("processInput", {
      URLToken: COGNIGY_WEBCHAT_TOKEN,
      userId: chatUserId,
      sessionId: chatSessionId,
      text: text || "",
      data: data || {},
      source: "device",
    });
  }

  function sendChatMessage(displayText, payloadText) {
    const cleanText = String(displayText || "").trim();
    if (!cleanText) return;
    if (chatStartersEl) chatStartersEl.hidden = true;

    appendChatMessage("user", cleanText);
    setTyping(true);
    ensureWebchatSocket();

    const outbound = payloadText || cleanText;
    if (socket && socketConnected) {
      emitCognigyInput(outbound, {});
    } else {
      pendingMessages.push({ text: outbound, data: {} });
    }
  }

  let eqAnimFrame = null;
  let eqAudioCtx = null;
  let eqAnalyser = null;
  let eqBoundAudioEl = null;
  let smoothedVoiceLevel = 0;

  function buildWaveCanvas() {
    const canvas = document.createElement("canvas");
    canvas.className = "jana-wave-canvas";
    canvas.setAttribute("aria-hidden", "true");
    return canvas;
  }

  function tryBindRemoteAudioAnalyser() {
    const audios = document.querySelectorAll("audio");
    for (const audio of audios) {
      if (audio.srcObject && audio !== eqBoundAudioEl) {
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!eqAudioCtx) eqAudioCtx = new AudioCtx();
          if (eqAudioCtx.state === "suspended") eqAudioCtx.resume().catch(() => {});
          const src = eqAudioCtx.createMediaStreamSource(audio.srcObject);
          eqAnalyser = eqAudioCtx.createAnalyser();
          eqAnalyser.fftSize = 128;
          eqAnalyser.smoothingTimeConstant = 0.72;
          src.connect(eqAnalyser);
          eqBoundAudioEl = audio;
          return true;
        } catch {
          // Ignore if stream cannot be tapped
        }
      }
    }
    return Boolean(eqAnalyser);
  }

  function sampleCognigyCanvasActivity(waveOrb) {
    const canvas = waveOrb.querySelector("canvas");
    if (!canvas || !canvas.width || !canvas.height) return 0;
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return 0;
      const w = canvas.width;
      const h = canvas.height;
      const topStrip = ctx.getImageData(0, Math.floor(h * 0.12), w, Math.max(2, Math.floor(h * 0.22))).data;
      let lit = 0;
      for (let i = 3; i < topStrip.length; i += 16) {
        if (topStrip[i] > 60) lit++;
      }
      return Math.min(1, lit / 18);
    } catch {
      return 0;
    }
  }

  function drawWaveRibbon(canvas, level, time) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width * dpr));
    const h = Math.max(100, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    const midY = h * 0.5;
    const ampBase = (0.04 + level * 0.36) * h;

    const ribbons = [
      { freq: 0.014, speed: 0.0038, phase: 0.0, scale: 1.0,  color: "rgba(255, 204, 0, 0.85)", width: 2.4 * dpr },
      { freq: 0.019, speed: -0.0031, phase: 1.8, scale: 0.78, color: "rgba(212, 5, 17, 0.75)",  width: 2.0 * dpr },
      { freq: 0.025, speed: 0.0046, phase: 3.4, scale: 0.55, color: "rgba(255, 232, 128, 0.72)", width: 1.5 * dpr },
    ];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const r of ribbons) {
      ctx.beginPath();
      const step = 3 * dpr;
      for (let x = 0; x <= w; x += step) {
        const nx = (x / w) * 2 - 1;
        // Gaussian envelope so the wave tapers smoothly at left & right edges
        const env = Math.exp(-3.2 * nx * nx);
        const y =
          midY +
          Math.sin(x * (r.freq / dpr) + time * r.speed + r.phase) *
            Math.cos(x * (r.freq * 0.45 / dpr) - time * r.speed * 0.6) *
            ampBase *
            r.scale *
            env;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  function startRadialEqLoop(container) {
    if (eqAnimFrame) return;
    const freqData = new Uint8Array(64);

    function tick(now) {
      const waveOrb = container.querySelector(".webrtc_widget_audio_wave");
      const waveCanvas = waveOrb && waveOrb.querySelector(".jana-wave-canvas");
      if (!waveOrb) {
        eqAnimFrame = null;
        return;
      }

      tryBindRemoteAudioAnalyser();

      let speakingLevel = 0;
      if (eqAnalyser) {
        eqAnalyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 1; i < 28; i++) sum += freqData[i];
        const avg = sum / (27 * 255);
        if (avg > 0.025) {
          speakingLevel = Math.min(1, avg * 2.6);
        }
      }

      if (speakingLevel < 0.05) {
        const canvasLevel = sampleCognigyCanvasActivity(waveOrb);
        if (canvasLevel > 0.08) {
          speakingLevel = canvasLevel;
        }
      }

      smoothedVoiceLevel += (speakingLevel - smoothedVoiceLevel) * (speakingLevel > 0.05 ? 0.28 : 0.14);
      const isSpeaking = smoothedVoiceLevel > 0.05;
      waveOrb.classList.toggle("is-speaking", isSpeaking);
      waveOrb.style.setProperty("--voice-level", smoothedVoiceLevel.toFixed(3));

      if (waveCanvas) {
        drawWaveRibbon(waveCanvas, smoothedVoiceLevel, now);
      }

      eqAnimFrame = requestAnimationFrame(tick);
    }

    eqAnimFrame = requestAnimationFrame(tick);
  }

  function syncVoiceAvatar(container) {
    // Idle avatar circle
    const avatarBox = container.querySelector(".webrtc_widget_avatar, .webrtc_widget_avatar_default");
    if (avatarBox && !avatarBox.querySelector(".jana-webrtc-avatar-img")) {
      const img = document.createElement("img");
      img.src = "./images/jana-avatar.jpg";
      img.alt = "Jana – DHL Assistentin";
      img.className = "jana-webrtc-avatar-img";
      avatarBox.appendChild(img);
    }

    // Active-call portrait + 60fps Siri/ChatGPT wave ribbon canvas
    const waveOrb = container.querySelector(".webrtc_widget_audio_wave");
    if (waveOrb) {
      if (!waveOrb.querySelector(".jana-wave-canvas")) {
        waveOrb.prepend(buildWaveCanvas());
      }
      if (!waveOrb.querySelector(".jana-orb-avatar-img")) {
        const orbImg = document.createElement("img");
        orbImg.src = "./images/jana-avatar.jpg";
        orbImg.alt = "Jana spricht";
        orbImg.className = "jana-orb-avatar-img";
        waveOrb.prepend(orbImg);
      }
      startRadialEqLoop(container);
    }

    // Move controls dock (.webrtc_widget_call_controls_container) to the BOTTOM, below captions, and place timer inside it
    const controlsDock = container.querySelector(".webrtc_widget_call_controls_container");
    const durationEl = container.querySelector(".webrtc_widget_call_duration");
    const endBtn = container.querySelector(".webrtc_widget_end_call_button");
    if (controlsDock && durationEl && durationEl.parentElement !== controlsDock) {
      if (endBtn && endBtn.parentElement === controlsDock) {
        controlsDock.insertBefore(durationEl, endBtn);
      } else {
        controlsDock.appendChild(durationEl);
      }
    }

    // Order: [Wave + Portrait] -> [Borderless Captions] -> [Bottom Control Dock]
    const transcriptWrapper = container.querySelector(".webrtc_widget_transcript_wrapper");
    const contentContainer = container.querySelector(".webrtc_widget_content_container");
    if (transcriptWrapper && contentContainer && controlsDock) {
      contentContainer.parentElement.style.display = "flex";
      contentContainer.parentElement.style.flexDirection = "column";
      contentContainer.style.order = "1";
      transcriptWrapper.style.order = "2";
      // Move controlsDock out to the main container so it sits cleanly anchored BELOW the captions
      if (controlsDock.parentElement !== contentContainer.parentElement) {
        contentContainer.parentElement.appendChild(controlsDock);
      }
      controlsDock.style.order = "90";
    }
  }

  function autoScrollVoiceTranscript(container) {
    const wrapper = container.querySelector(".webrtc_widget_transcript_wrapper");
    if (!wrapper) return;
    requestAnimationFrame(() => {
      wrapper.scrollTop = wrapper.scrollHeight;
    });
  }

  function observeCallState(container) {
    syncVoiceAvatar(container);
    autoScrollVoiceTranscript(container);
    const observer = new MutationObserver(() => {
      syncVoiceAvatar(container);
      autoScrollVoiceTranscript(container);
      const calling = Boolean(
        container.querySelector(".webrtc_widget_content_container_calling, .webrtc_widget_end_call_button")
      );
      if (activeMode === "voice") {
        setStatus(
          calling ? "Live verbunden · Spricht mit Jana" : "Bereit · Natürliche Sprachassistenz",
          calling
        );
      }
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  async function mountNativeWebRTC() {
    if (webrtcInitialized || webrtcInitializing) return;
    webrtcInitializing = true;

    const deadline = Date.now() + 4000;
    while (typeof window.initWebRTCWidget !== "function" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
    }

    if (typeof window.initWebRTCWidget !== "function") {
      webrtcInitializing = false;
      if (loaderEl) {
        loaderEl.innerHTML = `
          <div class="jana-stage-fallback">
            <p>Die Voice-Engine konnte im Fenster nicht geladen werden.</p>
            <a href="${COGNIGY_WEBRTC_FALLBACK_URL}" target="_blank" rel="noopener noreferrer" class="btn-dhl-red">
              Direkt mit Jana sprechen ↗
            </a>
          </div>
        `;
      }
      return;
    }

    try {
      await window.initWebRTCWidget(COGNIGY_WEBRTC_ENDPOINT, {});
      let wrapper = null;
      for (let i = 0; i < 25; i++) {
        wrapper = document.querySelector(".webrtc_widget_outer_wrapper");
        if (wrapper) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      if (wrapper && mountEl) {
        const host = wrapper.parentElement;
        if (host && host !== mountEl && host.parentElement === document.body) {
          mountEl.appendChild(host);
        } else {
          mountEl.appendChild(wrapper);
        }
        if (loaderEl) loaderEl.hidden = true;
        observeCallState(mountEl);
        webrtcInitialized = true;
      }
    } catch {
      if (loaderEl) {
        loaderEl.innerHTML = `
          <div class="jana-stage-fallback">
            <p>Verbindung zur Voice-Engine unterbrochen.</p>
            <a href="${COGNIGY_WEBRTC_FALLBACK_URL}" target="_blank" rel="noopener noreferrer" class="btn-dhl-red">
              Im Vollbild starten ↗
            </a>
          </div>
        `;
      }
    } finally {
      webrtcInitializing = false;
    }
  }

  function setMode(mode) {
    activeMode = mode === "voice" ? "voice" : "chat";
    const isChat = activeMode === "chat";

    tabChat.classList.toggle("is-active", isChat);
    tabChat.setAttribute("aria-selected", String(isChat));
    tabVoice.classList.toggle("is-active", !isChat);
    tabVoice.setAttribute("aria-selected", String(!isChat));

    chatPanel.hidden = !isChat;
    voicePanel.hidden = isChat;

    if (externalLink) {
      externalLink.href = isChat ? COGNIGY_WEBCHAT_DEMO_URL : COGNIGY_WEBRTC_FALLBACK_URL;
      externalLink.title = isChat ? "Webchat im Vollbild öffnen" : "Sprach-WebRTC im Vollbild öffnen";
    }

    if (isChat) {
      setStatus(socketConnected ? "Online · Verbunden mit DHL Webchat" : "Online · Chat & Sprachassistenz", false);
      ensureWebchatSocket();
      setTimeout(() => chatInput && chatInput.focus(), 60);
    } else {
      setStatus("Bereit · Natürliche Sprachassistenz", false);
      mountNativeWebRTC();
    }
  }

  function openJanaWidget(preferredMode, prefillPrompt) {
    drawer.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    setMode(preferredMode || activeMode || "chat");
    if (prefillPrompt && activeMode === "chat") {
      sendChatMessage(prefillPrompt);
    }
  }

  function closeJanaWidget() {
    drawer.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", () => openJanaWidget("chat"));
  closeBtn.addEventListener("click", closeJanaWidget);
  tabChat.addEventListener("click", () => setMode("chat"));
  tabVoice.addEventListener("click", () => setMode("voice"));
  if (switchToVoiceBtn) {
    switchToVoiceBtn.addEventListener("click", () => setMode("voice"));
  }

  document.querySelectorAll("[data-open-jana], #openJanaHeaderBtn").forEach((el) => {
    el.addEventListener("click", () => openJanaWidget("chat"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) {
      closeJanaWidget();
    }
  });

  // Chat composer submit
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (!val) return;
      chatInput.value = "";
      sendChatMessage(val);
    });
  }

  // Chat starter buttons
  document.querySelectorAll(".jana-starter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt) sendChatMessage(prompt);
    });
  });

  // Quick copy chips inside Voice panel
  document.querySelectorAll(".jana-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const code = chip.dataset.copy;
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      if (copyHintEl) {
        copyHintEl.textContent = "Kopiert: " + code + " ✓";
        copyHintEl.classList.add("is-copied");
        setTimeout(() => {
          copyHintEl.textContent = "Klick kopiert";
          copyHintEl.classList.remove("is-copied");
        }, 1800);
      }
    });
  });

  // Tracking form & sample pills
  const trackingForm = document.getElementById("trackingForm");
  const trackingInput = document.getElementById("trackingInput");
  const trackingResult = document.getElementById("trackingResult");

  function renderTracking(rawValue) {
    const clean = String(rawValue || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return;
    const hit = TEST_SHIPMENTS[clean];
    if (hit) {
      trackingResult.innerHTML = `
        <div>
          <span class="tr-badge ${hit.nafo ? "is-nafo" : "is-ok"}">
            ${hit.nafo ? "Nachforschungsberechtigt · PLZ " + hit.plz : "Aktueller Sendungsstatus"}
          </span>
          <h3 class="tr-title">${clean} — ${hit.status}</h3>
          <p class="tr-desc">${hit.detail}</p>
        </div>
        <button type="button" class="btn-dhl-red" id="trOpenJanaBtn">Mit Jana besprechen</button>
      `;
    } else {
      trackingResult.innerHTML = `
        <div>
          <span class="tr-badge is-nafo">Sendungsnummer nicht in Testdaten</span>
          <h3 class="tr-title">${clean} — Keine Sendung gefunden</h3>
          <p class="tr-desc">Unsere Sprachassistentin Jana verbindet Sie bei unbekannten Sendungsnummern direkt mit unserem Team.</p>
        </div>
        <button type="button" class="btn-dhl-red" id="trOpenJanaBtn">Jana anrufen</button>
      `;
    }
    trackingResult.hidden = false;
    const btn = document.getElementById("trOpenJanaBtn");
    if (btn) btn.addEventListener("click", openJanaWidget);
  }

  trackingForm.addEventListener("submit", (e) => {
    e.preventDefault();
    renderTracking(trackingInput.value);
  });

  document.querySelectorAll(".sample-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      trackingInput.value = pill.dataset.track;
      renderTracking(pill.dataset.track);
    });
  });

  // Header search button focuses tracking input
  const headerSearchBtn = document.getElementById("headerSearchBtn");
  if (headerSearchBtn) {
    headerSearchBtn.addEventListener("click", () => {
      trackingInput.focus();
      trackingInput.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // Interactive Postage Calculator
  const calcWeight = document.getElementById("calcWeight");
  const calcCountry = document.getElementById("calcCountry");
  const calcProductName = document.getElementById("calcProductName");
  const calcPrice = document.getElementById("calcPrice");
  const calcDuration = document.getElementById("calcDuration");
  const calcBadges = document.getElementById("calcBadges");
  const calcBuyBtn = document.getElementById("calcBuyBtn");

  function updateCalc() {
    const p = CALC_PRODUCTS[calcWeight.value] || CALC_PRODUCTS["2s"];
    const isEU = calcCountry.value === "EU";
    const displayPrice = isEU ? (p.tracking ? "14,49 €" : "10,49 €") : p.price;
    calcProductName.textContent = isEU ? p.name + " International" : p.name;
    calcPrice.textContent = displayPrice;
    calcDuration.textContent = isEU
      ? "Laufzeit in der Regel 3–5 Werktage"
      : "Laufzeit in der Regel 1–2 Werktage";
    calcBadges.innerHTML = `
      <span class="${p.insurance ? "feat-yes" : "feat-no"}">${p.insurance ? "Haftung bis 500 €" : "Haftung"}</span>
      <span class="${p.tracking ? "feat-yes" : "feat-no"}">Sendungsverfolgung</span>
    `;
    calcBuyBtn.textContent = `Jetzt kaufen (${displayPrice})`;
  }

  calcWeight.addEventListener("change", updateCalc);
  calcCountry.addEventListener("change", updateCalc);
  calcBuyBtn.addEventListener("click", openJanaWidget);
});
