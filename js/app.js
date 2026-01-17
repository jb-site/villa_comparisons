/* ==========================================================================
   VILLA COMPARISON APP

   This script loads villa data from JSON and renders the cards.
   ========================================================================== */

// ==========================================================================
// CONFIGURATION
// ==========================================================================

const CONFIG = {
  // Google Sheets URL - get this from your published sheet
  // Instructions:
  // 1. Open your Google Sheet
  // 2. File → Share → Publish to web
  // 3. Choose "Entire Document" and click Publish
  // 4. Copy the URL and paste it below
  googleSheetsUrl: 'https://docs.google.com/spreadsheets/d/1sB-0CUubMwKEb69M4-FS8MIrsU0misZdurImYb-2TqU',

  // Required fields for validation
  requiredFields: ['name', 'location', 'price', 'photo', 'hook', 'amenities']
};

// Store loaded data
let villasData = [];
let currentSortMode = 'rating';
let currentSortReversed = false;
let activeFilters = new Set(); // Stores active filter keys like 'heated_pool', 'walk_beach'

// ==========================================================================
// GOOGLE SHEETS PARSING
// ==========================================================================

function parseGoogleSheetsUrl(url) {
  // Extract sheet ID and gid from various Google Sheets URL formats
  const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) {
    throw new Error('Invalid Google Sheets URL. Please check the URL and try again.');
  }

  const sheetId = sheetIdMatch[1];

  // Try to extract gid from URL
  let gid = '0'; // Default to first sheet
  const gidMatch = url.match(/[#&]gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }

  return { sheetId, gid };
}

function buildExportUrl(sheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=tsv&gid=${gid}`;
}

function parseLine(line, delimiter) {
  // Parser that handles quoted fields and preserves multi-line content
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state but don't add the quote to the value
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function splitIntoRows(text, delimiter) {
  // Split text into rows while respecting quoted fields that may contain newlines
  const rows = [];
  let currentRow = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      // Handle escaped quotes ("")
      if (nextChar === '"') {
        currentRow += '""';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // Only treat newline as row separator if not inside quotes
      if (currentRow.trim()) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r') {
      // Skip carriage returns (Windows line endings)
      continue;
    } else {
      currentRow += char;
    }
  }

  // Add the last row if it exists
  if (currentRow.trim()) {
    rows.push(currentRow);
  }

  return rows;
}

function buildVillaObject(headers, values) {
  const villa = {};
  const links = [];

  // Define boolean columns for proper type conversion
  const booleanColumns = ['excluded', 'heated_pool', 'walk_beach'];

  // Map basic fields
  headers.forEach((header, index) => {
    const value = values[index] || '';

    // Handle link columns separately
    if (header.startsWith('link_') && header.endsWith('_label')) {
      // Extract link number
      const linkNum = header.match(/link_(\d+)_label/)[1];
      const urlHeader = `link_${linkNum}_url`;
      const urlIndex = headers.indexOf(urlHeader);

      if (urlIndex !== -1) {
        const label = value.trim();
        const url = (values[urlIndex] || '').trim();

        // Only add link if both label and URL are non-empty
        if (label && url) {
          links.push({ label, url });
        }
      }
    } else if (!header.startsWith('link_') || !header.endsWith('_url')) {
      // Add non-link fields directly
      if (value) {
        // Convert boolean columns to actual booleans
        if (booleanColumns.includes(header)) {
          villa[header] = value === 'TRUE' || value === 'true' || value === true;
        } else {
          villa[header] = value;
        }
      }
    }
  });

  // Add links array if any links exist
  if (links.length > 0) {
    villa.links = links;
  }

  return villa;
}

function parseSpreadsheet(text) {
  // Auto-detect delimiter: tab (Google Sheets) or comma (CSV)
  const delimiter = text.includes('\t') ? '\t' : ',';

  // Split by newlines while respecting quoted fields
  const lines = splitIntoRows(text.trim(), delimiter);

  if (lines.length === 0) {
    throw new Error('No data found in spreadsheet.');
  }

  if (lines.length === 1) {
    throw new Error('Only header row found. Please include villa data rows.');
  }

  // Parse header row
  const headers = parseLine(lines[0], delimiter).map(h => h.trim().toLowerCase());

  // Validate required fields
  const missingFields = CONFIG.requiredFields.filter(field => !headers.includes(field));
  if (missingFields.length > 0) {
    throw new Error(`Missing required columns: ${missingFields.join(', ')}`);
  }

  // Parse data rows
  const villas = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i], delimiter);

    // Skip empty rows
    if (values.every(v => !v.trim())) {
      continue;
    }

    try {
      const villa = buildVillaObject(headers, values);
      villas.push(villa);
    } catch (err) {
      throw new Error(`Error parsing row ${i + 1}: ${err.message}`);
    }
  }

  if (villas.length === 0) {
    throw new Error('No valid villa data found.');
  }

  return { villas };
}

// ==========================================================================
// DATA LOADING
// ==========================================================================

async function loadData() {
  try {
    // Parse Google Sheets URL and build export URL
    const { sheetId, gid } = parseGoogleSheetsUrl(CONFIG.googleSheetsUrl);
    const exportUrl = buildExportUrl(sheetId, gid);

    // Fetch from Google Sheets
    const sheetsResponse = await fetch(exportUrl);

    if (!sheetsResponse.ok) {
      throw new Error('Failed to load data from Google Sheets');
    }

    // Parse TSV data from Google Sheets
    const tsvData = await sheetsResponse.text();
    const parsedData = parseSpreadsheet(tsvData);

    villasData = parsedData.villas;

    renderVillas();
  } catch (error) {
    console.error('Error loading data:', error);
    showError(error.message);
  }
}

function showError(message = '') {
  const grid = document.querySelector('.villas-grid');
  const detailedMessage = message || 'Unable to load villa data.';
  grid.innerHTML = `
    <div class="error-state">
      <p>${detailedMessage}</p>
      <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.8;">
        Make sure your Google Sheet is published to web (File → Share → Publish to web)
      </p>
    </div>
  `;
}

// ==========================================================================
// RENDERING
// ==========================================================================

function renderVillas() {
  const grid = document.querySelector('.villas-grid');

  // Step 1: Filter out excluded villas
  let activeVillas = villasData.filter(villa => !villa.excluded);

  // Step 2: Apply active filters (AND logic)
  activeVillas = applyFilters(activeVillas);

  if (activeVillas.length === 0) {
    grid.innerHTML = '<div class="loading-state"><p>No villas match the selected filters.</p></div>';
    return;
  }

  // Step 3: Sort villas based on current mode
  const sortedVillas = sortVillas(activeVillas, currentSortMode, currentSortReversed);

  // Step 4: Render based on sort mode
  if (currentSortMode === 'area') {
    grid.innerHTML = renderVillasGroupedByArea(sortedVillas);
  } else {
    grid.innerHTML = sortedVillas.map((villa, index) => createVillaCard(villa, index)).join('');
  }
}

/**
 * Apply active filters to villa list
 * Uses AND logic - villa must match ALL active filters
 * @param {Array} villas - Array of villa objects
 * @returns {Array} Filtered villa array
 */
function applyFilters(villas) {
  if (activeFilters.size === 0) {
    return villas; // No filters active, return all villas
  }

  return villas.filter(villa => {
    // Check each active filter
    for (const filterKey of activeFilters) {
      // Filter is ON - only show villas where this property is TRUE
      const filterValue = villa[filterKey];

      // Parse as boolean (handles "TRUE", "true", true)
      const isTrue = filterValue === true ||
                     filterValue === 'TRUE' ||
                     filterValue === 'true';

      if (!isTrue) {
        return false; // Villa doesn't match this filter
      }
    }

    return true; // Villa matches all active filters
  });
}

function createVillaCard(villa, index) {
  const firstLink = villa.links && villa.links.length > 0 ? villa.links[0].url : null;

  return `
    <article class="villa-card" data-index="${index}">
      <div class="villa-photo">
        ${firstLink ? `<a href="${firstLink}" target="_blank" rel="noopener">` : ''}
        <img
          src="${villa.photo}"
          alt="${villa.name}"
          loading="lazy"
          onerror="this.parentElement.classList.add('photo-error'); this.style.display='none'; this.parentElement.textContent='Photo unavailable';"
        >
        ${firstLink ? `</a>` : ''}
      </div>

      <div class="villa-content">
        <h3 class="villa-name">${villa.name}</h3>

        <div class="villa-location-wrapper">
          <button class="villa-location" onclick="toggleTooltip(event)">
            <span class="location-text">${villa.location}</span>
            <span class="info-icon">i</span>
          </button>
          ${villa['area summary'] ? createLocationTooltip(villa['area summary'], villa.area_rating) : ''}
        </div>

        <div class="villa-price">${villa.price}</div>

        ${villa.amenities ? `<div class="villa-amenities">${villa.amenities}</div>` : ''}
        <p class="villa-hook">${villa.villa_location}</p>

        <div class="villa-links">
          ${createLinksHtml(villa.links)}
        </div>
      </div>
    </article>
  `;
}

function createLocationTooltip(areaSummary, areaRating) {
  const stars = areaRating ? getStarRating(areaRating) : '';

  return `
    <div class="location-tooltip">
      <div class="location-tooltip-content">
        ${stars ? `<div class="area-rating">Area rating: <span class="stars">${stars}</span></div>` : ''}
        ${areaSummary}
      </div>
    </div>
  `;
}

function getStarRating(rating) {
  return '⭐'.repeat(rating);
}

function createLinksHtml(links) {
  if (!links || links.length === 0) {
    return '';
  }

  return links.map((link, index) => {
    const separator = index < links.length - 1 ? '<span class="link-separator">|</span>' : '';
    return `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>${separator}`;
  }).join('');
}

// ==========================================================================
// SORTING
// ==========================================================================

function sortVillas(villas, sortMode, reversed = false) {
  // Clone array to avoid mutation
  const sorted = [...villas];
  const reverseMultiplier = reversed ? -1 : 1;

  switch(sortMode) {
    case 'area':
      // Sort by area in custom order: Sardinia, Menorca, Tuscan Coast, France
      const areaOrder = ['Sardinia', 'Menorca', 'Tuscan Coast', 'France'];
      return sorted.sort((a, b) => {
        const areaA = a.area || '';
        const areaB = b.area || '';
        const indexA = areaOrder.indexOf(areaA);
        const indexB = areaOrder.indexOf(areaB);

        // If area not in custom order, put it at the end
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;

        return (posA - posB) * reverseMultiplier;
      });

    case 'price':
      // Sort by price rank descending (higher rank first)
      return sorted.sort((a, b) => {
        const rankA = parseFloat(a['price rank']) || 0;
        const rankB = parseFloat(b['price rank']) || 0;
        return (rankB - rankA) * reverseMultiplier;
      });

    case 'rating':
      // Sort by favourites (jb rating) descending
      return sorted.sort((a, b) => {
        const ratingA = parseFloat(a['jb rating']) || 0;
        const ratingB = parseFloat(b['jb rating']) || 0;
        return (ratingB - ratingA) * reverseMultiplier;
      });

    default:
      return sorted;
  }
}

function createAreaHeader(locationName) {
  return `
    <div class="area-header">
      <h2 class="area-header-text">${locationName}</h2>
    </div>
  `;
}

function renderVillasGroupedByArea(villas) {
  const html = [];
  let currentArea = null;

  villas.forEach((villa, index) => {
    // Insert header when area changes
    if (villa.area !== currentArea) {
      html.push(createAreaHeader(villa.area));
      currentArea = villa.area;
    }

    html.push(createVillaCard(villa, index));
  });

  return html.join('');
}

// ==========================================================================
// FILTER CONTROLS
// ==========================================================================

/**
 * Toggle a filter on/off
 * @param {string} filterKey - The filter to toggle (e.g., 'heated_pool')
 */
function toggleFilter(filterKey) {
  if (activeFilters.has(filterKey)) {
    activeFilters.delete(filterKey);
  } else {
    activeFilters.add(filterKey);
  }

  updateFilterButtons();
  renderVillas();
}

/**
 * Update filter button active states
 */
function updateFilterButtons() {
  const filterButtons = document.querySelectorAll('.filter-btn');

  filterButtons.forEach(btn => {
    const filterKey = btn.dataset.filter;
    if (activeFilters.has(filterKey)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Initialize filter controls event listeners
 */
function initializeFilterControls() {
  const filterButtons = document.querySelectorAll('.filter-btn');

  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      const filterKey = this.dataset.filter;
      toggleFilter(filterKey);
    });
  });
}

// ==========================================================================
// INTERACTIONS
// ==========================================================================

function toggleDetails(event) {
  const button = event.currentTarget;
  const card = button.closest('.villa-card');
  const details = card.querySelector('.villa-details');

  const isExpanded = details.classList.contains('expanded');

  if (isExpanded) {
    details.classList.remove('expanded');
    button.textContent = 'View details';
  } else {
    details.classList.add('expanded');
    button.textContent = 'Close details';
  }
}

function toggleTooltip(event) {
  event.stopPropagation();

  const button = event.currentTarget;
  const wrapper = button.closest('.villa-location-wrapper');
  const tooltip = wrapper.querySelector('.location-tooltip');
  const card = button.closest('.villa-card');

  if (!tooltip) return;

  const isActive = tooltip.classList.contains('active');

  // Close all other tooltips first and remove elevated class from cards
  document.querySelectorAll('.location-tooltip.active').forEach(t => {
    t.classList.remove('active');
    const otherCard = t.closest('.villa-card');
    if (otherCard) {
      otherCard.classList.remove('tooltip-active');
    }
  });

  // Toggle this tooltip
  if (!isActive) {
    tooltip.classList.add('active');
    card.classList.add('tooltip-active');
  }
}

// Close tooltip when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.villa-location-wrapper')) {
    document.querySelectorAll('.location-tooltip.active').forEach(t => {
      t.classList.remove('active');
      const card = t.closest('.villa-card');
      if (card) {
        card.classList.remove('tooltip-active');
      }
    });
  }
});

// Close tooltip on Escape key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    document.querySelectorAll('.location-tooltip.active').forEach(t => {
      t.classList.remove('active');
      const card = t.closest('.villa-card');
      if (card) {
        card.classList.remove('tooltip-active');
      }
    });
  }
});

// ==========================================================================
// SORT CONTROLS
// ==========================================================================

function updateSortButtons(mode, reversed) {
  const sortButtons = document.querySelectorAll('.sort-btn');

  // Map data-sort values to display labels
  const sortLabels = {
    'area': 'Area',
    'price': 'Price',
    'rating': 'Default'
  };

  sortButtons.forEach(btn => {
    const btnMode = btn.dataset.sort;
    const baseName = sortLabels[btnMode] || btnMode.charAt(0).toUpperCase() + btnMode.slice(1);

    if (btnMode === mode) {
      const arrow = reversed ? '↑' : '↓';
      btn.innerHTML = `${baseName} <span class="sort-arrow">${arrow}</span>`;
    } else {
      btn.textContent = baseName;
    }
  });
}

function setSortMode(mode, reversed = false) {
  currentSortMode = mode;
  currentSortReversed = reversed;
  updateSortButtons(mode, reversed);
  renderVillas();
}

function initializeSortControls() {
  const sortButtons = document.querySelectorAll('.sort-btn');

  sortButtons.forEach(button => {
    button.addEventListener('click', function() {
      const sortMode = this.dataset.sort;
      const wasActive = this.classList.contains('active');

      // Don't allow reversing for 'favourites' (rating)
      const canReverse = sortMode !== 'rating';

      // If clicking the same active button, toggle reverse (if allowed)
      if (wasActive && canReverse) {
        currentSortReversed = !currentSortReversed;
        setSortMode(sortMode, currentSortReversed);
      } else if (!wasActive) {
        // New sort mode, reset to not reversed
        sortButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        setSortMode(sortMode, false);
      }
      // If wasActive but can't reverse, do nothing
    });
  });
}

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadData().then(() => {
    initializeSortControls();
    initializeFilterControls();
    // Initialize the area button with arrow
    updateSortButtons('area', false);
  });
});
