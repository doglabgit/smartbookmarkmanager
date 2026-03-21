# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-21

### Added
- Complete design system implementation
  - Helvetica Neue for display and body text
  - JetBrains Mono for data and code
  - Indigo primary color palette with semantic variants
  - 8px base spacing scale (8, 16, 24, 32, 48, 64)
  - Hierarchical border radius system (4px, 8px, 12px, full)
- Dark mode toggle with system preference detection
- Comprehensive DESIGN.md documentation
- Google Fonts integration for JetBrains Mono
- Tailwind CSS configuration with custom theme extensions
- PostCSS configuration for Tailwind processing

### Changed
- Applied design system to all pages (bookmarks, login, register)
- Updated all form inputs and buttons to match design tokens
- Reformatted bookmark cards with improved spacing and typography
- Standardized color usage across components (primary, secondary, destructive, info)
- Enhanced layout with consistent max-width (1200px) and padding

### Fixed
- Visual inconsistencies across pages
- Inconsistent spacing and typography scales
- Dark mode color contrast issues
