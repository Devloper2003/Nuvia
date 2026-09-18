import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const u = await p.user.findUnique({ where: { email: 'riya.qa@test.com' } })
  if (!u) { console.log('riya.qa not found'); return }
  await p.user.delete({ where: { email: 'riya.qa@test.com' } })
  console.log('Deleted riya.qa + cascade; total users:', await p.user.count())
}
main().finally(() => p.$disconnect())
