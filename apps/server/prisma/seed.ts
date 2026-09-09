import { Category, PrismaClient, Role, SkillStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * The production seed never contains a usable flag. Each value below is an
 * Argon2id verification hash generated from a private authoring source.
 */
const challenges = [
  ['web-101', 'Parameter Drift', 'WEB', 'EASY', 100, 'Inspect how a trusted parameter is transported.', '$argon2id$v=19$m=65536,t=3,p=4$Apn5M0DUdOWq05Sp+F/WMw$wWhwBk8vr0DExFgRocKl0Qq5keNi1yKuhxznldrUiRI'],
  ['web-102', 'Cookie Crumbs', 'WEB', 'EASY', 120, 'Understand signed session cookies.', '$argon2id$v=19$m=65536,t=3,p=4$hKfAqoohdQ8H6TX+oEueBw$mZk+K8wqqt8PQoprz3oyJ+IYUwfadydQBpPYQSb9byc'],
  ['web-201', 'Query Lab', 'WEB', 'MEDIUM', 220, 'A deliberately isolated SQL injection lesson.', '$argon2id$v=19$m=65536,t=3,p=4$Vim5QqPwn+WP53giDEDitQ$9zj8WJf8vPREzDjb82Y9CjQsg+vQ+tNHoHxqYvfm7Nw'],
  ['web-301', 'Upload Gate', 'WEB', 'HARD', 300, 'Review file validation logic.', '$argon2id$v=19$m=65536,t=3,p=4$AKfqQdZpyvnxqoacBoOhug$8cTWpYoHqFmpayrU2OIXaRHfrHDnuAAZF85is1urvPw'],
  ['crypto-101', 'Encoding Relay', 'CRYPTO', 'EASY', 100, 'Recognise common encodings.', '$argon2id$v=19$m=65536,t=3,p=4$r9VsjjVcUlZP0YyiHArmEw$EmuBL0xGq3zIwqdBxVI4S/m4XUM2v0VikCsdSsJfzJs'],
  ['crypto-201', 'Small Exponent', 'CRYPTO', 'MEDIUM', 220, 'Explore RSA mathematics safely.', '$argon2id$v=19$m=65536,t=3,p=4$YOzYbqS8v4uBYvSMiGmG2w$wl+qyi/j/vgZyVsrnyQ01obi7uo1Ye2ASFi2TXiFdNg'],
  ['crypto-301', 'Padding Signals', 'CRYPTO', 'HARD', 320, 'Study padding-oracle mitigations.', '$argon2id$v=19$m=65536,t=3,p=4$Com31PgOpZkbeSmmLuDs0Q$enO6FPK7NEWtfsYPoKL+OrzZA3BuTjSLl4HCblgKTfc'],
  ['forensics-101', 'Pixel Trail', 'FORENSICS', 'EASY', 120, 'Find metadata in a training image.', '$argon2id$v=19$m=65536,t=3,p=4$yqM4bn9HD6UlV4VwSu+GTw$XrgO4yW9HUB1eQ7rsD7HWbp/ZT4fl6Reesj1UwerM4I'],
  ['forensics-201', 'Log Lantern', 'FORENSICS', 'MEDIUM', 200, 'Trace an incident from logs.', '$argon2id$v=19$m=65536,t=3,p=4$Y+6vCA12Uak+fG3UKjmVKw$pLHUUvPNsB7o/txnhllxEdCDGIfCCFWrb4lg597pX8w'],
  ['network-101', 'Packet Postcard', 'NETWORK', 'EASY', 100, 'Read a compact packet capture.', '$argon2id$v=19$m=65536,t=3,p=4$ihy4cbXNa9m947PxKD/grw$qqqrFnUkWX7mvowyOCfdRVm2g1kfISLPBAwCty1N4tA'],
  ['network-201', 'TLS Trace', 'NETWORK', 'MEDIUM', 210, 'Identify secure handshake properties.', '$argon2id$v=19$m=65536,t=3,p=4$akJhn9OedkC+Mfg0ZNWF8w$yKX3awvA7L32bFh3+UB9QpK/yJYEgaarjZr7KJtDJuk'],
  ['reverse-101', 'String Theory', 'REVERSE', 'EASY', 150, 'Find useful strings in a sample.', '$argon2id$v=19$m=65536,t=3,p=4$fiOlo2zmITFHmdDq7tUFtw$oW+n2jD4SnjVYYWoGfbQzbG5htr1X2btg6EPZD8HD9s'],
  ['reverse-201', 'Control Flow', 'REVERSE', 'MEDIUM', 240, 'Map a harmless binary control flow.', '$argon2id$v=19$m=65536,t=3,p=4$BUkg7mxJjXd5j+tfxJX4PA$f42JZm5mRn2i7WwqSBrCI46DLOzioS3vnGORCfznSt8'],
  ['pwn-101', 'Stack Story', 'PWN', 'MEDIUM', 250, 'Learn why bounds checks matter.', '$argon2id$v=19$m=65536,t=3,p=4$o3LL2Ds/EJcpZr2dL9OT+A$jLwcFfhuWT9ou/aTI9FqQpHahEbzOXdr0ptkcnNpZH0'],
  ['pwn-201', 'Format First', 'PWN', 'HARD', 340, 'Understand format-string defenses.', '$argon2id$v=19$m=65536,t=3,p=4$vBmwUGltWKWrnSleTVtvAQ$7brc4ucG5UEkfQ/UIx9wmjUFtPzIN8hJCqy9rpOPh38'],
  ['misc-101', 'Open Source Clues', 'MISC', 'EASY', 80, 'Practice evidence-led research.', '$argon2id$v=19$m=65536,t=3,p=4$KozuepCLCWRNlz1nWq4JzA$PCRZ9ixParko3jTiI4VMBXZjjMIwaHESgnf+G9OWcJM'],
  ['misc-201', 'Protocol Puzzle', 'MISC', 'MEDIUM', 160, 'Read a custom training protocol.', '$argon2id$v=19$m=65536,t=3,p=4$faQLN+fPIwGLj0XNO5V3sw$pI8kNkjB49Is8berRAYRixihAVhNYvIPjj16Z/uvxAg'],
  ['web-401', 'SSRF Guardrails', 'WEB', 'HARD', 360, 'Build a safe outbound request policy.', '$argon2id$v=19$m=65536,t=3,p=4$/ha81y1oSnpPDOvWs8GbTQ$EisznpIITUBmt0qnciPo8VgXOTnfJ5qR5wWmv0wWyeE'],
  ['crypto-401', 'Hash Horizon', 'CRYPTO', 'HARD', 350, 'Compare password storage approaches.', '$argon2id$v=19$m=65536,t=3,p=4$ZaiRTUNo3hcj+wAuolW2iQ$NvUOt579VqR7XLT8EcZ7o6wX02tbcJyPJT1YPcsUeCw'],
  ['network-301', 'Firewall Path', 'NETWORK', 'HARD', 300, 'Model segmented network traffic.', '$argon2id$v=19$m=65536,t=3,p=4$J1ONSoYd749cTmElWReUdg$kMq+XacekelCUiF99UEOu7ysgzQO9J4KrKfT6Tj52fg'],
] as const;

const skills = [
  ['http', 'HTTP', 'Web Security'],
  ['sql-injection', 'SQL Injection', 'Web Security'],
  ['crypto-basics', 'Cryptography', 'Crypto'],
  ['packet-analysis', 'Packet Analysis', 'Network'],
  ['reverse-basics', 'Reverse Engineering', 'Reverse'],
  ['memory-safety', 'Memory Safety', 'Pwn'],
  ['log-analysis', 'Log Analysis', 'Forensics'],
  ['recon', 'Reconnaissance', 'Pentest'],
] as const;

function skillCategoryFor(category: Category) {
  return category === 'MISC' ? 'PENTEST' : category;
}

async function main() {
  const passwordHash = await argon2.hash('CyberQuest123!');

  for (const [username, email, role] of [
    ['admin', 'admin@cyberquest.local', Role.ADMIN],
    ['demo', 'demo@cyberquest.local', Role.USER],
  ] as const) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { username, email, role, passwordHash, score: username === 'demo' ? 450 : 0, xp: 500, level: 3 },
    });
  }

  for (let index = 0; index < skills.length; index += 1) {
    const [slug, name, category] = skills[index];
    await prisma.skill.upsert({
      where: { slug },
      update: {},
      create: { slug, name, category, description: `Foundational ${name} competency.`, x: index * 120, y: (index % 2) * 90 },
    });
  }

  for (const [slug, title, category, difficulty, points, description, flagHash] of challenges) {
    await prisma.challenge.upsert({
      where: { slug },
      update: { title, category: category as Category, difficulty, points, description, flagHash },
      create: { slug, title, category: category as Category, difficulty, points, description, flagHash },
    });
  }

  const [skillRows, challengeRows] = await Promise.all([prisma.skill.findMany(), prisma.challenge.findMany()]);
  for (const challenge of challengeRows) {
    const skill = skillRows.find((item) => item.category.toUpperCase().startsWith(skillCategoryFor(challenge.category))) ?? skillRows[0];
    await prisma.challengeSkill.upsert({
      where: { challengeId_skillId: { challengeId: challenge.id, skillId: skill.id } },
      update: { xpReward: Math.round(challenge.points * 0.8) },
      create: { challengeId: challenge.id, skillId: skill.id, xpReward: Math.round(challenge.points * 0.8) },
    });
  }

  for (const [title, slug, description, difficulty, duration, category] of [
    ['Web Security Foundations', 'web-security-foundations', 'HTTP, cookies and browser trust boundaries.', 'BEGINNER', '3h', 'Web'],
    ['Network Defense Basics', 'network-defense-basics', 'Learn traffic analysis and segmentation.', 'BEGINNER', '2h', 'Network'],
    ['CTF Methodology', 'ctf-methodology', 'A repeatable, ethical problem-solving workflow.', 'INTERMEDIATE', '4h', 'Pentest'],
  ] as const) {
    await prisma.course.upsert({
      where: { slug },
      update: { title, description, difficulty, duration, category },
      create: { title, slug, description, difficulty, duration, category },
    });
  }

  const demo = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@cyberquest.local' } });
  for (const skill of skillRows.slice(0, 3)) {
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: demo.id, skillId: skill.id } },
      update: {},
      create: { userId: demo.id, skillId: skill.id, xp: 120, level: 2, status: SkillStatus.LEARNING },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
