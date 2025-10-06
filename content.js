let processedImages = new Set();
let settings = {};
let processingQueue = [];
let isProcessing = false;
let failedImages = new Set();
let observedImages = new Set();
let currentUrl = window.location.href;
let isPageChanging = false;
let imageObserver = null;

(async function init() {
    settings = await chrome.storage.sync.get(['enabled']);
    if (!settings.enabled) return;

    await waitForLoad();

    // ⭐ Pixiv 감지
    const isPixiv = window.location.hostname.includes('pixiv.net');

    if (isPixiv) {
        console.log('[OCR] Pixiv detected, using special handling');
        await handlePixivImages();
    } else {
        await queueAllImages();
    }

    // ⭐ 새로 추가되는 이미지 감지
    setupImageObserver(isPixiv);
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

// ⭐ 새로운 이미지 자동 감지 및 큐 추가
function setupImageObserver(isPixiv) {
    console.log('[OCR] Setting up image observer...');

    imageObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // 새로 추가된 노드 체크
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // img 태그 직접 추가
                    if (node.tagName === 'IMG') {
                        handleNewImage(node, isPixiv);
                    }
                    // 자식 중에 img 태그 있는지 확인
                    const images = node.querySelectorAll?.('img');
                    if (images) {
                        images.forEach(img => handleNewImage(img, isPixiv));
                    }
                }
            }

            // 속성 변경 (src, srcset 등)
            if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
                const img = mutation.target;
                // 이미 처리한 이미지가 아니면 다시 체크
                if (!observedImages.has(img) && !processedImages.has(img)) {
                    handleNewImage(img, isPixiv);
                }
            }
        }
    });

    imageObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'data-src']
    });
}

async function handleNewImage(img, isPixiv) {
    // 이미 처리 중이거나 처리된 이미지는 스킵
    if (observedImages.has(img) || processedImages.has(img)) {
        return;
    }

    console.log('[OCR] New image detected');

    if (isPixiv) {
        // Pixiv 이미지 처리
        let src = img.currentSrc || img.src || img.getAttribute('data-src');

        const srcset = img.getAttribute('srcset');
        if (srcset) {
            const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
            const pixivSources = sources.filter(s => s.includes('pximg.net'));
            if (pixivSources.length > 0) {
                src = pixivSources[pixivSources.length - 1];
            }
        }

        if (!src || !src.includes('pximg.net')) {
            return;
        }

        let originalSrc = src;
        if (src.includes('/c/')) {
            originalSrc = src.replace(/\/c\/\d+x\d+[^\/]*\//, '/');
        }
        originalSrc = originalSrc.replace(/_square\d+\./, '_master1200.');
        originalSrc = originalSrc.replace(/_custom\d+\./, '_master1200.');

        // 로드 대기
        if (!img.complete || img.naturalWidth === 0) {
            await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(), 5000);
                img.addEventListener('load', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
                if (img.complete && img.naturalWidth > 0) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        }

        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (width > 200 && height > 200) {
            observedImages.add(img);
            img.dataset.originalPixivSrc = originalSrc;
            processingQueue.push(img);
            console.log(`[OCR] ✓ New Pixiv image added (${width}x${height})`);

            // 큐 처리 시작 (이미 진행 중이면 무시됨)
            processQueue();
        }
    } else {
        // 일반 이미지 처리
        if (!img.complete) {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 2000);
                img.addEventListener('load', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
            });
        }

        if (img.naturalWidth > 200 && img.naturalHeight > 200) {
            observedImages.add(img);
            processingQueue.push(img);
            console.log(`[OCR] ✓ New image added (${img.naturalWidth}x${img.naturalHeight})`);

            // 큐 처리 시작
            processQueue();
        }
    }
}

async function handlePixivImages() {
    console.log('[OCR] Waiting for Pixiv images to load...');

    const images = Array.from(document.querySelectorAll('img'));
    console.log(`[OCR] Found ${images.length} img tags`);

    let added = 0;

    for (const img of images) {
        let src = img.currentSrc || img.src || img.getAttribute('data-src');

        const srcset = img.getAttribute('srcset');
        if (srcset) {
            const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
            const pixivSources = sources.filter(s => s.includes('pximg.net'));
            if (pixivSources.length > 0) {
                src = pixivSources[pixivSources.length - 1];
            }
        }

        if (!src || !src.includes('pximg.net')) {
            continue;
        }

        let originalSrc = src;

        if (src.includes('/c/')) {
            originalSrc = src.replace(/\/c\/\d+x\d+[^\/]*\//, '/');
            console.log(`[Pixiv] Upgrading thumbnail to full size`);
        }

        originalSrc = originalSrc.replace(/_square\d+\./, '_master1200.');
        originalSrc = originalSrc.replace(/_custom\d+\./, '_master1200.');

        console.log(`[Pixiv] Checking image: ${originalSrc.substring(0, 80)}`);

        // 로드 대기
        if (!img.complete || img.naturalWidth === 0) {
            console.log(`[Pixiv]   Waiting for load...`);
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log(`[Pixiv]   Load timeout`);
                    resolve();
                }, 5000);

                img.addEventListener('load', () => {
                    clearTimeout(timeout);
                    console.log(`[Pixiv]   Loaded`);
                    resolve();
                }, { once: true });

                // 이미 로드됨
                if (img.complete && img.naturalWidth > 0) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        }

        // 크기 체크
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        console.log(`[Pixiv]   Size: ${width}x${height}`);

        if (width > 200 && height > 200) {
            observedImages.add(img);
            // ⭐ 원본 URL을 저장
            img.dataset.originalPixivSrc = originalSrc;
            processingQueue.push(img);
            added++;
            console.log(`[Pixiv]   ✓ Added to queue`);
        } else {
            console.log(`[Pixiv]   ✗ Too small`);
        }
    }

    console.log(`[OCR] ✅ Added ${added} Pixiv images to queue`);
}

async function scrollToLoadImages() {
    // 스크롤 제거 - 불필요함
    return Promise.resolve();
}

async function queueAllImages() {
    const images = Array.from(document.querySelectorAll('img'));
    console.log(`[OCR] Found ${images.length} images, adding all to queue...`);

    let added = 0;

    for (const img of images) {
        if (!img.complete) {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 2000);
                img.addEventListener('load', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
            });
        }

        if (img.naturalWidth > 200 && img.naturalHeight > 200) {
            observedImages.add(img);
            processingQueue.push(img);
            added++;
        }
    }

    console.log(`[OCR] ✅ Added ${added} images to queue`);
}

function setupPageChangeDetection() {
    const observer = new MutationObserver(() => {
        if (window.location.href !== currentUrl) {
            console.log('[OCR] ⚠️  Page changed, stopping OCR...');
            isPageChanging = true;
            processingQueue = [];

            // Observer 정리
            if (imageObserver) {
                imageObserver.disconnect();
                imageObserver = null;
            }

            currentUrl = window.location.href;
        }
    });

    observer.observe(document, { subtree: true, childList: true });

    window.addEventListener('beforeunload', () => {
        console.log('[OCR] ⚠️  Page unloading, stopping OCR...');
        isPageChanging = true;
        processingQueue = [];
        if (imageObserver) {
            imageObserver.disconnect();
        }
    });

    window.addEventListener('popstate', () => {
        console.log('[OCR] ⚠️  Navigation detected, stopping OCR...');
        isPageChanging = true;
        processingQueue = [];
        if (imageObserver) {
            imageObserver.disconnect();
        }
    });
}

async function processQueue() {
    if (isProcessing || processingQueue.length === 0) return;

    isProcessing = true;

    while (processingQueue.length > 0 && !isPageChanging) {
        const element = processingQueue.shift();

        console.log(`[Queue] Processing ${observedImages.size - processingQueue.length}/${observedImages.size} (${processingQueue.length} remaining)`);

        try {
            await processImage(element);
        } catch (e) {
            console.error('[OCR] ❌ Fatal error:', e);
            failedImages.add(element);
        }

        if (isPageChanging) {
            console.log('[OCR] ⚠️  Stopped due to page change');
            break;
        }
    }

    isProcessing = false;

    if (processingQueue.length === 0 && !isPageChanging) {
        console.log('[OCR] ✅ All images processed');
        console.log(`[Stats] Total: ${observedImages.size}, Processed: ${processedImages.size}, Failed: ${failedImages.size}`);
    }
}

async function processImage(element) {
    if (isPageChanging) {
        console.log('[OCR] Skipping (page changing)');
        return;
    }

    if (processedImages.has(element)) {
        console.log('[OCR] Already processed, skipping');
        return;
    }
    processedImages.add(element);

    element.classList.add('ocr-processing');

    const src = element.currentSrc || element.src;
    console.log(`[OCR] Processing: ${src ? src.substring(0, 80) : 'no src'}...`);

    const imageData = await extractImageData(element);
    if (!imageData || isPageChanging) {
        element.classList.remove('ocr-processing');
        if (isPageChanging) console.log('[OCR] Stopped (page changing)');
        else {
            console.log('[OCR] ❌ Failed to extract image');
            failedImages.add(element);
        }
        return;
    }

    console.log(`[OCR] ✓ Extracted (${Math.round(imageData.length / 1024)}KB), sending to server...`);

    const result = await sendToOCRServer(imageData);

    if (isPageChanging) {
        element.classList.remove('ocr-processing');
        console.log('[OCR] Stopped (page changing)');
        return;
    }

    if (!result || !result.text_blocks) {
        element.classList.remove('ocr-processing');
        console.log('[OCR] ❌ OCR failed');
        failedImages.add(element);
        return;
    }

    if (result.text_blocks.length === 0) {
        console.log('[OCR] ⚠️  No text detected, skipping');
        element.classList.remove('ocr-processing');
        return;
    }

    console.log(`[OCR] ✓ Detected ${result.text_blocks.length} block(s)`);

    const textBlocks = result.text_blocks.map(block => ({
        text: block.text,
        bbox: block.bbox,
        type: block.type,
        style: block.style
    }));

    await replaceTextInImage(element, textBlocks, textBlocks.map(b => b.text), imageData, false);

    element.classList.remove('ocr-processing');
    console.log('[OCR] ✅ Done');
}

async function extractImageData(img) {
    if (isPageChanging) return null;

    return new Promise(async (resolve) => {
        try {
            // ⭐ Pixiv 전용: 저장된 원본 URL 사용
            let src = img.dataset.originalPixivSrc || img.currentSrc || img.src;

            if (!src || src === '' || src === 'about:blank') {
                resolve(null);
                return;
            }

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;

            if (width < 200 || height < 200) {
                resolve(null);
                return;
            }

            const isPixiv = src.includes('pximg.net');

            // ⭐ Pixiv: Offscreen document를 통한 처리
            if (isPixiv) {
                console.log('  Pixiv image detected, using offscreen document...');

                try {
                    const response = await chrome.runtime.sendMessage({
                        type: 'FETCH_IMAGE_OFFSCREEN',
                        url: src,
                        referer: window.location.href
                    });

                    if (response && response.success && response.dataUrl) {
                        console.log(`  ✓ Offscreen processing succeeded (${Math.round(response.size / 1024)}KB)`);
                        resolve(response.dataUrl);
                        return;
                    } else {
                        console.log('  ❌ Offscreen processing failed:', response?.error);
                    }
                } catch (e) {
                    console.log('  ❌ Offscreen processing error:', e.message);
                }

                // Offscreen 실패 시 fallback: 직접 시도
                console.log('  Trying direct copy as fallback...');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: false });
                canvas.width = width;
                canvas.height = height;

                try {
                    ctx.drawImage(img, 0, 0);
                    const dataUrl = canvas.toDataURL('image/png', 0.95);
                    console.log(`  ✓ Direct copy succeeded (${Math.round(dataUrl.length / 1024)}KB)`);
                    resolve(dataUrl);
                    return;
                } catch (e) {
                    console.log('  Direct copy failed:', e.message);
                }

                // 모든 방법 실패
                console.log('  ❌ All methods failed for Pixiv image');
                resolve(null);
                return;
            }

            // ⭐ 일반 이미지: 먼저 직접 시도
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: false });
            canvas.width = width;
            canvas.height = height;

            try {
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/png', 0.95);
                resolve(dataUrl);
                return;
            } catch (e) {
                console.log('  Direct draw failed:', e.message);
            }

            if (isPageChanging) {
                resolve(null);
                return;
            }

            try {
                console.log('  Trying background fetch...');
                const response = await chrome.runtime.sendMessage({
                    type: 'FETCH_IMAGE',
                    url: src,
                    referer: window.location.href
                });

                if (response && response.success && response.dataUrl) {
                    const fetchedImg = new Image();
                    fetchedImg.crossOrigin = 'anonymous';

                    const result = await new Promise((res) => {
                        const timeout = setTimeout(() => res(null), 10000);

                        fetchedImg.onload = () => {
                            clearTimeout(timeout);
                            try {
                                canvas.width = fetchedImg.width;
                                canvas.height = fetchedImg.height;
                                ctx.drawImage(fetchedImg, 0, 0);
                                res(canvas.toDataURL('image/png', 0.95));
                            } catch (e) {
                                res(null);
                            }
                        };

                        fetchedImg.onerror = () => {
                            clearTimeout(timeout);
                            res(null);
                        };

                        fetchedImg.src = response.dataUrl;
                    });

                    if (result) {
                        console.log('  ✓ Background fetch succeeded');
                        resolve(result);
                        return;
                    }
                }
            } catch (e) {
                console.log('  Background fetch error:', e.message);
            }

            resolve(null);

        } catch (error) {
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

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result;

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
