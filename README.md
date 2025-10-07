# AnythingTranslate OCR

A powerful Chrome extension that automatically detects, recognizes, and translates text in images on web pages using advanced OCR technology.

> **⚠️ IMPORTANT LICENSE NOTICE:** This project uses Surya, which has commercial use restrictions for companies with >$2M revenue/funding. See [License](#-license) section below.

## 🌟 Features

- **Automatic Image Detection**: Automatically finds and processes images on web pages
- **Advanced OCR**: Uses dots.ocr model for high-quality multilingual text recognition
- **Multi-language Translation**: Supports translation to Korean, English, Japanese, Chinese, and more
- **Smart Text Overlay**: Replaces original text with translated text directly on images
- **Pixiv Support**: Special handling for Pixiv images with CORS bypass via Offscreen API
- **Click to Toggle**: Click on translated images to switch between original and translated versions
- **Real-time Processing**: Monitors dynamically loaded images automatically
- **GPU Acceleration**: Supports CUDA and Apple Silicon (MPS) for faster processing

## 🎯 Supported Target Languages

Translation is powered by LM Studio (local) or any OpenAI-compatible API:

- 🇰🇷 Korean (한국어)
- 🇺🇸 English
- 🇯🇵 Japanese (日本語)
- 🇨🇳 Chinese (中文)
- 🇪🇸 Spanish (Español)
- 🇫🇷 French (Français)
- 🇩🇪 German (Deutsch)
- 🇵🇹 Portuguese (Português)
- 🇷🇺 Russian (Русский)
- 🇮🇹 Italian (Italiano)

## 🚀 Installation

### Prerequisites

- **Python 3.9+** ([Download Python](https://www.python.org/downloads/))
- **Chrome Browser** ([Download Chrome](https://www.google.com/chrome/))
- **Git** ([Download Git](https://git-scm.com/downloads))
- **CUDA-capable GPU** (optional, but recommended for better performance)
- **LM Studio** (optional, for translation feature) - [Download LM Studio](https://lmstudio.ai/)

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/AnythingTranslate-ocr.git
cd MangaLens-Extension
```

### Step 2: Install Python Dependencies

#### For CUDA (NVIDIA GPU):

```bash
cd python-server

# Install PyTorch with CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install other dependencies
pip install -r requirements.txt
```

#### For Apple Silicon (M1/M2/M3):

```bash
cd python-server

# Install PyTorch for Apple Silicon
pip install torch torchvision torchaudio

# Install other dependencies  
pip install -r requirements.txt
```

#### For CPU only:

```bash
cd python-server
pip install -r requirements.txt
```

### Step 3: Download OCR Models

#### dots.ocr Model

**Official Repository:** [rednote-hilab/dots.ocr](https://github.com/rednote-hilab/dots.ocr)

**⚠️ CRITICAL: Directory Naming**
- Model directory MUST NOT contain periods (`.`)
- ✓ Correct: `DotsOCR`
- ✗ Wrong: `dots.ocr`

This is a temporary requirement pending integration with Transformers.

***

**Option 1 - Automatic Download (Recommended):**

```bash
cd python-server

# Install download dependencies
pip install huggingface-hub

# Download from Hugging Face
python tools/download_model.py

# Or download from ModelScope (China)
pip install modelscope
python tools/download_model.py --type modelscope
```

The model will be saved to: `python-server/weights/DotsOCR/`

***

**Option 2 - Manual Download:**

1. **From Hugging Face:**
    - Visit [rednote-hilab/dots.ocr](https://huggingface.co/rednote-hilab/dots.ocr)
    - Click "Files and versions" tab
    - Download all files
    - Place in: `python-server/weights/DotsOCR/`

2. **From ModelScope (China users):**
    - Visit [AI-ModelScope/dots.ocr](https://www.modelscope.cn/models/AI-ModelScope/dots.ocr)
    - Download model files
    - Place in: `python-server/weights/DotsOCR/`

***

**Option 3 - Using Git LFS:**

```bash
cd python-server/weights

# Install Git LFS if not already installed
# macOS: brew install git-lfs
# Ubuntu: sudo apt-get install git-lfs
# Windows: Download from https://git-lfs.github.com/

git lfs install

# Clone the model repository
git clone https://huggingface.co/rednote-hilab/dots.ocr

# ⚠️ Rename directory (remove period!)
mv dots.ocr DotsOCR
```

***

**Verify Installation:**

After downloading, your directory structure should look like:

```
python-server/
└── weights/
    └── DotsOCR/           ← No periods!
        ├── config.json
        ├── model.safetensors
        ├── tokenizer_config.json
        ├── tokenizer.json
        └── ... (other files)
```

***

#### Surya Model (Text Detection)

Surya is automatically installed via pip:

```bash
pip install surya-ocr>=0.6.0
```

No manual download needed! ✅

The model weights will be automatically downloaded on first use to:
- Linux/Mac: `~/.cache/huggingface/hub/`
- Windows: `C:\Users\<username>\.cache\huggingface\hub\`

### Step 4: Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right corner)
3. Click **"Load unpacked"**
4. Select the **project root directory** (folder containing `manifest.json`)
5. The extension icon should appear in your Chrome toolbar

### Step 5: Start the OCR Server

```bash
cd python-server
python server.py
```

You should see:

```
Initializing models...
✓ Models ready
Starting server on http://127.0.0.1:5000
 * Running on http://127.0.0.1:5000
```

The server will start on `http://127.0.0.1:5000`

> 💡 **Tip**: Keep this terminal window open while using the extension!

### Step 6: (Optional) Set Up Translation with LM Studio

For translation features, install and run LM Studio:

#### Install LM Studio:

1. **Download** [LM Studio](https://lmstudio.ai/) for your OS
    - Windows: Click "Download LM Studio for Windows"
    - macOS: Click "Download LM Studio for Mac"
    - Linux: AppImage available

2. **Install** and open LM Studio

#### Download a Translation Model:

1. Open LM Studio
2. Click **"Search"** (🔍 icon on left)
3. Search for a translation model (recommended):
    - `TowerInstruct-7B-v0.2` (multilingual translation)
    - `Llama-3-8B-Instruct` (general purpose)
    - `Qwen2.5-7B-Instruct` (excellent for Asian languages)

4. Click **"Download"** and wait for completion

#### Start the Local Server:

1. Click **"Local Server"** tab (↔️ icon)
2. Select your downloaded model from dropdown
3. Click **"Start Server"**
4. Make sure port is set to **1234**

> ✅ Once started, the extension will automatically use LM Studio for translation!

## 📖 Usage

### Quick Start

1. **Enable the Extension**:
    - Click the extension icon in Chrome toolbar
    - Click **"Enable Auto-Translate"** button
    - Verify server status shows green ✓

2. **Browse**:
    - Visit any webpage with images (e.g., manga sites, Twitter, Pixiv)
    - The extension will automatically detect and translate text in images

3. **Toggle View**:
    - Click on any translated image to switch between original and translated versions

### Advanced Usage

#### Manually Process an Image (Pixiv):

If automatic detection fails (e.g., on Pixiv due to CORS):

1. Right-click and **save the image** to your computer
2. Click the extension icon
3. Click **"Choose File"** under "Upload Image"
4. Select the saved image
5. Click **"Process Uploaded Image"**

#### Monitor Processing:

Open Chrome DevTools (F12) to see real-time logs:

```
[OCR] Found 5 images
[Queue] Processing 1/5 (4 remaining)
[OCR] ✓ Detected 3 text blocks
[OCR] ✅ Done
```

### Supported Websites

- ✅ **Manga sites** (mangakakalot, mangadex, etc.)
- ✅ **Twitter/X** images
- ✅ **Reddit** image posts
- ✅ **Pixiv** (via upload or offscreen API)
- ✅ **Most image hosting sites**
- ✅ **E-commerce sites** with product images

## 🛠️ Technical Stack

### Frontend (Chrome Extension)
- **Vanilla JavaScript** - No frameworks, lightweight
- **Chrome Extension Manifest V3** - Latest standard
- **Offscreen API** - For CORS bypass (Pixiv support)
- **Canvas API** - Image manipulation

### Backend (Python Server)
- **Flask** - REST API server
- **PyTorch** - Deep learning inference
- **dots.ocr** - State-of-the-art multilingual OCR (1.7B parameters)
- **Surya** - Text region detection
- **PIL/Pillow** - Image preprocessing
- **OpenAI API** - Translation (via LM Studio)

### Models

| Model | Purpose | License | Size |
|-------|---------|---------|------|
| **dots.ocr** | Text recognition | MIT ✅ | ~3.4GB |
| **Surya** | Text detection | AI PUBS OPEN RAIL-M ⚠️ | ~450MB |
| **LM Studio** | Translation (optional) | Model-specific | Varies |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ Content.js  │───▶│ Background.js│───▶│ Offscreen │ │
│  │  (Detect)   │    │  (Messaging) │    │  (CORS)   │ │
│  └─────────────┘    └──────────────┘    └───────────┘ │
│         │                                      │        │
└─────────┼──────────────────────────────────────┼────────┘
          │                                      │
          ▼                                      ▼
    ┌──────────────────────────────────────────────┐
    │           Flask Server (Python)               │
    │  ┌────────────┐         ┌─────────────┐     │
    │  │   Surya    │────────▶│  dots.ocr   │     │
    │  │ (Detect)   │         │    (OCR)    │     │
    │  └────────────┘         └─────────────┘     │
    └──────────────────┬───────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   LM Studio     │
              │  (Translation)  │
              └─────────────────┘
```

## 🎨 Configuration

### Extension Settings

Access settings by clicking the extension icon:

- **Enable/Disable**: Toggle automatic OCR processing
- **Server Status**: Check if Python server is running
- **Manual Upload**: Process individual images

### Server Configuration

Edit `python-server/server.py` to customize:

#### Image Enhancement:

```python
def image_enhance(image: Image.Image) -> Image.Image:
    """Enhance image quality before OCR"""
    # Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.8)  # Adjust: 1.0-2.0
    
    # Sharpen image
    sharpness = ImageEnhance.Sharpness(image)
    image = sharpness.enhance(1.5)  # Adjust: 1.0-2.0
    
    return image
```

#### Bbox Filter Settings:

```python
# Minimum text bubble dimensions
MIN_WIDTH = 30   # pixels
MIN_HEIGHT = 30  # pixels
MIN_AREA = 900   # square pixels
```

#### GPU/CPU Selection:

```python
# Force CPU mode
device = "cpu"
dtype = torch.float32

# Or use GPU (auto-detect)
device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
```

### LM Studio Configuration

Edit translation prompt in `server.py`:

```python
def translate_text(text, target_lang="Korean"):
    response = client.chat.completions.create(
        model="local-model",
        messages=[{
            "role": "user",
            "content": f"Translate to {target_lang}:\n{text}"
        }],
        temperature=0.1,  # Lower = more consistent
        max_tokens=256
    )
```

## 🔧 Development

### Project Structure

```
AnythingTranslate-ocr/
├── chome-extention/       # Chrome extension files
│   ├── manifest.json      # Extension manifest
│   ├── background.js      # Background service worker
│   ├── content.js         # Content script (main OCR logic)
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup controller
│   ├── offscreen.html     # Offscreen document (CORS bypass)
│   ├── offscreen.js       # Offscreen image processor
│   ├── overlay.css        # Translated text overlay styles
│   ├── rules.json         # Declarative net request rules (Pixiv)
│   └── icons/             # Extension icons
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── python-server/         # OCR backend server
│   ├── server.py          # Flask OCR server
│   ├── utils.py           # Helper functions
│   ├── requirements.txt   # Python dependencies
│   └── weights/           # Model weights directory
│       └── DotsOCR/       # DotsOCR model files
├── chome-extention.crx    # Pre-built extension package
├── chome-extention.pem    # Private key (DO NOT SHARE)
├── LICENSE                # License information
└── README.md              # This file
```

### Building for Distribution

**Already have a pre-built CRX file?** Users can download `chome-extention.crx` and install it directly - see [Quick Installation](#quick-installation-using-pre-built-crx) above.

#### Building Your Own CRX (For Developers)

1. **Prepare the extension:**
```bash
# Remove unnecessary files from chome-extention folder
cd chome-extention
rm -rf _metadata .DS_Store
cd ..
```

2. **Pack in Chrome:**
   - Open `chrome://extensions/`
   - Enable **"Developer mode"**
   - Click **"Pack extension"**
   - **Extension root directory:** Select the `chome-extention/` folder
   - **Private key file:** Leave empty (first time) or select existing `chome-extention.pem`
   - Click **"Pack Extension"**

3. **You'll get two files in parent directory:**
```
chome-extention.crx  ← Share this with users
chome-extention.pem  ← Keep this SECRET (for updates)
```

**⚠️ IMPORTANT:** 
- Keep the `.pem` file safe - never share it or commit to Git (it's in `.gitignore`)
- Use the same `.pem` for future updates
- Users just drag-and-drop the `.crx` file to install

---

#### Alternative: ZIP for Chrome Web Store

If you want to publish on Chrome Web Store:

```bash
# Create clean ZIP from the extension folder
cd chome-extention
zip -r ../MangaLens-Extension.zip . \
  -x "_metadata/*" \
  -x "*.DS_Store"
cd ..
```

Upload this ZIP to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

### Testing

1. **Load the extension** in Chrome (Developer Mode)
2. **Open DevTools** (F12) on any webpage
3. **Monitor console logs**:
    - `[OCR]` - Content script logs
    - `[Background]` - Service worker logs
    - `[Offscreen]` - Offscreen document logs
4. **Check Python server** terminal for OCR logs

#### Test on Sample Sites:

- **Manga**: https://mangadex.org/
- **Twitter**: https://twitter.com/search?q=%23漫画
- **Reddit**: https://www.reddit.com/r/manga/

## 🐛 Troubleshooting

### Server Not Running

```
❌ Server not running. Run: python server.py
```

**Solutions:**
1. Navigate to `python-server/` directory
2. Run `python server.py`
3. Check for port conflicts (port 5000)
4. Verify Python dependencies: `pip install -r requirements.txt`

**Test server:**
```bash
curl http://127.0.0.1:5000/health
# Should return: {"status":"ok"}
```

### Model Not Found

```
❌ Error: Model not found in weights/DotsOCR/
```

**Solutions:**
1. Make sure you downloaded the model (see Step 3)
2. Check directory name has NO periods: `DotsOCR` not `dots.ocr`
3. Verify files exist: `ls python-server/weights/DotsOCR/`

### CUDA/GPU Issues

**Error:** `CUDA out of memory` or `RuntimeError: No CUDA GPUs are available`

**Solutions:**

```python
# In server.py, force CPU mode
device = "cpu"
dtype = torch.float32
```

Or reduce batch size / image size:

```python
MAX_SIZE = 1000  # Reduce from 1500
```

### Translation Not Working

**Symptoms:** Images processed but text not translated (stays in original language)

**Checklist:**
1. ✅ LM Studio is running
2. ✅ Model is loaded in LM Studio
3. ✅ Local server started on port **1234**
4. ✅ Check Python terminal for translation logs

**Test translation:**
```python
# In Python terminal
from openai import OpenAI
client = OpenAI(base_url="http://localhost:1234/v1", api_key="test")
response = client.chat.completions.create(
    model="local-model",
    messages=[{"role": "user", "content": "Hello"}],
    max_tokens=10
)
print(response.choices[0].message.content)
```

### Images Not Processing

**Check:**
- Extension is **enabled** (green checkmark in popup)
- Image size is **> 100x100 pixels**
- Python server is **running and accessible**
- Console for error messages (F12)

**Common Issues:**

1. **No images detected:**
    - Wait 2-3 seconds for page load
    - Check if images are lazy-loaded (scroll down)

2. **CORS errors (Pixiv):**
    - Use the **"Upload Image"** feature in popup
    - Or wait for offscreen API to fetch the image

3. **OCR returns no text:**
    - Image may have no readable text
    - Try adjusting image enhancement settings

### Pixiv Specific Issues

**Problem:** Images on Pixiv fail to process

**Solutions:**

1. **Method 1 - Upload manually:**
    - Right-click image → Save As
    - Click extension icon → Upload Image
    - Process offline

2. **Method 2 - Check offscreen:**
    - Open `chrome://extensions`
    - Find AnythingTranslate OCR
    - Click "service worker" to check logs
    - Verify offscreen document is created

## 📊 Performance

### Processing Speed (per image)

| Hardware | Speed | Notes |
|----------|-------|-------|
| **Apple M1/M2/M3** | 2-5 sec | Via MPS acceleration |
| **NVIDIA RTX 30 Series** | 1-3 sec | Via CUDA |
| **NVIDIA GTX 10 Series** | 3-7 sec | Older GPU |
| **Intel/AMD CPU** | 5-15 sec | Slower but works |

### Accuracy

- ✅ **High accuracy** on manga/comic text (90%+)
- ✅ **Excellent** for Japanese, English, Korean
- ✅ **Good** for Chinese, Thai, Russian
- ⚠️ **Moderate** for cursive/handwritten text
- ⚠️ **Lower** on low-resolution images

### Resource Usage

| Component | RAM | VRAM | Storage |
|-----------|-----|------|---------|
| dots.ocr Model | ~1GB | ~3GB | 3.4GB |
| Surya Model | ~500MB | ~400MB | 450MB |
| LM Studio (7B) | ~8GB | ~8GB | 4-7GB |
| **Total** | ~9.5GB | ~11.4GB | ~8-11GB |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Guidelines

1. **Code Style:**
    - JavaScript: Use JSDoc comments
    - Python: Follow PEP 8, use docstrings

2. **Testing:**
    - Test on multiple websites
    - Verify on different image types
    - Check both CPU and GPU modes

3. **Documentation:**
    - Update README if adding features
    - Add inline comments for complex logic
    - Include usage examples

### How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project code (extension + server) is licensed under the **MIT License**.

**However**, this project depends on third-party models with different licenses:

### Model Licenses

| Model | License | Commercial Use |
|-------|---------|----------------|
| **dots.ocr** | MIT License | ✅ Unrestricted |
| **Surya** | AI PUBS OPEN RAIL-M | ⚠️ Restricted (see below) |

### ⚠️ Important for Commercial Users

**Surya License Restrictions:**

If your organization has:
- **>$2M annual revenue** in the prior year, OR
- **>$2M total funding** raised

You can **ONLY** use this software for:
- ✅ Personal use
- ✅ Research purposes
- ✅ Internal testing

**Commercial use requires a separate license from Surya.**

For commercial licensing inquiries:
- **Contact:** Vik Paruchuri (Surya creator)
- **GitHub:** [VikParuchuri/surya](https://github.com/VikParuchuri/surya)

### Summary

- **Individuals**: ✅ Free to use for any purpose
- **Small companies (<$2M)**: ✅ Free to use
- **Large companies (>$2M)**: ⚠️ Need commercial license for Surya

👉 **See [LICENSE](LICENSE) file for complete details.**

## 🙏 Acknowledgments

- **dots.ocr** - Multilingual OCR model by Xiaohongshu AI Lab  
  [GitHub](https://github.com/rednote-hilab/dots.ocr)

- **Surya** - Document OCR toolkit by Vik Paruchuri  
  [GitHub](https://github.com/VikParuchuri/surya)

- **LM Studio** - Local LLM inference platform  
  [Website](https://lmstudio.ai/)

- **Flask** - Python web framework  
  [Website](https://flask.palletsprojects.com/)

- **PyTorch** - Deep learning framework  
  [Website](https://pytorch.org/)

Special thanks to the open-source AI community! 💙

## 📞 Support

For issues and questions:
- 🐛 **Bug Reports:** [Open an issue](https://github.com/yourusername/AnythingTranslate-ocr/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/AnythingTranslate-ocr/discussions)
- 📖 **Documentation:** Check existing issues first

## 🔮 Roadmap

### Planned Features

- [ ] **Firefox & Edge support** - Cross-browser compatibility
- [ ] **Batch processing mode** - Process multiple images at once
- [ ] **Custom translation APIs** - Google Translate, DeepL integration
- [ ] **Text editing** - Edit translations before applying
- [ ] **Export functionality** - Save translated images
- [ ] **Vertical text support** - Better handling of vertical Asian text
- [ ] **OCR confidence threshold** - Filter low-confidence results
- [ ] **Multiple translation providers** - Switch between APIs
- [ ] **Dark mode UI** - Extension popup dark theme
- [ ] **Keyboard shortcuts** - Quick enable/disable, manual process

### Future Improvements

- [ ] Offline translation models
- [ ] Real-time video subtitle translation
- [ ] PDF document processing
- [ ] Custom model training interface
- [ ] Multi-user server mode
- [ ] Cloud deployment option

Vote on features in [GitHub Discussions](https://github.com/yourusername/AnythingTranslate-ocr/discussions)!

## 📝 Changelog

### Version 1.0.0 (2025-10-07)

**Initial Release** 🎉

- ✅ Multi-language OCR support (90+ languages via dots.ocr)
- ✅ Automatic image detection and processing
- ✅ Real-time translation via LM Studio
- ✅ Pixiv support with offscreen API
- ✅ GPU acceleration (CUDA, Apple Silicon)
- ✅ Click-to-toggle original/translated view
- ✅ Chrome Extension Manifest V3
- ✅ Flask REST API server
- ✅ Comprehensive error handling
- ✅ Manual image upload feature

***

**Made with ❤️ for the manga/comic translation community**

*Read manga in your language, anywhere, anytime!* 🌍📚

출처
