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
} from './kinematics.js';

import { drawCyberBackdrop, drawBodySilhouetteStencil, drawCenterAlignmentGrid, drawBiomechanicalSkeleton, drawAngleAnnotations } from './renderer.js';
import { AthleteProfileManager } from './athleteProfile.js';
import { VoiceCoach } from './voiceCoach.js';
import { ReportGenerator } from './reportGenerator.js';
import { AlertManager } from './alertManager.js';
import { AuthManager } from './auth.js';

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
const authManager = new AuthManager();
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
  
  // Authentication & User Profile Elements
  loginPortal: document.getElementById('loginPortal'),
  athleteBadgeBtn: document.getElementById('athleteBadgeBtn'),
  userHeaderAvatar: document.getElementById('userHeaderAvatar'),
  athleteHeaderName: document.getElementById('athleteHeaderName'),
  athleteHeaderSport: document.getElementById('athleteHeaderSport'),
  signOutBtn: document.getElementById('signOutBtn'),
  
  // Login Portal Form Elements
  authCardTitle: document.getElementById('authCardTitle'),
  authCardSubtitle: document.getElementById('authCardSubtitle'),
  authAlertBox: document.getElementById('authAlertBox'),
  customGoogleSignInBtn: document.getElementById('customGoogleSignInBtn'),
  googleSignInBtnMount: document.getElementById('googleSignInBtnMount'),
  openGoogleConfigFromLoginBtn: document.getElementById('openGoogleConfigFromLoginBtn'),
  tabSignInBtn: document.getElementById('tabSignInBtn'),
  tabSignUpBtn: document.getElementById('tabSignUpBtn'),
  signInForm: document.getElementById('signInForm'),
  signUpForm: document.getElementById('signUpForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  togglePasswordBtn: document.getElementById('togglePasswordBtn'),
  rememberMeCheck: document.getElementById('rememberMeCheck'),
  forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
  regName: document.getElementById('regName'),
  regEmail: document.getElementById('regEmail'),
  regRole: document.getElementById('regRole'),
  regSport: document.getElementById('regSport'),
  regPassword: document.getElementById('regPassword'),
  guestLoginBtn: document.getElementById('guestLoginBtn'),
  
  // Google Cloud Setup Modal
  googleConfigModal: document.getElementById('googleConfigModal'),
  closeGoogleConfigModalBtn: document.getElementById('closeGoogleConfigModalBtn'),
  googleConfigForm: document.getElementById('googleConfigForm'),
  googleClientIdInput: document.getElementById('googleClientIdInput'),
  googleConfigStatus: document.getElementById('googleConfigStatus'),
  resetGoogleClientIdBtn: document.getElementById('resetGoogleClientIdBtn'),
  
  // Forgot Password Modal
  forgotPassModal: document.getElementById('forgotPassModal'),
  closeForgotPassModalBtn: document.getElementById('closeForgotPassModalBtn'),
  forgotPassForm: document.getElementById('forgotPassForm'),
  forgotEmailInput: document.getElementById('forgotEmailInput'),
  forgotPassFeedback: document.getElementById('forgotPassFeedback'),

  reportBtn: document.getElementById('reportBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  
  viewportCard: document.querySelector('.viewport-card'),
  webcam: document.getElementById('webcam'),
  videoUploadPlayer: document.getElementById('videoUploadPlayer'),
  overlay: document.getElementById('overlay'),
  backgroundCanvas: document.getElementById('backgroundCanvas'),
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
const bgCtx = elements.backgroundCanvas.getContext('2d');
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
  try { initAuthUI(); } catch (e) { console.error('initAuthUI:', e); }
  try { initTelemetryChart(); } catch (e) { console.error('initTelemetryChart:', e); }
  try { initMediaPipePose(); } catch (e) { console.error('initMediaPipePose:', e); }
  try { initSettingsUI(); } catch (e) { console.error('initSettingsUI:', e); }
  
  // Verify login status
  if (authManager.isLoggedIn()) {
    const user = authManager.getCurrentUser();
    if (elements.loginPortal) {
      elements.loginPortal.classList.remove('active');
      elements.loginPortal.style.display = 'none';
    }
    updateUserHeaderUI();
    athleteManager.ensureAthleteForUser(user);
    updateAthleteUI();
    switchVideoSource('demo');
  } else {
    if (elements.loginPortal) {
      elements.loginPortal.style.display = 'flex';
      elements.loginPortal.classList.add('active');
    }
    updateAthleteUI();
  }
}

/**
 * Setup Authentication UI and Listeners
 */
function initAuthUI() {
  // Try initializing Google Identity Services button
  setTimeout(() => {
    authManager.initGoogleIdentity('googleSignInBtnMount');
  }, 300);

  // Subscribe to auth state changes
  authManager.onAuthChange((event, user) => {
    if (event === 'login' || event === 'update') {
      updateUserHeaderUI();
    }
  });

  // Athlete Profile button directly opens the profile modal
  if (elements.athleteBadgeBtn) {
    elements.athleteBadgeBtn.addEventListener('click', openAthleteModal);
  }

  // Header Sign Out button
  if (elements.signOutBtn) {
    elements.signOutBtn.addEventListener('click', handleSignOut);
  }

  // Tab switcher in login portal
  if (elements.tabSignInBtn && elements.tabSignUpBtn) {
    elements.tabSignInBtn.addEventListener('click', () => {
      elements.tabSignInBtn.classList.add('active');
      elements.tabSignUpBtn.classList.remove('active');
      if (elements.signInForm) elements.signInForm.style.display = 'flex';
      if (elements.signUpForm) elements.signUpForm.style.display = 'none';
      if (elements.authCardTitle) elements.authCardTitle.textContent = 'Sign In to Movement Lab';
      if (elements.authCardSubtitle) elements.authCardSubtitle.textContent = 'Choose your authentication method to access real-time biomechanics';
      clearAuthAlert();
    });

    elements.tabSignUpBtn.addEventListener('click', () => {
      elements.tabSignUpBtn.classList.add('active');
      elements.tabSignInBtn.classList.remove('active');
      if (elements.signUpForm) elements.signUpForm.style.display = 'flex';
      if (elements.signInForm) elements.signInForm.style.display = 'none';
      if (elements.authCardTitle) elements.authCardTitle.textContent = 'Create Movement Lab Account';
      if (elements.authCardSubtitle) elements.authCardSubtitle.textContent = 'Join the platform for AI knee valgus screening and inclusive coaching';
      clearAuthAlert();
    });
  }

  // Google Sign-In button click
  if (elements.customGoogleSignInBtn) {
    elements.customGoogleSignInBtn.addEventListener('click', async () => {
      try {
        showAuthAlert('Connecting to Google Identity Services...', 'info');
        const res = await authManager.signInWithGooglePrompt();
        if (res && res.user) {
          if (res.isSimulated) {
            showAuthAlert('Signed in with Google Simulation Account! (Configure your Google Cloud Client ID anytime via Settings)', 'success');
          } else {
            showAuthAlert('Google authentication verified successfully!', 'success');
          }
          setTimeout(() => handleAuthLogin(res.user), 450);
        }
      } catch (err) {
        showAuthAlert(err.message || 'Google sign-in encountered an error.', 'error');
      }
    });
  }

  // Open Google Config Modal from Login Portal link
  if (elements.openGoogleConfigFromLoginBtn) {
    elements.openGoogleConfigFromLoginBtn.addEventListener('click', openGoogleConfigModal);
  }

  // Sign In form submit
  if (elements.signInForm) {
    elements.signInForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = elements.loginEmail ? elements.loginEmail.value : '';
      const password = elements.loginPassword ? elements.loginPassword.value : '';
      const remember = elements.rememberMeCheck ? elements.rememberMeCheck.checked : true;
      try {
        const user = authManager.signInWithCredentials(email, password, remember);
        showAuthAlert('Welcome back! Entering Movement Lab...', 'success');
        setTimeout(() => handleAuthLogin(user), 350);
      } catch (err) {
        showAuthAlert(err.message, 'error');
      }
    });
  }

  // Sign Up form submit
  if (elements.signUpForm) {
    elements.signUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = elements.regName ? elements.regName.value : '';
      const email = elements.regEmail ? elements.regEmail.value : '';
      const password = elements.regPassword ? elements.regPassword.value : '';
      const role = elements.regRole ? elements.regRole.value : 'Athlete / Player';
      const sport = elements.regSport ? elements.regSport.value : 'basketball';
      try {
        const user = authManager.signUp(name, email, password, role, sport);
        showAuthAlert('Account created successfully! Entering Movement Lab...', 'success');
        setTimeout(() => handleAuthLogin(user), 400);
      } catch (err) {
        showAuthAlert(err.message, 'error');
      }
    });
  }

  // Fast Guest / Demo Login button
  if (elements.guestLoginBtn) {
    elements.guestLoginBtn.addEventListener('click', () => {
      const user = authManager.loginAsGuest();
      showAuthAlert('Continuing as Demo Coach & Biomechanist...', 'info');
      setTimeout(() => handleAuthLogin(user), 300);
    });
  }

  // Password visibility toggle
  if (elements.togglePasswordBtn && elements.loginPassword) {
    elements.togglePasswordBtn.addEventListener('click', () => {
      const isPass = elements.loginPassword.type === 'password';
      elements.loginPassword.type = isPass ? 'text' : 'password';
      elements.togglePasswordBtn.textContent = isPass ? '🙈' : '👁️';
    });
  }

  // Google Config Modal handlers
  if (elements.closeGoogleConfigModalBtn) {
    elements.closeGoogleConfigModalBtn.addEventListener('click', closeGoogleConfigModal);
  }

  if (elements.googleConfigForm) {
    elements.googleConfigForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const newId = elements.googleClientIdInput ? elements.googleClientIdInput.value : '';
      authManager.setGoogleClientId(newId);
      if (elements.googleConfigStatus) {
        elements.googleConfigStatus.textContent = authManager.isGoogleConfigured()
          ? '✅ Google OAuth 2.0 Client ID saved & initialized!'
          : 'ℹ️ Saved default placeholder.';
      }
      setTimeout(() => {
        closeGoogleConfigModal();
        authManager.initGoogleIdentity('googleSignInBtnMount');
      }, 700);
    });
  }

  if (elements.resetGoogleClientIdBtn) {
    elements.resetGoogleClientIdBtn.addEventListener('click', () => {
      authManager.setGoogleClientId('');
      if (elements.googleClientIdInput) {
        elements.googleClientIdInput.value = authManager.getGoogleClientId();
      }
      if (elements.googleConfigStatus) {
        elements.googleConfigStatus.textContent = 'ℹ️ Reset to default placeholder.';
      }
      authManager.initGoogleIdentity('googleSignInBtnMount');
    });
  }

  // Forgot Password modal
  if (elements.forgotPasswordBtn) {
    elements.forgotPasswordBtn.addEventListener('click', openForgotPassModal);
  }
  if (elements.closeForgotPassModalBtn) {
    elements.closeForgotPassModalBtn.addEventListener('click', closeForgotPassModal);
  }
  if (elements.forgotPassForm) {
    elements.forgotPassForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (elements.forgotPassFeedback) {
        elements.forgotPassFeedback.style.display = 'block';
        elements.forgotPassFeedback.className = 'auth-alert-box success';
        elements.forgotPassFeedback.textContent = 'Password reset instructions dispatched to your email address (or use Demo User: marcus.vance@sportsbiomechanics.io / password123).';
      }
      setTimeout(closeForgotPassModal, 2200);
    });
  }
}

function openGoogleConfigModal() {
  if (elements.googleClientIdInput) {
    elements.googleClientIdInput.value = authManager.getGoogleClientId() || '';
  }
  if (elements.googleConfigStatus) {
    elements.googleConfigStatus.textContent = authManager.isGoogleConfigured()
      ? '✅ Connected with Google Cloud Client ID'
      : 'ℹ️ Placeholder active (Simulated Google authentication available)';
  }
  if (elements.googleConfigModal) {
    elements.googleConfigModal.classList.add('active');
  }
}

function closeGoogleConfigModal() {
  if (elements.googleConfigModal) {
    elements.googleConfigModal.classList.remove('active');
  }
}

function openForgotPassModal() {
  if (elements.forgotPassFeedback) {
    elements.forgotPassFeedback.style.display = 'none';
  }
  if (elements.forgotPassModal) {
    elements.forgotPassModal.classList.add('active');
  }
}

function closeForgotPassModal() {
  if (elements.forgotPassModal) {
    elements.forgotPassModal.classList.remove('active');
  }
}

function showAuthAlert(message, type = 'error') {
  if (!elements.authAlertBox) return;
  elements.authAlertBox.textContent = message;
  elements.authAlertBox.className = `auth-alert-box ${type}`;
  elements.authAlertBox.style.display = 'block';
}

function clearAuthAlert() {
  if (elements.authAlertBox) {
    elements.authAlertBox.style.display = 'none';
    elements.authAlertBox.textContent = '';
  }
}

function updateUserHeaderUI() {
  const user = authManager.getCurrentUser();
  if (!user) return;

  if (elements.athleteHeaderName) {
    elements.athleteHeaderName.textContent = user.name;
  }
  if (elements.athleteHeaderSport) {
    elements.athleteHeaderSport.textContent = user.provider === 'google' 
      ? 'GOOGLE AUTH' 
      : (user.sport ? user.sport.toUpperCase() : 'VERIFIED');
  }
  if (elements.userHeaderAvatar) {
    if (user.avatarUrl) {
      elements.userHeaderAvatar.innerHTML = `<img src="${user.avatarUrl}" alt="${user.name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    } else {
      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '👤';
      elements.userHeaderAvatar.textContent = initials;
    }
  }
}

function handleAuthLogin(user) {
  if (elements.loginPortal) {
    elements.loginPortal.classList.remove('active');
    setTimeout(() => {
      if (elements.loginPortal && authManager.isLoggedIn()) {
        elements.loginPortal.style.display = 'none';
      }
    }, 400);
  }
  
  // Sync with athlete manager
  const athlete = athleteManager.ensureAthleteForUser(user);
  if (athlete && athlete.sport) {
    state.currentSport = athlete.sport;
    if (elements.sportSelect) elements.sportSelect.value = athlete.sport;
  }

  updateUserHeaderUI();
  updateAthleteUI();
  
  // Start simulation stream
  switchVideoSource('demo');
  
  const firstName = user.name ? user.name.split(' ')[0] : 'Coach';
  voiceCoach.speak(`Welcome to Movement Lab, ${firstName}`);
}

function stopAllStreams() {
  if (cameraInstance) {
    try { cameraInstance.stop(); } catch (e) {}
    cameraInstance = null;
  }
  if (elements.webcam && elements.webcam.srcObject) {
    try { elements.webcam.srcObject.getTracks().forEach(track => track.stop()); } catch (e) {}
    elements.webcam.srcObject = null;
  }
  if (demoAnimationFrameId) {
    cancelAnimationFrame(demoAnimationFrameId);
    demoAnimationFrameId = null;
  }
  state.isStreaming = false;
  state.isDemoRunning = false;
}

function handleSignOut() {
  stopAllStreams();
  authManager.signOut();
  if (elements.userProfileContainer) {
    elements.userProfileContainer.classList.remove('open');
  }
  if (elements.athleteModal) {
    elements.athleteModal.classList.remove('active');
  }
  if (elements.reportModal) {
    elements.reportModal.classList.remove('active');
  }
  if (elements.settingsModal) {
    elements.settingsModal.classList.remove('active');
  }
  if (elements.loginPortal) {
    elements.loginPortal.style.display = 'flex';
    requestAnimationFrame(() => {
      elements.loginPortal.classList.add('active');
    });
  }
  clearAuthAlert();
  voiceCoach.speak('Signed out of Movement Lab');
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

  if (bgCtx) {
    bgCtx.clearRect(0, 0, elements.backgroundCanvas.width, elements.backgroundCanvas.height);
    if (source === 'demo') {
      drawCyberBackdrop(bgCtx, elements.backgroundCanvas.width, elements.backgroundCanvas.height);
    }
  }

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

      elements.backgroundCanvas.width = width;
      elements.backgroundCanvas.height = height;
      bgCtx.clearRect(0, 0, width, height);
      if (state.videoSource === 'demo') {
        drawCyberBackdrop(bgCtx, width, height);
      }
    }

    ctx.clearRect(0, 0, width, height);

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
