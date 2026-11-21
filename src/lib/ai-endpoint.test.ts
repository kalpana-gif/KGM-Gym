import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import analyze from '../../netlify/functions/analyze-food';
import { smallBody } from '../../netlify/lib/shared';
const env={...process.env};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const request=(body:unknown)=>new Request('https://app.example/api/analyze-food',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-token'},body:JSON.stringify(body)});
beforeEach(()=>{
  process.env.SUPABASE_URL='https://project.example';
  process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY='private-test-placeholder';
  process.env.GEMINI_API_KEY='ai-test-placeholder';
  process.env.AI_MODEL='configured-test-model';
});
afterEach(()=>{vi.restoreAllMocks();for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);});
function mockProvider(provider:Response,allowed=true) {
  return vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(url.includes('/auth/v1/user'))return response({id:'e6d38438-6e17-4585-a69c-d187ec0cf9e3',aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-11-21T00:00:00Z'});
    if(url.includes('/rpc/consume_ai_quota'))return response(allowed);
    if(url.includes('generativelanguage.googleapis.com'))return provider;
    throw new Error('Unexpected request');
  });
}
describe('authenticated optional AI endpoint',()=>{
  it('rejects missing authentication and consent without calling the provider',async()=>{
    const fetch=mockProvider(response({}));
    const noAuth=new Request('https://app.example/api/analyze-food',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    expect((await analyze(noAuth)).status).toBe(401);
    expect((await analyze(request({description:'rice',consent:false}))).status).toBe(400);
    expect(fetch.mock.calls.some(([u])=>String(u).includes('generativelanguage'))).toBe(false);
  });
  it('returns validated suggestions without writing a meal to Supabase',async()=>{
    const estimate={foods:[{name:'rice',grams:150,kcalMin:170,kcalMax:230,assumptions:'Cooked rice; portion uncertain.'}],uncertainty:'Oil and scale cannot be confirmed.'};
    const fetch=mockProvider(response({candidates:[{content:{parts:[{text:JSON.stringify(estimate)}]}}]}));
    const result=await analyze(request({description:'rice and curry',consent:true}));
    expect(result.status).toBe(200);expect(await result.json()).toEqual(estimate);
    expect(fetch.mock.calls.every(([u])=>!String(u).includes('meal_logs'))).toBe(true);
  });
  it('handles missing keys, provider exhaustion and application quota exhaustion',async()=>{
    mockProvider(response({},429));
    expect((await analyze(request({description:'rice',consent:true}))).status).toBe(429);
    process.env.GEMINI_API_KEY='';
    expect((await analyze(request({description:'rice',consent:true}))).status).toBe(503);
    process.env.GEMINI_API_KEY='ai-test-placeholder';vi.restoreAllMocks();mockProvider(response({}),false);
    expect((await analyze(request({description:'rice',consent:true}))).status).toBe(429);
  });
  it('rejects malformed image bytes and invalid provider ranges',async()=>{
    mockProvider(response({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'rice',grams:150,kcalMin:300,kcalMax:100,assumptions:''}],uncertainty:''})}]}}]}));
    expect((await analyze(request({consent:true,mime:'image/jpeg',base64:Buffer.from('not an image').toString('base64')}))).status).toBe(400);
    expect((await analyze(request({description:'rice',consent:true}))).status).toBe(502);
  });
  it('limits body size even without trusting content-length',async()=>{
    const req=new Request('https://app.example/api/analyze-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(2000)})});
    await expect(smallBody(req,100)).rejects.toThrow(/too large/);
  });
});
