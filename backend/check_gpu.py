#!/usr/bin/env python3
"""
Script to check GPU availability and device information for the AI image generation.
"""

try:
    import torch
    import sys
except ImportError:
    print("❌ PyTorch is not installed. Please install it first:")
    print("   pip install torch torchvision torchaudio")
    sys.exit(1)

def check_gpu_availability():
    """Check if GPU is available and show device information"""
    
    print("🔍 GPU/Device Availability Check")
    print("=" * 40)
    
    # Check CUDA availability
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {'✅ Yes' if cuda_available else '❌ No'}")
    
    if cuda_available:
        # Get GPU information
        gpu_count = torch.cuda.device_count()
        print(f"Number of GPUs: {gpu_count}")
        
        for i in range(gpu_count):
            gpu_name = torch.cuda.get_device_name(i)
            gpu_memory = torch.cuda.get_device_properties(i).total_memory / 1024**3  # Convert to GB
            print(f"  GPU {i}: {gpu_name} ({gpu_memory:.1f} GB)")
        
        # Current device
        current_device = torch.cuda.current_device()
        print(f"Current GPU: {current_device}")
        
        # Memory usage
        allocated = torch.cuda.memory_allocated() / 1024**3
        cached = torch.cuda.memory_reserved() / 1024**3
        print(f"GPU Memory Allocated: {allocated:.2f} GB")
        print(f"GPU Memory Cached: {cached:.2f} GB")
        
        print("\n✅ Your system will use GPU for faster image generation!")
        print("   - Faster processing")
        print("   - Lower memory usage (float16)")
        print("   - Better performance for multiple images")
        
    else:
        print("\n⚠️  Your system will use CPU for image generation")
        print("   - Slower processing")
        print("   - Higher memory usage (float32)")
        print("   - Consider installing CUDA for better performance")
        
        # Check if CUDA is installed but not working
        try:
            import torch.cuda
            print("\n💡 CUDA might be installed but not properly configured")
            print("   - Check your CUDA installation")
            print("   - Verify GPU drivers are up to date")
        except ImportError:
            print("\n💡 CUDA is not installed")
            print("   - Install CUDA toolkit for GPU support")
            print("   - Install compatible PyTorch version")
    
    print("\n" + "=" * 40)
    print("🎬 Your AI image generation will work on both GPU and CPU!")
    print("   The system automatically chooses the best available device.")

if __name__ == "__main__":
    check_gpu_availability() 