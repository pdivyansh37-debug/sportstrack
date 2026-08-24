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
  SyntheticPoseGenerator,
  LandmarkSmoother
} from './kinematics.js?v=3.0';

import { AthleteProfileManager } from './athleteProfile.js?v=3.0';
import { VoiceCoach } from './voiceCoach.js?v=3.0';
import { ReportGenerator } from './reportGenerator.js?v=3.0';
import { AlertManager } from './alertManager.js?v=3.0';

// Landmark Temporal Smoother for High-Accuracy Pose Tracking
const landmarkSmoother = new LandmarkSmoother(0.40);

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
  athleteHeaderName: document.getElementById('athleteHeaderName'),
  athleteHeaderSport: document.getElementById('athleteHeaderSport'),
  reportBtn: document.getElementById('reportBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  
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
  
  // Athlete Profile Modal Elements
  athleteModal: document.getElementById('athleteModal'),
  closeAthleteModalBtn: document.getElementById('closeAthleteModalBtn'),
  athleteForm: document.getElementById('athleteForm'),
  athleteSelectDropdown: document.getElementById('athleteSelectDropdown'),
  addNewAthleteBtn: document.getElementById('addNewAthleteBtn'),
  athleteSessionHistoryList: document.getElementById('athleteSessionHistoryList'),
  deleteAthleteBtn: document.getElementById('deleteAthleteBtn'),
  newAthleteName: document.getElementById('newAthleteName'),
  newAthleteSport: document.getElementById('newAthleteSport'),
  newAthletePosition: document.getElementById('newAthletePosition'),
  newAthleteLeg: document.getElementById('newAthleteLeg'),
  newAthleteInjury: document.getElementById('newAthleteInjury'),

  // Unified System Settings Modal Elements
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  closeSettingsModalFooterBtn: document.getElementById('closeSettingsModalFooterBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  voiceCoachToggle: document.getElementById('voiceCoachToggle'),
  voiceRateSlider: document.getElementById('voiceRateSlider'),
  voiceRateValue: document.getElementById('voiceRateValue'),
  enableChimesToggle: document.getElementById('enableChimesToggle'),
  enableVoiceAlertsToggle: document.getElementById('enableVoiceAlertsToggle'),
  testVoiceBtn: document.getElementById('testVoiceBtn'),
  alertThresholdSlider: document.getElementById('alertThresholdSlider'),
  alertThresholdValue: document.getElementById('alertThresholdValue'),
  enableDesktopNotifs: document.getElementById('enableDesktopNotifs'),
  requestNotifPermBtn: document.getElementById('requestNotifPermBtn'),
  enableAudioSiren: document.getElementById('enableAudioSiren'),
  enableWebhookToggle: document.getElementById('enableWebhookToggle'),
  webhookUrlInput: document.getElementById('webhookUrlInput'),
  coachEmailInput: document.getElementById('coachEmailInput'),
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
 * Initializes MediaPipe Pose Detector
 */
function initMediaPipePose() {
  try {
    if (window.Pose) {
      poseDetector = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });
      poseDetector.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      poseDetector.onResults(onPoseResults);
    } else {
      console.warn('MediaPipe Pose CDN not yet loaded on window.');
    }
  } catch (err) {
    console.warn('MediaPipe initialization note:', err);
  }
}

/**
 * Initialize Application
 */
async function initApp() {
  try { setupEventListeners(); } catch (e) { console.error('setupEventListeners:', e); }
  try { updateAthleteUI(); } catch (e) { console.error('updateAthleteUI:', e); }
  try { initTelemetryChart(); } catch (e) { console.error('initTelemetryChart:', e); }
  try { initMediaPipePose(); } catch (e) { console.error('initMediaPipePose:', e); }
  try { initSettingsUI(); } catch (e) { console.error('initSettingsUI:', e); }
  
  // Launch Demo Simulation immediately
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

  if (elements.addNewAthleteBtn) {
    elements.addNewAthleteBtn.addEventListener('click', prepareNewAthleteForm);
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
  setupSettingsControls();

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
      populateAthleteForm(athleteManager.getActiveAthlete());
      renderAthleteHistory();
    });
  }

  if (elements.deleteAthleteBtn) {
    elements.deleteAthleteBtn.addEventListener('click', () => {
      if (confirm('Delete this athlete profile?')) {
        athleteManager.deleteAthlete(athleteManager.activeAthleteId);
        updateAthleteUI();
        openAthleteModal();
      }
    });
  }
}

/**
 * Setup Settings Modal & Handlers (Voice & Alerts)
 */
function setupSettingsControls() {
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', openSettingsModal);
  }
  if (elements.closeSettingsModalBtn) {
    elements.closeSettingsModalBtn.addEventListener('click', () => {
      elements.settingsModal.classList.remove('active');
    });
  }
  if (elements.closeSettingsModalFooterBtn) {
    elements.closeSettingsModalFooterBtn.addEventListener('click', () => {
      elements.settingsModal.classList.remove('active');
    });
  }

  if (elements.voiceRateSlider) {
    elements.voiceRateSlider.addEventListener('input', (e) => {
      if (elements.voiceRateValue) {
        elements.voiceRateValue.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
      }
    });
  }

  if (elements.testVoiceBtn) {
    elements.testVoiceBtn.addEventListener('click', () => {
      const rate = elements.voiceRateSlider ? parseFloat(elements.voiceRateSlider.value) : 1.05;
      const chimes = elements.enableChimesToggle ? elements.enableChimesToggle.checked : true;
      voiceCoach.setSettings({ enabled: true, rate, enableChimes: chimes });
      voiceCoach.playChime('start');
      voiceCoach.speak('Voice Coach online. Knee alignment is optimal. Keep chest upright and track knees over toes.', true);
    });
  }

  if (elements.alertThresholdSlider) {
    elements.alertThresholdSlider.addEventListener('input', (e) => {
      if (elements.alertThresholdValue) {
        elements.alertThresholdValue.textContent = `${e.target.value}%`;
      }
    });
  }

  if (elements.requestNotifPermBtn) {
    elements.requestNotifPermBtn.addEventListener('click', async () => {
      const granted = await alertManager.requestPermission();
      if (granted) {
        elements.requestNotifPermBtn.textContent = '✅ Push Allowed';
        elements.requestNotifPermBtn.style.borderColor = 'var(--emerald-safe)';
        alertManager.sendDesktopNotification({
          riskScore: 75,
          athleteName: athleteManager.getActiveAthlete() ? athleteManager.getActiveAthlete().name : 'Demo Athlete',
          exercise: 'Deep Squat Alignment',
          valgusLeft: 162,
          valgusRight: 165,
          feedback: 'Test Push Alert: MediaPipe Biomechanical Engine Connected!'
        });
      } else {
        alert('Browser notifications were blocked. Please enable them in your browser settings.');
      }
    });
  }

  if (elements.saveSettingsBtn) {
    elements.saveSettingsBtn.addEventListener('click', saveAllSettings);
  }

  if (elements.testAlertBtn) {
    elements.testAlertBtn.addEventListener('click', () => {
      triggerVisualDangerAlarm();
      voiceCoach.playChime('danger_siren');
      if (elements.enableVoiceAlertsToggle && elements.enableVoiceAlertsToggle.checked) {
        voiceCoach.speak('Warning! Knee valgus collapse detected!', true);
      }
      
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

      if (elements.enableDesktopNotifs && elements.enableDesktopNotifs.checked) {
        alertManager.sendDesktopNotification(testIncident);
      }
      if (elements.enableWebhookToggle && elements.enableWebhookToggle.checked) {
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
 * Initializes Settings UI Form values
 */
function initSettingsUI() {
  if (elements.voiceCoachToggle) elements.voiceCoachToggle.checked = voiceCoach.enabled;
  if (elements.voiceRateSlider) {
    elements.voiceRateSlider.value = voiceCoach.rate || 1.05;
    if (elements.voiceRateValue) elements.voiceRateValue.textContent = `${voiceCoach.rate || 1.05}x`;
  }
  if (elements.enableChimesToggle) elements.enableChimesToggle.checked = voiceCoach.enableChimes !== false;
  if (elements.enableVoiceAlertsToggle) elements.enableVoiceAlertsToggle.checked = alertManager.settings.enableVoiceAlert !== false;

  if (elements.alertThresholdSlider) {
    elements.alertThresholdSlider.value = alertManager.settings.riskThreshold || 60;
    if (elements.alertThresholdValue) elements.alertThresholdValue.textContent = `${alertManager.settings.riskThreshold || 60}%`;
  }
  if (elements.enableDesktopNotifs) elements.enableDesktopNotifs.checked = alertManager.settings.enableDesktopNotifications;
  if (elements.enableAudioSiren) elements.enableAudioSiren.checked = alertManager.settings.enableAudioSiren;
  if (elements.enableWebhookToggle) elements.enableWebhookToggle.checked = alertManager.settings.enableWebhook;
  if (elements.webhookUrlInput) elements.webhookUrlInput.value = alertManager.settings.webhookUrl || '';
  if (elements.coachEmailInput) elements.coachEmailInput.value = alertManager.settings.coachEmail || '';
}

/**
 * Opens Settings Modal
 */
function openSettingsModal() {
  initSettingsUI();
  renderIncidentLogs();
  elements.settingsModal.classList.add('active');
}

/**
 * Saves All Voice & Alert Settings
 */
function saveAllSettings() {
  const isVoiceActive = elements.voiceCoachToggle ? elements.voiceCoachToggle.checked : true;
  const voiceRate = elements.voiceRateSlider ? parseFloat(elements.voiceRateSlider.value) : 1.05;
  const isChimesActive = elements.enableChimesToggle ? elements.enableChimesToggle.checked : true;
  const isVoiceAlertActive = elements.enableVoiceAlertsToggle ? elements.enableVoiceAlertsToggle.checked : true;

  voiceCoach.setSettings({
    enabled: isVoiceActive,
    rate: voiceRate,
    enableChimes: isChimesActive
  });

  alertManager.saveSettings({
    riskThreshold: parseInt(elements.alertThresholdSlider.value),
    enableDesktopNotifications: elements.enableDesktopNotifs.checked,
    enableAudioSiren: elements.enableAudioSiren.checked,
    enableVoiceAlert: isVoiceAlertActive,
    enableWebhook: elements.enableWebhookToggle.checked,
    webhookUrl: elements.webhookUrlInput.value.trim(),
    coachEmail: elements.coachEmailInput.value.trim()
  });

  if (isVoiceActive) {
    voiceCoach.speak('Settings updated');
  }
  elements.settingsModal.classList.remove('active');
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

  if (!nose || !lHip || !rHip) return { state: 'NO_PERSON', text: '👤 Center in Frame', color: '#f59e0b' };

  const midHipY = (lHip.y + rHip.y) / 2;
  const midHipX = (lHip.x + rHip.x) / 2;
  const anklesVisible = (lAnkle && lAnkle.visibility > 0.4) || (rAnkle && rAnkle.visibility > 0.4);

  if (midHipY > 0.85 || !anklesVisible) {
    return { state: 'TOO_CLOSE', text: '⚠️ Step Back (Show Knees)', color: '#ef4444' };
  }

  const heightRatio = Math.abs((lAnkle ? lAnkle.y : 0.9) - nose.y);
  if (heightRatio < 0.35) {
    return { state: 'TOO_FAR', text: '🔍 Move Closer', color: '#f59e0b' };
  }

  if (midHipX < 0.28) {
    return { state: 'MOVE_RIGHT', text: '➡️ Move Right', color: '#06b6d4' };
  } else if (midHipX > 0.72) {
    return { state: 'MOVE_LEFT', text: '⬅️ Move Left', color: '#06b6d4' };
  }

  return { state: 'PERFECT', text: '🎯 Body Aligned & Locked', color: '#10b981' };
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
    landmarkSmoother.reset();
    elements.webcam.style.display = 'block';
    startWebcam();
  } else if (source === 'upload') {
    landmarkSmoother.reset();
    elements.videoUploadPlayer.style.display = 'block';
  } else if (source === 'demo') {
    landmarkSmoother.reset();
    startDemoSimulation();
  }
}

/**
 * Starts Camera Stream & Continuous MediaPipe Pose Processing Loop
 */
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
    });
    elements.webcam.srcObject = stream;
    await elements.webcam.play();

    if (!poseDetector) {
      initMediaPipePose();
    }

    let isProcessingCameraFrame = false;
    const processCameraFrame = async () => {
      if (state.videoSource === 'camera' && elements.webcam.readyState >= 2 && !elements.webcam.paused) {
        if (!poseDetector) {
          initMediaPipePose();
        }
        if (poseDetector && !isProcessingCameraFrame) {
          isProcessingCameraFrame = true;
          try {
            await poseDetector.send({ image: elements.webcam });
          } catch (err) {
            console.error('Camera Pose Detection Exception:', err);
          } finally {
            isProcessingCameraFrame = false;
          }
        }
      }
      if (state.videoSource === 'camera') {
        requestAnimationFrame(processCameraFrame);
      }
    };

    requestAnimationFrame(processCameraFrame);
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

  if (!poseDetector) {
    initMediaPipePose();
  }

  let isProcessingUploadFrame = false;
  const processUploadedFrame = async () => {
    if (state.videoSource === 'upload' && !elements.videoUploadPlayer.paused && !elements.videoUploadPlayer.ended) {
      if (!poseDetector) {
        initMediaPipePose();
      }
      if (poseDetector && !isProcessingUploadFrame) {
        isProcessingUploadFrame = true;
        try {
          await poseDetector.send({ image: elements.videoUploadPlayer });
        } catch (err) {
          console.error('Video Upload Pose Detection Exception:', err);
        } finally {
          isProcessingUploadFrame = false;
        }
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
  if (demoAnimationFrameId) {
    cancelAnimationFrame(demoAnimationFrameId);
    demoAnimationFrameId = null;
  }

  const runDemo = () => {
    if (state.videoSource !== 'demo') return;

    try {
      const syntheticLandmarks = syntheticGenerator.generateFrame(state.exerciseId, state.demoWithValgusFlaw);
      
      onPoseResults({
        poseLandmarks: syntheticLandmarks,
        image: null
      });
    } catch (err) {
      console.error('Error during synthetic demo simulation:', err);
    }

    demoAnimationFrameId = requestAnimationFrame(runDemo);
  };

  demoAnimationFrameId = requestAnimationFrame(runDemo);
}

/**
 * Primary MediaPipe Pose Results Handler
 */
function onPoseResults(results) {
  try {
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

    const rawLandmarks = results.poseLandmarks;
    const landmarks = state.videoSource === 'demo' ? rawLandmarks : landmarkSmoother.smooth(rawLandmarks);
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

      if (lHip && rHip && lKnee && rKnee && lAnkle && rAnkle) {
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
    let exerciseName = 'Squat Protocol';
    if (elements.exerciseSelect && elements.exerciseSelect.selectedIndex >= 0 && elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex]) {
      exerciseName = elements.exerciseSelect.options[elements.exerciseSelect.selectedIndex].text;
    }
    const incident = alertManager.processTelemetry(riskData, activeAthlete, exerciseName);
    if (incident) {
      triggerVisualDangerAlarm();
      if (alertManager.settings && alertManager.settings.enableAudioSiren) {
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
  } catch (renderErr) {
    console.error('Render Frame Error in onPoseResults:', renderErr);
  }
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
 * Draws Cyber Biomechanical Laboratory Backdrop
 */
function drawCyberBackdrop(c, w, h) {
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
 * Draws Biomechanical Skeleton with Full 33-Keypoint Overlay
 */
function drawBiomechanicalSkeleton(c, w, h, lm, riskData, videoElem, isMirrored) {
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

/**
 * Draws Floating Angle Badges on Knees
 */
function drawAngleAnnotations(c, w, h, lm, riskData, videoElem, isMirrored) {
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
  if (athlete) {
    if (elements.athleteHeaderName) {
      elements.athleteHeaderName.textContent = athlete.name;
    }
    if (elements.athleteHeaderSport) {
      elements.athleteHeaderSport.textContent = athlete.sport.toUpperCase();
    }
    if (elements.athleteBadgeBtn) {
      elements.athleteBadgeBtn.title = `Active Athlete: ${athlete.name} (${athlete.sport.toUpperCase()}) • Click to Manage Profiles`;
    }
  }
}

/**
 * Populates Athlete Edit Form
 */
function populateAthleteForm(athlete) {
  if (!athlete) return;
  if (elements.newAthleteName) elements.newAthleteName.value = athlete.name || '';
  if (elements.newAthleteSport) elements.newAthleteSport.value = athlete.sport || 'basketball';
  if (elements.newAthletePosition) elements.newAthletePosition.value = athlete.position || '';
  if (elements.newAthleteLeg) elements.newAthleteLeg.value = athlete.dominantLeg || 'Right';
  if (elements.newAthleteInjury) elements.newAthleteInjury.value = athlete.injuryHistory || '';
  if (elements.athleteForm) {
    elements.athleteForm.dataset.mode = 'edit';
    elements.athleteForm.dataset.athleteId = athlete.id;
  }
}

/**
 * Prepares Blank Form for Creating New Athlete
 */
function prepareNewAthleteForm() {
  if (elements.athleteForm) {
    elements.athleteForm.reset();
    elements.athleteForm.dataset.mode = 'create';
    delete elements.athleteForm.dataset.athleteId;
  }
  if (elements.newAthleteName) {
    elements.newAthleteName.focus();
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
      opt.textContent = `${a.name} (${a.sport.toUpperCase()})`;
      if (a.id === athleteManager.activeAthleteId) opt.selected = true;
      elements.athleteSelectDropdown.appendChild(opt);
    });
  }

  const activeAthlete = athleteManager.getActiveAthlete();
  populateAthleteForm(activeAthlete);
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
 * Handles creation or edit of athlete profile
 */
function handleNewAthleteSubmit(e) {
  e.preventDefault();
  const name = elements.newAthleteName.value.trim();
  const sport = elements.newAthleteSport.value;
  const position = elements.newAthletePosition.value.trim();
  const dominantLeg = elements.newAthleteLeg.value;
  const injuryHistory = elements.newAthleteInjury.value.trim();

  if (!name) return;

  const isEditing = elements.athleteForm && elements.athleteForm.dataset.mode === 'edit' && elements.athleteForm.dataset.athleteId;
  if (isEditing) {
    athleteManager.updateAthlete(elements.athleteForm.dataset.athleteId, {
      name, sport, position, dominantLeg, injuryHistory
    });
    updateAthleteUI();
    openAthleteModal();
    voiceCoach.speak(`Profile updated for ${name}`);
  } else {
    athleteManager.createAthlete({ name, sport, position, dominantLeg, injuryHistory });
    updateAthleteUI();
    openAthleteModal();
    voiceCoach.speak(`Profile created for ${name}`);
  }
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
  landmarkSmoother.reset();
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
