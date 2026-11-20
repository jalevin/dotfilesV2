package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

var pinned = map[string]map[string]any{
	"reviewer": {"model": "anthropic/claude-opus-5-5", "thinking": "high"},
}

func readSettings(t *testing.T, path string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]any
	if err := json.Unmarshal(data, &settings); err != nil {
		t.Fatal(err)
	}
	return settings
}

// Pi writes its own state (deviceId, packages, other subagents settings, and
// overrides the user set by hand) into the same file, so the merge must touch
// only the managed fields and be a no-op when they already match.
func TestSetAgentOverridesKeepsUnmanagedKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	initial := `{
  "deviceId": "abc",
  "packages": ["npm:pi-subagents@0.83.0"],
  "subagents": {
    "maxThinking": "high",
    "agentOverrides": {
      "reviewer": {"model": "openai-codex/gpt-6-sol", "disabled": false},
      "scout": {"model": "anthropic/claude-haiku-4-5"}
    }
  }
}`
	if err := os.WriteFile(path, []byte(initial), 0o600); err != nil {
		t.Fatal(err)
	}

	changed, err := setAgentOverrides(path, pinned)
	if err != nil || !changed {
		t.Fatalf("first merge: changed=%v err=%v, want changed", changed, err)
	}
	settings := readSettings(t, path)
	if settings["deviceId"] != "abc" || len(settings["packages"].([]any)) != 1 {
		t.Fatalf("top-level keys not preserved: %v", settings)
	}
	subagents := settings["subagents"].(map[string]any)
	if subagents["maxThinking"] != "high" {
		t.Fatalf("subagents.maxThinking not preserved: %v", subagents)
	}
	overrides := subagents["agentOverrides"].(map[string]any)
	reviewer := overrides["reviewer"].(map[string]any)
	if reviewer["model"] != "anthropic/claude-opus-5-5" || reviewer["thinking"] != "high" {
		t.Fatalf("reviewer not pinned: %v", reviewer)
	}
	if reviewer["disabled"] != false {
		t.Fatalf("unmanaged reviewer field dropped: %v", reviewer)
	}
	if overrides["scout"].(map[string]any)["model"] != "anthropic/claude-haiku-4-5" {
		t.Fatalf("unmanaged agent override dropped: %v", overrides)
	}
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
		t.Fatalf("file mode changed to %v", info.Mode().Perm())
	}

	changed, err = setAgentOverrides(path, pinned)
	if err != nil || changed {
		t.Fatalf("second merge: changed=%v err=%v, want no change", changed, err)
	}
}

func TestSetAgentOverridesCreatesMissingSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	changed, err := setAgentOverrides(path, pinned)
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v, want changed", changed, err)
	}
	reviewer := readSettings(t, path)["subagents"].(map[string]any)["agentOverrides"].(map[string]any)["reviewer"].(map[string]any)
	if reviewer["thinking"] != "high" {
		t.Fatalf("reviewer not pinned: %v", reviewer)
	}
}
