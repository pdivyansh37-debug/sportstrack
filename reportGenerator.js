/**
 * Biomechanical Report & Data Export Generator
 * Produces multi-format clinical/performance reports, PDF printing, and native Excel (.xlsx), CSV, JSON exports.
 */

export class ReportGenerator {
  /**
   * Generates formatted HTML report based on selected template format: 'clinical' | 'performance' | 'patient'
   */
  static generateHTMLReport(sessionData, format = 'clinical') {
    const {
      athleteName = 'Athlete / Patient',
      sport = 'Basketball',
      mode = 'ACL-Shield',
      exerciseName = 'Drop Jump / Squat Assessment',
      durationSeconds = 0,
      totalReps = 0,
      avgRiskScore = 0,
      maxRiskScore = 0,
      riskLevel = 'Low Risk',
      lessScore = 0,
      jumpHeightCm = 0,
      hangTimeMs = 0,
      impactGForce = 0,
      avgValgusLeft = 180,
      avgValgusRight = 180,
      maxValgusCollapse = 0,
      avgFlexionDepth = 90,
      asymmetryIndex = 0,
      repHistory = [],
      timestamp = new Date().toLocaleString()
    } = sessionData;

    const riskColor = maxRiskScore > 65 ? '#ef4444' : maxRiskScore > 35 ? '#f59e0b' : '#10b981';

    // Corrective Exercise Recommendations
    const recommendations = [];
    if (maxValgusCollapse > 12 || asymmetryIndex > 25) {
      recommendations.push({
        title: 'Banded Monster Walks & Clamshells',
        target: 'Gluteus Medius & Hip Abductors',
        prescription: '3 sets × 15 reps daily with medium resistance band',
        rationale: 'Strengthens hip external rotators to resist medial dynamic knee collapse (valgus).'
      });
      recommendations.push({
        title: 'Single-Leg Balance & Romanian Deadlifts',
        target: 'Unilateral Proprioception & Stability',
        prescription: '3 sets × 10 reps per leg, 3x/week',
        rationale: 'Equalizes limb asymmetry and improves ankle-knee joint alignment under load.'
      });
    }

    if (avgFlexionDepth > 140 || lessScore > 5) {
      recommendations.push({
        title: 'Soft-Landing Box Drops & Deceleration Training',
        target: 'Eccentric Quadriceps & Shock Absorption',
        prescription: '4 sets × 6 drops from 30cm box into deep squat stick',
        rationale: 'Prevents stiff-legged landings that transfer excessive ground reaction forces to the ACL.'
      });
    }

    recommendations.push({
      title: 'Nordic Hamstring Curls & Hip Bridges',
      target: 'Hamstring-to-Quad Ratio (H:Q)',
      prescription: '3 sets × 8 reps, twice weekly',
      rationale: 'Hamstrings act as primary secondary stabilizers against anterior tibial translation.'
    });

    if (format === 'performance') {
      // Format 2: Sports Performance & Strength Coach Report
      return `
        <div class="bio-report performance-format">
          <header class="report-header">
            <div class="report-title-group">
              <h2>⚡ ATHLETIC PERFORMANCE & KINEMATICS REPORT</h2>
              <p class="report-sub">Sport: ${sport} • Protocol: ${exerciseName}</p>
            </div>
            <div class="report-meta">
              <div><strong>Athlete:</strong> ${athleteName}</div>
              <div><strong>Date:</strong> ${timestamp}</div>
              <div><strong>Duration:</strong> ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s</div>
            </div>
          </header>

          <section class="report-summary-grid">
            <div class="summary-card" style="border-top: 4px solid var(--purple-accent)">
              <div class="card-label">VERTICAL JUMP HEIGHT</div>
              <div class="card-value" style="color: var(--purple-accent)">${jumpHeightCm || '—'} cm</div>
              <div class="card-note">${jumpHeightCm ? `${(jumpHeightCm / 2.54).toFixed(1)} inches` : 'Jump Protocol'}</div>
              <div class="card-sub-stats">Hang Time: ${hangTimeMs || '—'} ms</div>
            </div>

            <div class="summary-card" style="border-top: 4px solid var(--cyan-primary)">
              <div class="card-label">IMPACT ABSORPTION FORCE</div>
              <div class="card-value" style="color: var(--cyan-primary)">${impactGForce || '1.8'} G</div>
              <div class="card-note">Deceleration Load</div>
              <div class="card-sub-stats">Avg Depth: ${avgFlexionDepth}°</div>
            </div>

            <div class="summary-card" style="border-top: 4px solid ${asymmetryIndex > 20 ? '#ef4444' : '#10b981'}">
              <div class="card-label">BILATERAL ASYMMETRY</div>
              <div class="card-value" style="color: ${asymmetryIndex > 20 ? '#ef4444' : '#10b981'}">${asymmetryIndex}%</div>
              <div class="card-note">${asymmetryIndex > 20 ? 'Asymmetric Force Distribution' : 'Optimal Symmetry'}</div>
            </div>

            <div class="summary-card" style="border-top: 4px solid ${riskColor}">
              <div class="card-label">MOVEMENT EFFICIENCY</div>
              <div class="card-value" style="color: ${riskColor}">${Math.max(0, 100 - maxRiskScore)}%</div>
              <div class="card-note">LESS Score: ${lessScore}/15</div>
            </div>
          </section>

          <section class="report-section">
            <h3>Strength & Conditioning Coaching Insights</h3>
            <p class="eval-text">
              Athlete demonstrated <strong>${totalReps} completed repetitions</strong> with an average flexion depth of <strong>${avgFlexionDepth}°</strong>. 
              ${asymmetryIndex > 20 
                ? 'Unilateral power discrepancy was noted. Prioritize single-leg explosive plyometrics on the non-dominant limb to balance jump landing mechanics.' 
                : 'Bilateral force transfer was evenly balanced. Movement velocity and deceleration control are well within peak athletic parameters.'}
            </p>
          </section>

          <section class="report-section">
            <h3>Athletic Training Action Plan</h3>
            <div class="prescription-grid">
              ${recommendations.map(r => `
                <div class="prescription-item">
                  <div class="presc-title">${r.title}</div>
                  <div class="presc-target"><strong>Objective:</strong> ${r.target}</div>
                  <div class="presc-dosage"><strong>Training Protocol:</strong> ${r.prescription}</div>
                </div>
              `).join('')}
            </div>
          </section>

          <footer class="report-footer">
            <p>ACL-Shield Sports Science Module • Format: Athletic Performance & Load Analysis</p>
          </footer>
        </div>
      `;
    }

    if (format === 'patient') {
      // Format 3: Patient / Athlete Simplified Summary
      return `
        <div class="bio-report patient-format">
          <header class="report-header">
            <div class="report-title-group">
              <h2>🏃 MY MOVEMENT & KNEE HEALTH SUMMARY</h2>
              <p class="report-sub">Personalized Movement Assessment</p>
            </div>
            <div class="report-meta">
              <div><strong>Name:</strong> ${athleteName}</div>
              <div><strong>Date:</strong> ${timestamp}</div>
            </div>
          </header>

          <section class="report-summary-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="summary-card" style="border-top: 4px solid ${riskColor}">
              <div class="card-label">KNEE SAFETY RATING</div>
              <div class="card-value" style="color: ${riskColor}">${riskLevel.toUpperCase()}</div>
              <div class="card-note">${maxRiskScore < 35 ? '✅ Great joint alignment!' : '⚠️ Needs form adjustment'}</div>
            </div>

            <div class="summary-card">
              <div class="card-label">EXERCISE COMPLETED</div>
              <div class="card-value" style="color: var(--cyan-primary)">${totalReps} Reps</div>
              <div class="card-note">${exerciseName}</div>
            </div>

            <div class="summary-card">
              <div class="card-label">BALANCE RATING</div>
              <div class="card-value">${asymmetryIndex <= 15 ? 'Balanced (A)' : 'Slight Lean (B)'}</div>
              <div class="card-note">${asymmetryIndex}% Left-Right Difference</div>
            </div>
          </section>

          <section class="report-section">
            <h3>What This Means For You</h3>
            <p class="eval-text">
              ${maxRiskScore < 35 
                ? 'Fantastic job! Your knees remained stable and well-aligned with your toes throughout your workout. Keep up the great work!' 
                : 'We noticed a slight tendency for your knees to drift inwards when bending. Doing the simple strengthening exercises below will protect your knees and make you stronger!'}
            </p>
          </section>

          <section class="report-section">
            <h3>Your Daily Home Exercises</h3>
            <div class="prescription-grid">
              ${recommendations.slice(0, 2).map(r => `
                <div class="prescription-item">
                  <div class="presc-title">${r.title}</div>
                  <div class="presc-dosage"><strong>How often:</strong> ${r.prescription}</div>
                  <div class="presc-rationale"><em>${r.rationale}</em></div>
                </div>
              `).join('')}
            </div>
          </section>

          <footer class="report-footer">
            <p>ACL-Shield & AdaptiFit • Patient-Friendly Health Card</p>
          </footer>
        </div>
      `;
    }

    // Default Format 1: Comprehensive Clinical & Orthopedic Report
    return `
      <div class="bio-report clinical-format">
        <header class="report-header">
          <div class="report-title-group">
            <h2>CLINICAL BIOMECHANICS & ACL RISK ASSESSMENT</h2>
            <p class="report-sub">AI Pose Biomechanics • ${mode} • Sport: ${sport}</p>
          </div>
          <div class="report-meta">
            <div><strong>Athlete:</strong> ${athleteName}</div>
            <div><strong>Date:</strong> ${timestamp}</div>
            <div><strong>Protocol:</strong> ${exerciseName}</div>
            <div><strong>Duration:</strong> ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s</div>
          </div>
        </header>

        <section class="report-summary-grid">
          <div class="summary-card risk-card" style="border-top: 4px solid ${riskColor}">
            <div class="card-label">PEAK ACL INJURY RISK</div>
            <div class="card-value" style="color: ${riskColor}">${maxRiskScore}%</div>
            <div class="risk-badge" style="background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}55;">
              ${riskLevel.toUpperCase()}
            </div>
            <div class="card-note">Average Session Risk: ${avgRiskScore}%</div>
          </div>

          <div class="summary-card">
            <div class="card-label">KNEE VALGUS (FPPA)</div>
            <div class="card-value">${maxValgusCollapse}°</div>
            <div class="card-note">Max Inward Collapse from Neutral 180°</div>
            <div class="card-sub-stats">
              <span>L: ${avgValgusLeft}°</span> | <span>R: ${avgValgusRight}°</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="card-label">LESS SCORE & JUMP</div>
            <div class="card-value">${lessScore}/15</div>
            <div class="card-note">Landing Error Score ${lessScore <= 4 ? '(Normal)' : '(Elevated Risk)'}</div>
            <div class="card-sub-stats">
              <span>Jump: ${jumpHeightCm || '—'}cm</span> | <span>Impact: ${impactGForce || '—'}G</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="card-label">LIMB ASYMMETRY</div>
            <div class="card-value">${asymmetryIndex}%</div>
            <div class="card-note">${asymmetryIndex > 20 ? 'Significant imbalance' : 'Bilateral symmetry'}</div>
            <div class="card-sub-stats"><span>${totalReps} Completed Reps</span></div>
          </div>
        </section>

        <section class="report-section">
          <h3>Kinematic & Biomechanical Evaluation</h3>
          <p class="eval-text">
            ${maxRiskScore < 30 
              ? 'Excellent neuromuscular control demonstrated throughout the movement cycles. Minimal medial knee deviation was observed during deceleration, and ground reaction forces were well dissipated with optimal knee flexion.'
              : maxRiskScore < 60
              ? 'Moderate dynamic knee valgus detected during the transition phase. The athlete exhibits a mild tendency for knee adduction under peak eccentric loading. Targeted hip strengthening is advised.'
              : 'CRITICAL: High knee valgus collapse and stiff landing angles recorded. These biomechanical markers strongly correlate with increased non-contact ACL strain. Immediate corrective intervention recommended before high-intensity competitive loading.'}
          </p>
        </section>

        <section class="report-section">
          <h3>Personalized Corrective Prescription</h3>
          <div class="prescription-grid">
            ${recommendations.map(r => `
              <div class="prescription-item">
                <div class="presc-title">${r.title}</div>
                <div class="presc-target"><strong>Focus:</strong> ${r.target}</div>
                <div class="presc-dosage"><strong>Dosage:</strong> ${r.prescription}</div>
                <div class="presc-rationale"><em>${r.rationale}</em></div>
              </div>
            `).join('')}
          </div>
        </section>

        ${repHistory.length > 0 ? `
          <section class="report-section">
            <h3>Repetition Breakdown</h3>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Rep #</th>
                  <th>Duration</th>
                  <th>Flexion / Extension</th>
                  <th>Peak Risk</th>
                  <th>Grade</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${repHistory.map(rep => `
                  <tr>
                    <td>#${rep.repNumber}</td>
                    <td>${rep.durationSec}s</td>
                    <td>${rep.minDepthDeg || rep.maxExtensionDeg || '—'}°</td>
                    <td><span style="color: ${rep.peakRisk > 50 ? '#ef4444' : '#10b981'}">${rep.peakRisk || 0}%</span></td>
                    <td><strong>${rep.grade}</strong></td>
                    <td>${rep.timestamp}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        ` : ''}

        <footer class="report-footer">
          <p>Generated by ACL-Shield & AdaptiFit AI • Clinical & Orthopedic Biomechanical Screening Assessment</p>
        </footer>
      </div>
    `;
  }

  /**
   * Downloads multi-sheet native Excel (.xlsx) file using SheetJS
   */
  static downloadExcel(sessionData, telemetryLogs, filename = 'biomechanics_session.xlsx') {
    if (!window.XLSX) {
      alert('Excel export engine loading... please try again in a moment or use CSV export.');
      this.downloadCSV(telemetryLogs);
      return;
    }

    const wb = window.XLSX.utils.book_new();

    // Sheet 1: Assessment Summary
    const summaryData = [
      { Metric: 'Athlete Name', Value: sessionData.athleteName || 'Athlete / Patient' },
      { Metric: 'Sport Mode', Value: sessionData.sport || 'Basketball' },
      { Metric: 'Assessment Mode', Value: sessionData.mode || 'ACL-Shield' },
      { Metric: 'Protocol', Value: sessionData.exerciseName || 'Squat Assessment' },
      { Metric: 'Assessment Date', Value: sessionData.timestamp || new Date().toLocaleString() },
      { Metric: 'Duration (Seconds)', Value: sessionData.durationSeconds || 0 },
      { Metric: 'Total Completed Reps', Value: sessionData.totalReps || 0 },
      { Metric: 'Peak ACL Injury Risk (%)', Value: sessionData.maxRiskScore || 0 },
      { Metric: 'Average Session Risk (%)', Value: sessionData.avgRiskScore || 0 },
      { Metric: 'LESS Error Score (0-15)', Value: sessionData.lessScore || 0 },
      { Metric: 'Vertical Jump Height (cm)', Value: sessionData.jumpHeightCm || 0 },
      { Metric: 'Impact G-Force (G)', Value: sessionData.impactGForce || 0 },
      { Metric: 'Max Knee Valgus Collapse (°)', Value: sessionData.maxValgusCollapse || 0 },
      { Metric: 'Limb Asymmetry (%)', Value: sessionData.asymmetryIndex || 0 },
      { Metric: 'Average Flexion Depth (°)', Value: sessionData.avgFlexionDepth || 0 }
    ];
    const wsSummary = window.XLSX.utils.json_to_sheet(summaryData);
    window.XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Repetition Breakdown
    if (sessionData.repHistory && sessionData.repHistory.length > 0) {
      const repData = sessionData.repHistory.map(r => ({
        'Rep Number': r.repNumber,
        'Duration (s)': r.durationSec,
        'Flexion Depth (°)': r.minDepthDeg || r.maxExtensionDeg || 0,
        'Peak Risk (%)': r.peakRisk || 0,
        'Form Grade': r.grade,
        'Timestamp': r.timestamp
      }));
      const wsReps = window.XLSX.utils.json_to_sheet(repData);
      window.XLSX.utils.book_append_sheet(wb, wsReps, 'Rep Breakdown');
    }

    // Sheet 3: Full Kinematic Telemetry Log
    if (telemetryLogs && telemetryLogs.length > 0) {
      const logData = telemetryLogs.map(l => ({
        'Timestamp': l.timestamp,
        'Rep Count': l.repCount,
        'Injury Risk (%)': l.riskScore,
        'Risk Level': l.riskLevel,
        'LESS Score': l.lessScore || 0,
        'Left Knee Valgus (FPPA °)': l.valgusLeft,
        'Right Knee Valgus (FPPA °)': l.valgusRight,
        'Left Knee Flexion (°)': l.flexionLeft,
        'Right Knee Flexion (°)': l.flexionRight,
        'Limb Asymmetry (%)': l.asymmetry,
        'Trunk Lean (°)': l.trunkLean
      }));
      const wsTelemetry = window.XLSX.utils.json_to_sheet(logData);
      window.XLSX.utils.book_append_sheet(wb, wsTelemetry, 'Telemetry Stream');
    }

    window.XLSX.writeFile(wb, filename);
  }

  /**
   * Downloads session data as CSV file
   */
  static downloadCSV(telemetryLogs, filename = 'biomechanics_session.csv') {
    if (!telemetryLogs || telemetryLogs.length === 0) {
      alert('No telemetry data available for export.');
      return;
    }

    const headers = ['Timestamp', 'RepCount', 'RiskScore', 'RiskLevel', 'LESSScore', 'LeftKneeValgus', 'RightKneeValgus', 'LeftFlexion', 'RightFlexion', 'AsymmetryPercent', 'TrunkLeanDeg'];
    const rows = telemetryLogs.map(log => [
      log.timestamp || new Date().toISOString(),
      log.repCount || 0,
      log.riskScore || 0,
      `"${log.riskLevel || 'Normal'}"`,
      log.lessScore || 0,
      log.valgusLeft || 180,
      log.valgusRight || 180,
      log.flexionLeft || 180,
      log.flexionRight || 180,
      log.asymmetry || 0,
      log.trunkLean || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Downloads full session structure as JSON
   */
  static downloadJSON(sessionData, filename = 'biomechanics_session.json') {
    const jsonStr = JSON.stringify(sessionData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
