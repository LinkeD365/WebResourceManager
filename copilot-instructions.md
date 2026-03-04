# WebResourceManager Development Guidelines

## UI Components

- **Never use Tooltips** — avoid `<Tooltip>` components from `@fluentui/react-components`
- Use React functional components with hooks
- Use MobX for state management with the `observer` HOC
- Use Fluent UI (`@fluentui/react-components`) components
- Keep style objects inline with clear structure
- Extract reusable utility functions

## Code Style & Conventions

- Use TypeScript with strict typing
- Import order: React → third-party → local models → local services → local components
- Always add TypeScript interfaces for props
- Use seperate files for each component and model

## Common Tasks

When updating the code viewer:

- Update both `prettifyCode()` function and button UI
- Remember: js-beautify is now the formatter (not Prettier)
- Test theme switching with data-theme attribute

## When modifying components:

- Keep components focused and single-responsibility
- Modularize related logic into separate components
- Always use the observer HOC for MobX store dependencies
- use https://github.com/MscrmTools/MsCrmTools.WebResourcesManager for WebResource related operations
- Always use @pptb/types for shared types and interfaces and any interfaces

## Build & Testing

- Run `npm run build` to verify TypeScript compilation
- Check browser console for runtime errors
- Use `@ts-ignore` sparingly, only for untyped third-party libraries
