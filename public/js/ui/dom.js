export function queryDom() {
  return {
    btnHangup: document.getElementById("btnHangup"),
    btnRejoin: document.getElementById("btnRejoin"),
    btnToggleMic: document.getElementById("btnToggleMic"),
    btnToggleCam: document.getElementById("btnToggleCam"),
    btnVideoQuality: document.getElementById("btnVideoQuality"),
    btnCloseQuality: document.getElementById("btnCloseQuality"),
    qualityPanel: document.getElementById("qualityPanel"),
    qualitySlider: document.getElementById("qualitySlider"),
    qualityThumb: document.getElementById("qualityThumb"),
    qualityTrackFill: document.getElementById("qualityTrackFill"),
    qualityTicks: document.getElementById("qualityTicks"),
    qualityValueLabel: document.getElementById("qualityValueLabel"),
    qualityBadge: document.getElementById("qualityBadge"),
    btnSendCommand: document.getElementById("btnSendCommand"),
    localVideo: document.getElementById("localVideo"),
    localPip: document.getElementById("localPip"),
    remoteVideo: document.getElementById("remoteVideo"),
    remotePlaceholder: document.getElementById("remotePlaceholder"),
    placeholderText: document.querySelector("#remotePlaceholder p"),
    statusChip: document.getElementById("statusChip"),
    movementHint: document.getElementById("movementHint"),
    joystick: document.getElementById("joystick"),
    kbdHint: document.getElementById("kbdHint"),
    roomLabel: document.getElementById("roomLabel"),
    endedOverlay: document.getElementById("endedOverlay"),
    langToggle: document.getElementById("langToggle"),
    langMenu: document.getElementById("langMenu"),
    langCurrentFlag: document.getElementById("langCurrentFlag"),
    featureHost: document.getElementById("featureHost"),
    locomotionHost: document.getElementById("locomotionHost"),
    headLookLayer: document.getElementById("headLookLayer"),
  };
}

/**
 * @param {string} id
 * @param {ReturnType<typeof queryDom>} els
 */
export function hostById(id, els) {
  if (id === "call") return els.featureHost;
  if (id === "quality") return els.qualityPanel;
  if (id === "locomotion") return els.locomotionHost;
  if (id === "head" || id === "head-look") return els.headLookLayer;
  return document.querySelector(`[data-host="${id}"]`);
}
