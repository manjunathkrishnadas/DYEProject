// Sample data
const sampleImages = [
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker1",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker2",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker3",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker4",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker5",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker6",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker7",
    "https://api.dicebear.com/7.x/bottts/svg?seed=sticker8"
];

// DOM elements
const imageInput = document.getElementById('imageInput');
const renderBtn = document.getElementById('renderBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const clearBtn = document.getElementById('clearBtn');
const sampleBtn = document.getElementById('sampleBtn');
const status = document.getElementById('status');
const leftPage = document.querySelector('.page.left');
const rightPage = document.querySelector('.page.right');

let currentImages = [];

// Show status message
function showStatus(message, type = 'success') {
    status.textContent = message;
    status.className = `status ${type}`;
    setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
    }, 3000);
}

// Parse and validate JSON input with forgiving parsing
function parseImageInput() {
    let input = imageInput.value.trim();
    if (!input) {
        throw new Error('Please enter image URLs');
    }

    let urls;
    
    try {
        // First, try direct JSON parsing
        urls = JSON.parse(input);
    } catch (e) {
        // If that fails, try to handle messy input
        try {
            // Check if input is a quoted string containing JSON
            if ((input.startsWith('"') && input.endsWith('"')) || 
                (input.startsWith("'") && input.endsWith("'"))) {
                input = input.slice(1, -1);
                // Unescape quotes
                input = input.replace(/\\'/g, "'").replace(/\\"/g, '"');
            }
            
            // Try parsing again
            urls = JSON.parse(input);
        } catch (e2) {
            // Last resort: extract URLs using regex
            const urlPattern = /https?:\/\/[^\s"',\]\}]+/gi;
            const matches = input.match(urlPattern);
            if (matches && matches.length > 0) {
                urls = matches;
            } else {
                throw new Error('Invalid format. Please enter a JSON array or valid URLs.');
            }
        }
    }
    
    if (!Array.isArray(urls)) {
        throw new Error('Input must be a JSON array');
    }
    
    // Filter only http(s) URLs
    const validUrls = urls.filter(url => {
        if (typeof url !== 'string') return false;
        return url.startsWith('http://') || url.startsWith('https://');
    });
    
    if (validUrls.length === 0) {
        throw new Error('No valid http(s) URLs found');
    }
    
    return validUrls;
}

// Generate random number in range
function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Create sticker element with random size and rotation
function createSticker(imageUrl, index, customSize = null) {
    // Create container wrapper
    const container = document.createElement('div');
    container.className = 'sticker-container';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Sticker';
    img.className = 'sticker';
    img.draggable = false;
    
    // Use custom size if provided, otherwise random width between 100-160px
    const width = customSize || Math.floor(randomInRange(100, 160));
    container.style.width = `${width}px`;
    container.style.height = `${width}px`;
    
    // Random rotation between -8 and +8 degrees
    const rotation = randomInRange(-8, 8);
    container.style.transform = `rotate(${rotation}deg)`;
    
    // Store rotation for hover effect and animations
    container.dataset.baseRotation = rotation;
    container.style.setProperty('--rotation', `${rotation}deg`);
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    // Append elements
    container.appendChild(img);
    container.appendChild(resizeHandle);
    
    // Pointer-based drag handlers (on container)
    container.addEventListener('pointerdown', handlePointerDown);
    
    // Resize handler (on resize handle)
    resizeHandle.addEventListener('pointerdown', handleResizeDown);
    
    // Enhanced hover effect with preserved rotation
    container.addEventListener('mouseenter', function() {
        if (!dragState.element && !resizeState.element) {
            const baseRot = parseFloat(this.dataset.baseRotation);
            const hoverRot = baseRot + randomInRange(-5, 5);
            this.style.transform = `rotate(${hoverRot}deg) scale(1.08)`;
        }
    });
    
    container.addEventListener('mouseleave', function() {
        if (!dragState.element && !resizeState.element) {
            const baseRot = parseFloat(this.dataset.baseRotation);
            this.style.transform = `rotate(${baseRot}deg)`;
        }
    });
    
    return container;
}

// Smart placement to reduce overlap
function placeSticker(sticker, container, existingStickers) {
    const containerRect = container.getBoundingClientRect();
    const maxAttempts = 10;
    let bestPosition = null;
    let minOverlap = Infinity;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Random position within container
        const x = randomInRange(0, containerRect.width * 0.7);
        const y = randomInRange(0, containerRect.height * 0.7);
        
        // Calculate overlap with existing stickers
        let totalOverlap = 0;
        const stickerWidth = parseInt(sticker.style.width) || 110;
        
        existingStickers.forEach(existing => {
            const rect = existing.getBoundingClientRect();
            const exWidth = parseInt(existing.style.width) || 110;
            
            const exX = existing.offsetLeft;
            const exY = existing.offsetTop;
            
            const dx = Math.abs(x - exX);
            const dy = Math.abs(y - exY);
            
            if (dx < (stickerWidth + exWidth) / 2 && dy < (stickerWidth + exWidth) / 2) {
                totalOverlap += ((stickerWidth + exWidth) / 2 - dx) * ((stickerWidth + exWidth) / 2 - dy);
            }
        });
        
        if (totalOverlap < minOverlap) {
            minOverlap = totalOverlap;
            bestPosition = { x, y };
        }
        
        // If no overlap found, use this position
        if (totalOverlap === 0) {
            break;
        }
    }
    
    if (bestPosition) {
        sticker.style.position = 'absolute';
        sticker.style.left = `${bestPosition.x}px`;
        sticker.style.top = `${bestPosition.y}px`;
    }
}

// Render stickers to pages with smart placement
function renderStickers(images, animated = true, customSizes = null) {
    clearPages();
    currentImages = [...images];
    
    const midpoint = Math.ceil(images.length / 2);
    const leftImages = images.slice(0, midpoint);
    const rightImages = images.slice(midpoint);
    
    // Set pages to relative positioning for absolute sticker placement
    leftPage.style.position = 'relative';
    rightPage.style.position = 'relative';
    
    const leftStickers = [];
    leftImages.forEach((url, index) => {
        const customSize = customSizes ? customSizes[index] : null;
        const sticker = createSticker(url, index, customSize);
        leftPage.appendChild(sticker);
        placeSticker(sticker, leftPage, leftStickers);
        leftStickers.push(sticker);
        
        // Add pop-in animation with stagger
        if (animated) {
            sticker.style.opacity = '0';
            setTimeout(() => {
                sticker.classList.add('pop-in');
            }, index * 80);
        }
    });
    
    const rightStickers = [];
    rightImages.forEach((url, index) => {
        const customSize = customSizes ? customSizes[midpoint + index] : null;
        const sticker = createSticker(url, midpoint + index, customSize);
        rightPage.appendChild(sticker);
        placeSticker(sticker, rightPage, rightStickers);
        rightStickers.push(sticker);
        
        // Add pop-in animation with stagger
        if (animated) {
            sticker.style.opacity = '0';
            setTimeout(() => {
                sticker.classList.add('pop-in');
            }, (midpoint + index) * 80);
        }
    });
    
    // Bounce the book
    if (animated) {
        const book = document.querySelector('.book');
        book.classList.remove('bounce');
        void book.offsetWidth; // Trigger reflow
        book.classList.add('bounce');
        setTimeout(() => book.classList.remove('bounce'), 800);
    }
    
    showStatus(`Rendered ${images.length} sticker${images.length !== 1 ? 's' : ''}`);
}

// Clear all stickers
function clearPages() {
    leftPage.innerHTML = '';
    rightPage.innerHTML = '';
}

// Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Pointer-based drag functionality
let dragState = {
    element: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    originalZIndex: null,
    isHovering: false
};

// Resize state
let resizeState = {
    element: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    originalZIndex: null
};

function handlePointerDown(e) {
    // Don't handle if clicking on resize handle
    if (e.target.classList.contains('resize-handle')) {
        return;
    }
    
    // Prevent default to stop text selection
    e.preventDefault();
    
    const sticker = e.currentTarget;
    const container = sticker.parentElement;
    
    // Set up drag state
    dragState.element = sticker;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.offsetX = e.clientX - sticker.offsetLeft;
    dragState.offsetY = e.clientY - sticker.offsetTop;
    dragState.originalZIndex = sticker.style.zIndex || '1';
    dragState.isHovering = false;
    
    // Raise z-index for dragging
    sticker.style.zIndex = '100';
    sticker.style.cursor = 'grabbing';
    
    // Disable hover effects during drag
    sticker.style.transition = 'none';
    
    // Attach move and up handlers to document
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);
    
    // Capture pointer for this element
    sticker.setPointerCapture(e.pointerId);
}

function handlePointerMove(e) {
    if (!dragState.element) return;
    
    const sticker = dragState.element;
    const container = sticker.parentElement;
    const containerRect = container.getBoundingClientRect();
    
    // Calculate new position
    let newX = e.clientX - dragState.offsetX;
    let newY = e.clientY - dragState.offsetY;
    
    // Get sticker dimensions
    const stickerWidth = parseInt(sticker.style.width) || 110;
    const stickerHeight = parseInt(sticker.style.height) || 110;
    
    // Apply boundary constraints
    const minX = 0;
    const minY = 0;
    const maxX = container.clientWidth - stickerWidth;
    const maxY = container.clientHeight - stickerHeight;
    
    newX = Math.max(minX, Math.min(newX, maxX));
    newY = Math.max(minY, Math.min(newY, maxY));
    
    // Update position
    sticker.style.left = `${newX}px`;
    sticker.style.top = `${newY}px`;
}

function handlePointerUp(e) {
    if (!dragState.element) return;
    
    const sticker = dragState.element;
    
    // Restore z-index
    sticker.style.zIndex = dragState.originalZIndex;
    sticker.style.cursor = 'grab';
    
    // Re-enable transitions
    sticker.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    
    // Clean up
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerUp);
    
    // Reset drag state
    dragState = {
        element: null,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        originalZIndex: null,
        isHovering: false
    };
}

// Resize functionality
function handleResizeDown(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent drag from triggering
    
    const handle = e.currentTarget;
    const sticker = handle.parentElement;
    const container = sticker.parentElement;
    
    // Set up resize state
    resizeState.element = sticker;
    resizeState.startX = e.clientX;
    resizeState.startY = e.clientY;
    resizeState.startWidth = parseInt(sticker.style.width) || 110;
    resizeState.startHeight = parseInt(sticker.style.height) || 110;
    resizeState.originalZIndex = sticker.style.zIndex || '1';
    
    // Raise z-index for resizing
    sticker.style.zIndex = '100';
    
    // Disable transitions during resize
    sticker.style.transition = 'none';
    
    // Attach move and up handlers to document
    document.addEventListener('pointermove', handleResizeMove);
    document.addEventListener('pointerup', handleResizeUp);
    document.addEventListener('pointercancel', handleResizeUp);
    
    // Capture pointer
    handle.setPointerCapture(e.pointerId);
}

function handleResizeMove(e) {
    if (!resizeState.element) return;
    
    const sticker = resizeState.element;
    const container = sticker.parentElement;
    const containerRect = container.getBoundingClientRect();
    
    // Calculate new size based on mouse movement
    const deltaX = e.clientX - resizeState.startX;
    const deltaY = e.clientY - resizeState.startY;
    const delta = Math.max(deltaX, deltaY); // Use larger of the two for uniform scaling
    
    let newSize = resizeState.startWidth + delta;
    
    // Enforce minimum size
    newSize = Math.max(50, newSize);
    
    // Check boundaries - make sure resized sticker stays within container
    const stickerLeft = sticker.offsetLeft;
    const stickerTop = sticker.offsetTop;
    
    const maxWidth = container.clientWidth - stickerLeft;
    const maxHeight = container.clientHeight - stickerTop;
    const maxSize = Math.min(maxWidth, maxHeight);
    
    newSize = Math.min(newSize, maxSize);
    
    // Apply new size
    sticker.style.width = `${newSize}px`;
    sticker.style.height = `${newSize}px`;
}

function handleResizeUp(e) {
    if (!resizeState.element) return;
    
    const sticker = resizeState.element;
    
    // Restore z-index
    sticker.style.zIndex = resizeState.originalZIndex;
    
    // Re-enable transitions
    sticker.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    
    // Clean up
    document.removeEventListener('pointermove', handleResizeMove);
    document.removeEventListener('pointerup', handleResizeUp);
    document.removeEventListener('pointercancel', handleResizeUp);
    
    // Reset resize state
    resizeState = {
        element: null,
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        originalZIndex: null
    };
}

// Event listeners
renderBtn.addEventListener('click', () => {
    try {
        const images = parseImageInput();
        renderStickers(images);
    } catch (e) {
        showStatus(e.message, 'error');
    }
});

shuffleBtn.addEventListener('click', () => {
    if (currentImages.length === 0) {
        showStatus('No stickers to shuffle', 'error');
        return;
    }
    
    // Get all current sticker containers
    const allStickers = [...leftPage.querySelectorAll('.sticker-container'), ...rightPage.querySelectorAll('.sticker-container')];
    
    if (allStickers.length === 0) return;
    
    // Store current sizes before shuffling
    const currentSizes = allStickers.map(sticker => parseInt(sticker.style.width));
    
    // Shuffle the images
    const shuffled = shuffleArray(currentImages);
    
    // Animate existing stickers with spin
    allStickers.forEach((sticker, index) => {
        const oldRotation = parseFloat(sticker.dataset.baseRotation) || 0;
        const newRotation = randomInRange(-8, 8);
        
        sticker.style.setProperty('--rotation', `${oldRotation}deg`);
        sticker.style.setProperty('--rotation-new', `${newRotation}deg`);
        sticker.classList.add('spin-relocate');
    });
    
    // Bounce the book
    const book = document.querySelector('.book');
    book.classList.remove('bounce');
    void book.offsetWidth;
    book.classList.add('bounce');
    setTimeout(() => book.classList.remove('bounce'), 800);
    
    // After animation, re-render with new positions but preserve sizes
    setTimeout(() => {
        renderStickers(shuffled, false, currentSizes);
    }, 800);
});

clearBtn.addEventListener('click', () => {
    // Get all current sticker containers
    const allStickers = [...leftPage.querySelectorAll('.sticker-container'), ...rightPage.querySelectorAll('.sticker-container')];
    
    if (allStickers.length === 0) {
        showStatus('No stickers to clear', 'error');
        return;
    }
    
    // Animate stickers floating out with stagger
    allStickers.forEach((sticker, index) => {
        setTimeout(() => {
            sticker.classList.add('float-out');
        }, index * 40);
    });
    
    // Actually clear after animation completes
    setTimeout(() => {
        clearPages();
        currentImages = [];
        showStatus('Cleared all stickers');
    }, allStickers.length * 40 + 800);
});

sampleBtn.addEventListener('click', () => {
    imageInput.value = JSON.stringify(sampleImages, null, 2);
    
    // Add glow animation to textarea
    imageInput.classList.remove('glow');
    void imageInput.offsetWidth; // Trigger reflow
    imageInput.classList.add('glow');
    setTimeout(() => imageInput.classList.remove('glow'), 800);
    
    showStatus('Sample data loaded');
});

// No additional setup needed for pointer events - handlers attached to stickers individually
