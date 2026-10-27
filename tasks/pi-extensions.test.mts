import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,promises as fs} from "node:fs";
import {homedir,tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
const install=join(homedir(),".pi/agent/install"),version=readFileSync(join(install,"current-version"),"utf8").trim();
const modules=join(install,"releases",version,"node_modules"),require=createRequire(join(modules,"package.json"));
const {createJiti}=require("jiti");
const alias=Object.fromEntries(["pi-coding-agent","pi-tui","pi-ai","pi-agent-core"].map(p=>["@earendil-works/"+p,join(modules,"@earendil-works",p,"dist/index.js")]));
alias.typebox=join(modules,"typebox/build/index.mjs");
const jiti=createJiti(import.meta.url,{alias});
const load=(file:string)=>jiti.import(new URL("../home/.pi/agent/extensions/"+file,import.meta.url).pathname);
const menu=await load("skill-menu.ts"),questions=await load("ask-user-question.ts"),handoff=await load("handoff.ts"),review=await load("review/index.ts");
function api(){
 const events=new Map<string,any>(),commands=new Map<string,any>(),tools:any[]=[],sent:string[]=[];
 return {events,commands,tools,sent,on:(name:string,callback:any)=>events.set(name,callback),
 registerCommand:(name:string,value:any)=>commands.set(name,value),registerTool:(value:any)=>tools.push(value),
 sendUserMessage:(text:string)=>sent.push(text)};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test("dollar skills expand through the native skill command and preserve arguments",()=>{
 const skills=[{name:"review"}];
 assert.equal(menu.expandDollarSkill("$review https://github.com/acme/app/pull/2",skills),"/skill:review https://github.com/acme/app/pull/2");
 assert.equal(menu.expandDollarSkill("$review\nlook at auth",skills),"/skill:review look at auth");
 for(const literal of ["$HOME","$unknown","echo $review","price is $42"])assert.equal(menu.expandDollarSkill(literal,skills),undefined);
});
test("dollar menu filters discovered skills and preserves existing completion providers",async()=>{
 let delegated=0;
 const base={triggerCharacters:["@"],getSuggestions:async()=>{delegated++;return null},applyCompletion:()=>({fallback:true})};
 const provider=menu.skillAutocomplete(base,()=>[{name:"review",description:"Review code"},{name:"research"},{name:"wrap"}]);
 assert.deepEqual(provider.triggerCharacters,["@","$"]);
 const all=await provider.getSuggestions(["$"],0,1,{});assert.equal(all.items.length,3);
 const found=await provider.getSuggestions(["$rev"],0,4,{});assert.deepEqual(found.items.map((i:any)=>i.value),["$review"]);
 const completed=provider.applyCompletion(["$rev url"],0,4,found.items[0],"$rev");
 assert.deepEqual(completed,{lines:["$review url"],cursorLine:0,cursorCol:7});
 await provider.getSuggestions(["@file"],0,5,{});assert.equal(delegated,1);
 assert.deepEqual(provider.applyCompletion(["@file"],0,5,{value:"file"},"@file"),{fallback:true});
});
test("skill menu hooks use Pi's live skill catalog",()=>{
 const pi=api();(pi as any).getCommands=()=>[{name:"skill:review",source:"skill"},{name:"ci-watch",source:"extension"}];menu.default(pi);
 const result=pi.events.get("input")({text:"$review PR"});assert.equal(result.text,"/skill:review PR");
 assert.equal(pi.events.get("input")({text:"$ci-watch"}).action,"continue");
});
const question={question:"Which mode?",header:"Mode",options:[{label:"Watch",description:"Observe"},{label:"Fix",description:"Repair"}]};
test("structured questions work with RPC-native selectors and custom answers",async()=>{
 const pi=api();questions.default(pi);const tool=pi.tools[0];
 const result=await tool.execute("id",{questions:[question]},undefined,undefined,{hasUI:true,mode:"rpc",ui:{select:async()=>"Fix"}});
 assert.equal(result.details.answers[0].answer,"Fix");assert.equal(result.details.cancelled,false);
 const custom=await tool.execute("id",{questions:[question]},undefined,undefined,{hasUI:true,mode:"rpc",ui:{select:async()=>"Type something.",input:async()=>"Discuss first"}});
 assert.equal(custom.details.answers[0].answer,"Discuss first");
});
test("RPC questions support multi-select, previews, and cancellation",async()=>{
 const pi=api();questions.default(pi);const tool=pi.tools[0],answers=["Watch","Fix","Finish selecting"];
 const result=await tool.execute("id",{questions:[{...question,multiSelect:true}]},undefined,undefined,{hasUI:true,mode:"rpc",ui:{select:async()=>answers.shift()}});
 assert.deepEqual(result.details.answers[0].selected,["Watch","Fix"]);
 const cancelled=await tool.execute("id",{questions:[question]},undefined,undefined,{hasUI:true,mode:"rpc",ui:{select:async()=>undefined}});
 assert.equal(cancelled.details.cancelled,true);
 const noUI=await tool.execute("id",{questions:[question]},undefined,undefined,{hasUI:false});assert.equal(noUI.details.error,"no_ui");
});
test("handoffs include the latest compaction plus retained conversation",()=>{
 const message=(id:string,text:string)=>({type:"message",id,message:{role:"user",content:text,timestamp:0}});
 const result=handoff.getHandoffMessages([message("old","old"),message("keep","retained"),
 {type:"compaction",id:"compact",summary:"Summary",tokensBefore:100,firstKeptEntryId:"keep",timestamp:"2026-10-27T00:00:00Z"},message("new","recent")]);
 assert.equal(result[0].role,"compactionSummary");assert.deepEqual(result.slice(1).map((m:any)=>m.content),["retained","recent"]);
});
function handoffContext(){
 const sent:string[]=[],ctx:any={model:{id:"selected-model"},hasUI:true,waitForIdle:async()=>{},
 sessionManager:{getSessionFile:()=>"parent.jsonl",getBranch:()=>[{type:"message",message:{role:"user",content:"Implement feature",timestamp:0}}]},
 modelRegistry:{complete:async()=>({stopReason:"stop",content:[{type:"text",text:"Continue with tests"}]})},
 ui:{notify:()=>{},setStatus:()=>{},editor:async(_title:string,text:string)=>text},
 newSession:async(options:any)=>{assert.equal(options.parentSession,"parent.jsonl");await options.withSession({sendUserMessage:async(text:string)=>sent.push(text)});return{cancelled:false}}};
 return{ctx,sent};
}
test("handoff preview can cancel before replacing the session",async()=>{
 const pi=api();handoff.default(pi);const {ctx,sent}=handoffContext();ctx.ui.editor=async()=>undefined;
 await pi.commands.get("handoff").handler("write tests",ctx);assert.equal(sent.length,0);
});
test("edited handoff and automatic handoff use the replacement session context",async()=>{
 for(const command of ["handoff","handoff-auto"]){
  const pi=api();handoff.default(pi);const{ctx,sent}=handoffContext();ctx.ui.editor=async()=>"Edited handoff";
  await pi.commands.get(command).handler("write tests",ctx);
  assert.deepEqual(sent,[command==="handoff"?"Edited handoff":"Continue with tests"]);assert.equal(pi.sent.length,0);
 }
});
test("Plannotator distinguishes cancellation from annotations and validates JSON",()=>{
 assert.equal(review.reviewFeedback('{"decision":"dismissed","message":""}').decision,"dismissed");
 assert.match(review.reviewFeedback('{"decision":"annotated","message":"Fix test"}').content,/Fix test/);
 assert.throws(()=>review.reviewFeedback("not JSON"));assert.throws(()=>review.reviewFeedback('{}'),/structured decision/);
});
test("document picker follows the .hive symlink without looping",async()=>{
 const dir=await fs.mkdtemp(join(tmpdir(),"pi-docs-"));
 try{await fs.mkdir(join(dir,"context/plans"),{recursive:true});await fs.writeFile(join(dir,"context/plans/plan.md"),"Plan");
 await fs.symlink(join(dir,"context"),join(dir,".hive"));await fs.symlink(join(dir,"context/plans"),join(dir,"context/plans/loop"));
 assert.deepEqual(await review.recentDocuments(dir),[await fs.realpath(join(dir,"context/plans/plan.md"))]);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test("failed or dismissed reviews never send repair instructions",async()=>{
 for(const result of [{code:1,stderr:"startup failed",stdout:"{}"},{code:0,stderr:"",stdout:'{"decision":"dismissed"}'}]){
  const pi=api();(pi as any).exec=async()=>result;review.default(pi);
  await pi.commands.get("review:code").handler("",{cwd:process.cwd(),ui:{notify:()=>{},setStatus:()=>{}}});await settle();assert.equal(pi.sent.length,0);
 }
});
test("Plannotator receives argv safely and cancellation discards late feedback",async()=>{
 const pi=api();let finish:any,argv:any;
 (pi as any).exec=(_command:string,args:string[])=>{argv=args;return new Promise(resolve=>finish=resolve)};review.default(pi);
 const ctx={cwd:process.cwd(),isIdle:()=>true,ui:{notify:()=>{},setStatus:()=>{}}};
 await pi.commands.get("review:code").handler("https://github.com/acme/app/pull/42",ctx);
 assert.deepEqual(argv,["review","https://github.com/acme/app/pull/42","--json"]);
 await pi.commands.get("review:cancel").handler("",ctx);
 finish({code:0,stdout:'{"decision":"annotated","message":"Fix"}',stderr:""});await settle();assert.equal(pi.sent.length,0);
});

test("single-select question options navigate with Tab and Shift-Tab",async()=>{
 for(const keys of [["\t","\r"],["\t","\x1b[Z","\t","\r"]]){
  const pi=api();questions.default(pi);let component:any;
  const ctx={hasUI:true,mode:"tui",ui:{custom:(factory:any)=>new Promise(resolve=>{
   component=factory({requestRender:()=>{}},{fg:(_color:string,text:string)=>text,bold:(text:string)=>text},undefined,resolve);
  })}};
  const result=pi.tools[0].execute("id",{questions:[question]},undefined,undefined,ctx);
  assert.match(component.render(100).join("\n"),/Shift\+Tab/);
  for(const key of keys)component.handleInput(key);
  assert.equal((await result).details.answers[0].answer,"Fix");
 }
});
test("multi-select Tab navigation preserves selected options and custom text",async()=>{
 const pi=api();questions.default(pi);let component:any;
 const result=pi.tools[0].execute("id",{questions:[{...question,multiSelect:true}]},undefined,undefined,{hasUI:true,mode:"tui",ui:{custom:(factory:any)=>new Promise(resolve=>{
  component=factory({requestRender:()=>{}},{fg:(_color:string,text:string)=>text,bold:(text:string)=>text},undefined,resolve);
 })}});
 for(const key of ["\t","\r","\x1b[Z","\r","\t","\t","X","\t","\r"])component.handleInput(key);
 const answer=(await result).details.answers[0];
 assert.deepEqual(answer.selected,["Fix","Watch","X"]);
});
