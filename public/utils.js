// Utility functions for the application.

/**
 * Formats milliseconds into a human-readable string (e.g., "1h 30m", "45m 10s", "<1m").
 * @param {number} ms - Duration in milliseconds.
 * @param {boolean} [showSeconds=false] - Whether to include seconds.
 * @param {boolean} [showZeroMinutes=false] - If true and hours > 0, shows 0m if minutes is 0.
 * @returns {string} Formatted duration string.
 */
function formatMilliseconds(ms, showSeconds = false, showZeroMinutes = false) {
    if (isNaN(ms) || ms < 0) ms = 0;
    let totalSeconds = Math.floor(ms / 1000);
    let seconds = totalSeconds % 60;
    let totalMinutes = Math.floor(totalSeconds / 60);
    let minutes = totalMinutes % 60;
    let hours = Math.floor(totalMinutes / 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || (hours > 0 && showZeroMinutes) || (hours === 0 && minutes === 0 && showZeroMinutes && showSeconds && parts.length === 0)) {
         parts.push(`${minutes}m`);
    }
    if (showSeconds && (seconds > 0 || (hours === 0 && minutes === 0 && parts.length === 0))) {
         parts.push(`${seconds}s`);
    }

    if (parts.length === 0) {
        if (showSeconds && ms < 1000 && ms > 0) return `<1s`; 
        if (showSeconds) return "0s";
        if (showZeroMinutes) return "0m 0s";
        return "<1m";
    }
    return parts.join(' ');
}

/**
 * Validates the structure of a template object.
 * @param {object} template - The template object to validate.
 * @param {boolean} [isForFirestoreImport=false] - If true, allows template.id to be undefined.
 * @returns {boolean} True if the template structure is valid, false otherwise.
 */
function isValidTemplate(template, isForFirestoreImport = false) {
    if (!template || typeof template !== 'object') return false;
    const idCheck = isForFirestoreImport ? (template.id === undefined || (typeof template.id === 'string' && template.id.trim() !== '')) : (typeof template.id === 'string' && template.id.trim() !== '');
    if (!idCheck) return false;
    if (typeof template.name !== 'string' || template.name.trim() === '') return false;
    if (template.description !== undefined && typeof template.description !== 'string') return false;
    if (!Array.isArray(template.predefinedSkus)) return false;

    return template.predefinedSkus.every(sku =>
        sku && typeof sku === 'object' &&
        typeof sku.code === 'string' && sku.code.trim() !== '' &&
        typeof sku.target === 'number' && sku.target >= 0 && 
        Array.isArray(sku.capacities) && sku.capacities.every(cap => typeof cap === 'number' && cap > 0) &&
        (sku.palletBuildInfo === null || sku.palletBuildInfo === undefined ||
            (typeof sku.palletBuildInfo === 'object' &&
             (sku.palletBuildInfo.text === undefined || typeof sku.palletBuildInfo.text === 'string') &&
             (sku.palletBuildInfo.imageUrls === undefined || (Array.isArray(sku.palletBuildInfo.imageUrls) && sku.palletBuildInfo.imageUrls.every(url => typeof url === 'string' && url.trim() !== '')))
            )
        )
    );
}

/**
 * Generates a CSS linear-gradient string for progress visualization on tabs.
 * This creates a gradient that acts like a bottom border fill.
 * @param {number} percentage - The progress percentage (0-100).
 * @param {string} progressColorVar - CSS variable for the progress color.
 * @param {string} baseColorVar - CSS variable for the base/track color (often transparent for tabs).
 * @returns {string} - The CSS linear-gradient string.
 */
function getProgressGradientStyleString(percentage, progressColorVar, baseColorVar) {
    const p = Math.max(0, Math.min(100, parseFloat(percentage) || 0));


    return `linear-gradient(to right, ${progressColorVar} ${p}%, ${baseColorVar} ${p}%)`;
}