import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const users = await p.user.findMany({ select: { id: true, email: true, name: true }, orderBy: { createdAt: 'asc' } })
  for (const u of users) {
    const cycles = await p.cycle.count({ where: { userId: u.id } })
    console.log(`${u.email} | ${u.name} | cycles:${cycles}`)
  }
}
main().finally(() => p.$disconnect())
