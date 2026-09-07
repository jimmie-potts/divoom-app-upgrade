import {ApiError} from './security.js';
export function parse<T>(schema:{safeParse:(value:unknown)=>{success:boolean;data?:T}},value:unknown):T {
 const result=schema.safeParse(value);if(!result.success)throw new ApiError('invalid-input');return result.data!;
}
