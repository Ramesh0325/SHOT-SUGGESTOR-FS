# SHOT-SUGGESTOR

AI Cinematic Shot Suggestor: Generate new camera angles and cinematic shots with a grand look using reference images and prompts.

---

## Features
- **Shot Suggestion:**
  - Input a scene description and get AI-generated shot suggestions (shot types, camera angles, lens, lighting, etc.)
  - Designed for filmmakers, storyboard artists, and creative teams
- **Image Fusion:**
  - Upload 1-5 reference images of a scene
  - Describe the new angle/view you want
  - AI generates the same world from a new perspective (preserving all objects, style, lighting, etc.)
  - Multi-image blending for better world understanding
  - Optimized for both GPU and CPU (auto-detects device)
  - Progress bar and user-friendly UI
- **Grand Cinematic Look:**
  - Prompts and models are tuned for cinematic, high-quality, visually rich outputs
  - Supports advanced prompt engineering for epic, filmic, and visually consistent results
- **Secure authentication**
- **Modern React frontend**

---

## Quick Start

### 1. **Clone the Repository**
```bash
# Clone and enter the project
git clone <repo-url>
cd SHOT-SUGGESTOR
```

### 2. **Backend Setup**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
# or
source venv/bin/activate  # On Mac/Linux
pip install -r requirements.txt
```

#### **Check GPU Support (Optional)**
```bash
python check_gpu.py
```

### 3. **Start the Backend**
```bash
uvicorn main:app --reload
```

### 4. **Frontend Setup**
```bash
cd ../frontend
npm install
npm start
```

---

## Usage
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Register or log in.
3. **Shot Suggestion:**
   - Go to the "Shot Suggestor" page.
   - Enter a scene description (e.g., "A king sits on his throne in a grand hall, sunlight streaming through stained glass").
   - Get a list of AI-generated shot suggestions (shot type, angle, lens, lighting, etc.).
   - Select or edit shots for your project.
4. **Image Fusion:**
   - Go to the "Image Fusion" page.
   - Upload 1-5 reference images of your scene.
   - Enter a prompt describing the new angle (e.g., "same scene from a low angle").
   - Click "Generate New Angle".
   - View and download your generated image.

---

## Prompting Tips
- **Shot Suggestion:**
  - Be descriptive: "A hero stands at the edge of a cliff at sunset, wind blowing his cape"
  - Add mood, lighting, and camera intent for more cinematic suggestions
- **Image Fusion:**
  - Be specific: "same scene from above", "identical scene, camera moved to the left"
  - Avoid creative deviations: don't ask for new objects, locations, or styles
  - See the UI for more prompt examples

---

## Cinematic/Grand Look
- The system is tuned for cinematic, epic, and visually rich outputs
- Use prompts like:
  - "grand, wide establishing shot"
  - "epic lighting, deep shadows, rich color palette"
  - "filmic composition, dramatic angle"
  - "same world, new angle, maintain grandeur"
- Combine shot suggestion and image fusion for full previsualization workflow

---

## GPU/CPU Support
- The backend **automatically uses GPU** if available (`torch.cuda.is_available()`)
- If no GPU is found, it uses CPU
- No code changes are needed to switch devices
- For best performance, use a CUDA-enabled GPU

---

## Progress Bar & User Experience
- The UI shows a progress bar during image generation
- Users are warned if they try to close the tab while a job is running
- Modern, responsive design for creative workflows

---

## Troubleshooting
- **Backend not starting?**
  - Make sure you run `uvicorn main:app --reload` from the `backend` directory
  - Check for typos or missing dependencies
- **GPU not detected?**
  - Run `python check_gpu.py` in the backend directory
  - Make sure you have the correct CUDA drivers and PyTorch version
- **Image generation slow?**
  - Try on a machine with a GPU
  - Reduce the number of inference steps (advanced)
- **CORS errors?**
  - Make sure the backend allows requests from your frontend's origin (see CORS settings in `main.py`)
- **Logout during generation?**
  - The backend will finish the job, but the result will not be shown if you log out or close the tab

---

## Advanced
- See `backend/REFERENCE_MATCHING_GUIDE.md` for in-depth tips on reference image matching and parameter tuning
- Test scripts: `backend/test_reference_matching.py`, `backend/test_ui_integration.py`
- Backend endpoints for advanced users:
  - `/shots/suggest` (AI shot suggestion)
  - `/fusion/generate` (image fusion)
  - `/fusion/advanced-match` (style, identity, pose, theme)
  - `/api/theme-preserve` (grand look, world preservation)

---

## License
MIT
