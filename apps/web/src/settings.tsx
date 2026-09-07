import {useEffect,useRef,useState} from 'react';
import {deviceConfiguration} from '@pixoo/core';
import {request,explain} from './api';
import type {Controller,Device} from './controller';
export function Settings({controller}:{controller:Controller}){
 const device=controller.runtime?.device??null;
 const dirty=useRef(false);
 const [ip,setIp]=useState(''),[model,setModel]=useState(''),[firmware,setFirmware]=useState(''),[profile,setProfile]=useState('simulator-v1');
 const [brightness,setBrightness]=useState(50),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){await controller.refresh(true);}
 useEffect(()=>{if(device&&!dirty.current){setIp(device.configuration?.ip??'');setModel(device.configuration?.model??'');setFirmware(device.configuration?.firmware??'');setProfile(device.configuration?.profile??'simulator-v1');}},[device]);
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(explain(e));}finally{setBusy(false);}}
 const disabled=busy||controller.busy||!controller.connected||!!controller.pending;
 const physical=device?.mode==='device',availability=controller.sample?.value.player.availability??device?.availability??'unknown';
 return <section aria-label="Device settings"><p className="eyebrow">One local display</p><h2>Settings</h2><p className="notice">{physical?'Device mode is active. Saving settings applies to the next backend start.':device?'Simulator remains active. Saving a device address does not connect to hardware.':'Loading active device settings…'}</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p aria-live="polite">{notice}</p>}
 <div className="editor-layout"><form className="panel" onSubmit={e=>{e.preventDefault();void run(async()=>{const parsed=deviceConfiguration.safeParse({ip,profile,...(model.trim()?{model:model.trim()}:{}),...(firmware.trim()?{firmware:firmware.trim()}:{})});if(!parsed.success){setError('Enter a canonical private IPv4 address and valid profile/observations.');return;}const saved=await request<Device>('/device','PUT',parsed.data);dirty.current=false;await load();setNotice(saved.mode==='simulator'?'Configuration saved. Simulator remains active.':saved.restartRequired?'Configuration saved. Restart the backend to apply it.':'Configuration saved. It matches the active settings.');});}}>
 <label>Device IP<input aria-label="Device IP" required placeholder="Enter your private IPv4 address" value={ip} disabled={!device||busy||!controller.connected} onChange={e=>{dirty.current=true;setIp(e.target.value);}}/></label>
 <label>Saved profile<select aria-label="Saved profile" value={profile} disabled={!device||busy||!controller.connected} onChange={e=>{dirty.current=true;setProfile(e.target.value);}}>{(device?.profiles??[]).map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
 <label>Model observation<input aria-label="Model observation" maxLength={120} value={model} disabled={!device||busy||!controller.connected} onChange={e=>{dirty.current=true;setModel(e.target.value);}}/></label>
 <label>Firmware observation<input aria-label="Firmware observation" maxLength={120} value={firmware} disabled={!device||busy||!controller.connected} onChange={e=>{dirty.current=true;setFirmware(e.target.value);}}/></label>
 <div className="actions"><button disabled={!device||busy||!controller.connected}>Save configuration</button><button type="button" className="quiet" disabled={busy} onClick={()=>void run(async()=>{dirty.current=false;await load();})}>Reload settings</button></div>
 <p className="muted">Active rendering profile: {device?.activeProfile.name??'Loading…'}. Leave unknown observations blank. Saved settings stay in private runtime storage.</p>
 {physical&&<><p>Active target: {device?.activeConfiguration?.ip??'unknown'}</p><p>Active limits: one or two 64×64 frames, exactly 500 ms per animation frame. Incompatible GIFs are rejected.</p></>}
 {device?.restartRequired&&<p className="notice">Restart required. The active target and profile stay unchanged until the backend restarts.</p>}</form>
 <div className="panel"><h3>{physical?'Device display controls':device?'Simulated display controls':'Display controls'}</h3><p>{physical?`Device transport: ${availability}. Visible output is unverified.`:'Physical connection: unverified'}</p>{!physical&&<p>Adapter availability: {availability}</p>}
 <button disabled={disabled||!device} onClick={()=>void run(async()=>{if(!await controller.probe())return;setNotice(physical?'Device probe completed. Transport responded; visible output is unverified.':'Simulator probe completed. Physical connectivity is unverified.');})}>{physical?'Probe device':'Probe simulator'}</button>
 <form onSubmit={e=>{e.preventDefault();controller.display({brightness});}}><label>Requested brightness (0–100)<input aria-label="Requested brightness" type="number" min={0} max={100} step={1} required value={brightness} onChange={e=>setBrightness(e.target.valueAsNumber)}/></label><button disabled={disabled}>Apply brightness</button></form>
 <div className="actions"><button disabled={disabled} onClick={()=>controller.display({screenOn:false})}>Screen off</button><button disabled={disabled} onClick={()=>controller.display({screenOn:true})}>Screen on</button></div><p className="muted">Screen off pauses advancement. Screen on does not resume. Brightness is a requested value, not observed telemetry.</p></div></div></section>;
}
