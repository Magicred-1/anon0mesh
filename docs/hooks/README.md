# Hooks Directory

Custom React hooks for anon0mesh application.

## Available Hooks

### useBLESend

**Purpose:** Send payloads over Bluetooth Low Energy connections

**Location:** `src/hooks/useBLESend.ts`

**Quick Start:**
```typescript
import { useBLESend } from '../hooks/useBLESend';
import { PacketType } from '../domain/entities/Packet';

const { sendToDevice, isSending } = useBLESend();

// Send text message
const encoder = new TextEncoder();
const payload = encoder.encode('Hello!');
await sendToDevice('device-id', payload, { type: PacketType.MESSAGE });
```

**Documentation:**
- 📖 [Full Documentation](./useBLESend.md)
- 🚀 [Quick Reference](./QUICK_REFERENCE_useBLESend.md)
- 🏗️ [Architecture Diagram](./ARCHITECTURE_DIAGRAM.md)
- 📝 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

**Example:**
- 💡 [Complete Example Component](../../components/examples/BLESendExample.tsx)

---

### use-color-scheme

**Purpose:** Access and manage color scheme (light/dark mode)

**Location:** `src/hooks/use-color-scheme.ts`, `src/hooks/use-color-scheme.web.ts`

**Usage:**
```typescript
import { useColorScheme } from '../hooks/use-color-scheme';

const colorScheme = useColorScheme();
// Returns 'light' | 'dark' | null
```

---

### use-theme-color

**Purpose:** Get theme-specific colors

**Location:** `src/hooks/use-theme-color.ts`

**Usage:**
```typescript
import { useThemeColor } from '../hooks/use-theme-color';

const backgroundColor = useThemeColor(
  { light: '#ffffff', dark: '#000000' },
  'background'
);
```

---

## Hook Development Guidelines

### Creating a New Hook

1. **Create file** in `src/hooks/` with naming convention `use[Name].ts`
2. **Add TypeScript types** for parameters and return values
3. **Write tests** (if testing infrastructure exists)
4. **Document the hook** in this directory (`docs/hooks/`)
5. **Create example usage** in `components/examples/`

### Hook Template

```typescript
import { useState, useCallback } from 'react';

export interface UseMyHookOptions {
  // Options type
}

export interface UseMyHookReturn {
  // Return type
}

/**
 * Brief description of what the hook does
 * 
 * @example
 * ```tsx
 * const { data, loading } = useMyHook({ option: true });
 * ```
 */
export function useMyHook(options?: UseMyHookOptions): UseMyHookReturn {
  const [state, setState] = useState(initialValue);

  const action = useCallback(() => {
    // Implementation
  }, [dependencies]);

  return {
    // Return values
  };
}
```

### Documentation Structure

For each hook, create:
1. **Full documentation** (`[hookName].md`):
   - API reference
   - Usage examples
   - Advanced patterns
   - Troubleshooting

2. **Quick reference** (`QUICK_REFERENCE_[hookName].md`):
   - One-page cheat sheet
   - Common code snippets
   - Quick examples

3. **Example component** (`components/examples/[HookName]Example.tsx`):
   - Complete working example
   - UI demonstration
   - Error handling

### Best Practices

✅ **DO:**
- Use TypeScript for type safety
- Document with JSDoc comments
- Handle errors gracefully
- Provide loading/error states
- Use `useCallback` for functions
- Use `useMemo` for expensive computations
- Add examples in JSDoc

❌ **DON'T:**
- Mutate state directly
- Forget cleanup in `useEffect`
- Ignore error cases
- Create too many state variables
- Fetch data without error handling

### Testing Hooks

```typescript
// Example test structure (if testing framework is set up)
import { renderHook, act } from '@testing-library/react-hooks';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.data).toBeNull();
  });

  it('should handle action', async () => {
    const { result } = renderHook(() => useMyHook());
    await act(async () => {
      await result.current.action();
    });
    expect(result.current.data).toBeDefined();
  });
});
```

## Project-Specific Hooks Conventions

### Context-Based Hooks

If your hook uses a context (like `useBLE`), ensure:
1. Context is provided at app root
2. Hook checks if context exists
3. Provide helpful error messages

Example:
```typescript
export function useMyHook() {
  const context = useContext(MyContext);
  
  if (!context) {
    throw new Error('useMyHook must be used within MyProvider');
  }
  
  return context;
}
```

### Async Hooks

For hooks with async operations:
1. Always handle loading state
2. Always handle errors
3. Provide abort/cancel mechanism
4. Clean up on unmount

Example:
```typescript
export function useAsyncData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const result = await api.fetch();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
```

## Hook Dependencies

Common dependencies used in hooks:
- `react` - Core React hooks (useState, useEffect, etc.)
- `react-native` - Platform-specific functionality
- Project contexts (BLEContext, etc.)
- Domain entities (Packet, Peer, etc.)
- Value objects (PeerId, Nickname, etc.)

## Contributing

When adding a new hook:
1. Follow naming convention (`use[Name]`)
2. Add full TypeScript types
3. Write comprehensive documentation
4. Create example component
5. Update this README
6. Test on physical devices (if applicable)

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [React Native Hooks](https://reactnative.dev/docs/hooks)
- [Custom Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)
