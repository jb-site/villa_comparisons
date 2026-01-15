/* ==========================================================================
   VILLA COMPARISON APP

   This script loads villa data from JSON and renders the cards.
   ========================================================================== */

// Store loaded data
let villasData = [];
let locationsData = {};
let currentSortMode = 'rating';
let currentSortReversed = false;

// ==========================================================================
// DATA LOADING
// ==========================================================================

async function loadData() {
  try {
    const [villasResponse, locationsResponse] = await Promise.all([
      fetch('./data/villas.json'),
      fetch('./data/locations.json')
    ]);

    if (!villasResponse.ok || !locationsResponse.ok) {
      throw new Error('Failed to load data files');
    }

    const villasJson = await villasResponse.json();
    locationsData = await locationsResponse.json();
    villasData = villasJson.villas;

    renderVillas();
  } catch (error) {
    console.error('Error loading data:', error);
    showError();
  }
}

function showError() {
  const grid = document.querySelector('.villas-grid');
  grid.innerHTML = `
    <div class="error-state">
      <p>Unable to load villa data. Please refresh the page.</p>
    </div>
  `;
}

// ==========================================================================
// RENDERING
// ==========================================================================

function renderVillas() {
  const grid = document.querySelector('.villas-grid');

  // Filter out excluded villas
  const activeVillas = villasData.filter(villa => !villa.excluded);

  if (activeVillas.length === 0) {
    grid.innerHTML = '<div class="loading-state"><p>No villas found.</p></div>';
    return;
  }

  // Sort villas based on current mode
  const sortedVillas = sortVillas(activeVillas, currentSortMode, currentSortReversed);

  // Render based on sort mode
  if (currentSortMode === 'area') {
    grid.innerHTML = renderVillasGroupedByArea(sortedVillas);
  } else {
    grid.innerHTML = sortedVillas.map((villa, index) => createVillaCard(villa, index)).join('');
  }
}

function createVillaCard(villa, index) {
  const locationScores = locationsData[villa.location];
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

      <!-- ARCHIVED: View details functionality
      <div class="villa-content">
        <h3 class="villa-name">${villa.name}</h3>

        <div class="villa-location-wrapper">
          <button class="villa-location" onclick="toggleTooltip(event)">
            <span class="location-text">${villa.location}</span>
            <span class="info-icon">i</span>
          </button>
          ${locationScores ? createLocationTooltip(villa.location, locationScores) : ''}
        </div>

        <p class="villa-hook">${villa.hook}</p>
        <div class="villa-price">${villa.price}</div>

        <button class="expand-btn" onclick="toggleDetails(event)">
          View details
        </button>
      </div>

      <div class="villa-details">
        <div class="details-section">
          <div class="details-title">The Basics</div>
          <p class="details-text">${villa.basics}</p>
        </div>

        <div class="details-section">
          <div class="details-title">The Vibe</div>
          <p class="details-text">${villa.vibe}</p>
        </div>

        <div class="details-section details-links">
          ${createLinksHtml(villa.links)}
        </div>
      </div>
      -->
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

/* ARCHIVED: Old createLinksHtml with arrow and flex layout
function createLinksHtml(links) {
  if (!links || links.length === 0) {
    return '';
  }

  return links.map(link => `
    <a href="${link.url}" class="details-link" target="_blank" rel="noopener">
      ${link.label}
      <span class="link-arrow">→</span>
    </a>
  `).join('');
}
*/

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
    // Initialize the area button with arrow
    updateSortButtons('area', false);
  });
});
