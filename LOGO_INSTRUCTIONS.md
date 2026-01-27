# Logo Replacement Instructions

To add your logo to the application:

## Option 1: SVG Logo (Recommended)

1. Place your logo file in `public/logo.svg`
2. Update the following files:

### `src/components/landing/LandingPage.tsx`

Find this section (around line 14-18):
```tsx
{/* Logo Placeholder */}
<div className="mb-8">
  <div className="inline-block p-4 bg-primary-500 rounded-lg">
    <span className="text-white text-2xl font-bold">TH</span>
  </div>
</div>
```

Replace with:
```tsx
{/* Logo */}
<div className="mb-8">
  <img 
    src="/logo.svg" 
    alt="ThriverHealth.AI" 
    className="h-16 w-auto mx-auto"
  />
</div>
```

### `src/components/layout/Header.tsx`

Find this section (around line 16-20):
```tsx
<Link to="/dashboard" className="flex items-center">
  <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center mr-3">
    <span className="text-white font-bold">TH</span>
  </div>
  <span className="text-xl font-bold text-gray-900 dark:text-white">
    ThriverHealth.AI
  </span>
</Link>
```

Replace with:
```tsx
<Link to="/dashboard" className="flex items-center">
  <img 
    src="/logo.svg" 
    alt="ThriverHealth.AI" 
    className="h-10 w-auto mr-3"
  />
  <span className="text-xl font-bold text-gray-900 dark:text-white">
    ThriverHealth.AI
  </span>
</Link>
```

## Option 2: PNG/JPG Logo

1. Place your logo file in `public/logo.png` (or `.jpg`)
2. Follow the same replacement instructions as Option 1, but change the file extension in the `src` attribute

## Option 3: Custom Component

Create a reusable Logo component:

1. Create `src/components/layout/Logo.tsx`:
```tsx
interface LogoProps {
  className?: string;
}

export function Logo({ className = "h-10 w-auto" }: LogoProps) {
  return (
    <img 
      src="/logo.svg" 
      alt="ThriverHealth.AI" 
      className={className}
    />
  );
}
```

2. Import and use in `LandingPage.tsx` and `Header.tsx`:
```tsx
import { Logo } from '@/components/layout/Logo';

// Use it
<Logo className="h-16 w-auto mx-auto" />
```

## Logo Requirements

- **Format**: SVG (recommended), PNG, or JPG
- **Size**: 
  - Landing page: ~200px width recommended
  - Header: ~120px width recommended
- **Background**: Transparent background works best
- **Color**: Works well on both light and dark themes (consider using CSS filters if needed)

## Tips

- SVG logos scale better at different sizes
- Use a transparent background for flexibility
- Test the logo on both light and dark themes
- Consider creating separate logo variants for light/dark modes if needed

