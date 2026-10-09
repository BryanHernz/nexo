import request from 'supertest';
import {describe, expect, it, vi} from 'vitest';
import {PairingService} from '../src/tv/pairing';
import {firestoreStore} from '../src/tv/firestore';
import {fakeFirestore} from './fake-firestore';
import {createHttpApp} from '../src/http';
import {ReleaseService} from '../src/releases/service';
import {authorizedPortal} from '../src/releases/portal';
import {validateManifest} from '../src/releases/manifest';
import {readFileSync} from 'node:fs';

function fixture() {
  const db=fakeFirestore(()=>Date.now());
  db.rows.set('access/user',{active:true,apps:{contrapalabra:true,novaStar:false,cartonLleno:false}});
  const auth={verifyIdToken:vi.fn(async()=>({uid:'user',firebase:{sign_in_provider:'password'}})),
    createCustomToken:vi.fn(async()=> 'custom-test-only'),
    getUser:vi.fn(async()=>({uid:'user',disabled:false,providerData:[{providerId:'password'}]}))};
  const pairing=new PairingService({store:firestoreStore(db.db),auth,
    codeSecret:'qa-only-secret-not-a-production-credential',portalUrl:'https://nexo.test'});
  const releases=new ReleaseService({auth,access:async()=>db.rows.get('access/user'),
    storage:{read:async()=>null,metadata:async()=>null,sign:async()=>{throw Error('no artifacts');}}});
  const app=createHttpApp(pairing,{releases,portalTemplate:()=>readFileSync('portal-content.html','utf8')});
  return {...db,app,auth};
}
describe('Contrapalabra authorization registration',()=>{
  it('crea, aprueba y consume el pairing de Contrapalabra sólo una vez',async()=>{
    const f=fixture();const base='/api/v1/tv/pairings';
    const created=await request(f.app).post(base).send({app:'contrapalabra'});
    expect(created.status).toBe(201);const p=created.body;
    const approved=await request(f.app).post(`${base}/${p.pairingId}/approve`)
      .set('Authorization','Bearer test-only-id').send({code:p.code});
    expect(approved.status).toBe(200);
    const received=await request(f.app).get(`${base}/${p.pairingId}`).set('Authorization',`Pairing ${p.pollToken}`);
    expect(received.body).toEqual({status:'approved',customToken:'custom-test-only'});
    expect((await request(f.app).get(`${base}/${p.pairingId}`).set('Authorization',`Pairing ${p.pollToken}`)).status).toBe(409);
    expect(f.auth.createCustomToken).toHaveBeenCalledTimes(1);
  });
  it('cuenta con sólo Contrapalabra recibe sólo su HTML; otras apps/descargas denegadas',async()=>{
    const f=fixture();const portal=await request(f.app).get('/api/v1/portal').set('Authorization','Bearer test-only-id');
    expect(portal.status).toBe(200);expect(portal.body.apps).toEqual(['contrapalabra']);
    expect(portal.body.html).toContain('id="contrapalabra"');
    expect(portal.body.html).not.toContain('id="nova-star"');expect(portal.body.html).not.toContain('id="carton-lleno"');
    for(const app of ['novaStar','cartonLleno']){
      expect((await request(f.app).get(`/api/v1/releases/${app}/latest`).set('Authorization','Bearer test-only-id')).status).toBe(403);
    }
    expect((await request(f.app).get('/api/v1/releases/contrapalabra/latest').set('Authorization','Bearer test-only-id')).status).toBe(404);
  });
  it('sin active o sin permiso Contrapalabra no aprueba aunque tenga Nova',async()=>{
    for(const access of [{active:false,apps:{contrapalabra:true}},{active:true,apps:{novaStar:true}}]){
      const f=fixture();f.rows.set('access/user',access);
      const p=(await request(f.app).post('/api/v1/tv/pairings').send({app:'contrapalabra'})).body;
      expect((await request(f.app).post(`/api/v1/tv/pairings/${p.pairingId}/approve`)
        .set('Authorization','Bearer test-only-id').send({code:p.code})).status).toBe(403);
    }
  });
  it('el filtro servidor también elimina todos los bloques Contrapalabra no autorizados',()=>{
    const html=authorizedPortal(readFileSync('portal-content.html','utf8'),['novaStar']);
    expect(html).not.toContain('id="contrapalabra"');expect(html).not.toContain('href="#contrapalabra"');
  });
  it('el contrato de manifests reconoce Contrapalabra con artefactos privados',()=>{
    const app='contrapalabra',version='0.1.5';
    const assets=[['installer','windows','installer','standard','x64','exe'],['phone','android','package','phone','arm64-v8a','apk'],['tv','android','package','tv','armeabi-v7a','apk']]
      .map(([id,platform,purpose,variant,architecture,format])=>({id:`${app}-${version}-${id}`,platform,purpose,variant,architecture,format,
        versionCode:platform==='windows'?null:8,filename:`test-${id}.${format}`,size:100,sha256:'a'.repeat(64),generation:'1',
        downloadEndpoint:`/api/v1/releases/${app}/${version}/download/${app}-${version}-${id}`}));
    const m={schemaVersion:1,app,version,build:8,releasedAt:'2026-10-09T12:00:00.000Z',notes:'QA only',
      recommendations:{windows:`${app}-${version}-installer`,phone:`${app}-${version}-phone`,tv:`${app}-${version}-tv`},assets};
    expect(validateManifest(m,app,version).app).toBe(app);
  });
});
