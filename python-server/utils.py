"""
Utility functions for OCR and translation operations.

This module provides helper functions for image processing, bounding box operations,
and text translation using OpenAI API or LM Studio.
"""

from typing import List, Dict, Optional, Tuple, Any
from PIL import Image, ImageEnhance
from openai import OpenAI

# Type aliases for better code readability
BoundingBox = Tuple[float, float, float, float]  # (x_min, y_min, x_max, y_max)
TextBlock = Dict[str, Any]  # Dictionary containing text, bbox, and metadata
ImageSplit = Dict[str, Any]  # Dictionary containing image split information
TranslatorDict = Dict[str, Any]  # Dictionary containing translator type and client


def boxes_close(
    box1: BoundingBox,
    box2: BoundingBox,
    distance_threshold: float
) -> bool:
    """
    Check if two bounding boxes overlap or are close to each other.

    Args:
        box1: Tuple of (x_min, y_min, x_max, y_max) for the first box
        box2: Tuple of (x_min, y_min, x_max, y_max) for the second box
        distance_threshold: Maximum distance to consider boxes as close

    Returns:
        True if boxes overlap or are within the distance threshold
    """
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2

    # Calculate overlapping area
    x_overlap = max(0, min(x1_max, x2_max) - max(x1_min, x2_min))
    y_overlap = max(0, min(y1_max, y2_max) - max(y1_min, y2_min))

    # Return True if boxes already overlap
    if x_overlap > 0 and y_overlap > 0:
        return True

    # Calculate distance if boxes don't overlap
    # Horizontal distance
    if x1_max < x2_min:
        x_distance = x2_min - x1_max
    elif x2_max < x1_min:
        x_distance = x1_min - x2_max
    else:
        x_distance = 0

    # Vertical distance
    if y1_max < y2_min:
        y_distance = y2_min - y1_max
    elif y2_max < y1_min:
        y_distance = y1_min - y2_max
    else:
        y_distance = 0

    # Consider boxes close if diagonal distance is below threshold
    diagonal_distance = (x_distance ** 2 + y_distance ** 2) ** 0.5
    return diagonal_distance <= distance_threshold


def merge_overlapping_boxes(
    bboxes: List[Any],
    distance_threshold: int = 10
) -> List[List[float]]:
    """
    Merge overlapping or nearby bounding boxes.

    Args:
        bboxes: List of bounding box objects with .bbox attribute
        distance_threshold: Maximum distance to consider boxes for merging (default: 10)

    Returns:
        List of merged bounding boxes in [x_min, y_min, x_max, y_max] format
    """
    if not bboxes:
        return []

    # Convert bbox list to [x_min, y_min, x_max, y_max] format
    boxes = [bbox.bbox for bbox in bboxes]
    merged = []
    used = [False] * len(boxes)

    for i in range(len(boxes)):
        if used[i]:
            continue

        current_box = list(boxes[i])
        used[i] = True
        merged_any = True

        # Keep merging until no more boxes can be merged
        while merged_any:
            merged_any = False
            for j in range(len(boxes)):
                if used[j]:
                    continue

                if boxes_close(current_box, boxes[j], distance_threshold):
                    # Create minimum bounding box that contains both boxes
                    current_box = [
                        min(current_box[0], boxes[j][0]),  # x_min
                        min(current_box[1], boxes[j][1]),  # y_min
                        max(current_box[2], boxes[j][2]),  # x_max
                        max(current_box[3], boxes[j][3])  # y_max
                    ]
                    used[j] = True
                    merged_any = True

        merged.append(current_box)

    return merged


def split_large_image_with_overlap(
    image: Image.Image,
    max_size: int = 1500,
    overlap: int = 750
) -> List[ImageSplit]:
    """
    Split a large image into a grid with overlapping regions.

    This is useful for processing large images that exceed model size limits
    while maintaining continuity at boundaries.

    Args:
        image: PIL Image object to split
        max_size: Maximum dimension for each split (default: 1500)
        overlap: Overlap size between adjacent splits (default: 750)

    Returns:
        List of dictionaries containing:
            - image: Cropped PIL Image
            - offset: (x, y) offset in original image
            - grid: (row, col) position in grid
            - size: (width, height) of the cropped region
    """
    width, height = image.size

    if width <= max_size and height <= max_size:
        return [{'image': image, 'offset': (0, 0), 'grid': (0, 0)}]

    stride = max_size - overlap
    cols = (width - overlap + stride - 1) // stride
    rows = (height - overlap + stride - 1) // stride

    print(f'🔲 Splitting image: {cols}x{rows} grid (overlap: {overlap}px)')

    splits = []
    for row in range(rows):
        for col in range(cols):
            x_start = col * stride
            y_start = row * stride
            x_end = min(x_start + max_size, width)
            y_end = min(y_start + max_size, height)

            # Adjust last column/row to align with image boundary
            if col == cols - 1:
                x_start = max(0, width - max_size)
            if row == rows - 1:
                y_start = max(0, height - max_size)

            cropped = image.crop((x_start, y_start, x_end, y_end))

            splits.append({
                'image': cropped,
                'offset': (x_start, y_start),
                'grid': (row, col),
                'size': (x_end - x_start, y_end - y_start)
            })

    return splits


def remove_duplicate_boxes(
    all_boxes: List[TextBlock],
    iou_threshold: float = 0.7
) -> List[TextBlock]:
    """
    Remove duplicate bounding boxes in overlapping regions using IoU (Intersection over Union).

    Args:
        all_boxes: List of dictionaries containing 'bbox' key with bounding box coordinates
        iou_threshold: IoU threshold for considering boxes as duplicates (default: 0.7)

    Returns:
        List of unique bounding boxes after duplicate removal
    """
    if not all_boxes:
        return []

    def calculate_iou(box1: BoundingBox, box2: BoundingBox) -> float:
        """Calculate Intersection over Union (IoU) between two boxes."""
        x1_min, y1_min, x1_max, y1_max = box1
        x2_min, y2_min, x2_max, y2_max = box2

        x_left = max(x1_min, x2_min)
        y_top = max(y1_min, y2_min)
        x_right = min(x1_max, x2_max)
        y_bottom = min(y1_max, y2_max)

        if x_right < x_left or y_bottom < y_top:
            return 0.0

        intersection = (x_right - x_left) * (y_bottom - y_top)
        area1 = (x1_max - x1_min) * (y1_max - y1_min)
        area2 = (x2_max - x2_min) * (y2_max - y2_min)
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0

    # Sort boxes by area in descending order (keep larger boxes first)
    sorted_boxes = sorted(
        all_boxes,
        key=lambda b: (b['bbox'][2] - b['bbox'][0]) * (b['bbox'][3] - b['bbox'][1]),
        reverse=True
    )

    kept = []
    for box in sorted_boxes:
        is_duplicate = False
        for kept_box in kept:
            if calculate_iou(box['bbox'], kept_box['bbox']) > iou_threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            kept.append(box)

    print(f'🔍 Deduplication: {len(all_boxes)} → {len(kept)} (removed: {len(all_boxes) - len(kept)})')
    return kept


def image_enhance(image: Image.Image) -> Image.Image:
    """
    Enhance image quality for better OCR performance.

    Applies contrast and sharpness enhancements to improve text recognition.

    Args:
        image: PIL Image object to enhance

    Returns:
        Enhanced PIL Image object
    """
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.8)

    # Enhance sharpness
    sharpness = ImageEnhance.Sharpness(image)
    image = sharpness.enhance(1.5)

    return image


def translate_text(
    text: str,
    target_lang: str = "Korean",
    translator: Optional[TranslatorDict] = None
) -> str:
    """
    Translate text using OpenAI API or LM Studio.

    Args:
        text: Text to translate
        target_lang: Target language for translation (default: "Korean")
        translator: Optional translator dictionary from get_translator()

    Returns:
        Translated text, or original text if translation fails
    """
    if not text or not text.strip():
        return text

    if translator is None:
        translator = get_translator()

    if translator is None:
        print('⚠️  Translation skipped - API not available')
        return text

    try:
        client = translator['client']

        response = client.chat.completions.create(
            model="local-model",  # LM Studio uses the loaded model automatically
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


def get_translator() -> Optional[TranslatorDict]:
    """
    Initialize and test connection to OpenAI API (LM Studio or actual OpenAI).

    Returns:
        Dictionary containing translator type and client, or None if connection fails
    """
    print('Connecting to OpenAI API...')
    try:
        # Use LM Studio's local server
        client = OpenAI(
            base_url="http://localhost:1234/v1",
            api_key="lm-studio"  # LM Studio doesn't require a real API key
        )

        # Test the connection
        test_response = client.chat.completions.create(
            model="local-model",  # Model name doesn't matter for LM Studio
            messages=[{"role": "user", "content": "test"}],
            max_tokens=1
        )

        translator = {
            'type': 'openai',
            'client': client
        }
        print('✓ Connected to OpenAI API (LM Studio)')
        return translator

    except Exception as e:
        print(f'⚠️  OpenAI API connection failed: {e}')
        print('   Make sure LM Studio is running with a model loaded on port 1234')
        return None
