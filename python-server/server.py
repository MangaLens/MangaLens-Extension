from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import torch
import gc
from transformers import AutoModelForCausalLM, AutoProcessor
from surya.detection import DetectionPredictor
from utils import merge_overlapping_boxes, image_enhance

app = Flask(__name__)
CORS(app)

print('Initializing models...')

# GPU 설정
device = "mps" if torch.backends.mps.is_available() else "cpu"

# ⭐ 모델을 전역 변수로 한 번만 로딩 (서버 시작 시)
det_predictor = DetectionPredictor()

model_path = "weights/DotsOCR"

model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    trust_remote_code=True,
    local_files_only=True
).to(device)

processor = AutoProcessor.from_pretrained(
    model_path,
    trust_remote_code=True,
    local_files_only=True
)

# 번역 모델은 OpenAI API 사용
translator = None

def get_translator():
    """OpenAI API 연결 확인 (LM Studio 또는 실제 OpenAI)"""
    global translator
    if translator is None:
        print('Connecting to OpenAI API...')
        try:
            from openai import OpenAI

            # LM Studio의 로컬 서버 사용
            client = OpenAI(
                base_url="http://localhost:1234/v1",
                api_key="lm-studio"  # LM Studio는 API 키가 필요 없지만 형식상 필요
            )

            # 연결 테스트
            test_response = client.chat.completions.create(
                model="local-model",  # LM Studio는 모델명이 중요하지 않음
                messages=[{"role": "user", "content": "test"}],
                max_tokens=1
            )

            translator = {
                'type': 'openai',
                'client': client
            }
            print('✓ Connected to OpenAI API (LM Studio)')

        except Exception as e:
            print(f'⚠️  OpenAI API connection failed: {e}')
            print('   Make sure LM Studio is running with a model loaded on port 1234')
            return None
    return translator

print('✓ Models ready')

PROMPT = """Extract the text content from this image."""

def translate_text(text, target_lang="Korean"):
    """텍스트를 번역하는 함수 - OpenAI API 사용"""
    if not text or not text.strip():
        return text

    trans = get_translator()
    if trans is None:
        print('⚠️  Translation skipped - API not available')
        return text

    try:
        client = trans['client']

        response = client.chat.completions.create(
            model="local-model",  # LM Studio는 로드된 모델을 자동으로 사용
            messages=[
                {
                    "role": "user",
                    "content": f"Translate the following text into {target_lang}.\nText: {text}\n{target_lang}:"
                }
            ],
            temperature=0.1,
            max_tokens=256
        )

        translation = response.choices[0].message.content.strip()
        return translation

    except Exception as e:
        print(f'⚠️  Translation error: {e}')
        import traceback
        traceback.print_exc()
        return text

@app.route('/ocr', methods=['POST'])
def ocr_endpoint():
    print('=' * 50)

    try:
        data = request.get_json()
        image_data_url = data.get('image')

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

        # 1단계: Surya로 텍스트 버블 감지
        print('🔍 Detecting text bubbles with Surya...')
        predictions = det_predictor([image])
        text_bboxes = merge_overlapping_boxes(predictions[0].bboxes, 10)

        # 작은 버블 필터링
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

        # 2단계: 각 버블에 대해 OCR 수행
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

            inputs = {
                k: v.to(device).to(torch.float16) if isinstance(v, torch.Tensor) and v.dtype in [torch.float32, torch.bfloat16]
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

            # 번역 수행
            print(f'🌐 Translating...')
            translated_text = translate_text(output_text, target_lang="Korean")
            print(f'   Translated: {translated_text}')

            # 번역 실패 시 원문 사용
            display_text = translated_text if translated_text and translated_text != output_text else output_text

            # 번역된 텍스트를 표시 (원본은 보관만)
            text_blocks.append({
                'text': display_text,  # 화면에 표시될 텍스트 (번역본 또는 원문)
                'original_text': output_text,  # OCR 원본
                'translated_text': translated_text if translated_text != output_text else None,  # 번역본 (성공 시만)
                'bbox': {
                    'x0': x1,
                    'y0': y1,
                    'x1': x2,
                    'y1': y2
                },
                'type': 'text_bubble',
                'style': 'normal'
            })

            # ⭐ 텐서만 삭제 (모델은 유지)
            del inputs, generated_ids, generated_ids_trimmed

        # ⭐ 요청 처리 후 한 번만 메모리 정리
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        gc.collect()

        full_text = '\n'.join([b['text'] for b in text_blocks])  # 이제 번역된 텍스트

        print(f'✓ Extracted and translated {len(text_blocks)} text blocks')
        print('=' * 50)

        return jsonify({
            'text': full_text,  # 번역된 텍스트
            'text_blocks': text_blocks,  # text 필드에 번역본이 들어있음
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
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print('Starting server on http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=True)