import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const project = await prisma.project.upsert({
    where: { number: "PRJ-2026-014" },
    update: {},
    create: { name: "Riverside Quarter — Stage 2", number: "PRJ-2026-014" },
  });

  const demoUsers = [
    {
      email: "super@example.com",
      name: "Jamie Marsh (Superintendent — dev demo)",
      role: "SUPERINTENDENT" as const,
      organization: "Spiire",
    },
    {
      email: "contractor@example.com",
      name: "Priya Osei (Contractor — dev demo)",
      role: "CONTRACTOR" as const,
      organization: "ABC Concreting Pty Ltd",
    },
    {
      email: "client@example.com",
      name: "Morgan Lee (Client — dev demo)",
      role: "CLIENT" as const,
      organization: "Village Building Company",
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name },
    });
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      update: { role: u.role, organization: u.organization },
      create: {
        projectId: project.id,
        userId: user.id,
        role: u.role,
        organization: u.organization,
      },
    });
  }

  console.log(`Seeded project ${project.number} with 3 demo users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
