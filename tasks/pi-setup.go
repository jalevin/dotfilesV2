package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
)

type piSetup struct {
	Packages []string `json:"packages"`
	Servers  map[string]struct {
		URL      string `json:"url"`
		Exposure string `json:"exposure"`
	} `json:"mcpServers"`
}

func readPiJSON(path string, value any, optional bool) error {
	data, err := os.ReadFile(path)
	if optional && errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, value)
}
func configurePi() error {
	if _, err := exec.LookPath("pi"); err != nil {
		return fmt.Errorf("install Pi first with bash install/scripts/pi.sh: %w", err)
	}
	var setup piSetup
	if err := readPiJSON("home/.pi/setup.json", &setup, false); err != nil {
		return err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	var settings struct {
		Packages []json.RawMessage `json:"packages"`
	}
	if err := readPiJSON(filepath.Join(home, ".pi/agent/settings.json"), &settings, true); err != nil {
		return err
	}
	var installed []string
	for _, item := range settings.Packages {
		var source string
		if json.Unmarshal(item, &source) != nil {
			var obj struct {
				Source string `json:"source"`
			}
			if err := json.Unmarshal(item, &obj); err != nil {
				return err
			}
			source = obj.Source
		}
		installed = append(installed, source)
	}
	run := func(args ...string) error {
		fmt.Println("pi", args)
		cmd := exec.Command("pi", args...)
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		return cmd.Run()
	}
	for _, source := range setup.Packages {
		if !slices.Contains(installed, source) {
			if err := run("install", source); err != nil {
				return err
			}
		}
	}
	var mcp struct {
		Servers map[string]struct {
			URL      string `json:"url"`
			Exposure string `json:"exposure"`
		} `json:"mcpServers"`
	}
	if err := readPiJSON(filepath.Join(home, ".pi/agent/mcp.json"), &mcp, true); err != nil {
		return err
	}
	for name, server := range setup.Servers {
		if current, ok := mcp.Servers[name]; ok && current.URL == server.URL && current.Exposure == server.Exposure {
			continue
		}
		if err := run("mcp", "add", name, "--url", server.URL, "--exposure", server.Exposure); err != nil {
			return err
		}
	}
	fmt.Println("Pi packages and MCP configuration are in sync.")
	return nil
}
func main() {
	if err := configurePi(); err != nil {
		fmt.Fprintln(os.Stderr, "pi-setup:", err)
		os.Exit(1)
	}
}
