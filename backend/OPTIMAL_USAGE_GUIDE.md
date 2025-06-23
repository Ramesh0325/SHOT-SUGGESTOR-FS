# How to Get Better Results: Prompt and Image Guidelines

## 🎯 **Overview**
To get the best results from the image fusion system, both your **prompts** and **input images** need to be optimized. Here's a comprehensive guide based on the enhanced system capabilities.

---

## 📝 **Prompt Writing Best Practices**

### **1. 🎯 Use Specific Viewpoint Terms**

#### **✅ GOOD Prompts:**
```
"side view of the same car"
"rear view from behind"
"top view from above looking down"
"close-up detail of the front bumper"
"bird's eye view of the same building"
"profile view of the same person"
"ground level shot looking up"
"macro detail of the same object"
```

#### **❌ AVOID Vague Prompts:**
```
"different angle"          → Too vague
"another view"            → No specific direction
"change it"               → No clear instruction
"make it better"          → Ambiguous request
"new perspective"         → Too general
```

### **2. 🔄 Specify What to Preserve**

#### **✅ GOOD Preservation Terms:**
```
"same red car from the side"
"identical blue dress but profile view"
"same lighting but from above"
"same forest scene from ground level"
"same modern building from aerial view"
"same person with identical outfit, rear view"
```

#### **Key Preservation Words:**
- `same` / `identical` / `exact`
- `matching colors` / `consistent style`
- `preserve lighting` / `maintain mood`
- `keep all objects` / `same environment`

### **3. 📐 Use Directional Language**

#### **Horizontal Directions:**
```
"from the left side"
"from the right side" 
"facing left"
"facing right"
"profile view"
```

#### **Vertical Directions:**
```
"from above" / "overhead view"
"from below" / "looking up"
"eye level" / "at ground level"
"elevated perspective"
"low angle shot"
```

#### **Depth Directions:**
```
"from behind" / "rear view"
"from the front" / "frontal view"
"approaching view"
"receding view"
```

### **4. 🔍 Specify Detail Level**

#### **Close-up Prompts:**
```
"close-up of the car's front grille"
"macro detail of the flower petals"
"detailed view of the watch face"
"zoom in on the building's entrance"
```

#### **Wide Shot Prompts:**
```
"wide shot showing the full car"
"complete building in the frame"
"full body view of the same person"
"entire scene from further back"
```

### **5. 📷 Use Photography Terms**

#### **Professional Terms:**
```
"cinematic low angle shot"
"dramatic overhead perspective"
"architectural photography angle"
"portrait photography style"
"documentary perspective"
"commercial product shot"
```

---

## 🖼️ **Input Image Best Practices**

### **1. 📸 Image Quality Requirements**

#### **✅ OPTIMAL Images:**
- **Resolution**: 512x512 or higher (will be resized to 512x512)
- **File size**: Under 10MB
- **Format**: JPG, PNG, WEBP
- **Quality**: Sharp, well-focused
- **Lighting**: Even, not too dark or bright

#### **❌ AVOID These Issues:**
- Blurry or out-of-focus images
- Very dark or overexposed images
- Low resolution (under 256x256)
- Heavy compression artifacts
- Motion blur

### **2. 🎨 Lighting Considerations**

#### **✅ GOOD Lighting:**
```
Consistent lighting across all reference images
Natural daylight (best for color accuracy)
Even illumination without harsh shadows
Soft diffused light for portraits
Professional photography lighting
```

#### **❌ PROBLEMATIC Lighting:**
```
Mixed lighting types (fluorescent + natural)
Very harsh shadows or highlights
Extreme backlighting
Different color temperatures between images
Flash photography with hard shadows
```

### **3. 🏗️ Composition Guidelines**

#### **For Theme Preserve Mode:**
- **Single reference**: High-quality artistic or stylistic image
- **Multiple references**: Similar style and mood across all images
- **Focus**: Artistic consistency, mood, atmosphere

#### **For Multi-View Fusion Mode:**
- **2-4 reference images**: Different angles of the same subject
- **Consistency**: Same object, similar lighting across all images
- **Focus**: Object accuracy, viewpoint transformation

### **4. 🚗 Subject-Specific Guidelines**

#### **Cars/Vehicles:**
```
✅ GOOD:
- Clear view of the car without obstructions
- Similar backgrounds across reference images
- Consistent lighting and time of day
- Same car model and color
- Clean, well-maintained vehicle

❌ AVOID:
- Different car models mixed together
- Heavily modified vs stock versions
- Very different backgrounds
- Different weather conditions
- Dirty vs clean versions of same car
```

#### **Architecture/Buildings:**
```
✅ GOOD:
- Clear architectural details visible
- Similar weather/lighting conditions
- Same building from different angles
- Consistent color grading/exposure
- Professional architectural photography

❌ AVOID:
- Different seasons (winter vs summer)
- Construction/renovation differences
- Very different weather conditions
- Mixed day/night shots
- Different camera quality/styles
```

#### **People/Portraits:**
```
✅ GOOD:
- Same person in same outfit
- Consistent lighting setup
- Similar background or studio setting
- Same makeup/styling
- Professional portrait quality

❌ AVOID:
- Different outfits/styling
- Very different lighting setups
- Mixed indoor/outdoor shots
- Different facial expressions if identity matters
- Very different photo quality
```

#### **Products/Objects:**
```
✅ GOOD:
- Same product, identical model
- Consistent background/surface
- Professional product photography lighting
- Clean, unblemished products
- Similar angle ranges (not extreme opposites)

❌ AVOID:
- Different product variations/colors
- Very different backgrounds
- Mixed lighting setups
- Damaged vs pristine versions
- Extreme scale differences
```

---

## 🔧 **Mode Selection Guide**

### **When to Use Theme Preserve:**

#### **✅ Choose Theme Preserve For:**
```
• Artistic/creative photography
• Single high-quality reference image  
• Style and mood preservation priority
• Creative scene expansion
• Portrait photography with specific lighting
• Landscape/atmospheric scenes
```

#### **Example Scenarios:**
```
"Same mystical forest atmosphere but from ground level"
"Same dramatic portrait lighting but profile view"
"Same sunset mood but from hilltop perspective"
"Same vintage style but different composition"
```

### **When to Use Multi-View Fusion:**

#### **✅ Choose Multi-View Fusion For:**
```
• Product photography (different angles)
• Vehicle documentation  
• Architecture documentation
• Technical/commercial photography
• When you have 2+ reference angles
• Object accuracy is priority
```

#### **Example Scenarios:**
```
"Side view of the same red BMW"
"Aerial view of the same office building"
"Back view of the same smartphone"
"Rear perspective of the same person"
```

---

## 📊 **Parameter Recommendations**

### **For Different Prompt Types:**

#### **Subtle Changes (strength: 0.4-0.5):**
```
"same scene with slightly different lighting"
"same portrait but softer expression"
"same car but cleaner/shinier"
```

#### **Moderate Changes (strength: 0.5-0.65):**
```
"same car from side view"
"same building from street level"
"same person but profile view"
```

#### **Significant Changes (strength: 0.65-0.75):**
```
"same car from dramatically low angle"
"same building from aerial helicopter view"
"same object macro detail shot"
```

---

## 🧪 **Testing Your Setup**

### **Quick Quality Check:**
1. **Upload your reference image(s)**
2. **Try a simple test prompt**: "same [object] from side view"
3. **Check if the result**:
   - Shows the requested viewpoint ✅
   - Preserves colors and style ✅
   - Maintains object identity ✅

### **If Results Aren't Good:**

#### **Common Issues & Solutions:**
```
🔍 ISSUE: Output too similar to reference
💡 SOLUTION: Increase strength to 0.6-0.7, use more specific viewpoint terms

🔍 ISSUE: Output doesn't preserve theme
💡 SOLUTION: Use Theme Preserve mode, add "same style, same colors" to prompt

🔍 ISSUE: Object changes too much
💡 SOLUTION: Use Multi-View Fusion mode, lower strength to 0.5

🔍 ISSUE: Poor quality/artifacts
💡 SOLUTION: Use higher quality reference images, increase inference steps
```

---

## 💡 **Pro Tips for Optimal Results**

### **1. Progressive Refinement:**
```
Start simple: "side view of the same car"
If good: Add details: "side profile view showing the wheels clearly"
If needed: Add style: "side view, professional automotive photography"
```

### **2. Reference Image Strategy:**
```
Single image: Use Theme Preserve, focus on style preservation
2-3 images: Use Multi-View Fusion, ensure same subject
4+ images: Excellent for Multi-View, check consistency
```

### **3. Prompt Structure Template:**
```
[VIEWPOINT] + [SAME SUBJECT] + [STYLE PRESERVATION] + [DETAILS]

Example:
"Side view" + "of the same red car" + "same lighting and background" + "showing the door and wheel clearly"
```

### **4. Quality Validation:**
```
Before submitting:
✓ Are reference images sharp and well-lit?
✓ Is the prompt specific about viewpoint?
✓ Are preservation terms included?
✓ Is the right mode selected?
```

---

## 🎯 **Example Combinations That Work Well**

### **Car Photography:**
```
Reference: Front view of red sports car in parking lot
Prompt: "side profile view of the same red sports car, same parking lot background, same lighting, professional automotive photography"
Mode: Multi-View Fusion
Expected: Side view with matching color, background, lighting
```

### **Architecture:**
```
Reference: Street-level view of modern office building
Prompt: "aerial view from above of the same glass office building, same architectural details, bird's eye perspective"
Mode: Multi-View Fusion  
Expected: Overhead view showing building footprint and roof
```

### **Product Photography:**
```
Reference: Front view of smartphone on white background
Prompt: "back view of the same black smartphone, same white background, same professional lighting, product photography"
Mode: Multi-View Fusion
Expected: Rear view showing camera and Apple logo
```

### **Artistic Photography:**
```
Reference: Dramatic portrait with side lighting
Prompt: "same dramatic lighting mood but profile view, same artistic style, same background atmosphere"
Mode: Theme Preserve
Expected: Profile portrait with matching lighting and mood
```

**Follow these guidelines and you should see significantly better results from the image fusion system!**
