import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
const install=join(homedir(),".pi/agent/install"),version=readFileSync(join(install,"current-version"),"utf8").trim();
const modules=join(install,"releases",version,"node_modules"),require=createRequire(join(modules,"package.json"));
const {createJiti}=require("jiti");
const tui=await import(join(modules,"@earendil-works/pi-tui/dist/index.js"));
const themeApi=await import(join(modules,"@earendil-works/pi-coding-agent/dist/modes/interactive/theme/theme.js"));
const jiti=createJiti(import.meta.url,{alias:{
 "@earendil-works/pi-tui":join(modules,"@earendil-works/pi-tui/dist/index.js"),
 "@earendil-works/pi-coding-agent":join(modules,"@earendil-works/pi-coding-agent/dist/index.js"),
}});
const {default:extension,PromptEditor}=await jiti.import(new URL("../home/.pi/agent/extensions/editor.ts",import.meta.url).pathname);
const palette=themeApi.loadThemeFromPath(new URL("../home/.pi/agent/themes/codex.json",import.meta.url).pathname,"truecolor");
const identity=(s:string)=>s;
const editorTheme={borderColor:identity,selectList:{selectedPrefix:identity,selectedText:identity,description:identity,scrollInfo:identity,noMatch:identity}};
function create(){return new PromptEditor({terminal:{rows:30},requestRender:()=>{}},editorTheme,{matches:()=>false},()=>palette)}

test("editor is a filled prompt box without horizontal rules",()=>{
 const editor=create();editor.focused=true;editor.setText("hello");
 const lines=editor.render(100),plain=lines.map(tui.stripTerminalSequences);
 assert.match(plain[1],/^> hello/);assert.equal(plain[0].trim(),"");assert.equal(plain[2].trim(),"");
 assert.equal(plain.some((line:string)=>line.includes("─")),false);
 assert.ok(lines[1].includes("\x1b[48;2;59;59;59m"));
 assert.ok(lines[0].includes("\x1b[48;2;59;59;59m"));
 assert.ok(lines[2].includes("\x1b[48;2;59;59;59m"));
 assert.equal(tui.visibleWidth(lines[0]),100);assert.equal(tui.visibleWidth(lines[2]),100);
 assert.equal(lines.length,3);
 assert.ok(lines[1].includes(tui.CURSOR_MARKER));assert.equal(editor.getText(),"hello");
});
test("multiline input and Unicode keep the correct content and width",()=>{
 const editor=create();editor.focused=true;editor.setText("First line\nSecond 界 line with a longer continuation");
 for(const width of [1,2,3,8,20,80,140]){
  const lines=editor.render(width);
  assert.ok(lines.every((line:string)=>tui.visibleWidth(line)<=width),`overflow at ${width}`);
 }
 const lines=editor.render(80).map(tui.stripTerminalSequences);
 assert.match(lines[1],/^> First line/);assert.match(lines[2],/^  Second 界/);
 assert.equal(editor.getText(),"First line\nSecond 界 line with a longer continuation");
});
test("mouse coordinates account for the prompt gutter",()=>{
 const editor=create();editor.setText("hello");editor.render(80);
 editor.handleMouse({type:"click",button:"left",x:4,y:1,screenX:4,screenY:1,width:80,height:3,shift:false,alt:false,ctrl:false});
 assert.deepEqual(editor.getCursor(),{line:0,col:2});
});
test("app actions and submission continue through the native CustomEditor",()=>{
 const editor=create();let submitted="",interrupted=false;
 editor.onSubmit=(text:string)=>submitted=text;editor.setText("hello");editor.handleInput("\r");
 assert.equal(submitted,"hello");
 editor.onEscape=()=>interrupted=true;
 // CustomEditor checks application bindings before passing ordinary edits through.
 const other=new PromptEditor({terminal:{rows:30},requestRender:()=>{}},editorTheme,{matches:(data:string,key:string)=>data==="\x1b"&&key==="app.interrupt"},()=>palette);
 other.onEscape=()=>interrupted=true;other.handleInput("\x1b");assert.equal(interrupted,true);
});
test("autocomplete remains outside the filled box and keeps its native behavior",async()=>{
 const editor=create();editor.setAutocompleteProvider({
  triggerCharacters:["$"],getSuggestions:async()=>({prefix:"$",items:[{value:"$review",label:"$review"},{value:"$research",label:"$research"}]}),
  applyCompletion:()=>({lines:["$review "],cursorLine:0,cursorCol:8}),
 });
 editor.setText("$");editor.handleInput("\t");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(editor.isShowingAutocomplete(),true);
 const lines=editor.render(100),plain=lines.map(tui.stripTerminalSequences);
 assert.ok(plain.some((line:string)=>line.includes("$review")));
 const menuLine=lines.find((line:string)=>tui.stripTerminalSequences(line).includes("$review"));
 assert.equal(menuLine.includes("\x1b[48;2;59;59;59m"),false);
 editor.handleInput("\t");assert.equal(editor.getText(),"$review ");
});
test("extension installs only for the TUI and restores the default on shutdown",()=>{
 const events=new Map<string,any>();let installed:any;
 extension({on:(name:string,callback:any)=>events.set(name,callback)});
 const ctx={mode:"rpc",ui:{setEditorComponent:(factory:any)=>installed=factory}};
 events.get("session_start")({},ctx);assert.equal(installed,undefined);
 ctx.mode="tui";events.get("session_start")({},ctx);assert.equal(typeof installed,"function");
 events.get("session_shutdown")({},ctx);assert.equal(installed,undefined);
});
