import {gifFixture} from './media-fixtures.js';
export const mutationHeaders={'x-pixoo-request':'1'};
export function multipart(bytes=gifFixture(1,1,[{width:1,height:1,pixels:[1]}]),name='fixture.gif',extra=false){
 const boundary='pixoo-test-boundary';
 return {headers:{...mutationHeaders,'content-type':`multipart/form-data; boundary=${boundary}`},payload:Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/gif\r\n\r\n`),bytes,
  Buffer.from(`\r\n${extra?`--${boundary}\r\nContent-Disposition: form-data; name="extra"\r\n\r\nbad\r\n`:''}--${boundary}--\r\n`),
 ])};
}
