/**
 * Athlete Profile & Longitudinal Session History Manager
 * Manages athlete data, injury history, and multi-session recovery trends using localStorage.
 */

export class AthleteProfileManager {
  constructor() {
    this.storageKey = 'acl_shield_athletes';
    this.activeAthleteKey = 'acl_shield_active_athlete_id';
    this.athletes = this.loadAthletes();
    this.activeAthleteId = this.loadActiveAthleteId();
    
    // Ensure default athlete exists
    if (this.athletes.length === 0) {
      const defaultAthlete = {
        id: 'athlete_default',
        name: 'Demo Athlete / Patient',
        sport: 'basketball',
        position: 'Guard / Wing',
        dominantLeg: 'Right',
        injuryHistory: 'None (Preventative Screening)',
        notes: 'Pre-season baseline biomechanical assessment',
        createdAt: new Date().toLocaleDateString(),
        sessions: []
      };
      this.athletes.push(defaultAthlete);
      this.activeAthleteId = defaultAthlete.id;
      this.save();
    }
  }

  loadAthletes() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  loadActiveAthleteId() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return localStorage.getItem(this.activeAthleteKey) || (this.athletes[0] ? this.athletes[0].id : null);
      }
    } catch (e) {}
    return this.athletes[0] ? this.athletes[0].id : null;
  }

  save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.athletes));
        if (this.activeAthleteId) {
          localStorage.setItem(this.activeAthleteKey, this.activeAthleteId);
        }
      }
    } catch (e) {
      console.warn('Failed to save athlete data', e);
    }
  }

  getActiveAthlete() {
    return this.athletes.find(a => a.id === this.activeAthleteId) || this.athletes[0];
  }

  setActiveAthlete(id) {
    this.activeAthleteId = id;
    this.save();
  }

  createAthlete(athleteData) {
    const newAthlete = {
      id: 'athlete_' + Date.now(),
      name: athleteData.name || 'New Athlete',
      sport: athleteData.sport || 'general',
      position: athleteData.position || 'General',
      dominantLeg: athleteData.dominantLeg || 'Right',
      injuryHistory: athleteData.injuryHistory || 'None',
      notes: athleteData.notes || '',
      createdAt: new Date().toLocaleDateString(),
      sessions: []
    };
    this.athletes.push(newAthlete);
    this.activeAthleteId = newAthlete.id;
    this.save();
    return newAthlete;
  }

  saveSessionToActiveAthlete(sessionSummary) {
    const athlete = this.getActiveAthlete();
    if (!athlete) return;

    if (!athlete.sessions) {
      athlete.sessions = [];
    }

    const sessionRecord = {
      sessionId: 'sess_' + Date.now(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      mode: sessionSummary.mode || 'ACL-Shield',
      sport: sessionSummary.sport || athlete.sport,
      exercise: sessionSummary.exercise || 'Squat Assessment',
      durationSeconds: sessionSummary.durationSeconds || 0,
      totalReps: sessionSummary.totalReps || 0,
      maxRiskScore: sessionSummary.maxRiskScore || 0,
      avgRiskScore: sessionSummary.avgRiskScore || 0,
      lessScore: sessionSummary.lessScore || 0,
      jumpHeightCm: sessionSummary.jumpHeightCm || 0,
      asymmetryIndex: sessionSummary.asymmetryIndex || 0,
      maxValgusCollapse: sessionSummary.maxValgusCollapse || 0
    };

    athlete.sessions.unshift(sessionRecord);
    // Keep last 30 sessions per athlete
    if (athlete.sessions.length > 30) {
      athlete.sessions = athlete.sessions.slice(0, 30);
    }

    this.save();
    return sessionRecord;
  }

  deleteAthlete(id) {
    if (this.athletes.length <= 1) {
      alert('Cannot delete the only remaining profile.');
      return false;
    }
    this.athletes = this.athletes.filter(a => a.id !== id);
    if (this.activeAthleteId === id) {
      this.activeAthleteId = this.athletes[0].id;
    }
    this.save();
    return true;
  }
}
