/**
 * ACL-Shield Alert & Notification Dispatch System
 * Manages real-time injury risk alerts, desktop push notifications, webhook dispatches,
 * coach email integration, and emergency audio visual alarms.
 */

export class AlertManager {
  constructor() {
    this.storageKey = 'acl_shield_alert_settings';
    this.incidentLogs = [];
    this.lastAlertTime = 0;
    this.alertCooldownMs = 4000; // Prevent spamming alerts within 4s
    this.lastWebhookTime = 0;
    this.webhookCooldownMs = 15000; // Cooldown for webhook dispatches
    
    this.settings = this.loadSettings();
    this.initNotificationPermission();
  }

  loadSettings() {
    const defaultSettings = {
      riskThreshold: 60,
      enableAudioSiren: true,
      enableVoiceAlert: true,
      enableDesktopNotifications: true,
      enableVisualFlash: true,
      enableWebhook: false,
      webhookUrl: '',
      coachEmail: '',
      coachPhone: ''
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
      }
    } catch (e) {
      console.warn('Failed to load alert settings', e);
    }
    return defaultSettings;
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('Failed to save alert settings', e);
    }
  }

  async initNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Will request when user toggles or tests alerts
      }
    }
  }

  async requestPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  }

  /**
   * Evaluates if current frame warrants a critical alert
   */
  processTelemetry(riskData, athleteMeta, exerciseName) {
    if (!riskData || riskData.score < this.settings.riskThreshold) return null;

    const now = Date.now();
    if (now - this.lastAlertTime < this.alertCooldownMs) return null;

    this.lastAlertTime = now;

    const incident = {
      id: 'inc_' + now,
      timestamp: new Date().toLocaleTimeString(),
      athleteName: athleteMeta ? athleteMeta.name : 'Athlete',
      sport: athleteMeta ? athleteMeta.sport : 'General',
      exercise: exerciseName || 'Squat',
      riskScore: riskData.score,
      riskLevel: riskData.level,
      lessScore: riskData.lessScore || 0,
      valgusLeft: riskData.valgusLeft,
      valgusRight: riskData.valgusRight,
      feedback: riskData.feedbacks[0] || 'High ACL injury loading detected.'
    };

    this.incidentLogs.unshift(incident);
    if (this.incidentLogs.length > 50) this.incidentLogs.pop();

    // Trigger Desktop Push Notification
    if (this.settings.enableDesktopNotifications) {
      this.sendDesktopNotification(incident);
    }

    // Trigger Webhook if configured and cooldown passed
    if (this.settings.enableWebhook && this.settings.webhookUrl && (now - this.lastWebhookTime > this.webhookCooldownMs)) {
      this.lastWebhookTime = now;
      this.sendWebhookAlert(incident);
    }

    return incident;
  }

  /**
   * Sends Native Desktop Browser Notification
   */
  sendDesktopNotification(incident) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = `🚨 ACL Injury Risk Alert (${incident.riskScore}%)`;
        const options = {
          body: `${incident.athleteName} - ${incident.exercise}\n${incident.feedback} (Knee Valgus: L:${incident.valgusLeft}° R:${incident.valgusRight}°)`,
          icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
          tag: 'acl-injury-alert',
          renotify: true
        };
        new Notification(title, options);
      } catch (e) {
        console.warn('Desktop notification failed', e);
      }
    }
  }

  /**
   * Sends Webhook HTTP POST (Discord / Slack / EHR Backend)
   */
  async sendWebhookAlert(incident) {
    if (!this.settings.webhookUrl) return;

    try {
      // Formats for Discord / Slack / Generic Webhook
      const payload = {
        username: "ACL-Shield AI Safety Monitor",
        content: `🚨 **CRITICAL INJURY RISK DETECTED**\n**Athlete:** ${incident.athleteName} (${incident.sport})\n**Protocol:** ${incident.exercise}\n**Risk Score:** ${incident.riskScore}% (${incident.riskLevel})\n**LESS Error Score:** ${incident.lessScore}/15\n**Valgus FPPA Angles:** Left: ${incident.valgusLeft}° | Right: ${incident.valgusRight}°\n**Directive:** ${incident.feedback}\n*Timestamp: ${incident.timestamp}*`
      };

      await fetch(this.settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Webhook alert dispatched successfully');
    } catch (err) {
      console.warn('Webhook dispatch failed:', err);
    }
  }

  /**
   * Generates formatted Mailto link for coach / physiotherapist
   */
  generateEmailLink(athleteMeta, sessionSummary) {
    const coach = this.settings.coachEmail || '';
    const subject = encodeURIComponent(`🚨 Biomechanical Assessment Alert: ${athleteMeta ? athleteMeta.name : 'Athlete'} (${sessionSummary.maxRiskScore}% Peak Risk)`);
    
    const body = encodeURIComponent(
      `Dear Coach / Physiotherapist,\n\n` +
      `An automated biomechanical assessment report has been generated by ACL-Shield AI.\n\n` +
      `=== ATHLETE ASSESSMENT SUMMARY ===\n` +
      `Athlete: ${athleteMeta ? athleteMeta.name : 'Athlete'}\n` +
      `Sport: ${athleteMeta ? athleteMeta.sport : 'General'}\n` +
      `Protocol: ${sessionSummary.exerciseName || 'Assessment'}\n` +
      `Peak ACL Risk: ${sessionSummary.maxRiskScore}%\n` +
      `Average Risk: ${sessionSummary.avgRiskScore}%\n` +
      `LESS Error Score: ${sessionSummary.lessScore || 0}/15\n` +
      `Vertical Jump Height: ${sessionSummary.jumpHeightCm || 0} cm\n` +
      `Total Repetitions: ${sessionSummary.totalReps || 0}\n` +
      `Timestamp: ${sessionSummary.timestamp || new Date().toLocaleString()}\n\n` +
      `=== CLINICAL RECOMMENDATION ===\n` +
      `Immediate neuromuscular intervention recommended if peak valgus exceeds 15° collapse.\n` +
      `Please review the full report and Excel export on the ACL-Shield portal.\n\n` +
      `ACL-Shield Automated Sports Telemetry`
    );

    return `mailto:${coach}?subject=${subject}&body=${body}`;
  }
}
