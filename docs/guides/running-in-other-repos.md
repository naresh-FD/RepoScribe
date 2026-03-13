# Using DocGen in Other Repositories

This guide explains how to use your local `docgen` installation to generate documentation for other repositories on your machine.

Since `docgen` is under active development and may have TypeScript compilation errors that prevent standard `npm link` installation, we've provided a resilient execution method.

## Recommended Method: Using `docgen.bat`

The root directory contains a `docgen.bat` script specifically designed to:
1. Automatically install dependencies if they are missing.
2. Resolve the correct `docgen` path regardless of where you call the script from.
3. Use `tsx` to execute the TypeScript source directly, bypassing any `tsc` build errors.

### Option A: Call via Absolute Path

The simplest way to use `docgen` is to call the batch script using its full path. 

Open a command prompt inside your target repository and run:

```cmd
f:\docgen\docgen.bat generate
```

### Option B: Add to Windows PATH (Best Developer Experience)

If you plan to use `docgen` frequently across multiple repositories, adding it to your system's `PATH` will allow you to use it like a native tool.

1. Open the Windows Start menu.
2. Search for **Environment Variables** and select **"Edit the system environment variables"**.
3. In the System Properties window, click the **Environment Variables...** button.
4. Under the **User variables** section, find and select **`Path`**, then click **Edit...**.
5. Click **New** and paste the path to your docgen directory: `f:\docgen`
6. Click **OK** on all windows to save the changes.
7. Open a **new** command prompt in your target repository.

You can now use `docgen` just by typing:

```cmd
docgen.bat generate
```

## Alternative Method: Direct `npx` Execution

If you prefer not to use the batch script, or if you want to add `docgen` as a package script in your target repository's `package.json`, you can run the execution command directly:

```json
{
  "scripts": {
    "docs": "npx --yes tsx f:/docgen/packages/cli/src/index.ts generate"
  }
}
```

Then you can run `npm run docs` in your target repository.

## Future Standard Method: `npm link`

Once the `docgen` tool achieves a stable build state (i.e., `npm run build` succeeds locally without TypeScript errors), you can switch to the standard Node.js global linking method.

1. In the `f:\docgen\packages\cli` directory, run:
   ```cmd
   npm link
   ```
2. Now `docgen` is globally installed on your system.
3. In any other repository, you can simply run:
   ```cmd
   docgen generate
   ```

*Note: Until the compilation errors in `@docgen/renderer-markdown` and other packages are resolved, `npm link` will likely fail during its automatic build step, which is why the `docgen.bat` approach is recommended.*
