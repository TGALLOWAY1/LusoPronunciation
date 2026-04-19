# UI Style Guide

This document outlines the design system, component patterns, and styling conventions used throughout LusoPronounce.

## Color Palette

### Primary Colors (Portuguese Flag Green)
- **Primary 50**: `#f0f9f4` - Lightest tint
- **Primary 100**: `#dcf2e3` - Light tint
- **Primary 500**: `#2d8659` - Main brand color
- **Primary 600**: `#1e6b47` - Darker shade
- **Primary 700**: `#155537` - Darkest shade

### Accent Colors
- **Accent 400**: `#fdd835` - Yellow (Portuguese flag)
- **Accent 500**: `#fbc02d` - Yellow darker

### Secondary Colors
- **Secondary 500**: `#002776` - Blue (Portuguese flag)
- **Secondary 600**: `#001d5c` - Blue darker

### Neutral Colors
- **Gray Scale**: Standard Tailwind gray scale (50-900)
- Used for backgrounds, borders, text, and UI elements

### Semantic Colors
- **Success**: Green (500-600) - Positive actions, success states
- **Warning**: Yellow/Orange (400-500) - Warnings, attention needed
- **Danger**: Red (500-600) - Errors, destructive actions
- **Info**: Blue (400-500) - Information, tips

## Typography

### Font Families
- **System Stack**: `system-ui, -apple-system, sans-serif`
- Uses native system fonts for optimal performance

### Font Sizes
- **xs**: `0.75rem` (12px) - Small labels, captions
- **sm**: `0.875rem` (14px) - Body text, descriptions
- **base**: `1rem` (16px) - Default body text
- **lg**: `1.125rem` (18px) - Large body text
- **xl**: `1.25rem` (20px) - Section headings
- **2xl**: `1.5rem` (24px) - Page titles (mobile)
- **3xl**: `1.875rem` (30px) - Page titles (desktop)
- **4xl**: `2.25rem` (36px) - Hero headings

### Font Weights
- **Normal**: `400` - Body text
- **Medium**: `500` - Labels, emphasis
- **Semibold**: `600` - Buttons, card titles
- **Bold**: `700` - Headings, important text

### Line Heights
- **Tight**: `1.25` - Headings
- **Normal**: `1.5` - Body text
- **Relaxed**: `1.75` - Long-form content

## Spacing & Layout

### Spacing Scale
Uses Tailwind's default spacing scale (4px base unit):
- **1**: `0.25rem` (4px)
- **2**: `0.5rem` (8px)
- **3**: `0.75rem` (12px)
- **4**: `1rem` (16px)
- **6**: `1.5rem` (24px)
- **8**: `2rem` (32px)
- **12**: `3rem` (48px)
- **16**: `4rem` (64px)

### Container Max Widths
- **sm**: `640px` - Small screens
- **md**: `768px` - Tablets
- **lg**: `1024px` - Desktop
- **xl**: `1280px` - Large desktop
- **2xl**: `1536px` - Extra large desktop

### Page Layout
- **Dashboard**: `max-w-7xl` (1280px)
- **Practice Pages**: `max-w-4xl` (896px)
- **Review Queue**: `max-w-4xl` (896px)

### Padding Conventions
- **Card Padding**: `p-4` (compact) or `p-6` (standard)
- **Page Padding**: `px-4 sm:px-6` (responsive horizontal)
- **Section Spacing**: `mb-6` or `space-y-6`

## Component Patterns

### Cards

**Base Card Style**
```tsx
<div className="card card-hover">
  {/* Content */}
</div>
```

**Variants**:
- `.card` - Standard card with white background, border, shadow
- `.card-hover` - Adds hover shadow effect
- `.card-compact` - Reduced padding (p-4 instead of p-6)

**Dark Mode**: Automatically adapts with `dark:bg-gray-800 dark:border-gray-700`

### Buttons

**Base Button Classes**:
- `.btn` - Base button styles (font-semibold, rounded-lg, transitions, focus states)
- `.btn-primary` - Primary action (green)
- `.btn-secondary` - Secondary action (gray)
- `.btn-success` - Success action (green)
- `.btn-danger` - Destructive action (red)

**Sizes**:
- `.btn-sm` - Small (px-4 py-2 text-sm)
- `.btn-md` - Medium (px-6 py-3 text-base)
- `.btn-lg` - Large (px-8 py-4 text-lg)

**Example**:
```tsx
<button className="btn btn-primary btn-md">
  Click Me
</button>
```

**Features**:
- Focus ring for accessibility
- Disabled states
- Hover transitions
- Dark mode support

### Badges/Tags

**Base Badge Style**:
```tsx
<span className="badge badge-primary">Label</span>
```

**Variants**:
- `.badge-primary` - Primary color
- `.badge-secondary` - Gray
- `.badge-success` - Green
- `.badge-warning` - Yellow/Orange
- `.badge-danger` - Red
- `.badge-info` - Blue

**Usage**: Category labels, difficulty indicators, status tags

### Filter Chips

**Base Chip Style**:
```tsx
<button className="chip chip-active">Active</button>
<button className="chip chip-inactive">Inactive</button>
```

**Features**:
- Active/inactive states
- Focus rings for accessibility
- Rounded corners (rounded-lg or rounded-full)
- Dark mode support

### Progress Bars

**Base Progress Bar**:
```tsx
<div className="progress-bar">
  <div className="progress-fill" style={{ width: '50%' }} />
</div>
```

**Features**:
- Smooth transitions
- Accessible contrast
- Dark mode support

## Responsive Design

### Breakpoints
- **sm**: `640px` - Small tablets, large phones
- **md**: `768px` - Tablets
- **lg**: `1024px` - Desktop
- **xl**: `1280px` - Large desktop

### Mobile-First Approach
All styles default to mobile, then enhance for larger screens:
```tsx
<div className="text-base md:text-lg">
  Responsive text
</div>
```

### Common Patterns
- **Grid Layouts**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Flex Direction**: `flex-col sm:flex-row`
- **Text Sizes**: `text-2xl md:text-3xl`
- **Spacing**: `gap-2 sm:gap-4`
- **Padding**: `p-4 sm:p-6`

## Dark Mode

### Implementation
- Uses `prefers-color-scheme: dark` media query
- Configured in `tailwind.config.js` with `darkMode: 'media'`
- All components include dark mode variants

### Color Adaptations
- **Backgrounds**: `dark:bg-gray-800` or `dark:bg-gray-900`
- **Text**: `dark:text-gray-100` or `dark:text-gray-300`
- **Borders**: `dark:border-gray-700`
- **Cards**: `dark:bg-gray-800 dark:border-gray-700`

### Best Practices
- Always provide dark mode variants for custom colors
- Test contrast ratios in both modes
- Ensure interactive elements are clearly visible

## Accessibility

### Focus States
All interactive elements include focus rings:
```tsx
className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
```

### Color Contrast
- Text on backgrounds meets WCAG AA standards
- Primary actions have sufficient contrast
- Disabled states are clearly distinguishable

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Logical tab order
- Arrow key navigation in practice modes

### Screen Readers
- Semantic HTML elements
- ARIA labels where needed
- Descriptive button text

## Animation & Transitions

### Transition Durations
- **Fast**: `duration-150` (150ms) - Hover states
- **Standard**: `duration-200` (200ms) - Most interactions
- **Slow**: `duration-300` (300ms) - Progress bars, complex animations

### Common Transitions
- **Colors**: `transition-colors duration-200`
- **Shadows**: `transition-shadow duration-200`
- **Transforms**: `transition-transform duration-200`
- **All**: `transition-all duration-200`

### Hover Effects
- **Cards**: Shadow increase on hover
- **Buttons**: Color darkening, scale on active
- **Links**: Color change, underline

## Component-Specific Patterns

### Practice Cards
- Large, prominent text for Portuguese content
- Smaller, italic text for translations
- Color-coded difficulty badges
- Audio controls with compact variant
- Action buttons at bottom

### Dashboard Cards
- Summary cards with large numbers
- Gradient hero sections
- Progress indicators
- Category cards with progress bars

### Navigation
- Sidebar navigation (desktop)
- Horizontal scrollable nav (mobile)
- Active state highlighting
- Icon + text labels

## Usage Examples

### Creating a New Card
```tsx
<div className="card card-hover">
  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
    Title
  </h3>
  <p className="text-gray-600 dark:text-gray-400">
    Content
  </p>
</div>
```

### Creating a Button
```tsx
<button className="btn btn-primary btn-md">
  Action
</button>
```

### Creating a Badge
```tsx
<span className="badge badge-primary">
  Label
</span>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Items */}
</div>
```

## File Organization

### Shared Styles
- **`src/styles/index.css`** - Global styles, utility classes
- **`tailwind.config.js`** - Tailwind configuration, theme extensions

### Component Styles
- Components use Tailwind utility classes
- Shared patterns in CSS utility classes (`.card`, `.btn`, etc.)
- No component-specific CSS files

## Maintenance

### Adding New Colors
1. Add to `tailwind.config.js` theme.extend.colors
2. Update this style guide
3. Test in both light and dark modes

### Adding New Components
1. Use existing utility classes where possible
2. Follow established patterns
3. Include dark mode variants
4. Test responsive behavior
5. Ensure accessibility

### Updating Styles
1. Update utility classes in `index.css` for global changes
2. Update individual components for specific changes
3. Test across all breakpoints
4. Verify dark mode compatibility

