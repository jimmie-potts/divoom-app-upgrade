// `npm run verify -- <operation>`: disposable Pixoo simulator runs through the
// shared app verification core. See docs/development.md#simulator-verification-runs.
// The plug-in is TypeScript run by Node's type stripping and seeds with
// node:sqlite, so check the Node line before importing it.
const [major,minor]=process.versions.node.split('.').map(Number);
if(major!==24||minor<5){
 console.log(JSON.stringify({operation:process.argv[2]??'help',ok:false,error:'node-version',detail:`Node ${process.versions.node} cannot run the Pixoo adapter; use Node 24.5 or later in the 24.x line (fnm exec --using=.nvmrc -- npm run verify -- ...)`}));
 process.exit(3);
}
const {runCli}=await import('@jimmie-potts/app-verify');
const {default:plugin}=await import('./verify/plugin.ts');
process.exitCode=await runCli(plugin,process.argv.slice(2));
