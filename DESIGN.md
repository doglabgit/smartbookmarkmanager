# Design System — Smart Bookmark Manager

## Product Context
- **What this is:** A full-stack web application for managing bookmarks with automatic metadata enrichment and AI-powered summaries
- **Who it's for:** Knowledge workers (developers, researchers, students, productivity enthusiasts)
- **Space/industry:** Productivity tools, bookmark managers, personal knowledge management
- **Project type:** Web application (dashboard-style interface)

## Aesthetic Direction
- **Direction:** Modern Minimalist
- **Decoration level:** Minimal — Typography and whitespace do the work; no unnecessary textures or gradients
- **Mood:** Calm, focused, professional. The interface recedes; the content takes center stage. Clean, uncluttered, efficient.
- **Reference sites:** N/A (original design)

## Typography
- **Display/Hero:** Helvetica Neue (font-weight: 700) — The classic modernist sans-serif. Bold, authoritative, timeless. Creates strong visual hierarchy.
- **Body:** Helvetica Neue (font-weight: 400) — Same family for perfect harmony. Neutral, highly legible at all sizes. The ultimate workhorse.
- **UI/Labels:** Helvetica Neue (font-weight: 500) — Medium weight for interface text, buttons, form labels.
- **Data/Tables:** JetBrains Mono (font-weight: 400) — Tabular numbers essential for metrics and counters. Monospace for technical precision.
- **Code:** JetBrains Mono — For any code snippets or technical content.
- **Loading:** Google Fonts CDN for JetBrains Mono; Helvetica Neue uses system font stack (macOS/iOS: native, others: Arial fallback).
- **Scale:** 
  - Hero/Display: 2.5rem (40px) — H1 pages
  - Page title: 1.75rem (28px) — H2 sections
  - Section: 1.25rem (20px) — H3 subsections
  - Body: 1rem (16px) — default
  - Small: 0.875rem (14px) — secondary text
  - Tiny: 0.75rem (12px) — metadata, hints

## Color
- **Approach:** Restrained — One primary accent, semantic colors only where needed. Color is rare and meaningful.
- **Primary:** `hsl(221.2, 83.2%, 53.3%)` — Rich indigo blue. Used for primary actions, links, focus states. Not the default Tailwind blue; more sophisticated.
- **Secondary:** `hsl(210, 40%, 96.1%)` — Light gray (light mode) / dark gray (dark mode). Used for secondary buttons, card backgrounds, muted surfaces.
- **Neutrals:** 
  - Foreground: `hsl(222.2, 84%, 4.9%)` (light mode) / `hsl(210, 40%, 98%)` (dark mode)
  - Muted: `hsl(215.4, 16.3%, 46.9%)` (light mode) / `hsl(215, 20.2%, 65.1%)` (dark mode)
  - Border: `hsl(214.3, 31.8%, 91.4%)` (light mode) / `hsl(217.2, 32.6%, 17.5%)` (dark mode)
- **Semantic:**
  - Success: `hsl(142.1, 76.2%, 36.3%)` — Green
  - Warning: (use secondary + emphasis, no dedicated color unless needed)
  - Error/Destructive: `hsl(0, 84.2%, 60.2%)` — Red
  - Info: `hsl(221.2, 83.2%, 53.3%)` (reuse primary)
- **Dark mode:** First-class parity. Saturation reduced by ~15% on primary and neutrals. Dark surfaces are not simple inversions; they're carefully tuned for readability and reduced eye strain.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — not crowded, not airy. Gives content room to breathe.
- **Scale:** 8, 16, 24, 32, 48, 64 (all in pixels/rem)
- **Usage examples:**
  - Padding inside cards/inputs: 16px (1.5rem)
  - Gap between form fields: 16px
  - Section spacing: 32px–48px
  - Container max-width: 1200px (15rem)
  - Header height: 64px

## Layout
- **Approach:** Grid-disciplined — Predictable alignments, 12-column grid, clear visual hierarchy.
- **Grid:** 12 columns at breakpoints:
  - Mobile: 4 columns (simpler grid)
  - Tablet: 8 columns
  - Desktop: 12 columns
- **Max content width:** 1200px for full-width pages; 800px for reading-focused views.
- **Border radius:** Hierarchical scale:
  - Small (inputs, small cards): 4px
  - Medium (buttons, cards): 8px
  - Large (modals, feature blocks): 12px
  - Full (pills, avatars): 9999px

## Motion
- **Approach:** Minimal-functional — Motion only to communicate state changes; no gratuitous animations.
- **Easing:**
  - Enter: `ease-out` (300ms)
  - Exit: `ease-in` (200ms)
  - Move/position: `ease-in-out` (250ms)
- **Duration:**
  - Micro (hover, focus): 150–200ms
  - Short (page transitions, panel slides): 250–300ms
  - Medium (modal entrance): 300–400ms
- **No motion** for initial page load or content appearance. Only interactive state changes.

## Components (Tailwind Implementation)
All components use CSS custom properties for theming:

- **Buttons:** `.bg-primary`, `.bg-secondary`, `.border` (outline), `.disabled:opacity-50`
- **Cards:** `.border`, `.rounded-lg` (radius-lg), `.bg-card`
- **Inputs:** `.border`, `.rounded-md` (radius), `.bg-background`, ring on focus: `focus:ring`
- **Tags:** `.bg-secondary`, `.rounded-full` (pill)
- **Alerts:** Border colored with semantic color, background tinted with 10% opacity of semantic color

## Dark Mode
- Toggle via user preference (system preference respected but user can override)
- All surfaces redesign, not inversion:
  - Primary: lighter, more saturated (59.8% lightness vs 53.3%)
  - Secondary: darker gray (17.5% vs 96.1% light)
  - Borders: darker, less contrast
  - Text: slightly desaturated for extended reading comfort

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-03-21 | Helvetica Neue for all typography | Classic, authoritative, timeless. Creates perfect harmony across display and body. No font loading latency (system font). |
| 2025-03-21 | JetBrains Mono for data/code | Tabular numbers essential for metrics display. Monospace adds technical precision where needed. |
| 2025-03-21 | Indigo primary (not blue) | More sophisticated than default Tailwind blue. Stands out from sea of blue productivity apps. |
| 2025-03-21 | Restrained color palette | Keeps focus on bookmark content, not UI decoration. Consistent with minimalist aesthetic. |
| 2025-03-21 | Minimal-functional motion | Productivity apps should feel snappy, not flashy. Motion only for state feedback. |
| 2025-03-21 | 8px base spacing scale | Industry standard, predictable, works well with Tailwind defaults. Comfortable density for reading. |
| 2025-03-21 | Grid-disciplined layout | Users need to scan bookmark lists quickly. Predictable structure aids comprehension. |
| 2025-03-21 | Dark mode first-class | Many power users prefer dark mode. Explicit design ensures quality in both modes. |
