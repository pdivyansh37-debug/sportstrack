/**
 * Kinematics & Biomechanics Calculation Engine
 * Handles 2D/3D angle calculations, knee valgus (FPPA), ACL injury risk scoring,
 * sports-specific biomechanical profiles, Jump kinematics & LESS scoring.
 */

// MediaPipe Landmark Index References
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8,
  MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32
};

// Sports-Specific Biomechanical Risk Weightings
export const SPORTS_PROFILES = {
  basketball: {
    name: 'Basketball',
    icon: '🏀',
    valgusWeight: 1.25,      // High risk during rebound landings & cuts
    landingWeight: 1.35,     // Critical impact absorption
    asymmetryWeight: 1.0,
    trunkWeight: 1.1,
    focus: 'Rebound landings, rapid deceleration & cutting mechanics'
  },
  football: {
    name: 'Football / Soccer',
    icon: '⚽',
    valgusWeight: 1.35,      // Plant-and-kick knee valgus & rotational torque
    landingWeight: 1.1,
    asymmetryWeight: 1.3,    // Unilateral kicking limb dominance
    trunkWeight: 1.2,
    focus: 'Single-leg plant stability & sharp change-of-direction (COD)'
  },
  badminton: {
    name: 'Badminton / Volleyball',
    icon: '🏸',
    valgusWeight: 1.2,
    landingWeight: 1.4,      // Backward jump smash impact
    asymmetryWeight: 1.2,
    trunkWeight: 1.25,       // Hyperextension recovery
    focus: 'Overhead smash landing & deep explosive lunges'
  },
  running: {
    name: 'Athletics / Running',
    icon: '🏃',
    valgusWeight: 1.0,
    landingWeight: 1.15,
    asymmetryWeight: 1.4,    // Bilateral gait symmetry is key
    trunkWeight: 1.0,
    focus: 'Cadence symmetry, ground contact stability & knee tracking'
  },
  skiing: {
    name: 'Skiing / Winter Sports',
    icon: '🎿',
    valgusWeight: 1.3,
    landingWeight: 1.2,
    asymmetryWeight: 1.25,
    trunkWeight: 1.3,        // Forward torso & quad dominant loading
    focus: 'Deep asymmetric knee flexion load & eccentric quad control'
  },
  general: {
    name: 'General / Rehab',
    icon: '🧘',
    valgusWeight: 1.0,
    landingWeight: 1.0,
    asymmetryWeight: 1.0,
    trunkWeight: 1.0,
    focus: 'Standard clinical baseline & inclusive movement lab'
  }
};

/**
 * Temporal Exponential Moving Average (EMA) Landmark Smoother
 * Eliminates webcam frame jitter while preserving rapid athletic motion dynamics.
 */
export class LandmarkSmoother {
  constructor(alpha = 0.45) {
    this.alpha = alpha;
    this.smoothedLandmarks = null;
  }

  reset() {
    this.smoothedLandmarks = null;
  }

  smooth(rawLandmarks) {
    if (!rawLandmarks || rawLandmarks.length === 0) return rawLandmarks;
    
    if (!this.smoothedLandmarks || this.smoothedLandmarks.length !== rawLandmarks.length) {
      this.smoothedLandmarks = rawLandmarks.map(pt => ({ ...pt }));
      return this.smoothedLandmarks;
    }

    for (let i = 0; i < rawLandmarks.length; i++) {
      const raw = rawLandmarks[i];
      const prev = this.smoothedLandmarks[i];
      
      // Dynamic velocity-sensitive smoothing (higher responsiveness for rapid motion)
      const dist = Math.hypot(raw.x - prev.x, raw.y - prev.y);
      const adaptiveAlpha = Math.min(0.85, Math.max(this.alpha, this.alpha + dist * 3.0));

      prev.x = prev.x + adaptiveAlpha * (raw.x - prev.x);
      prev.y = prev.y + adaptiveAlpha * (raw.y - prev.y);
      prev.z = (prev.z || 0) + adaptiveAlpha * ((raw.z || 0) - (prev.z || 0));
      prev.visibility = raw.visibility;
    }

    return this.smoothedLandmarks;
  }
}

/**
 * Calculates 2D planar angle between three points with vertex at point B (degrees)
 */
export function calculateAngle(a, b, c) {
  return calculateAngle2D(a, b, c);
}

export function calculateAngle2D(a, b, c) {
  if (!a || !b || !c) return 180;
  
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return Math.round(angle * 10) / 10;
}

/**
 * Calculates 3D spatial angle between vectors BA and BC using coordinates (x, y, z)
 */
export function calculateAngle3D(a, b, c, depthScale = 1.2) {
  if (!a || !b || !c) return 180;

  const v1 = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: ((a.z || 0) - (b.z || 0)) * depthScale
  };
  const v2 = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: ((c.z || 0) - (b.z || 0)) * depthScale
  };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 180;

  const cosTheta = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
  const angle = Math.acos(cosTheta) * (180.0 / Math.PI);
  return Math.round(angle * 10) / 10;
}

/**
 * Calculates true Frontal Plane Projection Angle (FPPA) and Medial Knee Valgus Collapse.
 * Distinguishes between dangerous Medial Cave (valgus) and safe/beneficial Lateral Flare (varus).
 */
export function calculateKneeValgusFPPA(hip, knee, ankle, isLeft = true, oppositeHip = null) {
  if (!hip || !knee || !ankle) {
    return { fppa: 180, valgusCollapseDeg: 0, isValgus: false, direction: 'neutral' };
  }

  // 1. Calculate the mechanical reference axis from Hip to Ankle
  const verticalDelta = Math.max(0.001, ankle.y - hip.y);
  const kneeProgress = Math.max(0, Math.min(1, (knee.y - hip.y) / verticalDelta));
  const neutralAxisX = hip.x + kneeProgress * (ankle.x - hip.x);

  // 2. Identify the anatomical center/midline of the pelvis
  const midPelvisX = oppositeHip ? (hip.x + oppositeHip.x) / 2 : (isLeft ? hip.x - 0.1 : hip.x + 0.1);
  const medialSign = Math.sign(midPelvisX - hip.x);

  // 3. Medial displacement is positive when the knee moves towards the body's midline
  const medialOffset = (knee.x - neutralAxisX) * medialSign;

  // 4. Calculate 2D Frontal Plane Projection Angle
  const planarAngle = calculateAngle2D(hip, knee, ankle);
  const rawDeviation = Math.abs(180 - planarAngle);

  // Only inward (medial) displacement beyond physiological tolerance creates valgus ACL risk
  if (medialOffset > 0.006 && rawDeviation > 4) {
    const valgusCollapse = Math.min(45, Math.round(rawDeviation * 10) / 10);
    return {
      fppa: Math.round((180 - valgusCollapse) * 10) / 10,
      valgusCollapseDeg: valgusCollapse,
      isValgus: valgusCollapse > 7.5,
      direction: 'valgus'
    };
  }

  // Neutral or Lateral (Varus / Knees pushed out properly)
  return {
    fppa: 180,
    valgusCollapseDeg: 0,
    isValgus: false,
    direction: medialOffset < -0.006 ? 'varus' : 'neutral'
  };
}

/**
 * Calculates true Sagittal Knee Flexion depth combining 3D landmark geometry and frontal vertical compression.
 * Standing extension = 175°-180°, Parallel Squat = ~90°, Deep Squat = ~65°-75°.
 */
export function calculateKneeFlexion(hip, knee, ankle) {
  if (!hip || !knee || !ankle) return 180;

  // 1. 3D spatial joint angle
  const angle3D = calculateAngle3D(hip, knee, ankle, 1.4);

  // 2. Vertical kinematic leg segment compression
  const thighLen = Math.hypot(knee.x - hip.x, knee.y - hip.y);
  const shankLen = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
  const totalLegLen = Math.max(0.08, thighLen + shankLen);
  const verticalSpan = Math.max(0.01, Math.abs(ankle.y - hip.y));
  const compressionRatio = Math.min(1.0, verticalSpan / totalLegLen);

  // Map compression ratio [0.35..1.0] to anatomical angle [60°..180°]
  const compressionAngle = Math.max(60, Math.min(180, 60 + Math.pow(compressionRatio, 1.2) * 120));

  // Fuse 3D vector calculation with vertical compression for rock-solid stability
  const fusedFlexion = 0.55 * angle3D + 0.45 * compressionAngle;
  return Math.round(fusedFlexion * 10) / 10;
}

/**
 * Calculates Trunk Lateral Lean angle relative to gravity/vertical axis
 */
export function calculateTrunkLean(leftShoulder, rightShoulder, leftHip, rightHip) {
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 0;
  
  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  
  const dx = midShoulder.x - midHip.x;
  const dy = Math.max(0.01, Math.abs(midShoulder.y - midHip.y));
  
  const leanRadians = Math.atan2(Math.abs(dx), dy);
  return Math.round((leanRadians * 180 / Math.PI) * 10) / 10;
}

/**
 * Calculates Pelvic Tilt (Trendelenburg Angle) in degrees
 */
export function calculatePelvicTilt(leftHip, rightHip) {
  if (!leftHip || !rightHip) return 0;
  const dx = Math.abs(leftHip.x - rightHip.x);
  const dy = Math.abs(leftHip.y - rightHip.y);
  return Math.round((Math.atan2(dy, Math.max(0.01, dx)) * 180 / Math.PI) * 10) / 10;
}

/**
 * Calculates Limb Asymmetry %
 */
export function calculateAsymmetry(valLeft, valRight) {
  if (!valLeft && !valRight) return 0;
  const max = Math.max(valLeft, valRight);
  if (max === 0) return 0;
  const diff = Math.abs(valLeft - valRight);
  return Math.round((diff / max) * 100);
}

/**
 * Comprehensive ACL Injury Risk Assessment Algorithm with Sports-Specific Weighting
 */
export function evaluateACLRisk(landmarks, exerciseType = 'squat', sportId = 'general') {
  if (!landmarks || landmarks.length < 33) {
    return {
      score: 0,
      level: 'Calibrating',
      color: '#06b6d4',
      valgusLeft: 180,
      valgusRight: 180,
      collapseLeft: 0,
      collapseRight: 0,
      flexionLeft: 180,
      flexionRight: 180,
      avgFlexion: 180,
      asymmetry: 0,
      trunkLean: 0,
      pelvicTilt: 0,
      feedbacks: ['Position yourself fully in camera frame'],
      lessScore: 0,
      riskBreakdown: { valgusPenalty: 0, flexionPenalty: 0, asymmetryPenalty: 0, trunkPenalty: 0 }
    };
  }

  const profile = SPORTS_PROFILES[sportId] || SPORTS_PROFILES.general;

  const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  const leftValgusData = calculateKneeValgusFPPA(lHip, lKnee, lAnkle, true, rHip);
  const rightValgusData = calculateKneeValgusFPPA(rHip, rKnee, rAnkle, false, lHip);

  const leftFlexion = calculateKneeFlexion(lHip, lKnee, lAnkle);
  const rightFlexion = calculateKneeFlexion(rHip, rKnee, rAnkle);
  const avgFlexion = (leftFlexion + rightFlexion) / 2;

  const trunkLean = calculateTrunkLean(lShoulder, rShoulder, lHip, rHip);
  const pelvicTilt = calculatePelvicTilt(lHip, rHip);
  const asymmetry = calculateAsymmetry(leftValgusData.valgusCollapseDeg, rightValgusData.valgusCollapseDeg);

  const feedbacks = [];
  let valgusPenalty = 0;
  let flexionPenalty = 0;
  let asymmetryPenalty = 0;
  let trunkPenalty = 0;

  // 1. Dynamic Knee Valgus Penalty & Specific Joint Directives
  const maxCollapse = Math.max(leftValgusData.valgusCollapseDeg, rightValgusData.valgusCollapseDeg);
  
  if (leftValgusData.valgusCollapseDeg > 12 && rightValgusData.valgusCollapseDeg > 12) {
    valgusPenalty = Math.min(65, 45 + (maxCollapse - 12) * 1.5) * profile.valgusWeight;
    feedbacks.push(`[${profile.name}] Bilateral knee valgus! Push knees out aligned with toes.`);
  } else if (leftValgusData.valgusCollapseDeg > 10) {
    valgusPenalty = Math.min(55, 35 + leftValgusData.valgusCollapseDeg * 1.2) * profile.valgusWeight;
    feedbacks.push(`[${profile.name}] Left knee caving inward (${leftValgusData.valgusCollapseDeg}°). Drive left knee outward over pinky toe.`);
  } else if (rightValgusData.valgusCollapseDeg > 10) {
    valgusPenalty = Math.min(55, 35 + rightValgusData.valgusCollapseDeg * 1.2) * profile.valgusWeight;
    feedbacks.push(`[${profile.name}] Right knee caving inward (${rightValgusData.valgusCollapseDeg}°). Drive right knee outward over pinky toe.`);
  } else if (maxCollapse > 6) {
    valgusPenalty = 16 * profile.valgusWeight;
    feedbacks.push(`[${profile.name}] Slight medial knee tracking. Maintain glute activation.`);
  }

  // 2. Landing / Flexion Stiffness Penalty (LESS Criteria)
  if (exerciseType === 'drop_jump' || exerciseType === 'jump') {
    if (avgFlexion > 155) {
      flexionPenalty = 28 * profile.landingWeight;
      feedbacks.push(`[${profile.name}] Stiff landing detected! Flex knees to at least 45° to dissipate ground reaction forces.`);
    } else if (avgFlexion > 140) {
      flexionPenalty = 15 * profile.landingWeight;
      feedbacks.push(`[${profile.name}] Land softer — increase knee flexion on impact.`);
    }
  } else if (exerciseType === 'squat' && avgFlexion < 105) {
    if (maxCollapse > 8) {
      valgusPenalty += 12 * profile.valgusWeight;
      feedbacks.push(`[${profile.name}] Knee cave at bottom of squat. Engage abduction muscles.`);
    }
  }

  // 3. Asymmetry Penalty
  if (asymmetry > 35 && maxCollapse > 5) {
    asymmetryPenalty = 14 * profile.asymmetryWeight;
    feedbacks.push(`[${profile.name}] High limb asymmetry (${asymmetry}%). Balance load equally.`);
  } else if (asymmetry > 20 && maxCollapse > 5) {
    asymmetryPenalty = 7 * profile.asymmetryWeight;
  }

  // 4. Trunk Sway & Pelvic Tilt Penalty
  if (trunkLean > 14) {
    trunkPenalty = 10 * profile.trunkWeight;
    feedbacks.push(`[${profile.name}] Trunk tilt (${trunkLean}°). Maintain upright core stability.`);
  } else if (trunkLean > 8) {
    trunkPenalty = 5 * profile.trunkWeight;
  }

  if (pelvicTilt > 8) {
    trunkPenalty += 6;
  }

  // Calculate LESS (Landing Error Scoring System) Score (0 to 15)
  let lessScore = 0;
  if (maxCollapse > 10) lessScore += 2;
  else if (maxCollapse > 5) lessScore += 1;
  if (avgFlexion > 150) lessScore += 2; // stiff landing
  else if (avgFlexion > 135) lessScore += 1;
  if (trunkLean > 10) lessScore += 1;
  if (asymmetry > 25) lessScore += 1;
  if (pelvicTilt > 6) lessScore += 1;

  let totalScore = Math.min(100, Math.round(valgusPenalty + flexionPenalty + asymmetryPenalty + trunkPenalty));

  if (feedbacks.length === 0) {
    feedbacks.push(`[${profile.name}] Optimal joint alignment! Biomechanics safe and stable.`);
  }

  let level = 'Low Risk';
  let color = '#10b981';

  if (totalScore >= 65) {
    level = 'Severe Risk';
    color = '#ef4444';
  } else if (totalScore >= 40) {
    level = 'High Risk';
    color = '#f97316';
  } else if (totalScore >= 18) {
    level = 'Moderate Risk';
    color = '#f59e0b';
  }

  return {
    score: totalScore,
    level,
    color,
    valgusLeft: leftValgusData.fppa,
    valgusRight: rightValgusData.fppa,
    collapseLeft: leftValgusData.valgusCollapseDeg,
    collapseRight: rightValgusData.valgusCollapseDeg,
    directionLeft: leftValgusData.direction,
    directionRight: rightValgusData.direction,
    flexionLeft: Math.round(leftFlexion),
    flexionRight: Math.round(rightFlexion),
    avgFlexion: Math.round(avgFlexion),
    asymmetry,
    trunkLean,
    pelvicTilt,
    feedbacks,
    lessScore,
    riskBreakdown: { valgusPenalty, flexionPenalty, asymmetryPenalty, trunkPenalty }
}

/**
 * Jump Kinematics & Hang-Time Calculator
 */
export class JumpKinematicsTracker {
  constructor() {
    this.inFlight = false;
    this.takeoffTime = null;
    this.lastJumpHeightCm = 0;
    this.lastHangTimeMs = 0;
    this.lastImpactGForce = 0;
    this.baselineAnkleY = null;
  }

  update(landmarks) {
    if (!landmarks || landmarks.length < 33) return null;

    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    if (!lAnkle || !rAnkle) return null;

    const currentAnkleY = (lAnkle.y + rAnkle.y) / 2;

    if (this.baselineAnkleY === null) {
      this.baselineAnkleY = currentAnkleY;
      return null;
    }

    // Adapt baseline when resting
    if (!this.inFlight && currentAnkleY > this.baselineAnkleY) {
      this.baselineAnkleY = currentAnkleY * 0.95 + this.baselineAnkleY * 0.05;
    }

    const elevation = this.baselineAnkleY - currentAnkleY; // positive when airborne
    const now = performance.now();

    if (!this.inFlight && elevation > 0.045) {
      // Takeoff detected
      this.inFlight = true;
      this.takeoffTime = now;
    } else if (this.inFlight && elevation < 0.015) {
      // Landing detected
      this.inFlight = false;
      if (this.takeoffTime) {
        const hangTimeMs = Math.round(now - this.takeoffTime);
        if (hangTimeMs > 120 && hangTimeMs < 1200) { // realistic jump filter
          this.lastHangTimeMs = hangTimeMs;
          const hangTimeSec = hangTimeMs / 1000;
          // Jump Height h = 1/8 * g * t^2
          const heightMeters = 0.5 * 9.81 * Math.pow(hangTimeSec / 2, 2);
          this.lastJumpHeightCm = Math.round(heightMeters * 100 * 10) / 10;
          // Estimated peak ground impact G-force
          this.lastImpactGForce = (Math.sqrt(2 * 9.81 * Math.max(0.1, heightMeters)) / 0.08 / 9.81).toFixed(1);

          return {
            jumpCompleted: true,
            hangTimeMs: this.lastHangTimeMs,
            jumpHeightCm: this.lastJumpHeightCm,
            jumpHeightInches: (this.lastJumpHeightCm / 2.54).toFixed(1),
            impactGForce: this.lastImpactGForce
          };
        }
      }
    }

    return {
      inFlight: this.inFlight,
      jumpHeightCm: this.lastJumpHeightCm,
      hangTimeMs: this.lastHangTimeMs,
      impactGForce: this.lastImpactGForce
    };
  }
}

/**
 * Exercise Repetition & Form State Tracker
 */
export class RepetitionTracker {
  constructor(exerciseId = 'squat') {
    this.setExercise(exerciseId);
    this.reset();
  }

  setExercise(exerciseId) {
    this.exerciseId = exerciseId;
    this.reset();
  }

  reset() {
    this.repCount = 0;
    this.currentPhase = 'IDLE';
    this.repStartTime = null;
    this.minAngleReached = 180;
    this.maxAngleReached = 0;
    this.currentROM = 0;
    this.repHistory = [];
    this.peakRiskInRep = 0;
    this.peakValgusMoment = null;
  }

  update(landmarks, riskData) {
    if (!landmarks || landmarks.length < 33) {
      return {
        repCount: this.repCount,
        phase: this.currentPhase,
        romPercent: 0,
        newRepCompleted: false
      };
    }

    let primaryMetric = 180;
    let newRepCompleted = false;

    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    if (riskData && riskData.score > this.peakRiskInRep) {
      this.peakRiskInRep = riskData.score;
      this.peakValgusMoment = {
        valgusLeft: riskData.valgusLeft,
        valgusRight: riskData.valgusRight,
        flexionLeft: riskData.flexionLeft,
        flexionRight: riskData.flexionRight,
        riskScore: riskData.score,
        timestamp: Date.now()
      };
    }

    switch (this.exerciseId) {
      case 'squat':
      case 'drop_jump':
      case 'single_leg_squat':
      case 'lunge': {
        const leftKnee = calculateKneeFlexion(lHip, lKnee, lAnkle);
        const rightKnee = calculateKneeFlexion(rHip, rKnee, rAnkle);
        primaryMetric = (this.exerciseId === 'single_leg_squat' || this.exerciseId === 'lunge') ? leftKnee : (leftKnee + rightKnee) / 2;

        this.currentROM = Math.min(100, Math.max(0, Math.round(((180 - primaryMetric) / 90) * 100)));

        if (this.currentPhase === 'IDLE' || this.currentPhase === 'CONCENTRIC') {
          if (primaryMetric < 155) {
            this.currentPhase = 'ECCENTRIC';
            this.repStartTime = Date.now();
            this.minAngleReached = primaryMetric;
            this.peakRiskInRep = riskData ? riskData.score : 0;
          }
        } else if (this.currentPhase === 'ECCENTRIC') {
          if (primaryMetric < this.minAngleReached) {
            this.minAngleReached = primaryMetric;
          }
          if (primaryMetric <= 110) {
            this.currentPhase = 'BOTTOM';
          } else if (primaryMetric > this.minAngleReached + 12) {
            this.currentPhase = 'CONCENTRIC';
          }
        } else if (this.currentPhase === 'BOTTOM') {
          if (primaryMetric < this.minAngleReached) {
            this.minAngleReached = primaryMetric;
          }
          if (primaryMetric > 120) {
            this.currentPhase = 'CONCENTRIC';
          }
        } else if (this.currentPhase === 'CONCENTRIC') {
          if (primaryMetric >= 165) {
            const repDurationMs = Date.now() - (this.repStartTime || Date.now());
            // Filter noise: require at least 500ms duration for valid rep
            if (repDurationMs > 500) {
              this.repCount++;
              newRepCompleted = true;
              const repDurationSec = (repDurationMs / 1000).toFixed(1);
              const qualityGrade = this.peakRiskInRep > 60 ? 'C (High Risk)' : this.peakRiskInRep > 30 ? 'B (Moderate)' : 'A (Excellent)';
              
              this.repHistory.push({
                repNumber: this.repCount,
                durationSec: repDurationSec,
                minDepthDeg: Math.round(this.minAngleReached),
                peakRisk: this.peakRiskInRep,
                grade: qualityGrade,
                peakMoment: this.peakValgusMoment,
                timestamp: new Date().toLocaleTimeString()
              });
            }

            this.currentPhase = 'IDLE';
            this.peakRiskInRep = 0;
          }
        }
        break;
      }

      case 'seated_press': {
        const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
        const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
        primaryMetric = (leftArmAngle + rightArmAngle) / 2;
        this.currentROM = Math.min(100, Math.max(0, Math.round(((primaryMetric - 75) / 90) * 100)));

        if (this.currentPhase === 'IDLE' || this.currentPhase === 'ECCENTRIC') {
          if (primaryMetric > 105) {
            this.currentPhase = 'CONCENTRIC';
            this.repStartTime = Date.now();
            this.maxAngleReached = primaryMetric;
          }
        } else if (this.currentPhase === 'CONCENTRIC') {
          if (primaryMetric > this.maxAngleReached) {
            this.maxAngleReached = primaryMetric;
          }
          if (primaryMetric >= 155) {
            this.currentPhase = 'BOTTOM';
          } else if (primaryMetric < this.maxAngleReached - 15) {
            this.currentPhase = 'ECCENTRIC';
          }
        } else if (this.currentPhase === 'BOTTOM') {
          if (primaryMetric < 135) {
            this.currentPhase = 'ECCENTRIC';
          }
        } else if (this.currentPhase === 'ECCENTRIC') {
          if (primaryMetric <= 90) {
            this.repCount++;
            newRepCompleted = true;
            this.repHistory.push({
              repNumber: this.repCount,
              durationSec: ((Date.now() - (this.repStartTime || Date.now())) / 1000).toFixed(1),
              maxExtensionDeg: Math.round(this.maxAngleReached),
              grade: this.maxAngleReached > 150 ? 'A (Full Extension)' : 'B (Partial ROM)',
              timestamp: new Date().toLocaleTimeString()
            });
            this.currentPhase = 'IDLE';
          }
        }
        break;
      }

      case 'seated_boxing': {
        const leftReach = Math.hypot(lWrist.x - lShoulder.x, lWrist.y - lShoulder.y);
        const rightReach = Math.hypot(rWrist.x - rShoulder.x, rWrist.y - rShoulder.y);
        const maxReach = Math.max(leftReach, rightReach);
        this.currentROM = Math.min(100, Math.round(maxReach * 280));

        if (this.currentPhase === 'IDLE') {
          if (this.currentROM > 55) {
            this.currentPhase = 'CONCENTRIC';
            this.repStartTime = Date.now();
          }
        } else if (this.currentPhase === 'CONCENTRIC') {
          if (this.currentROM > 80) {
            this.currentPhase = 'BOTTOM';
          }
        } else if (this.currentPhase === 'BOTTOM') {
          if (this.currentROM < 50) {
            this.repCount++;
            newRepCompleted = true;
            this.repHistory.push({
              repNumber: this.repCount,
              durationSec: '0.8',
              grade: 'A (Crisp Strike)',
              timestamp: new Date().toLocaleTimeString()
            });
            this.currentPhase = 'IDLE';
          }
        }
        break;
      }

      case 'seated_lateral_raise': {
        const leftRaise = calculateAngle(lHip, lShoulder, lElbow);
        const rightRaise = calculateAngle(rHip, rShoulder, rElbow);
        primaryMetric = (leftRaise + rightRaise) / 2;
        this.currentROM = Math.min(100, Math.max(0, Math.round(((primaryMetric - 20) / 70) * 100)));

        if (this.currentPhase === 'IDLE') {
          if (primaryMetric > 45) {
            this.currentPhase = 'CONCENTRIC';
            this.repStartTime = Date.now();
          }
        } else if (this.currentPhase === 'CONCENTRIC') {
          if (primaryMetric >= 80) {
            this.currentPhase = 'BOTTOM';
          }
        } else if (this.currentPhase === 'BOTTOM') {
          if (primaryMetric < 60) {
            this.currentPhase = 'ECCENTRIC';
          }
        } else if (this.currentPhase === 'ECCENTRIC') {
          if (primaryMetric <= 30) {
            this.repCount++;
            newRepCompleted = true;
            this.repHistory.push({
              repNumber: this.repCount,
              durationSec: ((Date.now() - (this.repStartTime || Date.now())) / 1000).toFixed(1),
              grade: 'A (Controlled Tempo)',
              timestamp: new Date().toLocaleTimeString()
            });
            this.currentPhase = 'IDLE';
          }
        }
        break;
      }

      default: {
        this.currentROM = 50;
      }
    }

    return {
      repCount: this.repCount,
      phase: this.currentPhase,
      romPercent: this.currentROM,
      newRepCompleted,
      history: this.repHistory
    };
  }
}

/**
 * Synthetic Pose Simulation Engine for Demo / Offline Mode
 * Generates biomechanically accurate motion for every exercise protocol.
 */
export class SyntheticPoseGenerator {
  constructor() {
    this.frameIndex = 0;
  }

  generateFrame(exerciseId = 'squat', introduceValgusFlaw = false) {
    this.frameIndex += 0.045;
    const t = this.frameIndex;
    
    const landmarks = [];
    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 });
    }

    const headY = 0.22;
    const shoulderY = 0.32;
    const hipY = 0.55;
    const ankleBaseY = 0.88;

    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: headY, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_EYE] = { x: 0.52, y: headY - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EYE] = { x: 0.48, y: headY - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_EAR] = { x: 0.55, y: headY, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EAR] = { x: 0.45, y: headY, z: 0, visibility: 0.99 };

    switch (exerciseId) {
      // 1. Dynamic Forward Lunge (Asymmetrical front step and rear drop)
      case 'lunge': {
        const lungeCycle = (Math.sin(t) + 1) / 2;
        const depth = lungeCycle * 0.16;

        const dynShoulderY = shoulderY + depth * 0.7;
        const dynHipY = hipY + depth * 0.75;

        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.56, y: dynShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.44, y: dynShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.58, y: dynShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.42, y: dynShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.54, y: dynShoulderY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.46, y: dynShoulderY + 0.16, z: 0, visibility: 0.99 };

        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.55, y: dynHipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.45, y: dynHipY, z: 0, visibility: 0.99 };

        // Front Lead Leg (Left)
        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.59, y: ankleBaseY, z: 0, visibility: 0.99 };
        let leadKneeX = 0.59;
        const leadKneeY = (dynHipY + ankleBaseY) / 2 + depth * 0.35;
        
        if (introduceValgusFlaw && lungeCycle > 0.35) {
          leadKneeX -= (lungeCycle - 0.35) * 0.16; // Severe inward collapse
        }
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leadKneeX, y: leadKneeY, z: 0, visibility: 0.99 };

        // Rear Trailing Leg (Right)
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.38, y: ankleBaseY - depth * 0.05, z: 0, visibility: 0.99 };
        const rearKneeY = dynHipY + 0.18 + depth * 0.5;
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.40, y: rearKneeY, z: 0, visibility: 0.99 };
        break;
      }

      // 2. Drop Vertical Jump (DVJ / LESS Jump-Landing Protocol)
      case 'drop_jump': {
        const jumpPhase = (t % (Math.PI * 2)) / (Math.PI * 2);
        let heightOffset = 0;
        let kneeCompression = 0;
        let valgusCollapse = 0;

        if (jumpPhase < 0.3) {
          // Pre-jump dip
          kneeCompression = Math.sin(jumpPhase / 0.3 * Math.PI) * 0.08;
          heightOffset = kneeCompression;
        } else if (jumpPhase < 0.6) {
          // Explosive Jump Flight in Air
          const airProgress = (jumpPhase - 0.3) / 0.3;
          heightOffset = -Math.sin(airProgress * Math.PI) * 0.22; // Jump upwards
          kneeCompression = -0.04;
        } else {
          // High-Impact Landing Absorption
          const landProgress = (jumpPhase - 0.6) / 0.4;
          kneeCompression = Math.sin(landProgress * Math.PI) * 0.18;
          heightOffset = kneeCompression * 0.8;
          if (introduceValgusFlaw && landProgress < 0.7) {
            valgusCollapse = Math.sin(landProgress / 0.7 * Math.PI) * 0.15;
          }
        }

        const dynHeadY = headY + heightOffset;
        const dynShoulderY = shoulderY + heightOffset;
        const dynHipY = hipY + heightOffset;
        const dynAnkleY = ankleBaseY + Math.min(0, heightOffset * 0.6);

        landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: dynHeadY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.58, y: dynShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.42, y: dynShoulderY, z: 0, visibility: 0.99 };
        
        // Arms swing up in jump
        const armLift = heightOffset < -0.05 ? 0.2 : 0;
        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.59, y: dynShoulderY + 0.1 - armLift, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.41, y: dynShoulderY + 0.1 - armLift, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: dynShoulderY + 0.12 - armLift * 1.5, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: dynShoulderY + 0.12 - armLift * 1.5, z: 0, visibility: 0.99 };

        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.57, y: dynHipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.43, y: dynHipY, z: 0, visibility: 0.99 };

        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.60, y: dynAnkleY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.40, y: dynAnkleY, z: 0, visibility: 0.99 };

        const dynKneeY = (dynHipY + dynAnkleY) / 2 + kneeCompression * 0.4;
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.60 - valgusCollapse, y: dynKneeY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.40 + valgusCollapse, y: dynKneeY, z: 0, visibility: 0.99 };
        break;
      }

      // 3. Single-Leg Squat Stability (Unilateral balance & pelvic tilt)
      case 'single_leg_squat': {
        const squatCycle = (Math.sin(t) + 1) / 2;
        const depth = squatCycle * 0.14;

        const dynShoulderY = shoulderY + depth * 0.8;
        const dynHipY = hipY + depth;

        // Trunk lean on single leg
        const trunkLeanX = introduceValgusFlaw ? (squatCycle * 0.04) : 0;

        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.58 + trunkLeanX, y: dynShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.42 + trunkLeanX, y: dynShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.59, y: dynShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.41, y: dynShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.56, y: dynShoulderY + 0.08, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.44, y: dynShoulderY + 0.08, z: 0, visibility: 0.99 };

        // Pelvic tilt / Trendelenburg
        const pelvicDrop = introduceValgusFlaw ? (squatCycle * 0.05) : 0;
        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.56, y: dynHipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.44, y: dynHipY + pelvicDrop, z: 0, visibility: 0.99 };

        // Standing/Loaded Leg (Left)
        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.56, y: ankleBaseY, z: 0, visibility: 0.99 };
        let stanceKneeX = 0.56;
        if (introduceValgusFlaw && squatCycle > 0.3) {
          stanceKneeX -= (squatCycle - 0.3) * 0.15; // Medial collapse
        }
        const stanceKneeY = (dynHipY + ankleBaseY) / 2 + depth * 0.3;
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: stanceKneeX, y: stanceKneeY, z: 0, visibility: 0.99 };

        // Lifted Leg Floating (Right)
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.41, y: dynHipY + 0.12 - depth * 0.2, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.38, y: ankleBaseY - 0.12 - depth * 0.3, z: 0, visibility: 0.99 };
        break;
      }

      // 4. Seated Overhead Press
      case 'seated_press': {
        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.59, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.41, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.56, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.44, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.58, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.42, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.58, y: hipY + 0.32, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.42, y: hipY + 0.32, z: 0, visibility: 0.99 };

        const armCycle = (Math.sin(t) + 1) / 2;
        const elbowY = shoulderY + 0.12 - armCycle * 0.18;
        const wristY = shoulderY - armCycle * 0.22;
        const elbowXOffset = 0.08 - armCycle * 0.03;

        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.59 + elbowXOffset, y: elbowY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.41 - elbowXOffset, y: elbowY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.58, y: wristY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.42, y: wristY, z: 0, visibility: 0.99 };
        break;
      }

      // 5. Seated Shadow Boxing
      case 'seated_boxing': {
        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.59, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.41, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.56, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.44, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.58, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.42, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.58, y: hipY + 0.32, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.42, y: hipY + 0.32, z: 0, visibility: 0.99 };

        const punchLeft = Math.max(0, Math.sin(t));
        const punchRight = Math.max(0, -Math.sin(t));

        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.56, y: shoulderY + 0.1 - punchLeft * 0.05, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.44, y: shoulderY + 0.1 - punchRight * 0.05, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.54 + punchLeft * 0.14, y: shoulderY + 0.02 - punchLeft * 0.05, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.46 - punchRight * 0.14, y: shoulderY + 0.02 - punchRight * 0.05, z: 0, visibility: 0.99 };
        break;
      }

      // 6. Seated Lateral Arm Raises
      case 'seated_lateral_raise': {
        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.59, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.41, y: shoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.56, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.44, y: hipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.58, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.42, y: hipY + 0.16, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.58, y: hipY + 0.32, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.42, y: hipY + 0.32, z: 0, visibility: 0.99 };

        const raiseCycle = (Math.sin(t) + 1) / 2;
        const armAngle = raiseCycle * (Math.PI / 2);
        const armLen = 0.22;

        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = {
          x: 0.59 + Math.sin(armAngle) * (armLen * 0.5),
          y: shoulderY + Math.cos(armAngle) * (armLen * 0.5),
          z: 0, visibility: 0.99
        };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = {
          x: 0.41 - Math.sin(armAngle) * (armLen * 0.5),
          y: shoulderY + Math.cos(armAngle) * (armLen * 0.5),
          z: 0, visibility: 0.99
        };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = {
          x: 0.59 + Math.sin(armAngle) * armLen,
          y: shoulderY + Math.cos(armAngle) * armLen,
          z: 0, visibility: 0.99
        };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = {
          x: 0.41 - Math.sin(armAngle) * armLen,
          y: shoulderY + Math.cos(armAngle) * armLen,
          z: 0, visibility: 0.99
        };
        break;
      }

      // 7. Standard Deep Squat Alignment (Default)
      default: {
        const squatCycle = (Math.sin(t) + 1) / 2;
        const squatDepth = squatCycle * 0.15;

        const dynamicHipY = hipY + squatDepth;
        const dynamicShoulderY = shoulderY + squatDepth * 0.85;

        landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.58, y: dynamicShoulderY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.42, y: dynamicShoulderY, z: 0, visibility: 0.99 };
        
        landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.57, y: dynamicShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.43, y: dynamicShoulderY + 0.1, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.55, y: dynamicShoulderY + 0.12, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.45, y: dynamicShoulderY + 0.12, z: 0, visibility: 0.99 };

        landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.57, y: dynamicHipY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.43, y: dynamicHipY, z: 0, visibility: 0.99 };

        landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.60, y: ankleBaseY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.40, y: ankleBaseY, z: 0, visibility: 0.99 };

        const kneeY = (dynamicHipY + ankleBaseY) / 2 + squatDepth * 0.2;
        let leftKneeX = 0.61;
        let rightKneeX = 0.39;

        if (introduceValgusFlaw && squatCycle > 0.4) {
          const valgusShift = (squatCycle - 0.4) * 0.14;
          leftKneeX -= valgusShift;
          rightKneeX += valgusShift;
        } else {
          leftKneeX += squatCycle * 0.02;
          rightKneeX -= squatCycle * 0.02;
        }

        landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: leftKneeX, y: kneeY, z: 0, visibility: 0.99 };
        landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: rightKneeX, y: kneeY, z: 0, visibility: 0.99 };
        break;
      }
    }

    // 8. Populate All Facial & Peripheral Extremity Points for Full 33 Keypoint Tracking
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    landmarks[POSE_LANDMARKS.LEFT_EYE_INNER] = { x: nose.x + 0.015, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_EYE] = { x: nose.x + 0.025, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_EYE_OUTER] = { x: nose.x + 0.035, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EYE_INNER] = { x: nose.x - 0.015, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EYE] = { x: nose.x - 0.025, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EYE_OUTER] = { x: nose.x - 0.035, y: nose.y - 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_EAR] = { x: nose.x + 0.055, y: nose.y - 0.005, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_EAR] = { x: nose.x - 0.055, y: nose.y - 0.005, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.MOUTH_LEFT] = { x: nose.x + 0.015, y: nose.y + 0.025, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.MOUTH_RIGHT] = { x: nose.x - 0.015, y: nose.y + 0.025, z: 0, visibility: 0.99 };

    // Hands & Fingers
    const lW = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rW = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    landmarks[POSE_LANDMARKS.LEFT_PINKY] = { x: lW.x + 0.015, y: lW.y + 0.035, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_INDEX] = { x: lW.x, y: lW.y + 0.045, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_THUMB] = { x: lW.x - 0.015, y: lW.y + 0.025, z: 0, visibility: 0.99 };

    landmarks[POSE_LANDMARKS.RIGHT_PINKY] = { x: rW.x - 0.015, y: rW.y + 0.035, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_INDEX] = { x: rW.x, y: rW.y + 0.045, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_THUMB] = { x: rW.x + 0.015, y: rW.y + 0.025, z: 0, visibility: 0.99 };

    // Feet & Toes
    const lA = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rA = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    landmarks[POSE_LANDMARKS.LEFT_HEEL] = { x: lA.x - 0.015, y: lA.y + 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX] = { x: lA.x + 0.035, y: lA.y + 0.03, z: 0, visibility: 0.99 };

    landmarks[POSE_LANDMARKS.RIGHT_HEEL] = { x: rA.x + 0.015, y: rA.y + 0.02, z: 0, visibility: 0.99 };
    landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX] = { x: rA.x - 0.035, y: rA.y + 0.03, z: 0, visibility: 0.99 };

    return landmarks;
  }
}

