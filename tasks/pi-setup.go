package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"slices"
	"strconv"
)

// mcpServer mirrors the subset of a ~/.pi/agent/mcp.json entry that setup manages.
type mcpServer struct {
	URL         string   `json:"url,omitempty"`
	Command     string   `json:"command,omitempty"`
	Args        []string `json:"args,omitempty"`
	OAuth       *oauth   `json:"oauth,omitempty"`
	Exposure    string   `json:"exposure,omitempty"`
	Description string   `json:"description,omitempty"`
}

// oauth pins a pre-registered client for servers without dynamic registration.
type oauth struct {
	ClientID     string `json:"clientId,omitempty"`
	CallbackPort int    `json:"callbackPort,omitempty"`
	// CallbackURL overrides Pi's 127.0.0.1 redirect for clients registered with
	// localhost. `pi mcp add` has no flag for it, so setCallbackURL writes it.
	CallbackURL string `json:"callbackUrl,omitempty"`
}

// setCallbackURL writes oauth.callbackUrl for one server in mcp.json, keeping
// every other entry and key as Pi wrote it.
func setCallbackURL(path, name, url string) error {
	var file map[string]json.RawMessage
	if err := readPiJSON(path, &file, false); err != nil {
		return err
	}
	var servers map[string]map[string]json.RawMessage
	if err := json.Unmarshal(file["mcpServers"], &servers); err != nil {
		return err
	}
	server, ok := servers[name]
	if !ok {
		return fmt.Errorf("%s: server %q missing after pi mcp add", path, name)
	}
	var auth map[string]any
	if raw, ok := server["oauth"]; ok {
		if err := json.Unmarshal(raw, &auth); err != nil {
			return err
		}
	}
	if auth == nil {
		auth = map[string]any{}
	}
	auth["callbackUrl"] = url
	var err error
	if server["oauth"], err = json.Marshal(auth); err != nil {
		return err
	}
	if file["mcpServers"], err = json.Marshal(servers); err != nil {
		return err
	}
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o600)
}

// piSetup is a setup manifest. In a machine overlay, a null server removes it.
// AgentOverrides pins fields such as model and thinking for pi-subagents agents
// whose definitions ship inside the package and would be overwritten on update.
type piSetup struct {
	Packages       []string                  `json:"packages"`
	Servers        map[string]*mcpServer     `json:"mcpServers"`
	AgentOverrides map[string]map[string]any `json:"agentOverrides"`
}

// setAgentOverrides merges the managed fields into settings.json at
// subagents.agentOverrides.<agent>.<field>, keeping every other key and agent
// as they are. It writes only when a managed value differs, and reports whether
// it changed the file.
func setAgentOverrides(path string, overrides map[string]map[string]any) (bool, error) {
	if len(overrides) == 0 {
		return false, nil
	}
	file := map[string]json.RawMessage{}
	if err := readPiJSON(path, &file, true); err != nil {
		return false, err
	}
	subagents := map[string]json.RawMessage{}
	if raw, ok := file["subagents"]; ok {
		if err := json.Unmarshal(raw, &subagents); err != nil {
			return false, fmt.Errorf("%s: subagents: %w", path, err)
		}
	}
	current := map[string]map[string]any{}
	if raw, ok := subagents["agentOverrides"]; ok {
		if err := json.Unmarshal(raw, &current); err != nil {
			return false, fmt.Errorf("%s: subagents.agentOverrides: %w", path, err)
		}
	}
	changed := false
	for agent, fields := range overrides {
		if current[agent] == nil {
			current[agent] = map[string]any{}
		}
		for field, value := range fields {
			if !reflect.DeepEqual(current[agent][field], value) {
				current[agent][field] = value
				changed = true
			}
		}
	}
	if !changed {
		return false, nil
	}
	var err error
	if subagents["agentOverrides"], err = json.Marshal(current); err != nil {
		return false, err
	}
	if file["subagents"], err = json.Marshal(subagents); err != nil {
		return false, err
	}
	data, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return false, err
	}
	mode := os.FileMode(0o644)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode().Perm()
	}
	return true, os.WriteFile(path, append(data, '\n'), mode)
}

// loadSetup merges home/.pi/setup.json with the overlay for MISE_ENV.
func loadSetup() (piSetup, error) {
	var setup piSetup
	if err := readPiJSON("home/.pi/setup.json", &setup, false); err != nil {
		return setup, err
	}
	machine := os.Getenv("MISE_ENV")
	if machine != "grafana" && machine != "personal" {
		return setup, fmt.Errorf("set MISE_ENV to exactly grafana or personal (mise run stamp), got %q", machine)
	}
	var overlay piSetup
	if err := readPiJSON("home/.pi/setup."+machine+".json", &overlay, false); err != nil {
		return setup, err
	}
	setup.Packages = append(setup.Packages, overlay.Packages...)
	for name, server := range overlay.Servers {
		setup.Servers[name] = server
	}
	for agent, fields := range overlay.AgentOverrides {
		if setup.AgentOverrides == nil {
			setup.AgentOverrides = map[string]map[string]any{}
		}
		if setup.AgentOverrides[agent] == nil {
			setup.AgentOverrides[agent] = map[string]any{}
		}
		for field, value := range fields {
			setup.AgentOverrides[agent][field] = value
		}
	}
	return setup, nil
}

func addArgs(name string, server mcpServer) []string {
	args := []string{"mcp", "add", name, "--exposure", server.Exposure}
	if server.Description != "" {
		args = append(args, "--description", server.Description)
	}
	if server.OAuth != nil {
		if server.OAuth.ClientID != "" {
			args = append(args, "--oauth-client-id", server.OAuth.ClientID)
		}
		if server.OAuth.CallbackPort != 0 {
			args = append(args, "--oauth-callback-port", strconv.Itoa(server.OAuth.CallbackPort))
		}
	}
	if server.URL != "" {
		return append(args, "--url", server.URL)
	}
	return append(append(args, "--", server.Command), server.Args...)
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
	setup, err := loadSetup()
	if err != nil {
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
		Servers map[string]mcpServer `json:"mcpServers"`
	}
	mcpPath := filepath.Join(home, ".pi/agent/mcp.json")
	if err := readPiJSON(mcpPath, &mcp, true); err != nil {
		return err
	}
	for name, server := range setup.Servers {
		current, ok := mcp.Servers[name]
		if server == nil {
			if ok {
				if err := run("mcp", "remove", name); err != nil {
					return err
				}
			}
			continue
		}
		if ok && reflect.DeepEqual(current, *server) {
			continue
		}
		if err := run(addArgs(name, *server)...); err != nil {
			return err
		}
		if server.OAuth != nil && server.OAuth.CallbackURL != "" {
			if err := setCallbackURL(mcpPath, name, server.OAuth.CallbackURL); err != nil {
				return err
			}
		}
	}
	changed, err := setAgentOverrides(filepath.Join(home, ".pi/agent/settings.json"), setup.AgentOverrides)
	if err != nil {
		return err
	}
	if changed {
		fmt.Println("Updated subagents.agentOverrides in ~/.pi/agent/settings.json.")
	}
	fmt.Println("Pi packages, MCP configuration, and agent overrides are in sync.")
	return nil
}
func main() {
	if err := configurePi(); err != nil {
		fmt.Fprintln(os.Stderr, "pi-setup:", err)
		os.Exit(1)
	}
}
