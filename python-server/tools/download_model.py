"""
dots.ocr Model Downloader
Downloads the dots.ocr model from Hugging Face or ModelScope
"""

import os
import sys
import argparse
from pathlib import Path

def download_model(source='huggingface'):
    """Download dots.ocr model

    Args:
        source: 'huggingface' or 'modelscope'
    """

    script_dir = Path(__file__).parent.parent
    weights_dir = script_dir / "weights" / "DotsOCR"  # No periods in directory name!

    print("=" * 70)
    print("dots.ocr Model Downloader")
    print("=" * 70)
    print(f"📦 Downloading model to: {weights_dir}")
    print("⚠️  Model size: ~3.4GB - This may take a while...")
    print()

    try:
        # Create weights directory
        weights_dir.mkdir(parents=True, exist_ok=True)

        if source == 'huggingface':
            print("📥 Downloading from Hugging Face...")
            from huggingface_hub import snapshot_download

            snapshot_download(
                repo_id="rednote-hilab/dots.ocr",
                local_dir=str(weights_dir),
                local_dir_use_symlinks=False,
                resume_download=True,
                ignore_patterns=["*.md", "*.gitattributes"]
            )

        elif source == 'modelscope':
            print("📥 Downloading from ModelScope...")
            from modelscope.hub.snapshot_download import snapshot_download

            snapshot_download(
                model_id='AI-ModelScope/dots.ocr',
                local_dir=str(weights_dir),
                local_dir_use_symlinks=False
            )

        print()
        print("✅ Model downloaded successfully!")
        print(f"📁 Model location: {weights_dir}")
        print()
        print("⚠️  IMPORTANT NOTE:")
        print("   - Directory name MUST NOT contain periods (.)")
        print(f"   - Using: {weights_dir.name} ✓")
        print()
        return True

    except Exception as e:
        print()
        print(f"❌ Error downloading model: {e}")
        print()
        print("💡 Alternative: Download manually")
        print()
        print("Option 1 - Hugging Face:")
        print("   https://huggingface.co/rednote-hilab/dots.ocr")
        print()
        print("Option 2 - ModelScope (China):")
        print("   https://www.modelscope.cn/models/AI-ModelScope/dots.ocr")
        print()
        print(f"Then place all files in: {weights_dir}")
        print()
        print("⚠️  Remember: Use a directory name WITHOUT periods!")
        print("   ✓ Correct: DotsOCR")
        print("   ✗ Wrong: dots.ocr")
        print()
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Download dots.ocr model')
    parser.add_argument('--type', choices=['huggingface', 'modelscope'],
                        default='huggingface',
                        help='Download source (default: huggingface)')

    args = parser.parse_args()

    # Check dependencies
    try:
        if args.type == 'huggingface':
            import huggingface_hub
        elif args.type == 'modelscope':
            import modelscope
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print()
        print("Please install required packages:")
        if args.type == 'huggingface':
            print("   pip install huggingface-hub")
        else:
            print("   pip install modelscope")
        sys.exit(1)

    success = download_model(source=args.type)

    if success:
        print("🎉 Setup complete!")
        print()
        print("Next steps:")
        print("   1. Start the server: python server.py")
        print("   2. Install Chrome extension")
        print()
    else:
        print("⚠️  Manual download required")
        print("   Follow the instructions above")
        print()
        sys.exit(1)
