// 未配置时跟随当前访问主机：127.0.0.1、localhost 和局域网 IP 都能使用同一套本地服务。
const base=import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3000/api`;
export async function api<T>(path:string, options:RequestInit={}) :Promise<T>{
  const token=sessionStorage.getItem('cq_token') || localStorage.getItem('cq_token');
  const res=await fetch(base+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(options.headers||{})}});
  const data=await res.json().catch(()=>({message:'服务返回了无法解析的响应。'}));
  if(!res.ok)throw new Error(data.message||'Request failed');
  return data as T;
}
