package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"slices"
	"strconv"
	"strings"
)

type target struct {
	tool bool
	spec string
}

type packageStatus struct {
	Packages []struct {
		Name         string `json:"package"`
		DesiredState string `json:"desired_state"`
	} `json:"packages"`
}

type commandRunner func(args []string, capture bool) ([]byte, error)

func runMise(args []string, capture bool) ([]byte, error) {
	cmd := exec.Command("mise", args...)
	cmd.Stdin = os.Stdin
	cmd.Stderr = os.Stderr
	if capture {
		return cmd.Output()
	}
	cmd.Stdout = os.Stdout
	return nil, cmd.Run()
}

func discover(run commandRunner) ([]target, error) {
	data, err := run([]string{"bootstrap", "packages", "status", "--json"}, true)
	if err != nil {
		return nil, fmt.Errorf("reading package status: %w", err)
	}
	var packages map[string]packageStatus
	if err := json.Unmarshal(data, &packages); err != nil {
		return nil, fmt.Errorf("decoding package status: %w", err)
	}
	data, err = run([]string{"ls", "--current", "--json"}, true)
	if err != nil {
		return nil, fmt.Errorf("reading configured tools: %w", err)
	}
	var tools map[string]json.RawMessage
	if err := json.Unmarshal(data, &tools); err != nil {
		return nil, fmt.Errorf("decoding configured tools: %w", err)
	}
	var targets []target
	for manager, status := range packages {
		for _, pkg := range status.Packages {
			if pkg.DesiredState != "absent" {
				t := target{spec: manager + ":" + pkg.Name}
				if !slices.Contains(targets, t) {
					targets = append(targets, t)
				}
			}
		}
	}
	for name := range tools {
		targets = append(targets, target{tool: true, spec: name})
	}
	return targets, nil
}

func resolve(names []string, candidates []target) ([]target, error) {
	var selected []target
	for _, name := range names {
		var matches []target
		for _, candidate := range candidates {
			_, unqualified, prefixed := strings.Cut(candidate.spec, ":")
			if !prefixed {
				unqualified = candidate.spec
			}
			if strings.HasPrefix(name, "tool:") {
				if candidate.tool && candidate.spec == strings.TrimPrefix(name, "tool:") {
					matches = append(matches, candidate)
				}
			} else if name == candidate.spec || name == unqualified {
				matches = append(matches, candidate)
			}
		}
		if len(matches) == 0 && !strings.HasPrefix(name, "tool:") {
			for _, candidate := range candidates {
				if name == path.Base(candidate.spec) {
					matches = append(matches, candidate)
				}
			}
		}
		if len(matches) == 0 {
			return nil, fmt.Errorf("%q is not a declared package or tool", name)
		}
		if len(matches) > 1 {
			var choices []string
			for _, match := range matches {
				spec := match.spec
				if match.tool {
					spec = "tool:" + spec
				}
				choices = append(choices, spec)
			}
			slices.Sort(choices)
			return nil, fmt.Errorf("%q is ambiguous; use one of: %s", name, strings.Join(choices, ", "))
		}
		if !slices.Contains(selected, matches[0]) {
			selected = append(selected, matches[0])
		}
	}
	return selected, nil
}

func update(args []string, run commandRunner, out io.Writer) error {
	var names []string
	var bump, dryRun, positional bool
	for _, arg := range args {
		if positional {
			names = append(names, arg)
			continue
		}
		switch arg {
		case "--":
			positional = true
		case "-b", "--bump":
			bump = true
		case "-n", "--dry-run":
			dryRun = true
		case "-h", "--help":
			fmt.Fprintln(out, "Usage: mise update [names...] [--bump] [--dry-run]")
			fmt.Fprintln(out, "No names upgrades all packages and tools. Names may include manager/backend prefixes.")
			fmt.Fprintln(out, "--bump rewrites tool pins; --dry-run previews routing without upgrading.")
			return nil
		default:
			if strings.HasPrefix(arg, "-") {
				return fmt.Errorf("unknown option %q", arg)
			}
			names = append(names, arg)
		}
	}

	packageCommand := []string{"bootstrap", "packages", "upgrade", "--yes"}
	toolCommand := []string{"upgrade"}
	if bump {
		toolCommand = append(toolCommand, "--bump")
	}
	commands := [][]string{packageCommand, toolCommand}
	if len(names) > 0 {
		candidates, err := discover(run)
		if err != nil {
			return err
		}
		// Resolve all names before upgrades so a typo cannot partially apply.
		selected, err := resolve(names, candidates)
		if err != nil {
			return err
		}
		commands = nil
		for _, t := range selected {
			command := packageCommand
			if t.tool {
				command = toolCommand
			}
			commands = append(commands, append(slices.Clone(command), t.spec))
		}
	}
	for _, command := range commands {
		display := slices.Clone(command)
		for i, arg := range display {
			if strings.ContainsAny(arg, " \t\n'\"\\$`;|&()<>*?!") {
				display[i] = strconv.Quote(arg)
			}
		}
		fmt.Fprintln(out, "==> mise "+strings.Join(display, " "))
		if !dryRun {
			if _, err := run(command, false); err != nil {
				return fmt.Errorf("mise %s: %w", strings.Join(display, " "), err)
			}
		}
	}
	return nil
}

func main() {
	if err := update(os.Args[1:], runMise, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "update:", err)
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) && exitErr.ExitCode() > 0 {
			os.Exit(exitErr.ExitCode())
		}
		os.Exit(1)
	}
}
