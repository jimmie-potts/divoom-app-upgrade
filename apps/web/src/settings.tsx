import {useEffect,useState} from 'react';
import {deviceConfiguration,type DeviceConfiguration} from '@pixoo/core';
import {request,explain,type Rendition} from './api';
import type {Controller} from './controller';
interface Device {configuration:DeviceConfiguration|null;activeProfile:Rendition['profile'];profiles:Rendition['profile'][]}
export function Settings({controller}:{controller:Controller}){
 const [device,setDevice]=useState<Device|null>(null),[ip,setIp]=useState(''),[model,setModel]=useState(''),[firmware,setFirmware]=useState(''),[profile,setProfile]=useState('simulator-v1');
 const [brightness,setBrightness]=useState(50),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function load(){const d=await request<Device>('/device');setDevice(d);setIp(d.configuration?.ip??'');setModel(d.configuration?.model??'');setFirmware(d.configuration?.firmware??'');setProfile(d.configuration?.profile??'simulator-v1');}
 useEffect(()=>{void load().catch(e=>setError(explain(e)));},[]);
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();}catch(e){setError(explain(e));}finally{setBusy(false);}}
 const disabled=busy||controller.busy||!controller.connected||!!controller.pending;
 return <section aria-label="Device settings"><p className="eyebrow">One local display</p><h2>Settings</h2><p className="notice">Simulator remains active. Saving a device address does not connect to hardware.</p>
 {error&&<p role="alert">{error}</p>}{notice&&<p aria-live="polite">{notice}</p>}
 <div className="editor-layout"><form className="panel" onSubmit={e=>{e.preventDefault();void run(async()=>{const parsed=deviceConfiguration.safeParse({ip,profile,...(model.trim()?{model:model.trim()}:{}),...(firmware.trim()?{firmware:firmware.trim()}:{})});if(!parsed.success){setError('Enter a canonical private IPv4 address and valid profile/observations.');return;}setDevice(await request<Device>('/device','PUT',parsed.data));setNotice('Configuration saved. Simulator remains active.');});}}>
 <label>Device IP<input aria-label="Device IP" required placeholder="Enter your private IPv4 address" value={ip} disabled={!device||busy} onChange={e=>setIp(e.target.value)}/></label>
 <label>Saved profile<select aria-label="Saved profile" value={profile} disabled={!device||busy} onChange={e=>setProfile(e.target.value)}>{(device?.profiles??[]).map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
 <label>Model observation<input aria-label="Model observation" maxLength={120} value={model} disabled={!device||busy} onChange={e=>setModel(e.target.value)}/></label>
 <label>Firmware observation<input aria-label="Firmware observation" maxLength={120} value={firmware} disabled={!device||busy} onChange={e=>setFirmware(e.target.value)}/></label>
 <div className="actions"><button disabled={!device||busy}>Save configuration</button><button type="button" className="quiet" disabled={busy} onClick={()=>void run(load)}>Reload settings</button></div>
 <p className="muted">Active rendering profile: {device?.activeProfile.name??'Loading…'}. Leave unknown observations blank. Saved settings stay in private runtime storage.</p></form>
 <div className="panel"><h3>Simulated display controls</h3><p>Physical connection: unverified</p><p>Adapter availability: {controller.sample?.value.player.availability??'unknown'}</p>
 <button disabled={disabled} onClick={()=>void run(async()=>{await request('/device/probe','POST',{});setNotice('Simulator probe completed. Physical connectivity is unverified.');})}>Probe simulator</button>
 <form onSubmit={e=>{e.preventDefault();controller.display({brightness});}}><label>Requested brightness (0–100)<input aria-label="Requested brightness" type="number" min={0} max={100} step={1} required value={brightness} onChange={e=>setBrightness(e.target.valueAsNumber)}/></label><button disabled={disabled}>Apply brightness</button></form>
 <div className="actions"><button disabled={disabled} onClick={()=>controller.display({screenOn:false})}>Screen off</button><button disabled={disabled} onClick={()=>controller.display({screenOn:true})}>Screen on</button></div><p className="muted">Screen off pauses advancement. Screen on does not resume. Brightness is a requested value, not observed telemetry.</p></div></div></section>;
}
