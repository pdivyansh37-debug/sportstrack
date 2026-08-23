/**
 * ACL-Shield & AdaptiFit Application Controller
 * Integrates MediaPipe Pose, Multi-Sport Biomechanical Kinematics, LESS Scoring,
 * Jump Tracking, Video Scrubber, Body Silhouette Stencil, Auto-Calibration,
 * and Real-Time Injury Risk Alert & Dispatch System.
 */

import {
  POSE_LANDMARKS,
  SPORTS_PROFILES,
  calculateAngle,
  calculateKneeValgusFPPA,
  calculateKneeFlexion,
  calculateTrunkLean,
  calculateAsymmetry,
  evaluateACLRisk,
  JumpKinematicsTracker,
  RepetitionTracker,
  SyntheticPoseGenerator
} from './kinematics.js';

import { AthleteProfileManager } from './athleteProfile.js';
import { VoiceCoach } from './voiceCoach.js';
import { ReportGenerator } from './reportGenerator.js';
import { AlertManager } from './alertManager.js';

// Application State
const state = {
  currentMode: 'shield',
  currentSport: 'basketball',
  exerciseId: 'squat',
  abilityProfile: 'general',
  videoSource: 'demo',
  isStreaming: false,
  isDemoRunning: false,
  demoWithValgusFlaw: false,
  isMirrored: true,
  
  // Alignment & Calibration
  showSilhouette: true,
  showSkeleton: true,
  showAngles: true,
  showGrid: true,
  errorHighlightOnly: true, // Show points ONLY on joints with bad posture/valgus flaw
  isCalibrated: false,
  isCalibrating: false,
  calibrationCount: 0,
  calibrationSamples: [],
  neutralOffsetValgusL: 0,
  neutralOffsetValgusR: 0,
  bodyFramingState: 'PERFECT',
  
  // Video Playback
  playbackRate: 1.0,
  peakValgusTimestamp: 0,
  
  // Report Format
  reportFormat: 'clinical',
  
  // Session Metrics
  sessionStartTime: Date.now(),
  telemetryLogs: [],
  maxRiskScore: 0,
  riskSum: 0,
  riskCount: 0,
  maxLessScore: 0,
  maxJumpHeightCm: 0,
  maxImpactGForce: 0,
  
  // Performance
  fps: 0,
  lastFrameTime: performance.now(),
  frameCount: 0
};

// Sub-modules
const athleteManager = new AthleteProfileManager();
const voiceCoach = new VoiceCoach();
const alertManager = new AlertManager();
const repTracker = new RepetitionTracker('squat');
const jumpTracker = new JumpKinematicsTracker();
const syntheticGenerator = new SyntheticPoseGenerator();

// DOM Elements
const elements = {
  modeShieldBtn: document.getElementById('modeShield'),
  modeFitBtn: document.getElementById('modeFit'),
  sportSelect: document.getElementById('sportSelect'),
  exerciseSelect: document.getElementById('exerciseSelect'),
  abilitySelect: document.getElementById('abilitySelect'),
  abilityGroup: document.getElementById('abilityGroup'),
  athleteBadgeBtn: document.getElementById('athleteBadgeBtn'),
  alertsBtn: document.getElementById('alertsBtn'),
  
  viewportCard: document.querySelector('.viewport-card'),
  webcam: document.getElementById('webcam'),
  videoUploadPlayer: document.getElementById('videoUploadPlayer'),
  overlay: document.getElementById('overlay'),
  videoFileInput: document.getElementById('videoFileInput'),
  fpsCounter: document.getElementById('fpsCounter'),
  demoBadge: document.getElementById('demoBadge'),
  sourceCameraBtn: document.getElementById('sourceCameraBtn'),
  sourceUploadBtn: document.getElementById('sourceUploadBtn'),
  sourceDemoBtn: document.getElementById('sourceDemoBtn'),
  toggleFlawBtn: document.getElementById('toggleFlawBtn'),
  mirrorToggleBtn: document.getElementById('mirrorToggleBtn'),
  calibrateBtn: document.getElementById('calibrateBtn'),
  framingPill: document.getElementById('framingPill'),
  
  videoScrubberBar: document.getElementById('videoScrubberBar'),
  videoTimeline: document.getElementById('videoTimeline'),
  timeDisplay: document.getElementById('timeDisplay'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  stepBackBtn: document.getElementById('stepBackBtn'),
  stepFwdBtn: document.getElementById('stepFwdBtn'),
  freezePeakBtn: document.getElementById('freezePeakBtn'),
  speedChips: document.querySelectorAll('.speed-chip'),
  
  toggleSkeletonBtn: document.getElementById('toggleSkeleton'),
  toggleAnglesBtn: document.getElementById('toggleAngles'),
  toggleGridBtn: document.getElementById('toggleGrid'),
  toggleSilhouetteBtn: document.getElementById('toggleSilhouette'),
  toggleErrorOnlyBtn: document.getElementById('toggleErrorOnly'),
  toggleVoiceBtn: document.getElementById('toggleVoiceBtn'),
  
  gaugeNum: document.getElementById('gaugeNum'),
  gaugeStatusBadge: document.getElementById('gaugeStatusBadge'),
  gaugeNeedle: document.getElementById('gaugeNeedle'),
  gaugeLabel: document.getElementById('gaugeLabel'),
  
  valgusLeftVal: document.getElementById('valgusLeftVal'),
  valgusRightVal: document.getElementById('valgusRightVal'),
  flexionDepthVal: document.getElementById('flexionDepthVal'),
  asymmetryVal: document.getElementById('asymmetryVal'),
  trunkLeanVal: document.getElementById('trunkLeanVal'),
  repCountVal: document.getElementById('repCountVal'),
  romPercentVal: document.getElementById('romPercentVal'),
  repPhaseBadge: document.getElementById('repPhaseBadge'),
  lessScoreVal: document.getElementById('lessScoreVal'),
  jumpHeightVal: document.getElementById('jumpHeightVal'),
  
  feedbackText: document.getElementById('feedbackText'),
  coachBeacon: document.getElementById('coachBeacon'),
  
  historyList: document.getElementById('historyList'),
  reportBtn: document.getElementById('reportBtn'),
  downloadExcelBtn: document.getElementById('downloadExcelBtn'),
  modalExcelBtn: document.getElementById('modalExcelBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  resetBtn: document.getElementById('resetBtn'),
  
  reportModal: document.getElementById('reportModal'),
  reportContent: document.getElementById('reportContent'),
  reportFormatSelect: document.getElementById('reportFormatSelect'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  printReportBtn: document.getElementById('printReportBtn'),
  
  athleteModal: document.getElementById('athleteModal'),
  closeAthleteModalBtn: document.getElementById('closeAthleteModalBtn'),
  athleteForm: document.getElementById('athleteForm'),
  athleteSelectDropdown: document.getElementById('athleteSelectDropdown'),
  athleteSessionHistoryList: document.getElementById('athleteSessionHistoryList'),
  deleteAthleteBtn: document.getElementById('deleteAthleteBtn'),

  // Alerts Modal Elements
  alertsModal: document.getElementById('alertsModal'),
  closeAlertsModalBtn: document.getElementById('closeAlertsModalBtn'),
  alertThresholdSlider: document.getElementById('alertThresholdSlider'),
  alertThresholdValue: document.getElementById('alertThresholdValue'),
  enableDesktopNotifs: document.getElementById('enableDesktopNotifs'),
  requestNotifPermBtn: document.getElementById('requestNotifPermBtn'),
  enableAudioSiren: document.getElementById('enableAudioSiren'),
  enableWebhookToggle: document.getElementById('enableWebhookToggle'),
  webhookUrlInput: document.getElementById('webhookUrlInput'),
  coachEmailInput: document.getElementById('coachEmailInput'),
  saveAlertSettingsBtn: document.getElementById('saveAlertSettingsBtn'),
  testAlertBtn: document.getElementById('testAlertBtn'),
  sendEmailAlertBtn: document.getElementById('sendEmailAlertBtn'),
  incidentLogsList: document.getElementById('incidentLogsList')
};

const ctx = elements.overlay.getContext('2d');
let poseDetector = null;
let cameraInstance = null;
let demoAnimationFrameId = null;
let telemetryChart = null;

/**
 * Initialize Application
 */
async function initApp() {
  setupEventListeners();
  updateAthleteUI();
  initTelemetryChart();
  initMediaPipePose();
  initAlertsUI();
  
  switchVideoSource('demo');
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  elements.modeShieldBtn.addEventListener('click', () => setMode('shield'));
  elements.modeFitBtn.addEventListener('click', () => setMode('fit'));
  
  if (elements.sportSelect) {
    elements.sportSelect.addEventListener('change', (e) => {
      state.currentSport = e.target.value;
      const profile = SPORTS_PROFILES[state.currentSport];
      voiceCoach.speak(`Loaded ${profile.name} biomechanical profile`);
    });
  }

  elements.exerciseSelect.addEventListener('change', (e) => {
    state.exerciseId = e.target.value;
    repTracker.setExercise(state.exerciseId);
    syntheticGenerator.frameIndex = 0;
    voiceCoach.speak(`Starting ${e.target.options[e.target.selectedIndex].text}`);
  });

  if (elements.abilitySelect) {
    elements.abilitySelect.addEventListener('change', (e) => {
      state.abilityProfile = e.target.value;
      updateExerciseDropdown();
    });
  }

  if (elements.athleteBadgeBtn) {
    elements.athleteBadgeBtn.addEventListener('click', openAthleteModal);
  }

  // Alerts Modal Button
  if (elements.alertsBtn) {
    elements.alertsBtn.addEventListener('click', openAlertsModal);
  }

  elements.sourceCameraBtn.addEventListener('click', () => switchVideoSource('camera'));
  elements.sourceUploadBtn.addEventListener('click', () => elements.videoFileInput.click());
  elements.sourceDemoBtn.addEventListener('click', () => switchVideoSource('demo'));

  elements.videoFileInput.addEventListener('change', handleFileUpload);

  if (elements.toggleFlawBtn) {
    elements.toggleFlawBtn.addEventListener('click', () => {
      state.demoWithValgusFlaw = !state.demoWithValgusFlaw;
      elements.toggleFlawBtn.classList.toggle('active', state.demoWithValgusFlaw);
      elements.toggleFlawBtn.textContent = state.demoWithValgusFlaw ? '⚠️ Valgus Flaw: ON' : '✨ Perfect Form: ON';
      voiceCoach.speak(state.demoWithValgusFlaw ? 'Simulating knee valgus collapse' : 'Simulating optimal form');
    });
  }

  if (elements.mirrorToggleBtn) {
    elements.mirrorToggleBtn.addEventListener('click', () => {
      state.isMirrored = !state.isMirrored;
      elements.webcam.style.transform = state.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
      elements.mirrorToggleBtn.classList.toggle('active', state.isMirrored);
      elements.mirrorToggleBtn.textContent = state.isMirrored ? '🪞 Mirrored: ON' : '🪞 Mirrored: OFF';
    });
  }

  if (elements.calibrateBtn) {
    elements.calibrateBtn.addEventListener('click', triggerAutoCalibration);
  }

  setupScrubberControls();
  setupAlertsControls();

  // Layer Toggles
  elements.toggleSkeletonBtn.addEventListener('click', () => {
    state.showSkeleton = !state.showSkeleton;
    elements.toggleSkeletonBtn.classList.toggle('active', state.showSkeleton);
  });
  elements.toggleAnglesBtn.addEventListener('click', () => {
    state.showAngles = !state.showAngles;
    elements.toggleAnglesBtn.classList.toggle('active', state.showAngles);
  });
  elements.toggleGridBtn.addEventListener('click', () => {
    state.showGrid = !state.showGrid;
    elements.toggleGridBtn.classList.toggle('active', state.showGrid);
  });
  if (elements.toggleSilhouetteBtn) {
    elements.toggleSilhouetteBtn.addEventListener('click', () => {
      state.showSilhouette = !state.showSilhouette;
      elements.toggleSilhouetteBtn.classList.toggle('active', state.showSilhouette);
    });
  }

  if (elements.toggleErrorOnlyBtn) {
    elements.toggleErrorOnlyBtn.addEventListener('click', () => {
      state.errorHighlightOnly = !state.errorHighlightOnly;
      elements.toggleErrorOnlyBtn.classList.toggle('active', state.errorHighlightOnly);
      elements.toggleErrorOnlyBtn.textContent = state.errorHighlightOnly ? '🔴 Error-Only Points: ON' : '⚪ All 33 Points: ON';
      voiceCoach.speak(state.errorHighlightOnly ? 'Error focus mode active' : 'Showing all keypoints');
    });
  }

  elements.toggleVoiceBtn.addEventListener('click', () => {
    const isMuted = !voiceCoach.toggle();
    elements.toggleVoiceBtn.textContent = isMuted ? '🔇 Voice: Muted' : '🔊 Voice: Active';
    elements.toggleVoiceBtn.classList.toggle('active', !isMuted);
  });

  elements.reportBtn.addEventListener('click', showBiomechanicalReport);
  
  if (elements.downloadExcelBtn) {
    elements.downloadExcelBtn.addEventListener('click', handleExcelDownload);
  }
  if (elements.modalExcelBtn) {
    elements.modalExcelBtn.addEventListener('click', handleExcelDownload);
  }

  elements.downloadCsvBtn.addEventListener('click', () => ReportGenerator.downloadCSV(state.telemetryLogs));
  elements.downloadJsonBtn.addEventListener('click', () => {
    const athlete = athleteManager.getActiveAthlete();
    ReportGenerator.downloadJSON({
      athleteMeta: athlete,
      sessionMeta: {
        mode: state.currentMode === 'shield' ? 'ACL-Shield' : 'AdaptiFit',
        sport: state.currentSport,
        exercise: state.exerciseId,
        date: new Date().toISOString(),
        durationSeconds: Math.round((Date.now() - state.sessionStartTime) / 1000)
      },
      summary: {
        totalReps: repTracker.repCount,
        maxRiskScore: state.maxRiskScore,
        avgRiskScore: state.riskCount > 0 ? Math.round(state.riskSum / state.riskCount) : 0,
        maxLessScore: state.maxLessScore,
        jumpHeightCm: state.maxJumpHeightCm
      },
      repHistory: repTracker.repHistory,
      telemetryLogs: state.telemetryLogs
    });
  });

  elements.resetBtn.addEventListener('click', resetSession);

  if (elements.reportFormatSelect) {
    elements.reportFormatSelect.addEventListener('change', (e) => {
      state.reportFormat = e.target.value;
      showBiomechanicalReport();
    });
  }

  elements.closeModalBtn.addEventListener('click', () => {
    elements.reportModal.classList.remove('active');
  });
  elements.printReportBtn.addEventListener('click', () => {
    window.print();
  });

  if (elements.closeAthleteModalBtn) {
    elements.closeAthleteModalBtn.addEventListener('click', () => {
      elements.athleteModal.classList.remove('active');
    });
  }

  if (elements.athleteForm) {
    elements.athleteForm.addEventListener('submit', handleNewAthleteSubmit);
  }

  if (elements.athleteSelectDropdown) {
    elements.athleteSelectDropdown.addEventListener('change', (e) => {
      athleteManager.setActiveAthlete(e.target.value);
      updateAthleteUI();
      renderAthleteHistory();
    });
  }

  if (elements.deleteAthleteBtn) {
    elements.deleteAthleteBtn.addEventListener('click', () => {
      if (confirm('Delete this athlete profile?')) {
        athleteManager.deleteAthlete(athleteManager.activeAthleteId);
        updateAthleteUI();
        renderAthleteHistory();
      }
    });
  }
}

/**
 * Setup Alerts Modal & Handlers
 */
function setupAlertsControls() {
  if (elements.closeAlertsModalBtn) {
    elements.closeAlertsModalBtn.addEventListener('click', () => {
      elements.alertsModal.classList.remove('active');
    });
  }

  if (elements.alertThresholdSlider) {
    elements.alertThresholdSlider.addEventListener('input', (e) => {
      elements.alertThresholdValue.textContent = `${e.target.value}%`;
    });
  }

  if (elements.requestNotifPermBtn) {
    elements.requestNotifPermBtn.addEventListener('click', async () => {
      const granted = await alertManager.requestPermission();
      if (granted) {
        elements.requestNotifPermBtn.textContent = '✅ Permission Granted';
        elements.requestNotifPermBtn.style.borderColor = 'var(--emerald-safe)';
        alertManager.sendDesktopNotification({
          riskScore: 75,
          athleteName: athleteManager.getActiveAthlete() ? athleteManager.getActiveAthlete().name : 'Demo Athlete',
          exercise: 'Squat',
          valgusLeft: 162,
          valgusRight: 165,
          feedback: 'Test Desktop Push Alert: MediaPipe Biomechanical Engine Connected!'
        });
      } else {
        alert('Browser desktop notifications were blocked in your browser settings.');
      }
    });
  }

  if (elements.saveAlertSettingsBtn) {
    elements.saveAlertSettingsBtn.addEventListener('click', () => {
      alertManager.saveSettings({
        riskThreshold: parseInt(elements.alertThresholdSlider.value),
        enableDesktopNotifications: elements.enableDesktopNotifs.checked,
        enableAudioSiren: elements.enableAudioSiren.checked,
        enableWebhook: elements.enableWebhookToggle.checked,
        webhookUrl: elements.webhookUrlInput.value.trim(),
        coachEmail: elements.coachEmailInput.value.trim()
      });
      voiceCoach.speak('Alert settings updated');
      elements.alertsModal.classList.remove('active');
    });
  }

  if (elements.testAlertBtn) {
    elements.testAlertBtn.addEventListener('click', () => {
      triggerVisualDangerAlarm();
      voiceCoach.playChime('danger_siren');
      voiceCoach.speak('Warning! Knee valgus collapse detected!', true);
      
      const testIncident = {
        id: 'test_' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        athleteName: athleteManager.getActiveAthlete() ? athleteManager.getActiveAthlete().name : 'Demo Athlete',
        sport: state.currentSport,
        exercise: elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text,
        riskScore: 82,
        riskLevel: 'Severe Risk',
        lessScore: 9,
        valgusLeft: 160,
        valgusRight: 162,
        feedback: 'Severe Left Knee Inward Collapse. Push knees outward!'
      };

      alertManager.sendDesktopNotification(testIncident);
      if (alertManager.settings.enableWebhook) {
        alertManager.sendWebhookAlert(testIncident);
      }
      alertManager.incidentLogs.unshift(testIncident);
      renderIncidentLogs();
    });
  }

  if (elements.sendEmailAlertBtn) {
    elements.sendEmailAlertBtn.addEventListener('click', () => {
      const athlete = athleteManager.getActiveAthlete();
      const avgRisk = state.riskCount > 0 ? Math.round(state.riskSum / state.riskCount) : 0;
      const mailtoUrl = alertManager.generateEmailLink(athlete, {
        exerciseName: elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text,
        maxRiskScore: state.maxRiskScore,
        avgRiskScore: avgRisk,
        lessScore: state.maxLessScore,
        jumpHeightCm: state.maxJumpHeightCm,
        totalReps: repTracker.repCount,
        timestamp: new Date().toLocaleString()
      });
      window.open(mailtoUrl, '_blank');
    });
  }
}

/**
 * Initializes Alerts UI Form values
 */
function initAlertsUI() {
  if (!elements.alertThresholdSlider) return;
  elements.alertThresholdSlider.value = alertManager.settings.riskThreshold || 60;
  elements.alertThresholdValue.textContent = `${alertManager.settings.riskThreshold || 60}%`;
  elements.enableDesktopNotifs.checked = alertManager.settings.enableDesktopNotifications;
  elements.enableAudioSiren.checked = alertManager.settings.enableAudioSiren;
  elements.enableWebhookToggle.checked = alertManager.settings.enableWebhook;
  elements.webhookUrlInput.value = alertManager.settings.webhookUrl || '';
  elements.coachEmailInput.value = alertManager.settings.coachEmail || '';
}

/**
 * Opens Alerts & Notifications Modal
 */
function openAlertsModal() {
  initAlertsUI();
  renderIncidentLogs();
  elements.alertsModal.classList.add('active');
}

/**
 * Renders Live Incident Logs
 */
function renderIncidentLogs() {
  if (!elements.incidentLogsList) return;
  elements.incidentLogsList.innerHTML = '';

  if (alertManager.incidentLogs.length === 0) {
    elements.incidentLogsList.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; padding: 6px;">No critical injury risk incidents recorded yet in this session.</div>';
    return;
  }

  alertManager.incidentLogs.forEach(inc => {
    const item = document.createElement('div');
    item.className = 'incident-item';
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: 600;">
        <span>🚨 ${inc.riskScore}% Peak Valgus</span>
        <span style="color: var(--rose-danger); font-size: 0.75rem;">${inc.timestamp}</span>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">
        ${inc.athleteName} • ${inc.exercise} • LESS: ${inc.lessScore}/15
      </div>
      <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">
        ${inc.feedback}
      </div>
    `;
    elements.incidentLogsList.appendChild(item);
  });
}

/**
 * Triggers Visual Danger Flasher on Viewport
 */
function triggerVisualDangerAlarm() {
  if (elements.viewportCard) {
    elements.viewportCard.classList.add('danger-alert-active');
    setTimeout(() => {
      elements.viewportCard.classList.remove('danger-alert-active');
    }, 1200);
  }
}

/**
 * Triggers 3-Second Neutral Stance Auto-Calibration
 */
function triggerAutoCalibration() {
  state.isCalibrating = true;
  state.calibrationCount = 0;
  state.calibrationSamples = [];
  voiceCoach.speak('Stand tall in neutral posture. Calibrating in 3, 2, 1...');
  if (elements.calibrateBtn) {
    elements.calibrateBtn.textContent = '⏳ Calibrating...';
  }
}

/**
 * Maps MediaPipe Normalized Keypoints (0..1) directly to Canvas Pixels
 */
function mapLandmarkToCanvas(pt, canvasWidth, canvasHeight, videoElem, isMirrored = false) {
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

/**
 * Evaluates Framing, Distance, and Center Alignment
 */
function evaluateBodyFraming(landmarks, canvasWidth, canvasHeight) {
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
  const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  if (!nose || !lHip || !rHip) return { state: 'NO_PERSON', text: '👤 Position yourself in camera frame', color: '#f59e0b' };

  const midHipY = (lHip.y + rHip.y) / 2;
  const midHipX = (lHip.x + rHip.x) / 2;
  const anklesVisible = (lAnkle && lAnkle.visibility > 0.4) || (rAnkle && rAnkle.visibility > 0.4);

  if (midHipY > 0.85 || !anklesVisible) {
    return { state: 'TOO_CLOSE', text: '⚠️ Step back 2 steps to show knees & feet', color: '#ef4444' };
  }

  const heightRatio = Math.abs((lAnkle ? lAnkle.y : 0.9) - nose.y);
  if (heightRatio < 0.35) {
    return { state: 'TOO_FAR', text: '🔍 Move slightly closer', color: '#f59e0b' };
  }

  if (midHipX < 0.28) {
    return { state: 'MOVE_RIGHT', text: '➡️ Move slightly right', color: '#06b6d4' };
  } else if (midHipX > 0.72) {
    return { state: 'MOVE_LEFT', text: '⬅️ Move slightly left', color: '#06b6d4' };
  }

  return { state: 'PERFECT', text: '🎯 Body Perfectly Aligned & Locked', color: '#10b981' };
}

/**
 * Draws Humanoid Silhouette Target Stencil on Canvas
 */
function drawBodySilhouetteStencil(c, w, h, isAligned) {
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

/**
 * Handles Excel (.xlsx) download
 */
function handleExcelDownload() {
  const athlete = athleteManager.getActiveAthlete();
  const avgRisk = state.riskCount > 0 ? Math.round(state.riskSum / state.riskCount) : 0;
  const duration = Math.round((Date.now() - state.sessionStartTime) / 1000);

  const sessionSummary = {
    athleteName: athlete ? athlete.name : 'Athlete / Patient',
    sport: state.currentSport.toUpperCase(),
    mode: state.currentMode === 'shield' ? 'ACL-Shield' : 'AdaptiFit',
    exerciseName: elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text,
    durationSeconds: duration,
    totalReps: repTracker.repCount,
    avgRiskScore: avgRisk,
    maxRiskScore: state.maxRiskScore,
    lessScore: state.maxLessScore,
    jumpHeightCm: state.maxJumpHeightCm,
    impactGForce: state.maxImpactGForce,
    maxValgusCollapse: Math.max(0, 180 - parseInt(elements.valgusLeftVal.textContent || 180)),
    asymmetryIndex: elements.asymmetryVal.textContent.replace('%', ''),
    avgFlexionDepth: elements.flexionDepthVal.textContent.replace('°', ''),
    repHistory: repTracker.repHistory,
    timestamp: new Date().toLocaleString()
  };

  ReportGenerator.downloadExcel(sessionSummary, state.telemetryLogs, `Biomechanics_${athlete ? athlete.name.replace(/\s+/g, '_') : 'Session'}.xlsx`);
}

/**
 * Setup Scrubber & Slow-Mo Events
 */
function setupScrubberControls() {
  const vid = elements.videoUploadPlayer;

  if (elements.playPauseBtn) {
    elements.playPauseBtn.addEventListener('click', () => {
      if (vid.paused) {
        vid.play();
        elements.playPauseBtn.textContent = '⏸️ Pause';
      } else {
        vid.pause();
        elements.playPauseBtn.textContent = '▶️ Play';
      }
    });
  }

  if (elements.videoTimeline) {
    elements.videoTimeline.addEventListener('input', (e) => {
      if (vid.duration) {
        vid.currentTime = (e.target.value / 100) * vid.duration;
      }
    });
  }

  vid.addEventListener('timeupdate', () => {
    if (vid.duration && elements.videoTimeline) {
      elements.videoTimeline.value = (vid.currentTime / vid.duration) * 100;
      if (elements.timeDisplay) {
        elements.timeDisplay.textContent = `${vid.currentTime.toFixed(1)}s / ${vid.duration.toFixed(1)}s`;
      }
    }
  });

  if (elements.stepBackBtn) {
    elements.stepBackBtn.addEventListener('click', () => {
      vid.pause();
      vid.currentTime = Math.max(0, vid.currentTime - 0.04);
    });
  }

  if (elements.stepFwdBtn) {
    elements.stepFwdBtn.addEventListener('click', () => {
      vid.pause();
      vid.currentTime = Math.min(vid.duration, vid.currentTime + 0.04);
    });
  }

  elements.speedChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.speedChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.playbackRate = parseFloat(chip.dataset.speed || 1.0);
      vid.playbackRate = state.playbackRate;
      voiceCoach.speak(`Playback ${state.playbackRate}x`);
    });
  });

  if (elements.freezePeakBtn) {
    elements.freezePeakBtn.addEventListener('click', () => {
      if (state.peakValgusTimestamp) {
        vid.pause();
        vid.currentTime = state.peakValgusTimestamp;
        voiceCoach.speak('Frozen at peak knee valgus angle');
      } else {
        alert('No peak valgus event recorded yet.');
      }
    });
  }
}

/**
 * Mode Switching
 */
function setMode(mode) {
  state.currentMode = mode;
  if (mode === 'shield') {
    elements.modeShieldBtn.classList.add('active');
    elements.modeShieldBtn.classList.remove('fit-active');
    elements.modeFitBtn.classList.remove('active', 'fit-active');
    elements.abilityGroup.style.display = 'none';
    elements.gaugeLabel.textContent = 'ACL INJURY RISK GAUGE';
  } else {
    elements.modeFitBtn.classList.add('fit-active');
    elements.modeShieldBtn.classList.remove('active', 'fit-active');
    elements.abilityGroup.style.display = 'flex';
    elements.gaugeLabel.textContent = 'MOVEMENT ACCURACY METER';
  }

  updateExerciseDropdown();
  resetSession();
}

/**
 * Updates Exercise options
 */
function updateExerciseDropdown() {
  elements.exerciseSelect.innerHTML = '';

  let exercises = [];
  if (state.currentMode === 'shield') {
    exercises = [
      { id: 'squat', name: 'Deep Squat Alignment' },
      { id: 'drop_jump', name: 'Drop Vertical Jump (DVJ & LESS)' },
      { id: 'single_leg_squat', name: 'Single-Leg Squat Stability' },
      { id: 'lunge', name: 'Dynamic Forward Lunge' }
    ];
  } else {
    if (state.abilityProfile === 'seated') {
      exercises = [
        { id: 'seated_press', name: 'Seated Overhead Press' },
        { id: 'seated_boxing', name: 'Seated Shadow Boxing' },
        { id: 'seated_lateral_raise', name: 'Seated Lateral Arm Raises' }
      ];
    } else if (state.abilityProfile === 'rehab') {
      exercises = [
        { id: 'seated_press', name: 'Upper Limb Range of Motion' },
        { id: 'seated_lateral_raise', name: 'Shoulder Abduction Arc' }
      ];
    } else {
      exercises = [
        { id: 'squat', name: 'Adaptive Chair Sit-to-Stand' },
        { id: 'seated_press', name: 'Overhead Press' },
        { id: 'seated_boxing', name: 'Cardio Shadow Boxing' },
        { id: 'seated_lateral_raise', name: 'Lateral Arm Raises' }
      ];
    }
  }

  exercises.forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.name;
    elements.exerciseSelect.appendChild(opt);
  });

  state.exerciseId = exercises[0].id;
  repTracker.setExercise(state.exerciseId);
}

/**
 * Initializes MediaPipe Pose Detector
 */
function initMediaPipePose() {
  if (window.Pose) {
    poseDetector = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    poseDetector.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    poseDetector.onResults(onPoseResults);
  }
}

/**
 * Switches video source
 */
async function switchVideoSource(source) {
  state.videoSource = source;

  elements.sourceCameraBtn.classList.toggle('active', source === 'camera');
  elements.sourceUploadBtn.classList.toggle('active', source === 'upload');
  elements.sourceDemoBtn.classList.toggle('active', source === 'demo');
  elements.demoBadge.style.display = source === 'demo' ? 'flex' : 'none';
  if (elements.toggleFlawBtn) {
    elements.toggleFlawBtn.style.display = source === 'demo' ? 'inline-block' : 'none';
  }
  if (elements.mirrorToggleBtn) {
    elements.mirrorToggleBtn.style.display = source === 'camera' ? 'inline-block' : 'none';
  }
  if (elements.calibrateBtn) {
    elements.calibrateBtn.style.display = source === 'camera' ? 'inline-block' : 'none';
  }
  if (elements.videoScrubberBar) {
    elements.videoScrubberBar.style.display = source === 'upload' ? 'flex' : 'none';
  }

  if (cameraInstance) {
    cameraInstance.stop();
    cameraInstance = null;
  }
  if (elements.webcam.srcObject) {
    elements.webcam.srcObject.getTracks().forEach(track => track.stop());
    elements.webcam.srcObject = null;
  }

  if (demoAnimationFrameId) {
    cancelAnimationFrame(demoAnimationFrameId);
    demoAnimationFrameId = null;
  }

  elements.webcam.style.display = 'none';
  elements.videoUploadPlayer.style.display = 'none';

  if (source === 'camera') {
    elements.webcam.style.display = 'block';
    startWebcam();
  } else if (source === 'upload') {
    elements.videoUploadPlayer.style.display = 'block';
  } else if (source === 'demo') {
    startDemoSimulation();
  }
}

/**
 * Starts Camera Stream
 */
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    });
    elements.webcam.srcObject = stream;
    await elements.webcam.play();

    if (window.Camera && poseDetector) {
      cameraInstance = new window.Camera(elements.webcam, {
        onFrame: async () => {
          if (state.videoSource === 'camera') {
            await poseDetector.send({ image: elements.webcam });
          }
        },
        width: 1280,
        height: 720
      });
      cameraInstance.start();
    }
  } catch (err) {
    console.warn('Camera access unavailable. Falling back to Demo Mode.', err);
    alert('Camera permission denied or camera device not found. Switching to Simulated Demo Mode.');
    switchVideoSource('demo');
  }
}

/**
 * Handles uploaded video file
 */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  switchVideoSource('upload');
  const url = URL.createObjectURL(file);
  elements.videoUploadPlayer.src = url;
  elements.videoUploadPlayer.play();

  const processUploadedFrame = async () => {
    if (state.videoSource === 'upload' && !elements.videoUploadPlayer.paused && !elements.videoUploadPlayer.ended) {
      if (poseDetector) {
        await poseDetector.send({ image: elements.videoUploadPlayer });
      }
      requestAnimationFrame(processUploadedFrame);
    }
  };

  elements.videoUploadPlayer.onplay = () => {
    processUploadedFrame();
  };
}

/**
 * Runs synthetic pose simulation
 */
function startDemoSimulation() {
  const runDemo = () => {
    if (state.videoSource !== 'demo') return;

    const syntheticLandmarks = syntheticGenerator.generateFrame(state.exerciseId, state.demoWithValgusFlaw);
    
    onPoseResults({
      poseLandmarks: syntheticLandmarks,
      image: null
    });

    demoAnimationFrameId = requestAnimationFrame(runDemo);
  };

  demoAnimationFrameId = requestAnimationFrame(runDemo);
}

/**
 * Primary MediaPipe Pose Results Handler
 */
function onPoseResults(results) {
  updateFPS();

  const container = elements.overlay.parentElement;
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 450;
  
  if (elements.overlay.width !== width || elements.overlay.height !== height) {
    elements.overlay.width = width;
    elements.overlay.height = height;
  }

  ctx.clearRect(0, 0, width, height);

  if (state.videoSource === 'demo') {
    drawCyberBackdrop(ctx, width, height);
  }

  if (!results || !results.poseLandmarks) {
    if (state.showSilhouette) {
      drawBodySilhouetteStencil(ctx, width, height, false);
    }
    return;
  }

  const landmarks = results.poseLandmarks;
  const activeVideo = state.videoSource === 'camera' ? elements.webcam : state.videoSource === 'upload' ? elements.videoUploadPlayer : null;
  const isMirrored = state.videoSource === 'camera' && state.isMirrored;
  const activeAthlete = athleteManager.getActiveAthlete();

  // 1. Evaluate Body Framing & Stencil Fit
  const framing = evaluateBodyFraming(landmarks, width, height);
  const isAligned = framing.state === 'PERFECT';

  if (elements.framingPill) {
    elements.framingPill.textContent = framing.text;
    elements.framingPill.style.borderColor = framing.color;
    elements.framingPill.style.color = framing.color;
  }

  if (state.showSilhouette) {
    drawBodySilhouetteStencil(ctx, width, height, isAligned);
  }

  // 2. Handle Auto-Calibration Samples
  if (state.isCalibrating) {
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    const valgusL = calculateAngle(lHip, lKnee, lAnkle);
    const valgusR = calculateAngle(rHip, rKnee, rAnkle);
    state.calibrationSamples.push({ valgusL, valgusR });
    state.calibrationCount++;

    if (state.calibrationCount >= 45) {
      const avgL = state.calibrationSamples.reduce((a, b) => a + b.valgusL, 0) / state.calibrationSamples.length;
      const avgR = state.calibrationSamples.reduce((a, b) => a + b.valgusR, 0) / state.calibrationSamples.length;
      state.neutralOffsetValgusL = 180 - avgL;
      state.neutralOffsetValgusR = 180 - avgR;
      state.isCalibrating = false;
      state.isCalibrated = true;
      if (elements.calibrateBtn) {
        elements.calibrateBtn.textContent = '✅ Calibrated';
      }
      voiceCoach.playChime('lock_success');
      voiceCoach.speak('Calibration complete! Ready to start screening.');
    }
  }

  // 3. Biomechanical Evaluation with Sports Profile & Calibration Offset
  const riskData = evaluateACLRisk(landmarks, state.exerciseId, state.currentSport);
  if (state.isCalibrated) {
    riskData.valgusLeft = Math.round(riskData.valgusLeft + state.neutralOffsetValgusL);
    riskData.valgusRight = Math.round(riskData.valgusRight + state.neutralOffsetValgusR);
  }

  const repData = repTracker.update(landmarks, riskData);
  const jumpData = jumpTracker.update(landmarks);

  if (riskData.score > state.maxRiskScore) {
    state.maxRiskScore = riskData.score;
    if (state.videoSource === 'upload' && elements.videoUploadPlayer) {
      state.peakValgusTimestamp = elements.videoUploadPlayer.currentTime;
    }
  }

  if (riskData.lessScore > state.maxLessScore) {
    state.maxLessScore = riskData.lessScore;
  }

  if (jumpData && jumpData.jumpCompleted) {
    state.maxJumpHeightCm = jumpData.jumpHeightCm;
    state.maxImpactGForce = jumpData.impactGForce;
    voiceCoach.speak(`Jump height ${jumpData.jumpHeightCm} centimeters!`);
  }

  // 4. Critical Injury Risk Alerts Processing
  const exerciseName = elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text;
  const incident = alertManager.processTelemetry(riskData, activeAthlete, exerciseName);
  if (incident) {
    triggerVisualDangerAlarm();
    if (alertManager.settings.enableAudioSiren) {
      voiceCoach.playChime('danger_siren');
    }
    voiceCoach.speak(incident.feedback, true);
  }

  // 5. Render Skeleton & Visuals with Exact Geometric Mapping
  if (state.showGrid) {
    drawCenterAlignmentGrid(ctx, width, height, landmarks, activeVideo, isMirrored);
  }
  if (state.showSkeleton) {
    drawBiomechanicalSkeleton(ctx, width, height, landmarks, riskData, activeVideo, isMirrored);
  }
  if (state.showAngles) {
    drawAngleAnnotations(ctx, width, height, landmarks, riskData, activeVideo, isMirrored);
  }

  // 6. Update DOM Telemetry & Gauges
  updateDashboardUI(riskData, repData, jumpData);

  // 7. Voice Coaching & Chimes
  handleCoachingFeedback(riskData, repData);

  // 8. Log Telemetry
  logTelemetry(riskData, repData);
}

/**
 * Updates UI Dashboard
 */
function updateDashboardUI(riskData, repData, jumpData) {
  let scoreToDisplay = riskData.score;
  let statusText = riskData.level;
  let statusColor = riskData.color;

  if (state.currentMode === 'fit') {
    scoreToDisplay = Math.max(0, 100 - riskData.score);
    statusText = scoreToDisplay > 75 ? 'Optimal Form' : scoreToDisplay > 50 ? 'Good Form' : 'Adjust Form';
    statusColor = scoreToDisplay > 75 ? '#10b981' : scoreToDisplay > 50 ? '#f59e0b' : '#ef4444';
  }

  elements.gaugeNum.textContent = `${scoreToDisplay}%`;
  elements.gaugeNum.style.color = statusColor;
  elements.gaugeStatusBadge.textContent = statusText;
  elements.gaugeStatusBadge.style.color = statusColor;
  elements.gaugeStatusBadge.style.background = `${statusColor}22`;

  const needleRotation = -90 + (scoreToDisplay / 100) * 180;
  if (elements.gaugeNeedle) {
    elements.gaugeNeedle.style.transform = `rotate(${needleRotation}deg)`;
  }

  elements.valgusLeftVal.textContent = `${riskData.valgusLeft}°`;
  elements.valgusRightVal.textContent = `${riskData.valgusRight}°`;
  elements.flexionDepthVal.textContent = `${riskData.avgFlexion}°`;
  elements.asymmetryVal.textContent = `${riskData.asymmetry}%`;
  elements.trunkLeanVal.textContent = `${riskData.trunkLean}°`;

  elements.repCountVal.textContent = repData.repCount;
  elements.romPercentVal.textContent = `${repData.romPercent}%`;
  elements.repPhaseBadge.textContent = repData.phase;

  if (elements.lessScoreVal) {
    elements.lessScoreVal.textContent = `${riskData.lessScore}/15`;
    elements.lessScoreVal.style.color = riskData.lessScore > 5 ? '#ef4444' : '#10b981';
  }

  if (elements.jumpHeightVal) {
    if (jumpData && jumpData.jumpHeightCm > 0) {
      elements.jumpHeightVal.textContent = `${jumpData.jumpHeightCm}cm`;
    } else {
      elements.jumpHeightVal.textContent = `${state.maxJumpHeightCm || 0}cm`;
    }
  }

  const primaryFeedback = riskData.feedbacks[0] || 'Keep posture steady';
  elements.feedbackText.textContent = primaryFeedback;
  elements.feedbackText.style.borderLeftColor = statusColor;
  elements.coachBeacon.style.background = statusColor;
  elements.coachBeacon.style.boxShadow = `0 0 10px ${statusColor}`;
}

/**
 * Handles spoken coach voice & audio chimes
 */
function handleCoachingFeedback(riskData, repData) {
  if (repData.newRepCompleted) {
    voiceCoach.playChime('rep_success');
    voiceCoach.speak(`Rep ${repData.repCount} complete!`);
    addRepToHistoryList(repData.history[repData.history.length - 1]);
  } else if (riskData.score >= 50 && !alertManager.settings.enableAudioSiren) {
    voiceCoach.speak(riskData.feedbacks[0], true);
  }
}

/**
 * Adds completed repetition to the history feed
 */
function addRepToHistoryList(rep) {
  if (!rep) return;
  const item = document.createElement('div');
  const isHighRisk = rep.peakRisk > 45;
  item.className = `history-item ${isHighRisk ? 'high-risk' : ''}`;
  item.innerHTML = `
    <div><strong>Rep #${rep.repNumber}</strong> (${rep.durationSec}s)</div>
    <div>${rep.minDepthDeg ? `Depth: ${rep.minDepthDeg}°` : ''}</div>
    <div><strong>${rep.grade}</strong></div>
    <div style="color: ${isHighRisk ? '#ef4444' : '#10b981'}">${rep.peakRisk || 0}% Risk</div>
  `;
  elements.historyList.prepend(item);
}

/**
 * Logs telemetry sample
 */
function logTelemetry(riskData, repData) {
  state.riskSum += riskData.score;
  state.riskCount++;

  const now = Date.now();
  if (!state.lastLogTime || now - state.lastLogTime > 500) {
    state.lastLogTime = now;
    
    const sample = {
      timestamp: new Date().toLocaleTimeString(),
      repCount: repData.repCount,
      riskScore: riskData.score,
      riskLevel: riskData.level,
      lessScore: riskData.lessScore,
      valgusLeft: riskData.valgusLeft,
      valgusRight: riskData.valgusRight,
      flexionLeft: riskData.flexionLeft,
      flexionRight: riskData.flexionRight,
      asymmetry: riskData.asymmetry,
      trunkLean: riskData.trunkLean
    };
    state.telemetryLogs.push(sample);

    if (telemetryChart) {
      if (telemetryChart.data.labels.length > 25) {
        telemetryChart.data.labels.shift();
        telemetryChart.data.datasets[0].data.shift();
        telemetryChart.data.datasets[1].data.shift();
      }
      telemetryChart.data.labels.push(sample.timestamp);
      telemetryChart.data.datasets[0].data.push(sample.riskScore);
      telemetryChart.data.datasets[1].data.push(sample.flexionLeft);
      telemetryChart.update('none');
    }
  }
}

/**
 * Initializes Chart.js real-time graph
 */
function initTelemetryChart() {
  const chartCanvas = document.getElementById('telemetryChart');
  if (!chartCanvas || !window.Chart) return;

  telemetryChart = new window.Chart(chartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Injury Risk Score (%)',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Knee Flexion (°)',
          data: [],
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderDash: [4, 4],
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#ef4444', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y1: {
          position: 'right',
          min: 0,
          max: 180,
          ticks: { color: '#06b6d4', font: { size: 10 } },
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Draws Cyber Backdrop
 */
function drawCyberBackdrop(c, w, h) {
  const grad = c.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7);
  grad.addColorStop(0, '#0c1527');
  grad.addColorStop(1, '#050811');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  c.strokeStyle = 'rgba(6, 182, 212, 0.12)';
  c.lineWidth = 1;
  const horizonY = h * 0.75;
  
  for (let x = 0; x <= w; x += 40) {
    c.beginPath();
    c.moveTo(w / 2, horizonY);
    c.lineTo(x, h);
    c.stroke();
  }

  for (let y = horizonY; y <= h; y += 15) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
}

/**
 * Draws Center Alignment Grid
 */
function drawCenterAlignmentGrid(c, w, h, lm, videoElem, isMirrored) {
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

/**
 * Draws Biomechanical Skeleton with Selective Error Point Highlighting
 */
function drawBiomechanicalSkeleton(c, w, h, lm, riskData, videoElem, isMirrored) {
  const connections = [
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
    
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
    [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
    [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
    
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
    [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
    [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
    [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE]
  ];

  c.save();

  // Evaluate which specific joints have posture flaws
  const isLeftKneeError = riskData.collapseLeft > 8 || riskData.valgusLeft < 168;
  const isRightKneeError = riskData.collapseRight > 8 || riskData.valgusRight < 168;
  const isTrunkError = riskData.trunkLean > 12;

  // 1. Draw connecting bone lines
  connections.forEach(([i1, i2]) => {
    const lm1 = lm[i1];
    const lm2 = lm[i2];
    if (!lm1 || !lm2 || (lm1.visibility && lm1.visibility < 0.35) || (lm2.visibility && lm2.visibility < 0.35)) return;

    const p1 = mapLandmarkToCanvas(lm1, w, h, videoElem, isMirrored);
    const p2 = mapLandmarkToCanvas(lm2, w, h, videoElem, isMirrored);

    let boneColor = '#06b6d4';
    if ((i1 === POSE_LANDMARKS.LEFT_KNEE || i2 === POSE_LANDMARKS.LEFT_KNEE) && isLeftKneeError) {
      boneColor = '#ef4444';
    } else if ((i1 === POSE_LANDMARKS.RIGHT_KNEE || i2 === POSE_LANDMARKS.RIGHT_KNEE) && isRightKneeError) {
      boneColor = '#ef4444';
    } else if ((i1 === POSE_LANDMARKS.LEFT_KNEE || i2 === POSE_LANDMARKS.LEFT_KNEE ||
        i1 === POSE_LANDMARKS.RIGHT_KNEE || i2 === POSE_LANDMARKS.RIGHT_KNEE)) {
      boneColor = riskData.color;
    }

    c.strokeStyle = boneColor;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.stroke();
  });

  // 2. Draw Joint Points (Error-Only: Only show red dot on faulty joint!)
  lm.forEach((pt, idx) => {
    if (idx > 32 || (pt.visibility && pt.visibility < 0.35)) return;
    if (idx > 0 && idx < 11 && idx !== 7 && idx !== 8) return;

    const isThisJointInError = 
      (idx === POSE_LANDMARKS.LEFT_KNEE && isLeftKneeError) ||
      (idx === POSE_LANDMARKS.RIGHT_KNEE && isRightKneeError) ||
      ((idx === POSE_LANDMARKS.LEFT_SHOULDER || idx === POSE_LANDMARKS.RIGHT_SHOULDER) && isTrunkError);

    // If Error-Only mode is enabled, SKIP drawing points if this joint is in correct posture!
    if (state.errorHighlightOnly && !isThisJointInError) {
      return;
    }

    const p = mapLandmarkToCanvas(pt, w, h, videoElem, isMirrored);

    if (isThisJointInError) {
      // Flashing Pulsing RED Warning Beacon
      const pulseTime = performance.now() / 150;
      const rippleRadius = 10 + (Math.sin(pulseTime) + 1) * 7;

      // Outer animated ripple ring
      c.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(p.x, p.y, rippleRadius, 0, 2 * Math.PI);
      c.stroke();

      // Glowing red halo
      c.fillStyle = 'rgba(239, 68, 68, 0.45)';
      c.beginPath();
      c.arc(p.x, p.y, 11, 0, 2 * Math.PI);
      c.fill();

      // Bright solid red core
      c.fillStyle = '#ff2a2a';
      c.beginPath();
      c.arc(p.x, p.y, 6.5, 0, 2 * Math.PI);
      c.fill();

      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, 7.5, 0, 2 * Math.PI);
      c.stroke();
    } else {
      // Normal joint dot (when viewing all keypoints)
      c.fillStyle = 'rgba(6, 182, 212, 0.3)';
      c.beginPath();
      c.arc(p.x, p.y, 9, 0, 2 * Math.PI);
      c.fill();

      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      c.fill();

      c.strokeStyle = '#06b6d4';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, 6.5, 0, 2 * Math.PI);
      c.stroke();
    }
  });

  c.restore();
}

/**
 * Draws Floating Angle Badges on Knees (Only appears on faulty joints in Error-Only mode)
 */
function drawAngleAnnotations(c, w, h, lm, riskData, videoElem, isMirrored) {
  const lKnee = lm[POSE_LANDMARKS.LEFT_KNEE];
  const rKnee = lm[POSE_LANDMARKS.RIGHT_KNEE];
  const isLeftKneeError = riskData.collapseLeft > 8 || riskData.valgusLeft < 168;
  const isRightKneeError = riskData.collapseRight > 8 || riskData.valgusRight < 168;

  c.save();

  // Left Knee Badge (Only shown if in error or full mode)
  if (lKnee && (!lKnee.visibility || lKnee.visibility > 0.4)) {
    if (!state.errorHighlightOnly || isLeftKneeError) {
      const p = mapLandmarkToCanvas(lKnee, w, h, videoElem, isMirrored);
      const isBad = isLeftKneeError;
      drawBadge(c, p.x + 15, p.y, `${isBad ? '⚠️ ' : ''}L: ${riskData.valgusLeft}°`, isBad ? '#ef4444' : '#10b981');
    }
  }

  // Right Knee Badge (Only shown if in error or full mode)
  if (rKnee && (!rKnee.visibility || rKnee.visibility > 0.4)) {
    if (!state.errorHighlightOnly || isRightKneeError) {
      const p = mapLandmarkToCanvas(rKnee, w, h, videoElem, isMirrored);
      const isBad = isRightKneeError;
      drawBadge(c, p.x - 90, p.y, `${isBad ? '⚠️ ' : ''}R: ${riskData.valgusRight}°`, isBad ? '#ef4444' : '#10b981');
    }
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

function drawBadge(c, x, y, text, color) {
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

/**
 * Updates Athlete Profile UI
 */
function updateAthleteUI() {
  const athlete = athleteManager.getActiveAthlete();
  if (athlete && elements.athleteBadgeBtn) {
    elements.athleteBadgeBtn.innerHTML = `👤 ${athlete.name} (${athlete.sport.toUpperCase()})`;
  }
}

/**
 * Opens Athlete Profile Modal
 */
function openAthleteModal() {
  if (!elements.athleteModal) return;

  if (elements.athleteSelectDropdown) {
    elements.athleteSelectDropdown.innerHTML = '';
    athleteManager.athletes.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name} • ${a.sport}`;
      if (a.id === athleteManager.activeAthleteId) opt.selected = true;
      elements.athleteSelectDropdown.appendChild(opt);
    });
  }

  renderAthleteHistory();
  elements.athleteModal.classList.add('active');
}

/**
 * Renders Athlete Multi-Session History
 */
function renderAthleteHistory() {
  if (!elements.athleteSessionHistoryList) return;
  const athlete = athleteManager.getActiveAthlete();
  elements.athleteSessionHistoryList.innerHTML = '';

  if (!athlete || !athlete.sessions || athlete.sessions.length === 0) {
    elements.athleteSessionHistoryList.innerHTML = '<div style="color: var(--text-dim); font-size: 0.82rem; padding: 8px;">No previous sessions recorded.</div>';
    return;
  }

  athlete.sessions.forEach(s => {
    const isHigh = s.maxRiskScore > 50;
    const card = document.createElement('div');
    card.className = 'athlete-session-card';
    card.style.borderLeft = `3px solid ${isHigh ? '#ef4444' : '#10b981'}`;
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: 600;">
        <span>${s.exercise}</span>
        <span style="color: ${isHigh ? '#ef4444' : '#10b981'};">${s.maxRiskScore}% Peak Risk</span>
      </div>
      <div style="color: var(--text-muted); font-size: 0.75rem;">
        ${s.date} ${s.time} • ${s.totalReps} Reps • LESS: ${s.lessScore || '—'}/15 • Jump: ${s.jumpHeightCm || '—'}cm
      </div>
    `;
    elements.athleteSessionHistoryList.appendChild(card);
  });
}

/**
 * Handles creation of new athlete
 */
function handleNewAthleteSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newAthleteName').value.trim();
  const sport = document.getElementById('newAthleteSport').value;
  const position = document.getElementById('newAthletePosition').value.trim();
  const dominantLeg = document.getElementById('newAthleteLeg').value;
  const injuryHistory = document.getElementById('newAthleteInjury').value.trim();

  if (!name) return;

  athleteManager.createAthlete({ name, sport, position, dominantLeg, injuryHistory });
  updateAthleteUI();
  openAthleteModal();
  e.target.reset();
  voiceCoach.speak(`Profile created for ${name}`);
}

/**
 * FPS Counter calculation
 */
function updateFPS() {
  state.frameCount++;
  const now = performance.now();
  if (now - state.lastFrameTime >= 1000) {
    state.fps = state.frameCount;
    state.frameCount = 0;
    state.lastFrameTime = now;
    if (elements.fpsCounter) {
      elements.fpsCounter.textContent = `${state.fps} FPS`;
    }
  }
}

/**
 * Shows Clinical Biomechanical Report Modal
 */
function showBiomechanicalReport() {
  const athlete = athleteManager.getActiveAthlete();
  const avgRisk = state.riskCount > 0 ? Math.round(state.riskSum / state.riskCount) : 0;
  const duration = Math.round((Date.now() - state.sessionStartTime) / 1000);

  const reportData = {
    athleteName: athlete ? athlete.name : 'Athlete / Patient',
    sport: state.currentSport.toUpperCase(),
    mode: state.currentMode === 'shield' ? 'ACL-Shield (Injury Screener)' : 'AdaptiFit (Inclusive Coach)',
    exerciseName: elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text,
    durationSeconds: duration,
    totalReps: repTracker.repCount,
    avgRiskScore: avgRisk,
    maxRiskScore: state.maxRiskScore,
    riskLevel: state.maxRiskScore > 65 ? 'Severe Risk' : state.maxRiskScore > 35 ? 'Moderate Risk' : 'Low Risk',
    lessScore: state.maxLessScore,
    jumpHeightCm: state.maxJumpHeightCm,
    impactGForce: state.maxImpactGForce,
    avgValgusLeft: elements.valgusLeftVal.textContent.replace('°', ''),
    avgValgusRight: elements.valgusRightVal.textContent.replace('°', ''),
    maxValgusCollapse: Math.max(0, 180 - parseInt(elements.valgusLeftVal.textContent || 180)),
    avgFlexionDepth: elements.flexionDepthVal.textContent.replace('°', ''),
    asymmetryIndex: elements.asymmetryVal.textContent.replace('%', ''),
    repHistory: repTracker.repHistory,
    timestamp: new Date().toLocaleString()
  };

  athleteManager.saveSessionToActiveAthlete(reportData);

  const reportHTML = ReportGenerator.generateHTMLReport(reportData, state.reportFormat);
  elements.reportContent.innerHTML = reportHTML;
  elements.reportModal.classList.add('active');
}

/**
 * Resets current session metrics
 */
function resetSession() {
  state.sessionStartTime = Date.now();
  state.telemetryLogs = [];
  state.maxRiskScore = 0;
  state.riskSum = 0;
  state.riskCount = 0;
  state.maxLessScore = 0;
  state.maxJumpHeightCm = 0;
  state.maxImpactGForce = 0;
  state.isCalibrated = false;
  state.neutralOffsetValgusL = 0;
  state.neutralOffsetValgusR = 0;
  repTracker.reset();

  elements.historyList.innerHTML = '';
  if (telemetryChart) {
    telemetryChart.data.labels = [];
    telemetryChart.data.datasets[0].data = [];
    telemetryChart.data.datasets[1].data = [];
    telemetryChart.update();
  }

  if (elements.calibrateBtn) {
    elements.calibrateBtn.textContent = '⏱️ Calibrate Body';
  }

  voiceCoach.speak('Session reset');
}

// Launch on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
