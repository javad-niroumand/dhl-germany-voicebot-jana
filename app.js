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

const COGNIGY_WEBRTC_ENDPOINT =
  "https://endpoint-trial.cognigy.ai/9d56470dd93dd948a98bfdae06c67795e4590865551db81e821e5207b26b0bb9";
const COGNIGY_WEBRTC_FALLBACK_URL =
  "https://static-trial.cognigy.ai/webrtc/?token=9d56470dd93dd948a98bfdae06c67795e4590865551db81e821e5207b26b0bb9";

document.addEventListener("DOMContentLoaded", () => {
  const launcher = document.getElementById("janaLauncher");
  const drawer = document.getElementById("janaDrawer");
  const closeBtn = document.getElementById("janaCloseBtn");
  const mountEl = document.getElementById("janaWebrtcMount");
  const loaderEl = document.getElementById("janaStageLoader");
  const statusTextEl = document.getElementById("janaStatusText");
  const copyHintEl = document.getElementById("janaCopyHint");

  let webrtcInitialized = false;
  let webrtcInitializing = false;

  function updateStudioStatus(isCalling) {
    if (!statusTextEl) return;
    if (isCalling) {
      statusTextEl.innerHTML =
        '<span class="status-dot is-live" aria-hidden="true"></span><span>Live verbunden · Spricht mit Jana</span>';
    } else {
      statusTextEl.innerHTML =
        '<span class="status-dot" aria-hidden="true"></span><span>Bereit · Natürliche Sprachassistenz</span>';
    }
  }

  function observeCallState(container) {
    const observer = new MutationObserver(() => {
      const calling = Boolean(
        container.querySelector(".webrtc_widget_content_container_calling, .webrtc_widget_end_call_button")
      );
      updateStudioStatus(calling);
    });
    observer.observe(container, { childList: true, subtree: true, attributes: true });
  }

  async function mountNativeWebRTC() {
    if (webrtcInitialized || webrtcInitializing) return;
    webrtcInitializing = true;

    // Wait up to 4 seconds for the ES module script to register window.initWebRTCWidget
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
      // Cognigy appends a host <div> containing .webrtc_widget_outer_wrapper to document.body.
      // Move that wrapper seamlessly inside our Voice Studio stage.
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

  function openJanaWidget() {
    drawer.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    closeBtn.focus();
    mountNativeWebRTC();
  }

  function closeJanaWidget() {
    drawer.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", openJanaWidget);
  closeBtn.addEventListener("click", closeJanaWidget);

  document.querySelectorAll("[data-open-jana], #openJanaHeaderBtn").forEach((el) => {
    el.addEventListener("click", openJanaWidget);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer.hidden) {
      closeJanaWidget();
    }
  });

  // Quick copy chips inside Jana Voice Studio (also syncs tracking bar)
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
