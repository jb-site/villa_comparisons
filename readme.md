# Villa Comparison Website

> **Documentation Note**: This readme provides starter context and fundamental principles. [latest_iteration.md](latest_iteration.md) contains detailed design decisions, what we tried/rejected, and technical notes. **Both files should be kept up to date** when making changes to the project.

## Project Goal
Build a villa comparison tool for a May 2025 family beach holiday. The site helps a multi-generational family (10 people) quickly scan ~15 villas across 8 Mediterranean locations and make a decision within 1-2 weeks.

## The Problem
- **Audience**: Non-technical, multi-generational family (10 people)
- **Timeline**: Decision needed within 1-2 weeks
- **Viewing context**: Most viewing will be on mobile phones (landscape and portrait)
- **Decision style**: Multiple decision-makers with different priorities need to rule out obvious nos, then compare finalists
- **Cognitive load**: Need to scan ~15 villas quickly - every decorative element or interaction adds friction

## Core Principles
1. **Reduce cognitive load** - Remove decorative elements, minimize interactions, show all content upfront
2. **Lead with visuals** - Photos trigger faster gut reactions than scores or text
3. **Unified visual language** - One text color (except links), consistent spacing, no competing colors
4. **Mobile-first** - Optimize for phone viewing (portrait and landscape)
5. **Photo-first** - The villa photo is the primary decision trigger
6. **Group related information** - Tight spacing within groups, clear separation between groups

## Information Architecture

### What Goes in a Villa Card
All content is always visible (no expand/collapse). Content is organized into three visual groups:

**Group 1: Identity** (tight spacing within)
- Hero photo (3:2 aspect ratio, largest element)
- Villa name
- Location (with clickable tooltip for detailed area scores)
- Price (total for week including flights)

**Group 2: Description** (tight spacing within)
- One-line hook/description (telegraphic style)
- Amenities (comma-separated: "Pool, Garden, BBQ")

**Group 3: Action**
- Booking links (1-3 URLs, inline with pipes: "Airbnb | Owner site | Photos")

### Location Information
Each villa belongs to a location/area. Location scores are available:
- Overall location score (out of 5)
- Category breakdown: Beach quality, Sea conditions, Weather, Crowdedness, Character, Amenities, Local attractions

## Constraints
- Pure HTML/CSS/JavaScript (no build tools or frameworks needed)
- Should work well on mobile browsers
- Low-bandwidth friendly (images will be optimized separately)

## Success Criteria
- Family can scan all options in under 5 minutes
- Easy to rule out obvious nos quickly
- Easy to compare finalists side-by-side
- Works smoothly on phones (most viewing will be mobile)

---

## Implementation

### Current Architecture
The site is built as a data-driven static website that fetches villa data directly from Google Sheets:

```
/
├── index.html           # Minimal HTML structure
├── css/styles.css       # All styling with variables at top
├── js/app.js            # Data loading, Google Sheets parsing, and rendering
├── data/
│   ├── locations.json   # Location scores (14 Mediterranean destinations)
│   └── archive/         # Old static data files (no longer used)
└── tools/
    └── spreadsheet-converter.html  # Backup tool for testing/offline use
```

**Data Flow:**
1. Google Sheets (published to web) → Contains all villa data
2. Website fetches TSV export directly from Google Sheets on page load
3. [js/app.js](js/app.js) parses and renders the data
4. Updates to Google Sheet appear immediately on page refresh

### Design Aesthetic: Clean Mediterranean
- Warm cream background (#FAF7F4)
- Unified warm charcoal text color for all content except links
- Aegean blue (#5B8A9A) for booking links
- Playfair Display for villa names (elegant serif)
- Source Sans 3 for body text (warm sans-serif)
- Minimal effects: subtle card shadows with hover lift
- No decorative elements (no gradients, zoom effects, or quote marks)

### How to Update Content

**Updating Villa Data (Automated - No Manual Steps!):**
1. Open your Google Sheet with villa data
2. Edit villa information directly in the sheet
3. Save the sheet (Ctrl+S or Cmd+S)
4. Refresh the website - changes appear immediately!

That's it! No copying, pasting, or file editing needed. The website fetches data directly from Google Sheets.

**Google Sheets Setup:**
1. Go to **File → Share → Publish to web** in your Google Sheet
2. Choose "Entire Document" and click **Publish**
3. Copy the sheet URL and paste it into `googleSheetsUrl` in [js/app.js:18](js/app.js#L18)

**Google Sheets Column Structure:**

| Column | Required? | Description | Example |
|--------|-----------|-------------|---------|
| `name` | ✓ Yes | Villa name | "Villa Bini Mapa" |
| `location` | ✓ Yes | Location | "Binibeca, Menorca" |
| `hook` | ✓ Yes | One-line description | "Walk to sandy beach & restaurants" |
| `villa_location` | Optional | Detailed location info | "Walking distance to beach" |
| `area_rating` | Optional | Star rating for area (1-5) | "5" |
| `area summary` | Optional | Area description for tooltip | "Binibeca is a whitewashed coastal village..." |
| `price` | ✓ Yes | Price | "£3,300 per family inc flights" |
| `photo` | ✓ Yes | Image URL or path | "https://..." or "img/villa.jpg" |
| `amenities` | ✓ Yes | Comma-separated | "Pool, Garden, BBQ" |
| `link_1_label` | Optional | First booking link label | "Website" |
| `link_1_url` | Optional | First booking link URL | "https://..." |
| `link_2_label` | Optional | Second booking link label | "Airbnb" |
| `link_2_url` | Optional | Second booking link URL | "https://..." |
| `link_3_label` | Optional | Third booking link label | "VRBO" |
| `link_3_url` | Optional | Third booking link URL | "https://..." |
| `excluded` | Optional | Set to "TRUE" to hide villa | "TRUE" |

Add more link columns as needed (link_4, link_5, etc.). Leave empty if not needed.

**Backup Tool:**
[tools/spreadsheet-converter.html](tools/spreadsheet-converter.html) can still be used to:
- Generate JSON backups of your data
- Test data parsing before publishing
- Work offline with villa data

**Change colors or fonts:**
1. Open [css/styles.css](css/styles.css)
2. Edit the `:root` section at the top
3. Change CSS variables (colors, fonts, spacing)
4. Save and refresh browser

**Why this approach:**
- Completely automated - edit Google Sheet and see changes immediately
- No manual copy/paste/save workflow
- Familiar Google Sheets interface for data editing
- Can be shared via URL (GitHub Pages)
- No frameworks or build tools needed
- Converter tool available as backup for offline work

### Testing Locally
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

**Requirements:**
- Google Sheet must be published to web (File → Share → Publish to web)
- Internet connection (to fetch from Google Sheets)

### Deployment
**GitHub Pages:**
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Set source to main branch, root folder (or specific folder if needed)
4. Share the URL: `https://username.github.io/repo-name/`

**Note:** The Google Sheets integration works on GitHub Pages - no additional configuration needed. Just make sure your Google Sheet remains published to web.

### Mobile Optimization
- **Landscape iPhone (667x375)**: 2 cards side-by-side
- **Portrait mobile (375x667)**: Single column, easy scrolling
- Tested and working on both orientations

### Features
- ✓ **Automated content updates** - Edit Google Sheet → Refresh website (no manual steps)
- ✓ Photo-first card layout (3:2 aspect ratio)
- ✓ Location tooltips with area ratings and descriptions
- ✓ All content visible upfront (no expand/collapse)
- ✓ Three-group information architecture with strategic spacing
- ✓ Unified color scheme (one text color + blue links)
- ✓ Amenities field for quick scanning of key features
- ✓ Flexible booking links (unlimited URLs per villa with custom labels, inline with pipes)
- ✓ Responsive mobile design (2 cards on landscape, 1 on portrait)
- ✓ No build tools or frameworks
- ✓ Direct Google Sheets integration with TSV parsing

## Design Philosophy

**Simplicity over decoration**: Every visual element must serve the decision-making process. Removed:

- Orange gradient borders (visual noise)
- Photo zoom effects (distraction)
- Quote marks and italics (harder to read)
- Multiple font colors (cognitive load)
- Expand/collapse interactions (friction)

**Show, don't hide**: With only 15 villas and a 1-2 week timeline, showing all content upfront is faster than progressive disclosure.

**Group related information**: Visual hierarchy through spacing, not color or decoration. Tight gaps within groups (0.25-0.5rem), clear breaks between groups (1rem).

See [latest_iteration.md](latest_iteration.md) for detailed design decisions, what we tried and rejected, and technical implementation notes.

---

## Documentation Maintenance

When making changes to the project:

**Update [readme.md](readme.md)** (this file) for:
- Changes to core principles or design philosophy
- Updates to the information architecture
- New features or removed features
- Changes to the JSON data structure
- Updates to testing/deployment instructions

**Update [latest_iteration.md](latest_iteration.md)** for:
- Recent changes (add to "Recent Changes" section with date)
- New "What We Tried and Rejected" entries with reasoning
- Updates to "What's Working Well" based on testing
- Technical implementation notes
- Detailed design decisions and their rationale

Both files should provide complete context for future work. Start new AI conversations by providing both files as context.
