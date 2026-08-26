import { POSE_LANDMARKS } from './kinematics.js';

export function mapLandmarkToCanvas(pt, canvasWidth, canvasHeight, videoElem, isMirrored = false) {
  if (!videoElem || !videoElem.videoWidth || !videoElem.videoHeight) {
    const normX = isMirrored ? (1 - pt.x) : pt.x;
    return {
      x: normX * canvasWidth,
      y: pt.y * canvasHeight
    };
  }

  const vw = videoElem.videoWidth;
  const vh = videoElem.videoHeight;
  const videoAspect = vw / vh;
  const containerAspect = canvasWidth / canvasHeight;

  let renderWidth = canvasWidth;
  let renderHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > videoAspect) {
    renderWidth = canvasWidth;
    renderHeight = canvasWidth / videoAspect;
    offsetY = (canvasHeight - renderHeight) / 2;
  } else {
    renderHeight = canvasHeight;
    renderWidth = canvasHeight * videoAspect;
    offsetX = (canvasWidth - renderWidth) / 2;
  }

  const normX = isMirrored ? (1 - pt.x) : pt.x;
  const x = offsetX + normX * renderWidth;
  const y = offsetY + pt.y * renderHeight;

  return { x, y };
}

export function drawBodySilhouetteStencil(c, w, h, isAligned) {
  c.save();
  const centerX = w / 2;
  const stencilColor = isAligned ? 'rgba(16, 185, 129, 0.45)' : 'rgba(6, 182, 212, 0.25)';

  c.strokeStyle = stencilColor;
  c.lineWidth = isAligned ? 2.5 : 1.5;
  c.setLineDash([6, 6]);

  const headY = h * 0.2;
  const headRadius = h * 0.08;
  c.beginPath();
  c.arc(centerX, headY, headRadius, 0, 2 * Math.PI);
  c.stroke();

  const shoulderY = h * 0.32;
  const shoulderWidth = w * 0.24;
  c.beginPath();
  c.moveTo(centerX - shoulderWidth / 2, shoulderY);
  c.lineTo(centerX + shoulderWidth / 2, shoulderY);
  c.lineTo(centerX + shoulderWidth * 0.38, h * 0.58);
  c.lineTo(centerX - shoulderWidth * 0.38, h * 0.58);
  c.closePath();
  c.stroke();

  const hipY = h * 0.58;
  const kneeY = h * 0.74;
  const feetY = h * 0.92;
  const legOffset = shoulderWidth * 0.26;

  c.beginPath();
  c.moveTo(centerX - legOffset, hipY);
  c.lineTo(centerX - legOffset * 1.1, kneeY);
  c.lineTo(centerX - legOffset * 1.15, feetY);
  c.stroke();

  c.beginPath();
  c.moveTo(centerX + legOffset, hipY);
  c.lineTo(centerX + legOffset * 1.1, kneeY);
  c.lineTo(centerX + legOffset * 1.15, feetY);
  c.stroke();

  c.setLineDash([]);
  c.fillStyle = isAligned ? 'rgba(16, 185, 129, 0.18)' : 'rgba(12, 18, 32, 0.75)';
  c.strokeStyle = isAligned ? '#10b981' : 'rgba(255, 255, 255, 0.15)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(centerX - 120, 16, 240, 28, 8);
  c.fill();
  c.stroke();

  c.fillStyle = isAligned ? '#10b981' : '#cbd5e1';
  c.font = 'bold 11px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText(isAligned ? '🎯 BODY LOCKED IN TARGET' : '📐 ALIGN BODY TO SILHOUETTE', centerX, 34);

  c.restore();
}

export function drawCyberBackdrop(c, w, h) {
  c.save();

  // 1. Deep Cyber Laboratory Gradient
  const grad = c.createRadialGradient(w / 2, h * 0.45, 50, w / 2, h * 0.5, w * 0.85);
  grad.addColorStop(0, '#111e38');
  grad.addColorStop(0.45, '#0a1224');
  grad.addColorStop(0.85, '#050914');
  grad.addColorStop(1, '#02040a');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  const horizonY = h * 0.76;

  // 2. Glowing Perspective Floor Grid Lines
  c.strokeStyle = 'rgba(6, 182, 212, 0.22)';
  c.lineWidth = 1.4;
  for (let x = -w * 0.6; x <= w * 1.6; x += 55) {
    c.beginPath();
    c.moveTo(w / 2, horizonY * 0.94);
    c.lineTo(x, h);
    c.stroke();
  }

  // 3. Horizontal Floor Distance Rings
  for (let y = horizonY; y <= h; y += (h - horizonY) / 5) {
    c.strokeStyle = 'rgba(6, 182, 212, 0.20)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }

  // 4. Illuminated Biomechanical Force Platform on Floor
  const platCenterY = h * 0.87;
  const platRadiusX = w * 0.32;
  const platRadiusY = h * 0.09;

  // Outer Glowing Ring
  c.strokeStyle = 'rgba(6, 182, 212, 0.65)';
  c.lineWidth = 2.0;
  c.beginPath();
  c.ellipse(w / 2, platCenterY, platRadiusX, platRadiusY, 0, 0, 2 * Math.PI);
  c.stroke();

  // Inner Target Ring
  c.strokeStyle = 'rgba(99, 102, 241, 0.55)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(w / 2, platCenterY, platRadiusX * 0.6, platRadiusY * 0.6, 0, 0, 2 * Math.PI);
  c.stroke();

  // Center Bullseye Target Marker
  c.fillStyle = 'rgba(6, 182, 212, 0.7)';
  c.beginPath();
  c.ellipse(w / 2, platCenterY, 6, 2.5, 0, 0, 2 * Math.PI);
  c.fill();

  // 5. Subtle Watermark Badge
  c.fillStyle = 'rgba(6, 182, 212, 0.75)';
  c.font = '600 11px Outfit, sans-serif';
  c.textAlign = 'right';
  c.fillText('⚡ BIOMECHANICAL MOTION LAB • SIMULATOR ACTIVE', w - 16, 24);
  c.textAlign = 'left';

  c.restore();
}

export function drawCenterAlignmentGrid(c, w, h, lm, videoElem, isMirrored) {
  const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
  if (!lShoulder || !rShoulder) return;

  const p1 = mapLandmarkToCanvas(lShoulder, w, h, videoElem, isMirrored);
  const p2 = mapLandmarkToCanvas(rShoulder, w, h, videoElem, isMirrored);
  const midX = (p1.x + p2.x) / 2;

  c.save();
  c.setLineDash([4, 6]);
  c.strokeStyle = 'rgba(6, 182, 212, 0.35)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(midX, 0);
  c.lineTo(midX, h);
  c.stroke();
  c.restore();
}

export function drawBiomechanicalSkeleton(c, w, h, lm, riskData, videoElem, isMirrored) {
  const connections = [
    // Head / Facial Geometry
    [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.LEFT_EYE_INNER],
    [POSE_LANDMARKS.LEFT_EYE_INNER, POSE_LANDMARKS.LEFT_EYE],
    [POSE_LANDMARKS.LEFT_EYE, POSE_LANDMARKS.LEFT_EYE_OUTER],
    [POSE_LANDMARKS.LEFT_EYE_OUTER, POSE_LANDMARKS.LEFT_EAR],
    [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.RIGHT_EYE_INNER],
    [POSE_LANDMARKS.RIGHT_EYE_INNER, POSE_LANDMARKS.RIGHT_EYE],
    [POSE_LANDMARKS.RIGHT_EYE, POSE_LANDMARKS.RIGHT_EYE_OUTER],
    [POSE_LANDMARKS.RIGHT_EYE_OUTER, POSE_LANDMARKS.RIGHT_EAR],
    [POSE_LANDMARKS.MOUTH_LEFT, POSE_LANDMARKS.MOUTH_RIGHT],

    // Torso Frame
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],

    // Left Arm & Hand
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
    [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
    [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_PINKY],
    [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_INDEX],
    [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_THUMB],
    [POSE_LANDMARKS.LEFT_PINKY, POSE_LANDMARKS.LEFT_INDEX],

    // Right Arm & Hand
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
    [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
    [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_PINKY],
    [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_INDEX],
    [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_THUMB],
    [POSE_LANDMARKS.RIGHT_PINKY, POSE_LANDMARKS.RIGHT_INDEX],

    // Left Leg & Foot
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
    [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
    [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_HEEL],
    [POSE_LANDMARKS.LEFT_HEEL, POSE_LANDMARKS.LEFT_FOOT_INDEX],
    [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],

    // Right Leg & Foot
    [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
    [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
    [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_HEEL],
    [POSE_LANDMARKS.RIGHT_HEEL, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
    [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX]
  ];

  c.save();

  // Evaluate which specific joints have posture flaws
  const isLeftKneeError = riskData.collapseLeft > 7.5 || (riskData.valgusLeft && riskData.valgusLeft < 172);
  const isRightKneeError = riskData.collapseRight > 7.5 || (riskData.valgusRight && riskData.valgusRight < 172);
  const isTrunkError = riskData.trunkLean > 12;

  // 1. Draw connecting bone lines
  connections.forEach(([i1, i2]) => {
    const lm1 = lm[i1];
    const lm2 = lm[i2];
    if (!lm1 || !lm2) return;

    const p1 = mapLandmarkToCanvas(lm1, w, h, videoElem, isMirrored);
    const p2 = mapLandmarkToCanvas(lm2, w, h, videoElem, isMirrored);

    let boneColor = 'rgba(6, 182, 212, 0.85)';
    let boneWidth = 3.5;

    if ((i1 === POSE_LANDMARKS.LEFT_KNEE || i2 === POSE_LANDMARKS.LEFT_KNEE) && isLeftKneeError) {
      boneColor = '#ef4444';
      boneWidth = 4.5;
    } else if ((i1 === POSE_LANDMARKS.RIGHT_KNEE || i2 === POSE_LANDMARKS.RIGHT_KNEE) && isRightKneeError) {
      boneColor = '#ef4444';
      boneWidth = 4.5;
    }

    c.strokeStyle = boneColor;
    c.lineWidth = boneWidth;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.stroke();
  });

  // 2. Draw ALL 33 Joint Points Clearly & Aesthetically
  lm.forEach((pt, idx) => {
    if (idx > 32 || !pt) return;

    const p = mapLandmarkToCanvas(pt, w, h, videoElem, isMirrored);

    const isMajorJoint = [
      POSE_LANDMARKS.NOSE,
      POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST,
      POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.RIGHT_KNEE,
      POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.RIGHT_ANKLE
    ].includes(idx);

    const dotRadius = isMajorJoint ? 5.0 : 3.2;
    const haloRadius = isMajorJoint ? 8.0 : 5.0;

    // Outer cyan glow
    c.fillStyle = 'rgba(6, 182, 212, 0.35)';
    c.beginPath();
    c.arc(p.x, p.y, haloRadius, 0, 2 * Math.PI);
    c.fill();

    // Cyan ring
    c.strokeStyle = '#06b6d4';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(p.x, p.y, dotRadius + 1.5, 0, 2 * Math.PI);
    c.stroke();

    // Solid white center core
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(p.x, p.y, dotRadius, 0, 2 * Math.PI);
    c.fill();
  });

  c.restore();
}

export function drawAngleAnnotations(c, w, h, lm, riskData, videoElem, isMirrored) {
  const lKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
  const isLeftKneeError = riskData.collapseLeft > 8 || riskData.valgusLeft < 168;
  const isRightKneeError = riskData.collapseRight > 8 || riskData.valgusRight < 168;

  c.save();

  // Left Knee Badge (Red if faulty, Green if correct)
  if (lKnee && (!lKnee.visibility || lKnee.visibility > 0.4)) {
    const p = mapLandmarkToCanvas(lKnee, w, h, videoElem, isMirrored);
    drawBadge(c, p.x + 15, p.y, `${isLeftKneeError ? '⚠️ ' : ''}L: ${riskData.valgusLeft}°`, isLeftKneeError ? '#ef4444' : '#10b981');
  }

  // Right Knee Badge (Red if faulty, Green if correct)
  if (rKnee && (!rKnee.visibility || rKnee.visibility > 0.4)) {
    const p = mapLandmarkToCanvas(rKnee, w, h, videoElem, isMirrored);
    drawBadge(c, p.x - 90, p.y, `${isRightKneeError ? '⚠️ ' : ''}R: ${riskData.valgusRight}°`, isRightKneeError ? '#ef4444' : '#10b981');
  }

  // Trunk Sway Badge (Only appears if posture tilts)
  if (riskData.trunkLean > 12) {
    const nose = lm[POSE_LANDMARKS.NOSE];
    if (nose) {
      const p = mapLandmarkToCanvas(nose, w, h, videoElem, isMirrored);
      drawBadge(c, p.x + 20, p.y, `⚠️ Lean: ${riskData.trunkLean}°`, '#ef4444');
    }
  }

  c.restore();
}

export function drawBadge(c, x, y, text, color) {
  c.fillStyle = 'rgba(12, 18, 32, 0.88)';
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(x, y - 12, 68, 24, 6);
  c.fill();
  c.stroke();

  c.fillStyle = '#fff';
  c.font = 'bold 11px Inter, sans-serif';
  c.fillText(text, x + 8, y + 4);
}
