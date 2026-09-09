import { PrismaClient, Category, Role, SkillStatus } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
const challenges = [
  ['web-101','Parameter Drift','WEB','EASY',100,'Inspect how a trusted parameter is transported.','flag{parameter_observer}'], ['web-102','Cookie Crumbs','WEB','EASY',120,'Understand signed session cookies.','flag{cookie_context_matters}'], ['web-201','Query Lab','WEB','MEDIUM',220,'A deliberately isolated SQL injection lesson.','flag{prepared_statements_win}'], ['web-301','Upload Gate','WEB','HARD',300,'Review file validation logic.','flag{validate_then_store}'],
  ['crypto-101','Encoding Relay','CRYPTO','EASY',100,'Recognise common encodings.','flag{hex_then_base64}'], ['crypto-201','Small Exponent','CRYPTO','MEDIUM',220,'Explore RSA mathematics safely.','flag{rsa_needs_padding}'], ['crypto-301','Padding Signals','CRYPTO','HARD',320,'Study padding-oracle mitigations.','flag{constant_time_errors}'],
  ['forensics-101','Pixel Trail','FORENSICS','EASY',120,'Find metadata in a training image.','flag{metadata_tells_stories}'], ['forensics-201','Log Lantern','FORENSICS','MEDIUM',200,'Trace an incident from logs.','flag{logs_are_evidence}'],
  ['network-101','Packet Postcard','NETWORK','EASY',100,'Read a compact packet capture.','flag{dns_is_not_private}'], ['network-201','TLS Trace','NETWORK','MEDIUM',210,'Identify secure handshake properties.','flag{verify_the_certificate}'],
  ['reverse-101','String Theory','REVERSE','EASY',150,'Find useful strings in a sample.','flag{strings_before_debugger}'], ['reverse-201','Control Flow','REVERSE','MEDIUM',240,'Map a harmless binary control flow.','flag{branches_reveal_logic}'],
  ['pwn-101','Stack Story','PWN','MEDIUM',250,'Learn why bounds checks matter.','flag{bounds_are_security}'], ['pwn-201','Format First','PWN','HARD',340,'Understand format-string defenses.','flag{format_with_care}'],
  ['misc-101','Open Source Clues','MISC','EASY',80,'Practice evidence-led research.','flag{verify_before_trust}'], ['misc-201','Protocol Puzzle','MISC','MEDIUM',160,'Read a custom training protocol.','flag{specification_is_key}'],
  ['web-401','SSRF Guardrails','WEB','HARD',360,'Build a safe outbound request policy.','flag{allowlists_stop_ssrf}'], ['crypto-401','Hash Horizon','CRYPTO','HARD',350,'Compare password storage approaches.','flag{argon2_for_passwords}'], ['network-301','Firewall Path','NETWORK','HARD',300,'Model segmented network traffic.','flag{segment_to_contain}']
] as const;
async function main() {
  const passwordHash = await argon2.hash('CyberQuest123!');
  for (const [username, email, role] of [['admin','admin@cyberquest.local',Role.ADMIN],['demo','demo@cyberquest.local',Role.USER]] as const) {
    await prisma.user.upsert({ where:{email}, update:{}, create:{username,email,role,passwordHash,score: username==='demo'?450:0,xp:500,level:3} });
  }
  const skills = [['http','HTTP','Web Security'],['sql-injection','SQL Injection','Web Security'],['crypto-basics','Cryptography','Crypto'],['packet-analysis','Packet Analysis','Network'],['reverse-basics','Reverse Engineering','Reverse'],['memory-safety','Memory Safety','Pwn'],['log-analysis','Log Analysis','Forensics'],['recon','Reconnaissance','Pentest']];
  for (let i=0;i<skills.length;i++) await prisma.skill.upsert({where:{slug:skills[i][0]},update:{},create:{slug:skills[i][0],name:skills[i][1],category:skills[i][2],description:`Foundational ${skills[i][1]} competency.`,x:i*120,y:(i%2)*90}});
  const skillRows=await prisma.skill.findMany();
  for (const c of challenges) { const [slug,title,category,difficulty,points,description,flag]=c; await prisma.challenge.upsert({where:{slug},update:{},create:{slug,title,category:category as Category,difficulty,points,description,flagHash:await argon2.hash(flag)}}); }
  const allChallenges=await prisma.challenge.findMany();
  for (const c of allChallenges) { const skill=skillRows.find(s=>s.category.toUpperCase().startsWith(c.category==='WEB'?'WEB':c.category==='CRYPTO'?'CRYPTO':c.category==='NETWORK'?'NETWORK':c.category==='REVERSE'?'REVERSE':c.category==='PWN'?'PWN':c.category==='FORENSICS'?'FORENSICS':'PENTEST')) ?? skillRows[0]; await prisma.challengeSkill.upsert({where:{challengeId_skillId:{challengeId:c.id,skillId:skill.id}},update:{},create:{challengeId:c.id,skillId:skill.id,xpReward:Math.round(c.points*.8)}}); }
  for (const course of [['Web Security Foundations','web-security-foundations','HTTP, cookies and browser trust boundaries.','BEGINNER','3h','Web'],['Network Defense Basics','network-defense-basics','Learn traffic analysis and segmentation.','BEGINNER','2h','Network'],['CTF Methodology','ctf-methodology','A repeatable, ethical problem-solving workflow.','INTERMEDIATE','4h','Pentest']]) await prisma.course.upsert({where:{slug:course[1]},update:{},create:{title:course[0],slug:course[1],description:course[2],difficulty:course[3],duration:course[4],category:course[5]}});
  const demo=await prisma.user.findUniqueOrThrow({where:{email:'demo@cyberquest.local'}}); for(const skill of skillRows.slice(0,3)) await prisma.userSkill.upsert({where:{userId_skillId:{userId:demo.id,skillId:skill.id}},update:{},create:{userId:demo.id,skillId:skill.id,xp:120,level:2,status:SkillStatus.LEARNING}});
}
main().finally(()=>prisma.$disconnect());
