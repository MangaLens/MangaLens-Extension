let processedImages = new Set();
let settings = {};
let processingQueue = [];
let isProcessing = false;
let failedImages = new Set();
let observedImages = new Set();
let currentUrl = window.location.href;
let isPageChanging = false;

(async function init() {
    settings = await chrome.storage.sync.get(['enabled']);
    if (!settings.enabled) return;

    await waitForLoad();
    await queueAllImages();
    setupPageChangeDetection();
    processQueue();
})();

function waitForLoad() {
    return new Promise(resolve => {
        if (document.readyState === 'complete') {
            setTimeout(resolve, 2000);
        } else {
            window.addEventListener('load', () => setTimeout(resolve, 2000));
        }
    });
}

async function queueAllImages() {
    const images = Array.from(document.querySelectorAll('img'));
    console.log(`[OCR] Found ${images.length} images`);

    let added = 0;
    let skipped = 0;

    for (const img of images) {
        const src = img.currentSrc || img.src;

        // ⭐ Pixiv: pximg.net만, 다른 사이트: 모든 이미지
        const isPixiv = window.location.hostname.includes('pixiv.net');
        if (isPixiv && (!src || !src.includes('pximg.net'))) {
            skipped++;
            continue;
        }

        // 로드 대기
        if (!img.complete && img.src) {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 2000);
                img.addEventListener('load', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
            });
        }

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (width > 200 && height > 200) {
            observedImages.add(img);
            processingQueue.push(img);
            added++;
        } else {
            skipped++;
        }
    }

    console.log(`[OCR] ✅ Queued ${added} images, skipped ${skipped}`);
}

function setupPageChangeDetection() {
    const observer = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
            console.log('[OCR] ⚠️  Page changed, stopping...');
            isPageChanging = true;
            processingQueue = [];
            currentUrl = window.location.href;
        }
    });

    observer.observe(document, { subtree: true, childList: true });

    window.addEventListener('beforeunload', () => {
        isPageChanging = true;
        processingQueue = [];
    });
}

async function processQueue() {
    if (isProcessing || processingQueue.length === 0) return;

    isProcessing = true;

    while (processingQueue.length > 0 && !isPageChanging) {
        const element = processingQueue.shift();

        console.log(`[Queue] ${observedImages.size - processingQueue.length}/${observedImages.size} (${processingQueue.length} left)`);

        try {
            await processImage(element);
        } catch (e) {
            console.error('[OCR] ❌ Fatal error:', e);
            failedImages.add(element);
        }

        if (isPageChanging) break;
    }

    isProcessing = false;

    if (!isPageChanging) {
        console.log('[OCR] ✅ All processed');
        console.log(`[Stats] Total: ${observedImages.size}, OK: ${processedImages.size}, Failed: ${failedImages.size}`);
    }
}

async function processImage(element) {
    if (isPageChanging || processedImages.has(element)) return;

    processedImages.add(element);
    element.classList.add('ocr-processing');

    const src = element.currentSrc || element.src;
    console.log(`[OCR] ${src.substring(0, 80)}...`);

    const imageData = await extractImageData(element);

    element.classList.remove('ocr-processing');

    if (!imageData || isPageChanging) {
        if (!imageData) {
            console.log(`[OCR] ❌ Extract failed`);
            failedImages.add(element);
        }
        return;
    }

    console.log(`[OCR] ✓ Extracted ${Math.round(imageData.length / 1024)}KB`);

    const result = await sendToOCRServer(imageData);

    if (isPageChanging) return;

    if (!result || !result.text_blocks || result.text_blocks.length === 0) {
        console.log('[OCR] ❌ OCR failed or no text');
        failedImages.add(element);
        return;
    }

    console.log(`[OCR] ✓ ${result.text_blocks.length} blocks`);

    const textBlocks = result.text_blocks.map(block => ({
        text: block.text,
        bbox: block.bbox,
        type: block.type,
        style: block.style
    }));

    await replaceTextInImage(element, textBlocks, textBlocks.map(b => b.text), imageData, false);

    console.log('[OCR] ✅ Done');
}

async function extractImageData(img) {
    if (isPageChanging) return null;

    return new Promise(async (resolve) => {
        try {
            let src = img.currentSrc || img.src;

            if (!src) {
                console.log('  No src');
                resolve(null);
                return;
            }

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;

            if (width < 200 || height < 200) {
                console.log(`  Too small: ${width}x${height}`);
                resolve(null);
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            // Direct draw 시도
            try {
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png', 0.95);
                console.log(`  ✓ Direct draw OK`);
                resolve(dataUrl);
                return;
            } catch (e) {
                console.log(`  Direct draw failed: ${e.message}`);
            }

            if (isPageChanging) {
                resolve(null);
                return;
            }

            // Background fetch
            try {
                console.log('  Trying background fetch...');
                const response = await chrome.runtime.sendMessage({
                    type: 'FETCH_IMAGE',
                    url: src,
                    referer: window.location.href
                });

                console.log('  Background response:', response);

                if (response && response.success && response.dataUrl) {
                    const fetchedImg = new Image();
                    fetchedImg.crossOrigin = 'anonymous';

                    const result = await new Promise((res) => {
                        const timeout = setTimeout(() => {
                            console.log('  Fetch timeout');
                            res(null);
                        }, 10000);

                        fetchedImg.onload = () => {
                            clearTimeout(timeout);
                            try {
                                canvas.width = fetchedImg.width;
                                canvas.height = fetchedImg.height;
                                ctx.drawImage(fetchedImg, 0, 0);
                                const dataUrl = canvas.toDataURL('image/png', 0.95);
                                console.log(`  ✓ Background fetch OK`);
                                res(dataUrl);
                            } catch (e) {
                                console.log(`  Background draw failed: ${e.message}`);
                                res(null);
                            }
                        };

                        fetchedImg.onerror = () => {
                            clearTimeout(timeout);
                            console.log('  Fetch image load failed');
                            res(null);
                        };

                        fetchedImg.src = response.dataUrl;
                    });

                    if (result) {
                        resolve(result);
                        return;
                    }
                }
            } catch (e) {
                console.log(`  Background fetch error: ${e.message}`);
            }

            console.log('  ❌ All methods failed');
            resolve(null);

        } catch (error) {
            console.error('  Extract error:', error);
            resolve(null);
        }
    });
}

async function sendToOCRServer(imageDataUrl) {
    if (isPageChanging) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        const response = await fetch('http://127.0.0.1:5000/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageDataUrl }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) return null;

        return await response.json();

    } catch (error) {
        return null;
    }
}

async function replaceTextInImage(element, textBlocks, translatedTexts, originalImageData, useTranslation) {
    if (isPageChanging) return;

    return new Promise((resolve) => {
        const img = new Image();

        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            textBlocks.forEach((block, idx) => {
                const bbox = block.bbox;
                const text = useTranslation && translatedTexts[idx] ? translatedTexts[idx] : block.text;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);

                const boxWidth = bbox.x1 - bbox.x0;
                const boxHeight = bbox.y1 - bbox.y0;
                const padding = Math.max(8, boxWidth * 0.05);

                let fontSize = Math.min(24, boxHeight * 0.4);
                let lines = [];

                for (let testSize = fontSize; testSize >= 10; testSize -= 1) {
                    ctx.font = `bold ${testSize}px "Noto Sans KR", Arial, sans-serif`;
                    lines = wrapText(ctx, text, boxWidth - padding * 2);

                    const totalHeight = lines.length * testSize + (lines.length - 1) * 3 + padding * 2;

                    if (totalHeight <= boxHeight) {
                        fontSize = testSize;
                        break;
                    }
                }

                ctx.fillStyle = 'black';
                ctx.font = `bold ${fontSize}px "Noto Sans KR", Arial, sans-serif`;
                ctx.textBaseline = 'top';
                ctx.textAlign = 'center';

                const x = bbox.x0 + boxWidth / 2;
                const lineHeight = fontSize + 3;
                const totalTextHeight = lines.length * lineHeight;
                let y = bbox.y0 + (boxHeight - totalTextHeight) / 2;

                lines.forEach((line, lineIdx) => {
                    const lineY = y + lineIdx * lineHeight;
                    if (lineY + fontSize <= bbox.y1) {
                        ctx.fillText(line, x, lineY);
                    }
                });
            });

            const newImageData = canvas.toDataURL('image/png');

            if (!element.dataset.original) {
                element.dataset.original = element.src;
                element.style.cursor = 'pointer';
                element.title = 'Click to toggle';

                element.addEventListener('click', function() {
                    if (this.dataset.showing === 'translated') {
                        this.src = this.dataset.original;
                        this.dataset.showing = 'original';
                    } else {
                        this.src = this.dataset.translated;
                        this.dataset.showing = 'translated';
                    }
                });
            }

            element.dataset.translated = newImageData;
            element.dataset.showing = 'translated';
            element.src = newImageData;

            resolve();
        };

        img.onerror = () => resolve();
        img.src = originalImageData;
    });
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) lines.push(currentLine);

    return lines.flatMap(line => line.includes('\n') ? line.split('\n') : [line]);
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled && changes.enabled.newValue) {
        location.reload();
    }
});
