"""
Flask server for OCR and translation operations.

This server provides endpoints for performing OCR on images using DotsOCR model
and optional translation using LM Studio or OpenAI API.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import torch
import gc
from transformers import AutoModelForCausalLM, AutoProcessor
from surya.detection import DetectionPredictor
from utils import merge_overlapping_boxes, image_enhance, translate_text

app = Flask(__name__)
CORS(app)

print('Initializing models...')

# GPU configuration - Support CUDA, MPS, and CPU
if torch.cuda.is_available():
    device = "cuda"
    dtype = torch.bfloat16  # Use bfloat16 for CUDA
    print(f'✓ Using CUDA GPU: {torch.cuda.get_device_name(0)}')
elif torch.backends.mps.is_available():
    device = "mps"
    dtype = torch.float16  # MPS uses float16
    print('✓ Using Apple Silicon MPS')
else:
    device = "cpu"
    dtype = torch.float32  # CPU uses float32
    print('⚠️  Using CPU (slower performance)')

# Load models globally once at server startup
det_predictor = DetectionPredictor()

dotsocr_model_path = "weights/DotsOCR"

model = AutoModelForCausalLM.from_pretrained(
    dotsocr_model_path,
    torch_dtype=dtype,
    trust_remote_code=True,
    local_files_only=True
).to(device)

processor = AutoProcessor.from_pretrained(
    dotsocr_model_path,
    trust_remote_code=True,
    local_files_only=True
)

print('✓ Models ready')

PROMPT = """Extract the text content from this image."""


@app.route('/ocr', methods=['POST'])
def ocr_endpoint():
    """
    OCR endpoint that extracts and translates text from images.

    Expects:
        JSON with 'image' key containing base64-encoded image data
        JSON with optional 'target_lang' key for translation language

    Returns:
        JSON with extracted text, text blocks, and bounding boxes
    """
    print('=' * 50)

    try:
        data = request.get_json()
        image_data_url = data.get('image')
        target_lang = data.get('target_lang', 'Korean')  # Get target language, default to Korean

        print(f'Target translation language: {target_lang}')

        if not image_data_url:
            return jsonify({'error': 'No image'}), 400

        if ',' in image_data_url:
            image_data_url = image_data_url.split(',', 1)[1]

        image_bytes = base64.b64decode(image_data_url)
        image = Image.open(BytesIO(image_bytes))

        if image.mode != 'RGB':
            image = image.convert('RGB')

        image = image_enhance(image)

        print(f'Processing: {image.size}')

        # Step 1: Detect text bubbles with Surya
        print('🔍 Detecting text bubbles with Surya...')
        predictions = det_predictor([image])
        text_bboxes = merge_overlapping_boxes(predictions[0].bboxes, 10)

        # Filter out small bubbles
        MIN_WIDTH = 30
        MIN_HEIGHT = 30
        MIN_AREA = 900

        filtered_bboxes = []
        for bbox in text_bboxes:
            x1, y1, x2, y2 = bbox
            width = x2 - x1
            height = y2 - y1
            area = width * height

            if width >= MIN_WIDTH and height >= MIN_HEIGHT and area >= MIN_AREA:
                filtered_bboxes.append(bbox)

        text_bboxes = filtered_bboxes
        print(f'✓ Detected {len(text_bboxes)} text bubbles')

        # Step 2: Perform OCR on each bubble
        text_blocks = []

        for idx, bbox in enumerate(text_bboxes):
            x1, y1, x2, y2 = map(int, bbox)
            cropped = image.crop((x1, y1, x2, y2))

            print(f'🔄 OCR {idx + 1}/{len(text_bboxes)} at ({x1}, {y1}, {x2}, {y2})')

            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": cropped},
                        {"type": "text", "text": PROMPT}
                    ]
                }
            ]

            text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
            inputs = processor(text=[text], images=[cropped], padding=True, return_tensors="pt")

            # Move inputs to device with appropriate dtype
            inputs = {
                k: v.to(device).to(dtype) if isinstance(v, torch.Tensor) and v.dtype in [torch.float32, torch.bfloat16, torch.float16]
                else v.to(device) if isinstance(v, torch.Tensor)
                else v
                for k, v in inputs.items()
            }

            with torch.no_grad():
                generated_ids = model.generate(
                    **inputs,
                    max_new_tokens=64,
                    do_sample=False,
                    num_beams=1,
                )

            generated_ids_trimmed = [
                out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs['input_ids'], generated_ids)
            ]

            output_text = processor.batch_decode(
                generated_ids_trimmed,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False
            )[0]

            print(f'   Text: {output_text}')

            # Perform translation with selected target language
            print(f'🌐 Translating to {target_lang}...')
            translated_text = translate_text(output_text, target_lang=target_lang)
            print(f'   Translated: {translated_text}')

            # Use original text if translation fails
            display_text = translated_text if translated_text and translated_text != output_text else output_text

            # Store both original and translated text
            text_blocks.append({
                'text': display_text,  # Text to display (translated or original)
                'original_text': output_text,  # Original OCR text
                'translated_text': translated_text if translated_text != output_text else None,
                # Translation (only if successful)
                'bbox': {
                    'x0': x1,
                    'y0': y1,
                    'x1': x2,
                    'y1': y2
                },
                'type': 'text_bubble',
                'style': 'normal'
            })

            # Clean up tensors only (keep models)
            del inputs, generated_ids, generated_ids_trimmed

        # Clean up memory after processing all requests
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        elif torch.backends.mps.is_available():
            torch.mps.empty_cache()
        gc.collect()

        full_text = '\n'.join([b['text'] for b in text_blocks])  # Now contains translated text

        print(f'✓ Extracted and translated {len(text_blocks)} text blocks')
        print('=' * 50)

        return jsonify({
            'text': full_text,  # Translated text
            'text_blocks': text_blocks,  # Text field contains translated text
            'success': True,
            'bubbles_count': len(text_blocks)
        })

    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        print('=' * 50)
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print('Starting server on http://localhost:5000')
    app.run(host='localhost', port=5000, debug=True)
