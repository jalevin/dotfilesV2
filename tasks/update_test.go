package main

import (
	"bytes"
	"errors"
	"reflect"
	"slices"
	"strings"
	"testing"
)

func TestUpdate(t *testing.T) {
	for _, tt := range []struct {
		name       string
		args       []string
		packages   string
		tools      string
		failure    string
		want       [][]string
		wantError  string
		wantOutput string
	}{
		{
			name: "mixed names and backend short name",
			args: []string{"codex", "--bump", "hive", "plannotator"},
			want: [][]string{
				{"bootstrap", "packages", "upgrade", "--yes", "brew-cask:codex"},
				{"upgrade", "--bump", "hive"},
				{"upgrade", "--bump", "github:backnotprop/plannotator"},
			},
		},
		{
			name: "all preserves pins",
			want: [][]string{{"bootstrap", "packages", "upgrade", "--yes"}, {"upgrade"}},
		},
		{
			name: "all with bump",
			args: []string{"--bump"},
			want: [][]string{{"bootstrap", "packages", "upgrade", "--yes"}, {"upgrade", "--bump"}},
		},
		{
			name: "full names and duplicates",
			args: []string{"brew:jq", "jq", "tool:hive", "github:backnotprop/plannotator"},
			want: [][]string{
				{"bootstrap", "packages", "upgrade", "--yes", "brew:jq"},
				{"upgrade", "hive"},
				{"upgrade", "github:backnotprop/plannotator"},
			},
		},
		{
			name: "unknown name prevents all upgrades", args: []string{"codex", "typo"},
			wantError: `"typo" is not a declared`,
		},
		{
			name: "ambiguous name", args: []string{"jq"}, tools: `{"jq":[]}`,
			wantError: "brew:jq, tool:jq",
		},
		{
			name: "explicit tool", args: []string{"tool:jq"}, tools: `{"jq":[]}`,
			want: [][]string{{"upgrade", "jq"}},
		},
		{
			name: "package discovery failure", args: []string{"hive"}, failure: "bootstrap",
			wantError: "reading package status: failed",
		},
		{
			name: "tool discovery failure", args: []string{"hive"}, failure: "ls",
			wantError: "reading configured tools: failed",
		},
		{
			name: "invalid JSON", args: []string{"hive"}, tools: `invalid`,
			wantError: "decoding configured tools",
		},
		{
			name: "dry run", args: []string{"hive", "--bump", "--dry-run"},
			wantOutput: "==> mise upgrade --bump hive",
		},
		{
			name: "absent package", args: []string{"old"},
			packages:  `{"brew":{"packages":[{"package":"old","desired_state":"absent"}]}}`,
			wantError: `"old" is not a declared`,
		},
		{
			name: "upgrade failure stops further commands", args: []string{"hive", "codex"},
			failure: "upgrade", want: [][]string{{"upgrade", "hive"}},
			wantError: "mise upgrade hive: failed",
		},
		{
			name: "unknown flag", args: []string{"--oops"}, wantError: "unknown option",
		},
		{
			name: "help", args: []string{"--help"}, wantOutput: "Usage: mise update",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var calls [][]string
			run := func(args []string, capture bool) ([]byte, error) {
				if !capture {
					calls = append(calls, slices.Clone(args))
				}
				if args[0] == tt.failure {
					return nil, errors.New("failed")
				}
				if !capture {
					return nil, nil
				}
				switch {
				case slices.Equal(args, []string{"bootstrap", "packages", "status", "--json"}):
					if tt.packages != "" {
						return []byte(tt.packages), nil
					}
					return []byte(`{"brew-cask":{"packages":[{"package":"codex"}]},"brew":{"packages":[{"package":"jq"}]}}`), nil
				case slices.Equal(args, []string{"ls", "--current", "--json"}):
					if tt.tools != "" {
						return []byte(tt.tools), nil
					}
					return []byte(`{"hive":[],"github:backnotprop/plannotator":[]}`), nil
				default:
					t.Fatalf("unexpected discovery command: %v", args)
					return nil, nil
				}
			}
			var out bytes.Buffer
			err := update(tt.args, run, &out)
			if tt.wantError == "" && err != nil {
				t.Fatalf("update: %v", err)
			}
			if tt.wantError != "" && (err == nil || !strings.Contains(err.Error(), tt.wantError)) {
				t.Fatalf("error = %v, want containing %q", err, tt.wantError)
			}
			if !reflect.DeepEqual(calls, tt.want) {
				t.Errorf("upgrades = %v, want %v", calls, tt.want)
			}
			if !strings.Contains(out.String(), tt.wantOutput) {
				t.Errorf("output = %q, want containing %q", out.String(), tt.wantOutput)
			}
		})
	}
}
