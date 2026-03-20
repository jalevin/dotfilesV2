---
description: Install a Homebrew package and add it to the Brewfile
argument-hint: <package-name> [# optional comment]
allowed-tools: Bash, Read, Edit
---

Install a Homebrew package and add it to the dotfiles Brewfile: $ARGUMENTS

## Steps

### 1. Parse arguments

Split `$ARGUMENTS` on ` # ` — the part before is the package name, the part after (if present) is a comment to add inline.

### 2. Check if already installed or in Brewfile

Read `install/Brewfile` in this repo.
- If the package already appears in the Brewfile, report it and stop.

### 3. Identify formula vs. cask

Run `brew info --json=v2 <package>` to determine the type:
- If the result includes `"casks"` with entries, it's a **cask** (`cask "<name>"`).
- If it includes `"formulae"` with entries, it's a **formula** (`brew "<name>"`).
- If both are empty or the command fails, report that the package was not found and stop.

### 4. Install

Run the appropriate install command:
- Formula: `brew install <name>`
- Cask: `brew install --cask <name>`

If installation fails, report the error and stop — do not modify the Brewfile.

### 5. Add to Brewfile

Edit `install/Brewfile` directly (do **not** run `make brew-dump`, which destroys comments and formatting).

**For casks**: add to the `# ── Casks` section, in alphabetical order among existing `cask` lines.

**For formulae**: choose the most appropriate existing section based on the package's purpose (e.g. a cloud CLI goes in `# ── Cloud & Infrastructure`, a language runtime in `# ── Languages & Runtimes`, a general tool in `# ── Dev Tools`, etc.). Place it in alphabetical order within the section.

Format:
- No comment: `brew "<name>"` or `cask "<name>"`
- With comment: `brew "<name>"                   # <comment>` (align comment to column 40 if practical)

### 6. Confirm

Report what was installed and exactly what line was added to which section of the Brewfile.
