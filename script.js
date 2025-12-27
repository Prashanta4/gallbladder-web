// ===========================
// Global Variables
// ===========================
let selectedFile = null;
let isProcessing = false;
let progressInterval = null; // To store the timer ID

// ===========================
// Configuration
// ===========================
const BASE_URL = "https://prasanta4-my-model-deployment.hf.space"; 

// ===========================
// DOM Elements
// ===========================
const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const predictBtn = document.getElementById('predictBtn');
const xaiBtn = document.getElementById('xaiBtn');

// New Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusDot = statusIndicator.querySelector('.status-dot');
const statusText = statusIndicator.querySelector('.status-text');
const loadingProgress = document.getElementById('loadingProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');

// ===========================
// Initialization
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkBackendStatus(); // Check immediately on load
    setInterval(checkBackendStatus, 10000); // Poll every 10 seconds
});

function initializeEventListeners() {
    imageInput.addEventListener('change', handleFileSelect);

    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', handleDrop);

    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());
}

// ===========================
// Backend Status Check
// ===========================
async function checkBackendStatus() {
    try {
        // Use a short timeout so we don't hang if it's down
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${BASE_URL}/health`, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            updateStatusUI(true);
        } else {
            updateStatusUI(false);
        }
    } catch (error) {
        updateStatusUI(false);
    }
}

function updateStatusUI(isOnline) {
    if (isOnline) {
        statusIndicator.className = "d-flex align-items-center status-online";
        statusText.textContent = "System Online";
    } else {
        statusIndicator.className = "d-flex align-items-center status-offline";
        statusText.textContent = "System Offline";
    }
}

// ===========================
// File Handling
// ===========================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndProcessFile(file);
    }
    e.target.value = "";
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        validateAndProcessFile(files[0]);
    }
}

function validateAndProcessFile(file) {
    hideError();

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!allowed.includes(file.type)) {
        return showError('Invalid file type. Please upload JPG, PNG, or GIF.');
    }

    if (file.size > 10 * 1024 * 1024) {
        return showError('File must be under 10MB.');
    }

    selectedFile = file;
    displayImagePreview(file);
    enableButtons();
}

function displayImagePreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
        preview.innerHTML = `
            <div class="preview-container">
                <img src="${e.target.result}" class="img-fluid rounded" alt="Preview">
                <div class="image-overlay" onclick="removeImage()">
                    <i class="fas fa-times"></i>
                </div>
            </div>
        `;
        uploadArea.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    preview.innerHTML = '';
    uploadArea.style.display = 'block';
    disableButtons();
    hideResult();
    hideError();
    // Hide progress bar if visible
    loadingProgress.classList.add('d-none');
    clearInterval(progressInterval);
}

// ===========================
// UI State Management
// ===========================
function enableButtons() {
    [predictBtn, xaiBtn].forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-secondary');
    });
}

function disableButtons() {
    [predictBtn, xaiBtn].forEach(btn => btn.disabled = true);
}

// ===========================
// Prediction / XAI Handling
// ===========================
async function predictImage(mode) {
    if (!selectedFile || isProcessing) return;

    hideError();
    hideResult();
    isProcessing = true;
    disableButtons(); // Disable immediately

    // Start Progress Bar Simulation
    startProgressSimulation(mode);

    try {
        const endpoint = mode === 'explain'
            ? `${BASE_URL}/explain`
            : `${BASE_URL}/predict`;

        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        // Complete the progress bar instantly upon success
        finishProgress();
        
        // Short delay to let the bar hit 100% visually before showing results
        setTimeout(() => {
            displayResults(data, mode);
        }, 500);

    } catch (err) {
        console.error(err);
        loadingProgress.classList.add('d-none'); // Hide bar on error
        showError('Failed to analyze. Please try again.');
    } finally {
        isProcessing = false;
        enableButtons();
    }
}

// ===========================
// Progress Bar Logic
// ===========================
function startProgressSimulation(mode) {
    loadingProgress.classList.remove('d-none');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';
    progressText.textContent = mode === 'explain' ? 'Generating Explanations...' : 'Analyzing Image...';
    
    // Config: XAI takes longer (~40s), Predict is fast (~2s)
    const duration = mode === 'explain' ? 35000 : 2000; 
    const updateInterval = 100; // Update every 100ms
    const totalSteps = duration / updateInterval;
    let currentStep = 0;

    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        currentStep++;
        
        // Calculate percentage (Logarithmic slowdown effectively)
        // It goes fast at first, then slows down as it approaches 90%
        let progress = Math.min(90, (currentStep / totalSteps) * 100); 
        
        progressBar.style.width = `${progress}%`;
        progressPercent.textContent = `${Math.round(progress)}%`;

        if (progress >= 90) {
            clearInterval(progressInterval); // Hold at 90% until actual response
        }
    }, updateInterval);
}

function finishProgress() {
    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    progressBar.classList.remove('progress-bar-animated'); // Stop animation
    
    // Hide after a brief moment
    setTimeout(() => {
        loadingProgress.classList.add('d-none');
        progressBar.style.width = '0%'; // Reset
        progressBar.classList.add('progress-bar-animated'); // Reset animation
    }, 1000);
}


// ===========================
// Display Results
// ===========================
function displayResults(data, mode) {
    const confidence = Math.round(data.confidence_score * 100);

    let xaiImagesHTML = '';
    if (mode === 'explain' && data.xai) {
        const xaiMethods = ['gradcam', 'shap', 'lime'];
        xaiImagesHTML = `
            <div class="text-center mt-4">
                <h5>Explainability Maps</h5>
                <div class="row justify-content-center mt-3">
                    ${xaiMethods
                        .filter(m => data.xai[m])
                        .map(
                            m => `
                            <div class="col-md-4 mb-3">
                                <div class="card shadow-sm">
                                    <div class="card-header text-capitalize fw-bold bg-light">${m}</div>
                                    <div class="card-body p-2">
                                        <img src="data:image/png;base64,${data.xai[m]}" 
                                             class="img-fluid rounded" 
                                             alt="${m} visualization">
                                    </div>
                                </div>
                            </div>
                        `
                        )
                        .join('')}
                </div>
            </div>
        `;
    }

    result.innerHTML = `
        <div class="result-card">
            <div class="result-header">
                <i class="fas fa-chart-line"></i>
                <h4 class="mb-0">${mode === 'explain' ? 'XAI Analysis Results' : 'AI Analysis Results'}</h4>
            </div>
            <div class="result-item">
                <span class="result-label"><i class="fas fa-diagnosis me-2"></i>Predicted Class:</span>
                <span class="result-value">${data.predicted_class}</span>
            </div>
            <div class="result-item">
                <span class="result-label"><i class="fas fa-percentage me-2"></i>Confidence:</span>
                <span class="result-value">${confidence}%</span>
            </div>
            ${xaiImagesHTML}
        </div>
    `;

    result.style.display = 'block';
}

function showError(msg) {
    errorMessage.textContent = msg;
    error.classList.remove('d-none');
}

function hideError() {
    error.classList.add('d-none');
}

function hideResult() {
    result.style.display = 'none';
}
