# ACL‑Shield • AdaptiFit 🏅
### AI-Powered Sports Biomechanics Knee/ACL Injury Screener & Inclusive Movement Lab

An advanced, client-side real-time computer vision platform designed for athletic knee injury prevention, dynamic knee valgus (FPPA) screening, LESS scoring, and adaptive inclusive fitness coaching.

---

## 🌟 Key Features

### 1. 🛡️ ACL‑Shield (Injury Screener)
- **Dynamic Knee Valgus (FPPA) Detection**: Computes frontal plane projection angles (Hip-Knee-Ankle) at 60 FPS to detect medial knee collapse.
- **Landing Shock & Stiffness Analysis**: Evaluates knee flexion depth on impact to mitigate non-contact ACL strain.
- **Landing Error Scoring System (LESS)**: Clinical 0–15 scoring system evaluating initial contact angles, torso sway, and foot asymmetry.
- **Vertical Jump & Hang-Time Kinematics**: Computes jump height (cm/inches) and estimated ground reaction impact G-force.
- **Speedometer Risk Gauge**: Real-time 0–100% composite risk meter with severity tiers (*Low, Moderate, High, Severe*).

### 2. 🏀 Multi-Sport Biomechanics Modes
- **Basketball**: High-impact rebound landing mechanics, rapid deceleration & cutting.
- **Football / Soccer**: Single-leg plant-and-cut stability & rotational knee torque.
- **Badminton / Volleyball**: Overhead smash landing & backward jump shock dissipation.
- **Athletics / Running**: Cadence, bilateral gait symmetry & ground contact stability.
- **Skiing**: Deep asymmetric knee flexion load & eccentric quad control.
- **General / Rehab**: Standard clinical baseline & inclusive movement lab.

### 3. ♿ AdaptiFit (Inclusive Adaptive Coach)
- **Seated & Wheelchair Workouts**: Seated Boxing, Seated Overhead Press, Lateral Arm Raises.
- **Upper Limb & Stroke Mobility Rehab**: Assisted Range of Motion (ROM %) and tempo pacing.
- **Voice Coach & Chimes**: Spoken coaching feedback via Web Speech API and telemetry audio chimes.

### 4. 👤 Athlete Profile & Recovery History
- Track multiple athletes, save session histories, and visualize longitudinal recovery trends over time.

### 5. ⏱️ Video Scrubber & Peak Valgus Freeze-Frame
- Upload game footage, scrub frame-by-frame with Slow-Motion (0.25x, 0.5x), and click **"⚡ Freeze at Peak Valgus"** to instantly jump to the exact moment of maximum injury risk.

### 6. 🔐 Dual-Method Authentication (Google & Credentials)
- **Sign In with Google**: Integrated with Google Identity Services (GIS) OAuth 2.0.
- **Email & Password**: Local user registration, session persistence (`localStorage`), profile role/sport tagging, and password visibility toggle.
- **Guest / Demo Mode**: Instant 1-click access for swift clinical evaluation.

---

## 🔑 How to Setup Google Cloud OAuth 2.0 (Google Authentication)

To connect your own Google Cloud credentials to the login system:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select your Google Cloud Project.
3. Click **+ CREATE CREDENTIALS** &rarr; select **OAuth client ID**.
   - If prompted, configure the **OAuth consent screen** (User Type: *External*, fill in App Name & Developer Email).
4. Set **Application type** to **Web application**.
5. Under **Authorized JavaScript origins**, add your deployment URLs:
   - For local testing: `http://localhost:3000` or `http://127.0.0.1:5500`
   - For production: `https://your-domain.vercel.app` or `https://your-domain.netlify.app`
6. Click **Create** and copy your **Client ID** (ends in `.apps.googleusercontent.com`).
7. Paste your Client ID into the app:
   - Click **⚙️ Configure Google Cloud Client ID** on the login page or in the top right user menu.
   - Or paste it directly into `auth.js` (`defaultGoogleClientId`).
8. Click **Save** — Google Sign-In is now live!

---

## 🚀 How to Deploy in 60 Seconds

This project is a 100% client-side modern web application. It requires **no complex backend server or database setup**!

### Option 1: Deploy with Vercel (Recommended)
1. Install Vercel CLI (or connect your GitHub repo at [vercel.com](https://vercel.com)):
   ```bash
   npx vercel
   ```
2. Follow the prompt (accept defaults) — your website will be live with an HTTPS URL in seconds!

### Option 2: Deploy with Netlify
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop this folder (`sports`) directly into the browser!
3. Netlify will deploy it instantly with a public URL.

### Option 3: Deploy with GitHub Pages
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of ACL-Shield & AdaptiFit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Go to your GitHub Repository **Settings** -> **Pages**.
3. Under **Branch**, select `main` and `/ (root)` folder -> Click **Save**.
4. Your website is live at `https://<your-username>.github.io/<your-repo-name>/`!

---

## 💻 Local Development

To run locally on your machine:
```bash
# Using Node / NPX
npx serve .

# Or using Python 3
python -m http.server 3000
```
Open **[http://localhost:3000](http://localhost:3000)** in Chrome, Edge, or Safari.

---

## 🧬 Tech Stack
- **Authentication**: Google Identity Services (GIS SDK OAuth 2.0) + Local Credentials Engine
- **Vision Engine**: MediaPipe Pose (33 3D Keypoint Landmark Model)
- **Kinematics Engine**: Pure Vanilla JavaScript (FPPA math, LESS protocol, Jump kinematics)
- **Audio Engine**: Web Speech API + Web Audio API Synthesis
- **Visualization**: HTML5 Canvas HUD + Chart.js Real-Time Waveforms
- **Styling**: Vanilla CSS (Glassmorphism, Cyber-Sports Dark Theme)

