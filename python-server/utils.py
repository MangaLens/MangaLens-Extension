from typing import List, Dict
from PIL import Image, ImageEnhance


def boxes_close(box1, box2, distance_threshold):
    """두 박스가 겹치거나 가까이 있는지 확인"""
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2

    # 겹치는 영역 계산
    x_overlap = max(0, min(x1_max, x2_max) - max(x1_min, x2_min))
    y_overlap = max(0, min(y1_max, y2_max) - max(y1_min, y2_min))

    # 이미 겹치면 True
    if x_overlap > 0 and y_overlap > 0:
        return True

    # 겹치지 않으면 거리 계산
    # 수평 거리
    if x1_max < x2_min:
        x_distance = x2_min - x1_max
    elif x2_max < x1_min:
        x_distance = x1_min - x2_max
    else:
        x_distance = 0

    # 수직 거리
    if y1_max < y2_min:
        y_distance = y2_min - y1_max
    elif y2_max < y1_min:
        y_distance = y1_min - y2_max
    else:
        y_distance = 0
    # 두 박스 사이의 최소 거리가 threshold 이하면 가깝다고 판단
    diagonal_distance = (x_distance ** 2 + y_distance ** 2) ** 0.5
    return diagonal_distance <= distance_threshold

def merge_overlapping_boxes(bboxes, distance_threshold=10):
    """겹치거나 가까운 박스들을 합침"""
    if not bboxes:
        return []

    # bbox 리스트를 [x_min, y_min, x_max, y_max] 형식으로 변환
    boxes = [bbox.bbox for bbox in bboxes]
    merged = []
    used = [False] * len(boxes)

    for i in range(len(boxes)):
        if used[i]:
            continue

        current_box = list(boxes[i])
        used[i] = True
        merged_any = True

        # 더 이상 합칠 박스가 없을 때까지 반복
        while merged_any:
            merged_any = False
            for j in range(len(boxes)):
                if used[j]:
                    continue

                if boxes_close(current_box, boxes[j], distance_threshold):
                    # 두 박스를 포함하는 최소 박스 생성
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
        image: Image,
        max_size: int = 1500,
        overlap: int = 750
) -> List[Dict]:
    """큰 이미지를 겹치는 영역을 포함하여 격자로 분할합니다."""
    width, height = image.size

    if width <= max_size and height <= max_size:
        return [{'image': image, 'offset': (0, 0), 'grid': (0, 0)}]

    stride = max_size - overlap
    cols = (width - overlap + stride - 1) // stride
    rows = (height - overlap + stride - 1) // stride

    print(f'🔲 이미지 분할: {cols}x{rows} 격자 (오버랩: {overlap}px)')

    splits = []
    for row in range(rows):
        for col in range(cols):
            x_start = col * stride
            y_start = row * stride
            x_end = min(x_start + max_size, width)
            y_end = min(y_start + max_size, height)

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


def remove_duplicate_boxes(all_boxes: List[Dict], iou_threshold: float = 0.7) -> List[Dict]:
    """오버랩 영역에서 중복된 bbox를 제거합니다."""
    if not all_boxes:
        return []

    def calculate_iou(box1, box2):
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

    print(f'🔍 중복 제거: {len(all_boxes)} → {len(kept)} (제거: {len(all_boxes) - len(kept)})')
    return kept



def image_enhance(image: Image) -> Image:

    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.8)

    sharpness = ImageEnhance.Sharpness(image)
    image = sharpness.enhance(1.5)

    return image