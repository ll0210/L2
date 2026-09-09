const base = process.env.CYBERQUEST_API ?? 'http://localhost:3000/api';
const login = await fetch(`${base}/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({email:'demo@cyberquest.local',password:'CyberQuest123!'}) });
if (!login.ok) throw new Error(`Login failed: ${await login.text()}`);
const { accessToken } = await login.json();
const headers={authorization:`Bearer ${accessToken}`,'content-type':'application/json'};
const challenges = await (await fetch(`${base}/challenges`,{headers})).json();
if (!challenges.some(c=>c.slug==='web-101')) throw new Error('Seed challenge missing');
const skills=await (await fetch(`${base}/users/me/skills`,{headers})).json();
console.log(`Verified demo login, ${challenges.length} seeded challenges and ${skills.length} skill records.`);
